import { describe, expect, it } from 'vitest'
import { InvalidWildcardPermission, parseWildcardPermission, wildcardImplies } from '../src'

describe('parseWildcardPermission', () => {
  it('splits parts and subparts', () => {
    expect(parseWildcardPermission('articles.edit,delete.own')).toEqual([['articles'], ['edit', 'delete'], ['own']])
  })

  it.each(['', '  ', 'articles.', '.edit', 'articles..edit', 'articles.edit,'])('rejects %j', (value) => {
    expect(() => parseWildcardPermission(value)).toThrow(InvalidWildcardPermission)
  })
})

describe('wildcardImplies', () => {
  it.each([
    ['*', 'articles.edit', true],
    ['articles.*', 'articles.edit', true],
    ['articles.*', 'articles.edit.own', true],
    ['articles.*', 'articles', true],
    ['articles', 'articles.edit', true],
    ['articles.edit', 'articles.edit', true],
    ['articles.edit,delete', 'articles.edit', true],
    ['articles.edit,delete', 'articles.edit,delete', true],
    ['articles.*.own', 'articles.edit.own', true],
    ['articles.edit,delete', 'articles.create', false],
    ['articles.edit', 'articles', false],
    ['articles.edit', 'articles.*', false],
    ['articles.*', 'posts.edit', false],
    ['articles.*.own', 'articles.edit.all', false],
  ])('%s implies %s → %s', (granted, required, expected) => {
    expect(wildcardImplies(granted, required)).toBe(expected)
  })
})
