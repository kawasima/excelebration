import { describe, it, expect } from 'vitest'
import { filterRows, sortRows, applyFilterAndSort } from '../core/filter.ts'
import type { ColumnDef, RowState } from '../types.ts'

const columns: ColumnDef[] = [
  { key: 'name', label: '名前', type: 'text' },
  { key: 'age', label: '年齢', type: 'number' },
  { key: 'dept', label: '部署', type: 'select', options: ['営業', '開発', '総務'] },
]

function makeRows(): Map<string, RowState> {
  return new Map([
    ['1', { id: '1', status: 'clean' as const, cells: { name: '田中太郎', age: 30, dept: '営業' }, errors: {} }],
    ['2', { id: '2', status: 'clean' as const, cells: { name: '山田花子', age: 25, dept: '開発' }, errors: {} }],
    ['3', { id: '3', status: 'clean' as const, cells: { name: '佐藤次郎', age: 35, dept: '営業' }, errors: {} }],
    ['4', { id: '4', status: 'deleted' as const, cells: { name: '鈴木一郎', age: 40, dept: '総務' }, errors: {} }],
  ])
}

const rowOrder = ['1', '2', '3', '4']

describe('filterRows', () => {
  it('returns all rows when no filters', () => {
    expect(filterRows(rowOrder, makeRows(), [])).toEqual(rowOrder)
  })

  it('filters by text partial match (case-insensitive)', () => {
    const result = filterRows(rowOrder, makeRows(), [{ colKey: 'name', value: '田中' }])
    expect(result).toEqual(['1'])
  })

  it('filters by department', () => {
    const result = filterRows(rowOrder, makeRows(), [{ colKey: 'dept', value: '営業' }])
    expect(result).toEqual(['1', '3'])
  })

  it('excludes deleted rows', () => {
    const result = filterRows(rowOrder, makeRows(), [{ colKey: 'dept', value: '総務' }])
    expect(result).toEqual([])
  })

  it('applies multiple filters (AND)', () => {
    const result = filterRows(rowOrder, makeRows(), [
      { colKey: 'dept', value: '営業' },
      { colKey: 'name', value: '佐藤' },
    ])
    expect(result).toEqual(['3'])
  })
})

describe('sortRows', () => {
  it('returns original order when no sort', () => {
    expect(sortRows(rowOrder, makeRows(), null, columns)).toEqual(rowOrder)
  })

  it('sorts by number ascending', () => {
    const result = sortRows(rowOrder, makeRows(), { colKey: 'age', direction: 'asc' }, columns)
    expect(result).toEqual(['2', '1', '3', '4'])
  })

  it('sorts by number descending', () => {
    const result = sortRows(rowOrder, makeRows(), { colKey: 'age', direction: 'desc' }, columns)
    expect(result).toEqual(['4', '3', '1', '2'])
  })

  it('sorts by text ascending (locale-aware)', () => {
    const result = sortRows(rowOrder, makeRows(), { colKey: 'name', direction: 'asc' }, columns)
    expect(result[0]).toBeDefined()
  })
})

describe('applyFilterAndSort', () => {
  it('filters then sorts', () => {
    const result = applyFilterAndSort(
      rowOrder,
      makeRows(),
      [{ colKey: 'dept', value: '営業' }],
      { colKey: 'age', direction: 'desc' },
      columns,
    )
    expect(result).toEqual(['3', '1'])
  })
})
