import { describe, it, expect } from 'vitest'
import { createInitialState, sheetReducer } from '../core/reducer.ts'
import type { SheetState } from '../types.ts'

function makeState(): SheetState {
  const state = createInitialState()
  return sheetReducer(state, {
    type: 'INIT',
    columns: [
      { key: 'name', label: '名前', type: 'text', required: true },
      { key: 'age', label: '年齢', type: 'number' },
      { key: 'dept', label: '部署', type: 'select', options: ['営業', '開発'] },
    ],
    data: [
      { name: '田中', age: 30, dept: '営業' },
      { name: '山田', age: 25, dept: '開発' },
    ],
  })
}

describe('sheetReducer', () => {
  describe('INIT', () => {
    it('initializes state with data and columns', () => {
      const state = makeState()
      expect(state.rowOrder).toHaveLength(2)
      expect(state.columns).toHaveLength(3)
      expect(state.rows.size).toBe(2)

      const row0 = state.rows.get(state.rowOrder[0])!
      expect(row0.cells.name).toBe('田中')
      expect(row0.status).toBe('clean')
      expect(row0.original).toEqual({ name: '田中', age: 30, dept: '営業' })
    })
  })

  describe('SET_CELL', () => {
    it('updates cell value and marks row dirty', () => {
      const state = makeState()
      const rowId = state.rowOrder[0]

      const next = sheetReducer(state, { type: 'SET_CELL', rowId, colKey: 'name', value: '鈴木' })
      expect(next.rows.get(rowId)!.cells.name).toBe('鈴木')
      expect(next.rows.get(rowId)!.status).toBe('dirty')
      expect(next.undoStack).toHaveLength(1)
    })

    it('validates on set', () => {
      const state = makeState()
      const rowId = state.rowOrder[0]

      const next = sheetReducer(state, { type: 'SET_CELL', rowId, colKey: 'age', value: 'abc' })
      expect(next.rows.get(rowId)!.errors.age).toBe('年齢は数値で入力してください')
    })
  })

  describe('UNDO / REDO', () => {
    it('undoes and redoes a cell edit', () => {
      const state = makeState()
      const rowId = state.rowOrder[0]

      const edited = sheetReducer(state, { type: 'SET_CELL', rowId, colKey: 'name', value: '鈴木' })
      expect(edited.rows.get(rowId)!.cells.name).toBe('鈴木')

      const undone = sheetReducer(edited, { type: 'UNDO' })
      expect(undone.rows.get(rowId)!.cells.name).toBe('田中')
      expect(undone.undoStack).toHaveLength(0)
      expect(undone.redoStack).toHaveLength(1)

      const redone = sheetReducer(undone, { type: 'REDO' })
      expect(redone.rows.get(rowId)!.cells.name).toBe('鈴木')
    })
  })

  describe('ADD_ROWS', () => {
    it('adds rows to the end', () => {
      const state = makeState()
      const next = sheetReducer(state, { type: 'ADD_ROWS', count: 3 })
      expect(next.rowOrder).toHaveLength(5)
      expect(next.rows.get(next.rowOrder[4])!.status).toBe('new')
    })
  })

  describe('DELETE_ROWS', () => {
    it('marks rows as deleted', () => {
      const state = makeState()
      const rowId = state.rowOrder[0]
      const next = sheetReducer(state, { type: 'DELETE_ROWS', rowIds: [rowId] })
      expect(next.rows.get(rowId)!.status).toBe('deleted')
    })
  })

  describe('TOGGLE_SORT', () => {
    it('cycles through asc -> desc -> none', () => {
      let state = makeState()

      state = sheetReducer(state, { type: 'TOGGLE_SORT', colKey: 'age' })
      expect(state.sortState).toEqual({ colKey: 'age', direction: 'asc' })

      state = sheetReducer(state, { type: 'TOGGLE_SORT', colKey: 'age' })
      expect(state.sortState).toEqual({ colKey: 'age', direction: 'desc' })

      state = sheetReducer(state, { type: 'TOGGLE_SORT', colKey: 'age' })
      expect(state.sortState).toBeNull()
    })

    it('resets direction when switching columns', () => {
      let state = makeState()

      state = sheetReducer(state, { type: 'TOGGLE_SORT', colKey: 'age' })
      state = sheetReducer(state, { type: 'TOGGLE_SORT', colKey: 'age' })
      expect(state.sortState?.direction).toBe('desc')

      state = sheetReducer(state, { type: 'TOGGLE_SORT', colKey: 'name' })
      expect(state.sortState).toEqual({ colKey: 'name', direction: 'asc' })
    })
  })

  describe('SET_FILTER / REMOVE_FILTER', () => {
    it('filters rows', () => {
      let state = makeState()
      state = sheetReducer(state, { type: 'SET_FILTER', filter: { colKey: 'dept', value: '営業' } })
      expect(state.filteredRowOrder).toHaveLength(1)

      state = sheetReducer(state, { type: 'REMOVE_FILTER', colKey: 'dept' })
      expect(state.filteredRowOrder).toHaveLength(2)
    })

    it('removes filter when value is empty', () => {
      let state = makeState()
      state = sheetReducer(state, { type: 'SET_FILTER', filter: { colKey: 'dept', value: '営業' } })
      state = sheetReducer(state, { type: 'SET_FILTER', filter: { colKey: 'dept', value: '' } })
      expect(state.filteredRowOrder).toHaveLength(2)
    })
  })

  describe('RESIZE_COLUMN', () => {
    it('updates column width with minimum of 40', () => {
      let state = makeState()
      state = sheetReducer(state, { type: 'RESIZE_COLUMN', colKey: 'name', width: 200 })
      expect(state.columnWidths.name).toBe(200)

      state = sheetReducer(state, { type: 'RESIZE_COLUMN', colKey: 'name', width: 10 })
      expect(state.columnWidths.name).toBe(40)
    })
  })

  describe('MARK_SYNCED', () => {
    it('marks rows as clean and updates original', () => {
      let state = makeState()
      const rowId = state.rowOrder[0]

      state = sheetReducer(state, { type: 'SET_CELL', rowId, colKey: 'name', value: '鈴木' })
      state = sheetReducer(state, { type: 'MARK_SYNCED', rowIds: [rowId] })

      const row = state.rows.get(rowId)!
      expect(row.status).toBe('clean')
      expect(row.original!.name).toBe('鈴木')
    })
  })

  describe('VALIDATE_ALL', () => {
    it('validates all non-deleted rows', () => {
      let state = makeState()
      const rowId = state.rowOrder[0]

      state = sheetReducer(state, { type: 'SET_CELL', rowId, colKey: 'name', value: '' })
      // Clear the error to test VALIDATE_ALL
      const row = state.rows.get(rowId)!
      const newRows = new Map(state.rows)
      newRows.set(rowId, { ...row, errors: {} })
      state = { ...state, rows: newRows }

      state = sheetReducer(state, { type: 'VALIDATE_ALL' })
      expect(state.rows.get(rowId)!.errors.name).toBe('名前は必須です')
    })
  })

  describe('MERGE_CELLS', () => {
    it('adds merged cell region', () => {
      let state = makeState()
      state = sheetReducer(state, {
        type: 'MERGE_CELLS',
        merged: { startRow: 0, startCol: 0, rowSpan: 2, colSpan: 2 },
      })
      expect(state.mergedCells).toHaveLength(1)
    })
  })

  describe('SET_FROZEN_COLUMNS', () => {
    it('sets frozen column count', () => {
      let state = makeState()
      state = sheetReducer(state, { type: 'SET_FROZEN_COLUMNS', count: 2 })
      expect(state.frozenColumns).toBe(2)
    })
  })
})
