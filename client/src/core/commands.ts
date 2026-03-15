import { nanoid } from 'nanoid'
import type { CellAddress, CellValue, Command, MergedCell, RowId, RowState, SheetState } from '../types.ts'
import { parseTSV } from './clipboard.ts'
import { validateCell } from './validation.ts'

const LINE_HEIGHT = 20 // px per line
const CELL_PADDING = 8 // top + bottom padding

function calcRowHeight(cells: Record<string, CellValue>, state: SheetState): number {
  let maxLines = 1
  for (const col of state.columns) {
    if (!col.multiline) continue
    const val = cells[col.key]
    if (val == null || val === '') continue
    const lines = String(val).split('\n').length
    if (lines > maxLines) maxLines = lines
  }
  return Math.max(state.rowHeight, maxLines * LINE_HEIGHT + CELL_PADDING)
}

export function createSetCellCommand(
  rowId: RowId,
  colKey: string,
  newValue: CellValue,
): Command {
  let oldValue: CellValue
  let oldStatus: RowState['status']

  return {
    type: 'SET_CELL',
    execute(state) {
      const row = state.rows.get(rowId)
      if (!row) return state

      oldValue = row.cells[colKey]
      oldStatus = row.status

      const newCells = { ...row.cells, [colKey]: newValue }
      const col = state.columns.find(c => c.key === colKey)
      const error = col ? validateCell(col, newValue, newCells) : null

      // Only recalculate row height if a multiline column was modified
      const isMultilineCol = col?.multiline ?? false
      const height = isMultilineCol ? calcRowHeight(newCells, state) : row.height

      const newRows = new Map(state.rows)
      newRows.set(rowId, {
        ...row,
        cells: newCells,
        errors: { ...row.errors, [colKey]: error },
        status: row.status === 'new' ? 'new' : 'dirty',
        height,
      })

      return { ...state, rows: newRows }
    },
    undo(state) {
      const row = state.rows.get(rowId)
      if (!row) return state

      const newCells = { ...row.cells, [colKey]: oldValue }
      const col = state.columns.find(c => c.key === colKey)
      const error = col ? validateCell(col, oldValue, newCells) : null

      const isMultilineCol = col?.multiline ?? false
      const height = isMultilineCol ? calcRowHeight(newCells, state) : row.height

      const newRows = new Map(state.rows)
      newRows.set(rowId, {
        ...row,
        cells: newCells,
        errors: { ...row.errors, [colKey]: error },
        status: oldStatus,
        height,
      })

      return { ...state, rows: newRows }
    },
  }
}

export function createPasteCommand(
  tsv: string,
  anchor: CellAddress,
): Command {
  const parsed = parseTSV(tsv)
  let snapshot: Array<{ rowId: RowId; cells: Record<string, CellValue>; status: RowState['status'] }> = []
  let addedRowIds: RowId[] = []

  return {
    type: 'PASTE',
    execute(state) {
      snapshot = []
      addedRowIds = []
      const newRows = new Map(state.rows)
      let newRowOrder = [...state.rowOrder]

      const neededRows = anchor.rowIndex + parsed.length
      while (newRowOrder.length < neededRows) {
        const id = nanoid()
        addedRowIds.push(id)
        newRowOrder.push(id)
        newRows.set(id, {
          id,
          status: 'new',
          cells: {},
          errors: {},
        })
      }

      for (let r = 0; r < parsed.length; r++) {
        const rowIdx = anchor.rowIndex + r
        const rowId = newRowOrder[rowIdx]
        const row = newRows.get(rowId)
        if (!row) continue

        snapshot.push({ rowId, cells: { ...row.cells }, status: row.status })

        const newCells = { ...row.cells }
        const newErrors = { ...row.errors }

        for (let c = 0; c < parsed[r].length; c++) {
          const colIdx = anchor.colIndex + c
          if (colIdx >= state.columns.length) continue

          const col = state.columns[colIdx]
          const value: CellValue = parsed[r][c]
          newCells[col.key] = value
          newErrors[col.key] = validateCell(col, value, newCells)
        }

        newRows.set(rowId, {
          ...row,
          cells: newCells,
          errors: newErrors,
          status: row.status === 'new' ? 'new' : 'dirty',
        })
      }

      return { ...state, rows: newRows, rowOrder: newRowOrder }
    },
    undo(state) {
      const newRows = new Map(state.rows)
      let newRowOrder = [...state.rowOrder]

      for (const s of snapshot) {
        const row = newRows.get(s.rowId)
        if (row) {
          newRows.set(s.rowId, { ...row, cells: s.cells, status: s.status })
        }
      }

      for (const id of addedRowIds) {
        newRows.delete(id)
        newRowOrder = newRowOrder.filter(rid => rid !== id)
      }

      return { ...state, rows: newRows, rowOrder: newRowOrder }
    },
  }
}

