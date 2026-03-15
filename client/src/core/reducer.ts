import { nanoid } from 'nanoid'
import type {
  CellAddress,
  CellValue,
  ColumnDef,
  Command,
  FilterCondition,
  MergedCell,
  RowId,
  RowState,
  Selection,
  SheetState,
  SortDirection,
} from '../types.ts'
import {
  createSetCellCommand,
  createPasteCommand,
  createAddRowsCommand,
  createDeleteRowsCommand,
  createMergeCellsCommand,
} from './commands.ts'
import { validateCell, validateRow } from './validation.ts'
import { applyFilterAndSort } from './filter.ts'

export type SheetAction =
  | { type: 'SET_CELL'; rowId: RowId; colKey: string; value: CellValue }
  | { type: 'PASTE'; tsv: string; anchor: CellAddress }
  | { type: 'ADD_ROWS'; count: number }
  | { type: 'DELETE_ROWS'; rowIds: RowId[] }
  | { type: 'SET_SELECTION'; selection: Selection }
  | { type: 'SET_FOCUS'; cell: CellAddress | null }
  | { type: 'SET_EDITING'; cell: CellAddress | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'VALIDATE_ALL' }
  | { type: 'APPLY_SERVER_ERRORS'; errors: Array<{ rowId: RowId; colKey: string; message: string }> }
  | { type: 'MARK_SYNCED'; rowIds: RowId[] }
  | { type: 'INIT'; data: Record<string, CellValue>[]; columns: ColumnDef[] }
  | { type: 'RESIZE_COLUMN'; colKey: string; width: number }
  | { type: 'SET_ROW_HEIGHT'; height: number }
  | { type: 'SET_SORT'; colKey: string; direction: SortDirection | null }
  | { type: 'TOGGLE_SORT'; colKey: string }
  | { type: 'SET_FILTER'; filter: FilterCondition }
  | { type: 'REMOVE_FILTER'; colKey: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'MERGE_CELLS'; merged: MergedCell }
  | { type: 'UNMERGE_CELLS'; startRow: number; startCol: number }
  | { type: 'SET_FROZEN_COLUMNS'; count: number }
  | { type: 'DELETE_CELL_VALUES'; cells: CellAddress[] }
  | { type: 'LOAD_BEGIN'; columns: ColumnDef[]; totalCount: number | null }
  | { type: 'LOAD_BATCH'; rows: Array<{ id: RowId; cells: Record<string, CellValue> }> }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR'; error: string }

const MAX_UNDO_STACK = 100

function executeCommand(state: SheetState, command: Command): SheetState {
  const newState = command.execute(state)
  const undoStack = state.undoStack.length >= MAX_UNDO_STACK
    ? [...state.undoStack.slice(1), command]
    : [...state.undoStack, command]

  // Skip expensive refilter/resort if filters/sort haven't changed
  // and the row order is the same (i.e., no rows added/removed)
  const skipRefilter =
    newState.filters === state.filters &&
    newState.sortState === state.sortState &&
    newState.rowOrder === state.rowOrder

  return {
    ...newState,
    undoStack,
    redoStack: [],
    filteredRowOrder: skipRefilter
      ? state.filteredRowOrder
      : applyFilterAndSort(
          newState.rowOrder, newState.rows, newState.filters, newState.sortState, newState.columns,
        ),
  }
}

