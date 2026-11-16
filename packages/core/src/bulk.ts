import type { RbacAdapter, SubjectLinks } from './adapter'
import { RbacError } from './errors'
import { earliest, expiryMs, isActive } from './expiry'
import type { Rbac, RbacInternals, SubjectRbac } from './rbac'
import type { Id, Permission, RbacTypeConfig, Role, Subject, TeamId } from './types'

/** Options of {@link SubjectRbac.revokeAll}. */
export interface RevokeAllOptions {
  /** Also remove the roles and direct permissions of every other guard. Default: only the subject's guard. */
  allGuards?: boolean | undefined
  /**
   * Also remove them in every team, global scope included. Default: only the subject's team.
   * Needs the optional adapter method `getSubjectLinks` when teams are enabled. With teams disabled there is
   * only the global scope, so it changes nothing.
   */
  allTeams?: boolean | undefined
}

/** Options of {@link SubjectRbac.teams}. */
export interface SubjectTeamsOptions {
  /** Count the roles and direct permissions of every guard. Default: only the subject's guard. */
  allGuards?: boolean | undefined
}

const idKey = (id: Id | null): string => (id === null ? '\u0000null' : String(id))
const subjectKey = (subject: Subject): string => `${subject.type}\u0000${String(subject.id)}`

const missingMethod = (method: keyof RbacAdapter, caller: string): RbacError =>
  new RbacError(
    'ADAPTER_METHOD_MISSING',
    `${caller} needs the optional adapter method \`${method}()\`, which this adapter does not implement.`,
  )

const teamsNotEnabled = (caller: string): RbacError =>
  new RbacError('TEAMS_NOT_ENABLED', `${caller} needs teams, but they are not enabled. Use \`createRbac({ teams: true })\`.`)

function uniqueIds(ids: readonly Id[]): Id[] {
  const seen = new Map<string, Id>()
  for (const id of ids) if (!seen.has(idKey(id))) seen.set(idKey(id), id)
  return [...seen.values()]
}

function byId<V extends { id: Id }>(items: readonly V[]): Map<string, V> {
  return new Map(items.map((item) => [idKey(item.id), item]))
}

/** Groups items by guard, in first-seen order. */
function byGuard<V extends { guardName: string }>(items: readonly V[]): Map<string, V[]> {
  const out = new Map<string, V[]>()
  for (const item of items) {
    const list = out.get(item.guardName)
    if (list) list.push(item)
    else out.set(item.guardName, [item])
  }
  return out
}

interface TeamGroup {
  teamId: TeamId
  /** Every link's target, expired ones included (they are removed too). */
  roleIds: Id[]
  permissionIds: Id[]
  /** Targets of expired links, which events don't list: the subject no longer had them. */
  expiredRoleIds: Set<string>
  expiredPermissionIds: Set<string>
}

function groupByTeam(links: SubjectLinks, now: number): TeamGroup[] {
  const groups = new Map<string, TeamGroup>()
  const group = (teamId: TeamId): TeamGroup => {
    let g = groups.get(idKey(teamId))
    if (!g) {
      g = { teamId, roleIds: [], permissionIds: [], expiredRoleIds: new Set(), expiredPermissionIds: new Set() }
      groups.set(idKey(teamId), g)
    }
    return g
  }
  for (const link of links.roles) {
    const g = group(link.teamId)
    g.roleIds.push(link.roleId)
    if (!isActive(link.expiresAt, now)) g.expiredRoleIds.add(idKey(link.roleId))
  }
  for (const link of links.permissions) {
    const g = group(link.teamId)
    g.permissionIds.push(link.permissionId)
    if (!isActive(link.expiresAt, now)) g.expiredPermissionIds.add(idKey(link.permissionId))
  }
  return [...groups.values()]
}

/** Every link of the subject in one team, as a {@link TeamGroup} (with expiry on, from the expiry-aware reads). */
async function scopeGroup<T extends RbacTypeConfig>(
  rbac: Rbac<T>,
  core: RbacInternals<T>,
  subject: Subject,
  teamId: TeamId,
): Promise<TeamGroup> {
  const { adapter } = rbac
  const empty: TeamGroup = {
    teamId,
    roleIds: [],
    permissionIds: [],
    expiredRoleIds: new Set(),
    expiredPermissionIds: new Set(),
  }
  if (!core.expiry) {
    return {
      ...empty,
      roleIds: await adapter.getSubjectRoleIds(subject, teamId),
      permissionIds: await adapter.getSubjectPermissionIds(subject, teamId),
    }
  }
  if (!adapter.getSubjectRoleLinks) throw missingMethod('getSubjectRoleLinks', '`revokeAll()` with expiry')
  if (!adapter.getSubjectPermissionLinks) throw missingMethod('getSubjectPermissionLinks', '`revokeAll()` with expiry')
  const links: SubjectLinks = {
    roles: await adapter.getSubjectRoleLinks(subject, teamId),
    permissions: await adapter.getSubjectPermissionLinks(subject, teamId),
  }
  const [group] = groupByTeam(links, core.now())
  return group ? { ...group, teamId } : empty
}

