/**
 * Property-based tests for the name parsers (permission names, wildcards, pipe-separated requirements).
 * The rule they protect: no input, however odd (blanks, pipes, dots, commas, stars, unicode lookalikes,
 * invisible characters), may turn a deny into an allow.
 *
 * A failing run prints a seed; rerun it with `fc.assert(..., { seed, path })` to reproduce.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  createRbac,
  InvalidWildcardPermission,
  MemoryAdapter,
  parseWildcardPermission,
  permissionRequirement,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  wildcardImplies,
} from '../src'

const RUNS = { numRuns: 300 }

// ----------------------------------------------------------------------------- arbitraries

/** Characters that mean something to a parser, plus lookalikes and characters `trim()` does or doesn't strip. */
const NASTY = fc.constantFrom(
  'a', 'b', 'A', 'é', 'é', // e + combining accent: looks like é, is not
  'а', // Cyrillic "а", looks like Latin "a"
  '.', ',', '*', '|', ':',
  ' ', '\t', '\n', ' ', ' ', // trimmed by String.prototype.trim
  '​', '﻿', // zero-width space (not trimmed), BOM (trimmed)
)

/** Any string, biased towards parser-relevant characters. */
const anyName = fc.oneof(fc.string({ unit: NASTY, maxLength: 12 }), fc.string({ maxLength: 12 }))

/**
 * A name close to one of `names`: the same name (padded, so it should match after trimming) or a
 * near miss that must NOT match (other case, lookalike or invisible character, one character more or less).
 */
function nearMiss(names: readonly string[]): fc.Arbitrary<string> {
  return fc.tuple(fc.constantFrom(...names), fc.nat()).chain(([name, at]) => {
    const i = name.length === 0 ? 0 : at % name.length
    return fc.constantFrom(
      name,
      ` ${name}\t`,
      name.toUpperCase(),
      name.toLowerCase(),
      name.slice(0, i) + '\u200b' + name.slice(i),
      name.replace(/a/g, '\u0430').replace(/e/g, 'e\u0301'),
      `${name}x`,
      name.slice(0, -1),
      `${name}|${name}`,
    )
  })
}

/** A small alphabet so generated permissions often overlap and imply each other. */
const subpart = fc.constantFrom('a', 'b', 'c', '*')
const part = fc.uniqueArray(subpart, { minLength: 1, maxLength: 3 }).map((s) => s.join(','))
/** A valid wildcard permission such as `a.b,c.*`. */
const permission = fc.array(part, { minLength: 1, maxLength: 4 }).map((p) => p.join('.'))
/** A valid permission without any `*`. */
const plainPermission = permission.filter((p) => !p.includes('*'))

/** Never throws: an invalid name implies nothing (this is how the engine treats it). */
function implies(granted: string, required: string): boolean {
  try {
    return wildcardImplies(granted, required)
  } catch (error) {
    if (error instanceof InvalidWildcardPermission) return false
    throw error
  }
}

const levels = (p: string): string[][] => parseWildcardPermission(p)

// ------------------------------------------------------------------------- wildcard parser

describe('wildcard permissions (property-based)', () => {
  it('every valid permission implies itself, and `*` implies every valid permission', () => {
    fc.assert(
      fc.property(permission, (p) => {
        expect(wildcardImplies(p, p)).toBe(true)
        expect(wildcardImplies('*', p)).toBe(true)
      }),
      RUNS,
    )
  })

  it('a grant without `*` covers exactly the permissions at or below it, matching the documented rules', () => {
    // Independent spec: `g` covers `r` when `r` has at least as many levels, and each of g's levels
    // lists every subpart r has there (r may not use `*` at those levels).
    const spec = (g: string, r: string): boolean => {
      const gl = levels(g)
      const rl = levels(r)
      if (rl.length < gl.length) return false
      return gl.every((subs, i) => !rl[i]!.includes('*') && rl[i]!.every((s) => subs.includes(s)))
    }
    fc.assert(
      fc.property(plainPermission, permission, (g, r) => {
        expect(wildcardImplies(g, r)).toBe(spec(g, r))
      }),
      { numRuns: 2000 },
    )
  })

  it('making a grant more specific (one more level) never widens it', () => {
    fc.assert(
      fc.property(permission, part, permission, (g, extra, r) => {
        if (implies(`${g}.${extra}`, r)) expect(implies(g, r)).toBe(true)
      }),
      { numRuns: 2000 },
    )
  })

  it('removing a subpart from a grant never widens it', () => {
    fc.assert(
      fc.property(permission, fc.nat(), permission, (g, pick, r) => {
        const gl = levels(g)
        const level = gl[pick % gl.length]!
        if (level.length < 2) return
        const narrowed = gl.map((subs) => (subs === level ? subs.slice(1) : subs).join(',')).join('.')
        if (implies(narrowed, r)) expect(implies(g, r)).toBe(true)
      }),
      { numRuns: 2000 },
    )
  })

  it('is transitive', () => {
    fc.assert(
      fc.property(permission, permission, permission, (a, b, c) => {
        if (implies(a, b) && implies(b, c)) expect(implies(a, c)).toBe(true)
      }),
      { numRuns: 3000 },
    )
  })

  it('rejects malformed names instead of guessing, on either side', () => {
    fc.assert(
      fc.property(anyName, permission, (raw, valid) => {
        let parsed: string[][] | undefined
        try {
          parsed = parseWildcardPermission(raw)
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidWildcardPermission)
          expect(() => wildcardImplies(raw, valid)).toThrow(InvalidWildcardPermission)
          expect(() => wildcardImplies(valid, raw)).toThrow(InvalidWildcardPermission)
          return
        }
        // Accepted names have no empty level or subpart and no surrounding whitespace in a subpart.
        for (const subs of parsed) for (const s of subs) expect(s).toBe(s.trim()), expect(s).not.toBe('')
      }),
      RUNS,
    )
  })
})

