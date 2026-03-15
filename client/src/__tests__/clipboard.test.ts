import { describe, it, expect } from 'vitest'
import { parseTSV, formatTSV } from '../core/clipboard.ts'

describe('parseTSV', () => {
  it('parses single cell', () => {
    expect(parseTSV('hello')).toEqual([['hello']])
  })

  it('parses multiple columns', () => {
    expect(parseTSV('a\tb\tc')).toEqual([['a', 'b', 'c']])
  })

  it('parses multiple rows', () => {
    expect(parseTSV('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('handles Windows line endings (\\r\\n)', () => {
    expect(parseTSV('a\tb\r\nc\td')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('handles old Mac line endings (\\r)', () => {
    expect(parseTSV('a\tb\rc\td')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('trims trailing newline', () => {
    expect(parseTSV('a\tb\n')).toEqual([['a', 'b']])
  })

  it('handles empty string', () => {
    expect(parseTSV('')).toEqual([['']])
  })

  it('handles cells with empty values', () => {
    expect(parseTSV('a\t\tc')).toEqual([['a', '', 'c']])
  })

  it('parses large dataset correctly', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `row${i}\tcol1\tcol2`)
    const result = parseTSV(lines.join('\n'))
    expect(result).toHaveLength(100)
    expect(result[0]).toEqual(['row0', 'col1', 'col2'])
    expect(result[99]).toEqual(['row99', 'col1', 'col2'])
  })
})

describe('formatTSV', () => {
  it('formats single cell', () => {
    expect(formatTSV([['hello']])).toBe('hello')
  })

  it('formats multiple columns', () => {
    expect(formatTSV([['a', 'b', 'c']])).toBe('a\tb\tc')
  })

  it('formats multiple rows', () => {
    expect(formatTSV([['a', 'b'], ['c', 'd']])).toBe('a\tb\nc\td')
  })

  it('converts null to empty string', () => {
    expect(formatTSV([[null, 'b']])).toBe('\tb')
  })

  it('converts numbers to string', () => {
    expect(formatTSV([[42, 'text']])).toBe('42\ttext')
  })

  it('handles empty array', () => {
    expect(formatTSV([[]])).toBe('')
  })
})