async function emitDetached<T extends RbacTypeConfig>(
  core: RbacInternals<T>,
  subject: Subject,
  teamId: TeamId,
  roles: readonly Role[],
  permissions: readonly Permission[],
): Promise<void> {
  for (const [guardName, list] of byGuard(roles)) {
    await core.events.emit({ event: 'role.detached', subject, roles: list, guardName, teamId })
  }
  for (const [guardName, list] of byGuard(permissions)) {
    await core.events.emit({ event: 'permission.detached', target: 'subject', subject, permissions: list, guardName, teamId })
  }
}

/** @internal Implementation of `SubjectRbac.revokeAll()`. */
export async function revokeAll<T extends RbacTypeConfig>(
  rbac: Rbac<T>,
  core: RbacInternals<T>,
  scope: SubjectRbac<T, string>,
  options: RevokeAllOptions,
): Promise<void> {
  const { adapter } = rbac
  const { subject } = scope
  const allGuards = options.allGuards === true

  let groups: TeamGroup[]
  if (options.allTeams === true && rbac.teams) {
    if (!adapter.getSubjectLinks) throw missingMethod('getSubjectLinks', '`revokeAll({ allTeams: true })`')
    groups = groupByTeam(await adapter.getSubjectLinks(subject), core.now())
  } else {
    groups = [await scopeGroup(rbac, core, subject, scope.teamId)]
  }

  // The role & permission objects tell the guard of each link; with `allGuards` they are only needed for events.
  const needObjects = !allGuards || core.events.has('role.detached') || core.events.has('permission.detached')
  const guardName = allGuards ? undefined : scope.guardName
  const removed: { teamId: TeamId; roles: Role[]; permissions: Permission[] }[] = []

  for (const group of groups) {
    const roleIds = uniqueIds(group.roleIds)
    const permissionIds = uniqueIds(group.permissionIds)
    const roles = needObjects && roleIds.length > 0 ? await adapter.findRoles({ ids: roleIds, guardName }) : []
    const permissions =
      needObjects && permissionIds.length > 0 ? await adapter.findPermissions({ ids: permissionIds, guardName }) : []

    if (allGuards) {
      // `undefined` ids: every link of the team goes, including links to roles or permissions deleted meanwhile.
      if (roleIds.length > 0) await adapter.detachSubjectRoles(subject, undefined, group.teamId)
      if (permissionIds.length > 0) await adapter.detachSubjectPermissions(subject, undefined, group.teamId)
    } else {
      if (roles.length > 0) await adapter.detachSubjectRoles(subject, roles.map((r) => r.id), group.teamId)
      if (permissions.length > 0) {
        await adapter.detachSubjectPermissions(subject, permissions.map((p) => p.id), group.teamId)
      }
    }
    removed.push({
      teamId: group.teamId,
      roles: roles.filter((r) => !group.expiredRoleIds.has(idKey(r.id))),
      permissions: permissions.filter((p) => !group.expiredPermissionIds.has(idKey(p.id))),
    })
  }

  await rbac.forgetCachedPermissions()
  for (const { teamId, roles, permissions } of removed) await emitDetached(core, subject, teamId, roles, permissions)
}

/** @internal Implementation of `SubjectRbac.teams()`. */
export async function subjectTeams<T extends RbacTypeConfig>(
  rbac: Rbac<T>,
  core: RbacInternals<T>,
  scope: SubjectRbac<T, string>,
  options: SubjectTeamsOptions,
): Promise<Id[]> {
  if (!rbac.teams) throw teamsNotEnabled('`teams()`')
  const { adapter } = rbac
  const { subject } = scope
  const guardName = options.allGuards === true ? null : scope.guardName
  const key = `rbac:teams:${JSON.stringify([guardName, subject.type, String(subject.id)])}`

  const compute = async (): Promise<{ teams: Id[]; validUntil?: number }> => {
    if (!adapter.getSubjectLinks) throw missingMethod('getSubjectLinks', '`teams()`')
    const links = await adapter.getSubjectLinks(subject)
    const now = core.now()
    // Expired links don't make the subject a member (with expiry off, `expiresAt` is never set).
    let roles = links.roles.filter((l) => l.teamId !== null && isActive(l.expiresAt, now))
    let permissions = links.permissions.filter((l) => l.teamId !== null && isActive(l.expiresAt, now))

    if (guardName !== null) {
      const roleIds = uniqueIds(roles.map((l) => l.roleId))
      const permissionIds = uniqueIds(permissions.map((l) => l.permissionId))
      const keepRoles = byId(roleIds.length > 0 ? await adapter.findRoles({ ids: roleIds, guardName }) : [])
      const keepPermissions = byId(
        permissionIds.length > 0 ? await adapter.findPermissions({ ids: permissionIds, guardName }) : [],
      )
      roles = roles.filter((l) => keepRoles.has(idKey(l.roleId)))
      permissions = permissions.filter((l) => keepPermissions.has(idKey(l.permissionId)))
    }

    const teams = uniqueIds([...roles, ...permissions].map((l) => l.teamId as Id))
    const validUntil = earliest([...roles, ...permissions].map((l) => expiryMs(l.expiresAt)))
    return validUntil === undefined ? { teams } : { teams, validUntil }
  }

  if (!core.expiry) return core.remember(key, async () => (await compute()).teams)
  // With expiry, the entry carries its own end (another key, so a process without expiry never reads it).
  const entry = await core.remember(`${key}:expiry`, compute, (value) => value.validUntil)
  return entry.teams
}

