import { describe, it, expect } from 'vitest'
import {
  createSetCellCommand,
  createAddRowsCommand,
  createDeleteRowsCommand,
  createPasteCommand,
  createMergeCellsCommand,
} from '../core/commands.ts'
import { createInitialState, sheetReducer } from '../core/reducer.ts'
import type { SheetState } from '../types.ts'

function makeState(): SheetState {
  const state = createInitialState()
  return sheetReducer(state, {
    type: 'INIT',
    columns: [
      { key: 'name', label: '名前', type: 'text' },
      { key: 'age', label: '年齢', type: 'number' },
      { key: 'dept', label: '部署', type: 'text' },
    ],
    data: [
      { name: '田中', age: 30, dept: '営業' },
      { name: '山田', age: 25, dept: '開発' },
      { name: '佐藤', age: 35, dept: '営業' },
    ],
  })
}

describe('createSetCellCommand', () => {
  it('changes cell value and can undo', () => {
    const state = makeState()
    const rowId = state.rowOrder[0]
    const command = createSetCellCommand(rowId, 'name', '鈴木')

    const after = command.execute(state)
    expect(after.rows.get(rowId)!.cells.name).toBe('鈴木')
    expect(after.rows.get(rowId)!.status).toBe('dirty')

    const undone = command.undo(after)
    expect(undone.rows.get(rowId)!.cells.name).toBe('田中')
    expect(undone.rows.get(rowId)!.status).toBe('clean')
  })
})

describe('createPasteCommand', () => {
  it('pastes TSV data starting from anchor', () => {
    const state = makeState()
    const command = createPasteCommand('A\tB\nC\tD', { rowIndex: 0, colIndex: 0 })

    const after = command.execute(state)
    const row0 = after.rows.get(after.rowOrder[0])!
    const row1 = after.rows.get(after.rowOrder[1])!
    expect(row0.cells.name).toBe('A')
    expect(row0.cells.age).toBe('B')
    expect(row1.cells.name).toBe('C')
    expect(row1.cells.age).toBe('D')
  })

  it('adds rows when pasting beyond existing rows', () => {
    const state = makeState()
    const command = createPasteCommand('X\nY\nZ\nW', { rowIndex: 2, colIndex: 0 })

    const after = command.execute(state)
    expect(after.rowOrder.length).toBe(6)
    expect(after.rows.get(after.rowOrder[5])!.cells.name).toBe('W')
  })

  it('can undo paste including added rows', () => {
    const state = makeState()
    const command = createPasteCommand('X\nY\nZ\nW', { rowIndex: 2, colIndex: 0 })

    const after = command.execute(state)
    const undone = command.undo(after)
    expect(undone.rowOrder.length).toBe(3)
    expect(undone.rows.get(undone.rowOrder[2])!.cells.name).toBe('佐藤')
  })
})

describe('createAddRowsCommand', () => {
  it('adds rows and can undo', () => {
    const state = makeState()
    const command = createAddRowsCommand(2)

    const after = command.execute(state)
    expect(after.rowOrder.length).toBe(5)

    const undone = command.undo(after)
    expect(undone.rowOrder.length).toBe(3)
  })
})

describe('createDeleteRowsCommand', () => {
  it('marks rows as deleted and can undo', () => {
    const state = makeState()
    const rowId = state.rowOrder[1]
    const command = createDeleteRowsCommand([rowId])

    const after = command.execute(state)
    expect(after.rows.get(rowId)!.status).toBe('deleted')

    const undone = command.undo(after)
    expect(undone.rows.get(rowId)!.status).toBe('clean')
  })
})

describe('createMergeCellsCommand', () => {
  it('creates a merged cell region and clears non-origin cells', () => {
    const state = makeState()
    const merged = { startRow: 0, startCol: 0, rowSpan: 2, colSpan: 2 }
    const command = createMergeCellsCommand(merged)

    const after = command.execute(state)
    expect(after.mergedCells).toHaveLength(1)

    const row0 = after.rows.get(after.rowOrder[0])!
    expect(row0.cells.name).toBe('田中')
    expect(row0.cells.age).toBeNull()

    const row1 = after.rows.get(after.rowOrder[1])!
    expect(row1.cells.name).toBeNull()
    expect(row1.cells.age).toBeNull()
  })

  it('can undo merge', () => {
    const state = makeState()
    const merged = { startRow: 0, startCol: 0, rowSpan: 2, colSpan: 2 }
    const command = createMergeCellsCommand(merged)

    const after = command.execute(state)
    const undone = command.undo(after)

    expect(undone.mergedCells).toHaveLength(0)
    const row0 = undone.rows.get(undone.rowOrder[0])!
    expect(row0.cells.age).toBe(30)
  })
})
