import { describe, expect, it } from 'vitest'
import { parseId } from '../src/run'

describe('parseId', () => {
  it('turns plain safe integers into numbers', () => {
    expect(parseId('0')).toBe(0)
    expect(parseId('42')).toBe(42)
    expect(parseId(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('keeps ids as strings when a number would change them', () => {
    expect(parseId('9007199254740993')).toBe('9007199254740993') // would round to ...992
    expect(parseId('007')).toBe('007')
    expect(parseId('1e3')).toBe('1e3')
    expect(parseId('-1')).toBe('-1')
    expect(parseId('a1b2-uuid')).toBe('a1b2-uuid')
  })
})