/** @internal Implementation of `Rbac.deleteTeam()`. */
export async function deleteTeam<T extends RbacTypeConfig>(
  rbac: Rbac<T>,
  core: RbacInternals<T>,
  teamId: Id,
): Promise<void> {
  if (!rbac.teams) throw teamsNotEnabled('`deleteTeam()`')
  if (teamId === null || teamId === undefined || teamId === '') {
    // `null` is the global scope, and SQL adapters store it as `''`: refuse both rather than wipe global data.
    throw new TypeError('rbac.deleteTeam() needs a team id; null and empty strings are the global scope.')
  }
  const { adapter } = rbac
  if (!adapter.getTeamLinks) throw missingMethod('getTeamLinks', '`deleteTeam()`')

  const links = await adapter.getTeamLinks(teamId)
  const teamRoles = await adapter.findRoles({ teamIds: [teamId] })

  // Every subject with a link in the team, with the ids it holds there.
  // `active*` leave out expired links: they are removed too, but events only list what the subject still had.
  const subjects = new Map<
    string,
    { subject: Subject; roleIds: Id[]; permissionIds: Id[]; activeRoleIds: Id[]; activePermissionIds: Id[] }
  >()
  const entry = (subject: Subject) => {
    let e = subjects.get(subjectKey(subject))
    if (!e) {
      e = { subject, roleIds: [], permissionIds: [], activeRoleIds: [], activePermissionIds: [] }
      subjects.set(subjectKey(subject), e)
    }
    return e
  }
  const now = core.now()
  for (const link of links.roles) {
    const e = entry(link.subject)
    e.roleIds.push(link.roleId)
    if (isActive(link.expiresAt, now)) e.activeRoleIds.push(link.roleId)
  }
  for (const link of links.permissions) {
    const e = entry(link.subject)
    e.permissionIds.push(link.permissionId)
    if (isActive(link.expiresAt, now)) e.activePermissionIds.push(link.permissionId)
  }

  const track = core.events.has('role.detached') || core.events.has('permission.detached')
  const roleIds = uniqueIds(links.roles.map((l) => l.roleId))
  const permissionIds = uniqueIds(links.permissions.map((l) => l.permissionId))
  const roleById = byId(track && roleIds.length > 0 ? await adapter.findRoles({ ids: roleIds }) : [])
  const permissionById = byId(track && permissionIds.length > 0 ? await adapter.findPermissions({ ids: permissionIds }) : [])

  // Links first, then the team's roles: a failure midway leaves roles nobody holds, never holders of deleted roles.
  if (adapter.detachTeamLinks) {
    await adapter.detachTeamLinks(teamId)
  } else {
    for (const { subject, roleIds: held, permissionIds: direct } of subjects.values()) {
      if (held.length > 0) await adapter.detachSubjectRoles(subject, undefined, teamId)
      if (direct.length > 0) await adapter.detachSubjectPermissions(subject, undefined, teamId)
    }
  }
  for (const role of teamRoles) await adapter.deleteRole(role.id)
  await rbac.forgetCachedPermissions()

  if (track) {
    for (const { subject, activeRoleIds: held, activePermissionIds: direct } of subjects.values()) {
      const roles = uniqueIds(held).flatMap((id) => roleById.get(idKey(id)) ?? [])
      const permissions = uniqueIds(direct).flatMap((id) => permissionById.get(idKey(id)) ?? [])
      await emitDetached(core, subject, teamId, roles, permissions)
    }
  }
  for (const role of teamRoles) await core.events.emit({ event: 'role.deleted', role, teamId: role.teamId })
}