function recomputeFiltered(state: SheetState): SheetState {
  return {
    ...state,
    filteredRowOrder: applyFilterAndSort(
      state.rowOrder, state.rows, state.filters, state.sortState, state.columns,
    ),
  }
}

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case 'SET_CELL': {
      const command = createSetCellCommand(action.rowId, action.colKey, action.value)
      return executeCommand(state, command)
    }

    case 'PASTE': {
      const command = createPasteCommand(action.tsv, action.anchor)
      return executeCommand(state, command)
    }

    case 'ADD_ROWS': {
      const command = createAddRowsCommand(action.count)
      return executeCommand(state, command)
    }

    case 'DELETE_ROWS': {
      const command = createDeleteRowsCommand(action.rowIds)
      return executeCommand(state, command)
    }

    case 'MERGE_CELLS': {
      const command = createMergeCellsCommand(action.merged)
      return executeCommand(state, command)
    }

    case 'UNMERGE_CELLS': {
      const merged = state.mergedCells.find(
        m => m.startRow === action.startRow && m.startCol === action.startCol,
      )
      if (!merged) return state
      return {
        ...state,
        mergedCells: state.mergedCells.filter(m => m !== merged),
      }
    }

    case 'SET_SELECTION':
      return { ...state, selection: action.selection }

    case 'SET_FOCUS':
      return { ...state, focusedCell: action.cell }

    case 'SET_EDITING':
      return { ...state, editingCell: action.cell }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const command = state.undoStack[state.undoStack.length - 1]
      const newState = command.undo(state)
      return recomputeFiltered({
        ...newState,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, command],
      })
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state
      const command = state.redoStack[state.redoStack.length - 1]
      const newState = command.execute(state)
      return recomputeFiltered({
        ...newState,
        undoStack: [...state.undoStack, command],
        redoStack: state.redoStack.slice(0, -1),
      })
    }

    case 'VALIDATE_ALL': {
      const newRows = new Map(state.rows)
      for (const [id, row] of newRows) {
        if (row.status === 'deleted') continue
        const errors = validateRow(state.columns, row)
        newRows.set(id, { ...row, errors })
      }
      return { ...state, rows: newRows }
    }

    case 'APPLY_SERVER_ERRORS': {
      const newRows = new Map(state.rows)
      for (const error of action.errors) {
        const row = newRows.get(error.rowId)
        if (!row) continue
        newRows.set(error.rowId, {
          ...row,
          errors: { ...row.errors, [error.colKey]: error.message },
        })
      }
      return { ...state, rows: newRows }
    }

    case 'MARK_SYNCED': {
      const newRows = new Map(state.rows)
      const deletedIds = new Set<RowId>()
      for (const rowId of action.rowIds) {
        const row = newRows.get(rowId)
        if (!row) continue
        if (row.status === 'deleted') {
          newRows.delete(rowId)
          deletedIds.add(rowId)
        } else {
          newRows.set(rowId, {
            ...row,
            status: 'clean',
            original: { ...row.cells },
            errors: {},
          })
        }
      }
      const newRowOrder = state.rowOrder.filter(id => !deletedIds.has(id))
      return recomputeFiltered({ ...state, rows: newRows, rowOrder: newRowOrder })
    }

    case 'INIT': {
      const rows = new Map<RowId, RowState>()
      const rowOrder: RowId[] = []

      for (const data of action.data) {
        const id = nanoid()
        rowOrder.push(id)
        rows.set(id, {
          id,
          status: 'clean',
          cells: { ...data },
          errors: {},
          original: { ...data },
        })
      }

      const columnWidths: Record<string, number> = {}
      for (const col of action.columns) {
        columnWidths[col.key] = col.width ?? 120
      }

      return {
        ...state,
        columns: action.columns,
        rows,
        rowOrder,
        filteredRowOrder: rowOrder,
        columnWidths,
        undoStack: [],
        redoStack: [],
        sortState: null,
        filters: [],
        mergedCells: [],
        selection: null,
        focusedCell: null,
        editingCell: null,
      }
    }

    case 'RESIZE_COLUMN':
      return {
        ...state,
        columnWidths: { ...state.columnWidths, [action.colKey]: Math.max(40, action.width) },
      }

    case 'SET_ROW_HEIGHT':
      return { ...state, rowHeight: Math.max(20, action.height) }

    case 'TOGGLE_SORT': {
      let newSort = state.sortState
      if (!newSort || newSort.colKey !== action.colKey) {
        newSort = { colKey: action.colKey, direction: 'asc' }
      } else if (newSort.direction === 'asc') {
        newSort = { colKey: action.colKey, direction: 'desc' }
      } else {
        newSort = null
      }
      return recomputeFiltered({ ...state, sortState: newSort })
    }

    case 'SET_SORT': {
      const newSort = action.direction ? { colKey: action.colKey, direction: action.direction } : null
      return recomputeFiltered({ ...state, sortState: newSort })
    }

    case 'SET_FILTER': {
      const existing = state.filters.findIndex(f => f.colKey === action.filter.colKey)
      let newFilters: FilterCondition[]
      if (action.filter.value === '') {
        newFilters = state.filters.filter(f => f.colKey !== action.filter.colKey)
      } else if (existing >= 0) {
        newFilters = [...state.filters]
        newFilters[existing] = action.filter
      } else {
        newFilters = [...state.filters, action.filter]
      }
      return recomputeFiltered({ ...state, filters: newFilters })
    }

    case 'REMOVE_FILTER': {
      return recomputeFiltered({
        ...state,
        filters: state.filters.filter(f => f.colKey !== action.colKey),
      })
    }

    case 'CLEAR_FILTERS':
      return recomputeFiltered({ ...state, filters: [], sortState: null })

    case 'SET_FROZEN_COLUMNS':
      return { ...state, frozenColumns: Math.max(0, action.count) }

    case 'DELETE_CELL_VALUES': {
      const newRows = new Map(state.rows)
      for (const cell of action.cells) {
        const rowId = state.filteredRowOrder[cell.rowIndex]
        if (!rowId) continue
        const row = newRows.get(rowId)
        if (!row) continue
        const col = state.columns[cell.colIndex]
        if (!col) continue

        const newCells = { ...row.cells, [col.key]: null }
        const error = validateCell(col, null, newCells)
        newRows.set(rowId, {
          ...row,
          cells: newCells,
          errors: { ...row.errors, [col.key]: error },
          status: row.status === 'new' ? 'new' : 'dirty',
        })
      }
      return { ...state, rows: newRows }
    }

    case 'LOAD_BEGIN': {
      const columnWidths: Record<string, number> = {}
      for (const col of action.columns) {
        columnWidths[col.key] = col.width ?? 120
      }
      return {
        ...state,
        columns: action.columns,
        rows: new Map(),
        rowOrder: [],
        filteredRowOrder: [],
        columnWidths,
        undoStack: [],
        redoStack: [],
        sortState: null,
        filters: [],
        mergedCells: [],
        selection: null,
        focusedCell: null,
        editingCell: null,
        loadingState: {
          status: 'loading',
          loadedCount: 0,
          totalCount: action.totalCount,
        },
      }
    }

    case 'LOAD_BATCH': {
      const newRows = new Map(state.rows)
      const newRowOrder = [...state.rowOrder]
      for (const { id, cells } of action.rows) {
        newRowOrder.push(id)
        newRows.set(id, {
          id,
          status: 'clean',
          cells,
          errors: {},
          original: { ...cells },
        })
      }
      return {
        ...state,
        rows: newRows,
        rowOrder: newRowOrder,
        filteredRowOrder: newRowOrder, // skip sort/filter during loading
        loadingState: {
          ...state.loadingState,
          loadedCount: newRowOrder.length,
        },
      }
    }

    case 'LOAD_COMPLETE':
      return {
        ...recomputeFiltered(state),
        loadingState: {
          ...state.loadingState,
          status: 'complete',
        },
      }

    case 'LOAD_ERROR':
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          status: 'error',
          error: action.error,
        },
      }

    default:
      return state
  }
}

export function createInitialState(): SheetState {
  return {
    columns: [],
    rows: new Map(),
    rowOrder: [],
    filteredRowOrder: [],
    selection: null,
    focusedCell: null,
    editingCell: null,
    undoStack: [],
    redoStack: [],
    sortState: null,
    filters: [],
    mergedCells: [],
    columnWidths: {},
    rowHeight: 32,
    frozenColumns: 0,
    loadingState: {
      status: 'idle',
      loadedCount: 0,
      totalCount: null,
    },
  }
}