export function createAddRowsCommand(count: number): Command {
  let addedIds: RowId[] = []

  return {
    type: 'ADD_ROWS',
    execute(state) {
      addedIds = Array.from({ length: count }, () => nanoid())
      const newRows = new Map(state.rows)
      const newRowOrder = [...state.rowOrder]

      for (const id of addedIds) {
        const cells: Record<string, CellValue> = {}
        for (const col of state.columns) {
          cells[col.key] = null
        }
        newRows.set(id, { id, status: 'new', cells, errors: {} })
        newRowOrder.push(id)
      }

      return { ...state, rows: newRows, rowOrder: newRowOrder }
    },
    undo(state) {
      const newRows = new Map(state.rows)
      let newRowOrder = [...state.rowOrder]

      for (const id of addedIds) {
        newRows.delete(id)
        newRowOrder = newRowOrder.filter(rid => rid !== id)
      }

      return { ...state, rows: newRows, rowOrder: newRowOrder }
    },
  }
}

export function createDeleteRowsCommand(rowIds: RowId[]): Command {
  let previousStatuses: Array<{ rowId: RowId; status: RowState['status'] }> = []

  return {
    type: 'DELETE_ROWS',
    execute(state) {
      previousStatuses = []
      const newRows = new Map(state.rows)

      for (const rowId of rowIds) {
        const row = newRows.get(rowId)
        if (!row) continue
        previousStatuses.push({ rowId, status: row.status })
        newRows.set(rowId, { ...row, status: 'deleted' })
      }

      return { ...state, rows: newRows }
    },
    undo(state) {
      const newRows = new Map(state.rows)

      for (const { rowId, status } of previousStatuses) {
        const row = newRows.get(rowId)
        if (row) {
          newRows.set(rowId, { ...row, status })
        }
      }

      return { ...state, rows: newRows }
    },
  }
}

export function createMergeCellsCommand(merged: MergedCell): Command {
  let removedValues: Array<{ rowIdx: number; colKey: string; value: CellValue }> = []

  return {
    type: 'MERGE_CELLS',
    execute(state) {
      removedValues = []
      const newRows = new Map(state.rows)

      for (let r = merged.startRow; r < merged.startRow + merged.rowSpan; r++) {
        for (let c = merged.startCol; c < merged.startCol + merged.colSpan; c++) {
          if (r === merged.startRow && c === merged.startCol) continue

          const rowId = state.rowOrder[r]
          if (!rowId) continue
          const row = newRows.get(rowId)
          if (!row) continue

          const colKey = state.columns[c]?.key
          if (!colKey) continue

          removedValues.push({ rowIdx: r, colKey, value: row.cells[colKey] })
          const newCells = { ...row.cells, [colKey]: null }
          newRows.set(rowId, {
            ...row,
            cells: newCells,
            status: row.status === 'new' ? 'new' : 'dirty',
          })
        }
      }

      return {
        ...state,
        rows: newRows,
        mergedCells: [...state.mergedCells, merged],
      }
    },
    undo(state) {
      const newRows = new Map(state.rows)

      for (const { rowIdx, colKey, value } of removedValues) {
        const rowId = state.rowOrder[rowIdx]
        if (!rowId) continue
        const row = newRows.get(rowId)
        if (!row) continue

        newRows.set(rowId, {
          ...row,
          cells: { ...row.cells, [colKey]: value },
        })
      }

      const newMerged = state.mergedCells.filter(
        m => !(m.startRow === merged.startRow && m.startCol === merged.startCol),
      )

      return { ...state, rows: newRows, mergedCells: newMerged }
    },
  }
}
