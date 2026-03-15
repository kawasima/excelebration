import { describe, it, expect } from 'vitest'
import { validateCell, validateRow, validateAll } from '../core/validation.ts'
import type { ColumnDef, RowState } from '../types.ts'

describe('validateCell', () => {
  it('returns error for required empty value', () => {
    const col: ColumnDef = { key: 'name', label: '名前', type: 'text', required: true }
    expect(validateCell(col, '', {})).toBe('名前は必須です')
    expect(validateCell(col, null, {})).toBe('名前は必須です')
  })

  it('returns null for required non-empty value', () => {
    const col: ColumnDef = { key: 'name', label: '名前', type: 'text', required: true }
    expect(validateCell(col, '田中', {})).toBeNull()
  })

  it('returns null for optional empty value', () => {
    const col: ColumnDef = { key: 'name', label: '名前', type: 'text' }
    expect(validateCell(col, '', {})).toBeNull()
    expect(validateCell(col, null, {})).toBeNull()
  })

  it('validates number type', () => {
    const col: ColumnDef = { key: 'age', label: '年齢', type: 'number' }
    expect(validateCell(col, 25, {})).toBeNull()
    expect(validateCell(col, '25', {})).toBeNull()
    expect(validateCell(col, 'abc', {})).toBe('年齢は数値で入力してください')
  })

  it('validates date type', () => {
    const col: ColumnDef = { key: 'date', label: '日付', type: 'date' }
    expect(validateCell(col, '2024-01-15', {})).toBeNull()
    expect(validateCell(col, '2024/01/15', {})).toBe('日付はYYYY-MM-DD形式で入力してください')
    expect(validateCell(col, 'invalid', {})).toBe('日付はYYYY-MM-DD形式で入力してください')
  })

  it('validates select type', () => {
    const col: ColumnDef = { key: 'dept', label: '部署', type: 'select', options: ['営業', '開発'] }
    expect(validateCell(col, '営業', {})).toBeNull()
    expect(validateCell(col, '総務', {})).toBe('部署の値が不正です')
  })

  it('runs custom validate function', () => {
    const col: ColumnDef = {
      key: 'email',
      label: 'メール',
      type: 'text',
      validate: (value) => {
        if (typeof value === 'string' && !value.includes('@')) return 'メール形式が不正です'
        return null
      },
    }
    expect(validateCell(col, 'test@example.com', {})).toBeNull()
    expect(validateCell(col, 'invalid', {})).toBe('メール形式が不正です')
  })
})

describe('validateRow', () => {
  it('validates all columns in a row', () => {
    const columns: ColumnDef[] = [
      { key: 'name', label: '名前', type: 'text', required: true },
      { key: 'age', label: '年齢', type: 'number' },
    ]
    const row: RowState = {
      id: '1',
      status: 'new',
      cells: { name: '', age: 'abc' },
      errors: {},
    }
    const errors = validateRow(columns, row)
    expect(errors.name).toBe('名前は必須です')
    expect(errors.age).toBe('年齢は数値で入力してください')
  })
})

describe('validateAll', () => {
  it('validates all non-deleted rows', () => {
    const columns: ColumnDef[] = [
      { key: 'name', label: '名前', type: 'text', required: true },
    ]
    const rows = new Map<string, RowState>([
      ['1', { id: '1', status: 'new', cells: { name: '' }, errors: {} }],
      ['2', { id: '2', status: 'clean', cells: { name: '田中' }, errors: {} }],
      ['3', { id: '3', status: 'deleted', cells: { name: '' }, errors: {} }],
    ])

    const { results, summary } = validateAll(columns, rows)
    expect(summary.valid).toBe(false)
    expect(summary.errorCount).toBe(1)
    expect(results.get('1')!.name).toBe('名前は必須です')
    expect(results.get('2')!.name).toBeNull()
    expect(results.has('3')).toBe(false)
  })
})