// ----------------------------------------------------------------------- engine, end to end

describe('permission and role checks (property-based)', () => {
  const user = { type: 'user', id: 1 }

  it('without wildcards, can() allows exactly the granted names (after trimming), for any input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .uniqueArray(anyName.filter((n) => n.trim() !== ''), { minLength: 1, maxLength: 4, selector: (n) => n.trim() })
          .chain((granted) => fc.tuple(fc.constant(granted), fc.oneof(anyName, nearMiss(granted)))),
        async ([granted, asked]) => {
          const rbac = createRbac({ adapter: new MemoryAdapter() })
          for (const name of granted) await rbac.createPermission(name)
          await rbac.for(user).givePermissionTo(granted)
          const allowed = new Set(granted.map((n) => n.trim()))
          // The asked name exists too (e.g. `Edit` next to `edit`) but is not granted, so only the
          // match itself, not the existence check, can tell them apart.
          if (asked.trim() !== '' && !allowed.has(asked.trim())) await rbac.createPermission(asked)

          const subject = rbac.for(user)
          expect(await subject.can(asked)).toBe(allowed.has(asked.trim()))
          expect(await subject.hasAnyPermission(asked)).toBe(allowed.has(asked.trim()))
          expect(await subject.cannot(asked)).toBe(!allowed.has(asked.trim()))
        },
      ),
      RUNS,
    )
  })

  it('with wildcards, can() only allows what a grant covers, and never throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .uniqueArray(permission, { minLength: 1, maxLength: 3 })
          .chain((granted) => fc.tuple(fc.constant(granted), fc.oneof(permission, anyName, nearMiss(granted)))),
        async ([granted, asked]) => {
          const rbac = createRbac({ adapter: new MemoryAdapter(), wildcard: true })
          for (const name of granted) await rbac.createPermission(name)
          await rbac.createRole('r')
          await rbac.role('r').givePermissionTo(granted)
          await rbac.for(user).assignRole('r')
          // The asked permission exists too when it is valid, but is not granted.
          if (!granted.includes(asked.trim())) await rbac.createPermission(asked).catch(() => undefined)

          const covered = granted.some((g) => implies(g, asked.trim()))
          expect(await rbac.for(user).can(asked)).toBe(covered)
        },
      ),
      RUNS,
    )
  })

  it('hasRole() matches role names exactly (after trimming): no lookalike or partial name passes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .uniqueArray(anyName.filter((n) => n.trim() !== ''), { minLength: 1, maxLength: 4, selector: (n) => n.trim() })
          .chain((roles) => fc.tuple(fc.constant(roles), fc.oneof(anyName, nearMiss(roles)))),
        async ([roles, asked]) => {
          const rbac = createRbac({ adapter: new MemoryAdapter() })
          for (const name of roles) await rbac.createRole(name)
          await rbac.for(user).assignRole(roles)
          const held = new Set(roles.map((n) => n.trim()))
          // The asked role exists too, held by someone else.
          if (asked.trim() !== '' && !held.has(asked.trim())) {
            await rbac.createRole(asked)
            await rbac.for({ type: 'user', id: 2 }).assignRole(asked)
          }
          expect(await rbac.for(user).hasRole(asked)).toBe(held.has(asked.trim()))
        },
      ),
      RUNS,
    )
  })
})

// --------------------------------------------------------------------- guard requirements

describe('guard requirements (property-based)', () => {
  const namesArg = fc.array(fc.oneof(anyName, fc.array(anyName, { maxLength: 3 })), { maxLength: 4 })
  const builders = [
    (names: (string | string[])[]) => permissionRequirement(names),
    (names: (string | string[])[]) => permissionRequirement(names, { any: true }),
    (names: (string | string[])[]) => roleRequirement(names),
    (names: (string | string[])[]) => roleRequirement(names, { all: true }),
    (names: (string | string[])[]) => roleOrPermissionRequirement(names),
  ]

  it('either throws a TypeError or yields non-empty groups of trimmed, pipe-free names', () => {
    fc.assert(
      fc.property(namesArg, fc.constantFrom(...builders), (names, build) => {
        let requirement
        try {
          requirement = build(names)
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError)
          return
        }
        expect(requirement.requirements.length).toBeGreaterThan(0)
        for (const group of requirement.requirements) {
          expect(group.length).toBeGreaterThan(0)
          for (const name of group) {
            expect(name).toBe(name.trim())
            expect(name).not.toBe('')
            expect(name).not.toContain('|')
          }
        }
      }),
      { numRuns: 1000 },
    )
  })

  it('fails closed: a subject with no roles or permissions never satisfies any requirement', async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter(), wildcard: true })
    await rbac.createPermission('*')
    await rbac.createRole('admin')
    await rbac.role('admin').givePermissionTo('*')
    await rbac.for({ type: 'user', id: 'someone-else' }).assignRole('admin')
    const nobody = rbac.for({ type: 'user', id: 'nobody' })

    await fc.assert(
      fc.asyncProperty(namesArg, fc.constantFrom(...builders), async (names, build) => {
        let requirement
        try {
          requirement = build(names)
        } catch {
          return
        }
        expect(await satisfiesRequirement(nobody, requirement)).toBe(false)
      }),
      RUNS,
    )
  })
})
