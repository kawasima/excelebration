import * as z from 'zod'
import type { CellValue, RowId, SyncPayload, SyncResult, ValidationResult } from '../types.ts'
import { useSheetReducer } from './useSheetReducer.ts'
import { useSelection } from './useSelection.ts'
import { useKeyboard } from './useKeyboard.ts'
import { useClipboard } from './useClipboard.ts'
import { useCellEdit } from './useCellEdit.ts'
import { useColumnResize } from './useColumnResize.ts'
import { useFilter } from './useFilter.ts'
import { collectDirtyRows, getDirtyCount, getErrorCount } from '../core/sync.ts'
import { validateAll } from '../core/validation.ts'
import { useServerLoad } from './useServerLoad.ts'
import { syncViaWebTransport } from '../core/arrowSync.ts'

export type SheetOptions = {
  schema: z.ZodObject<z.ZodRawShape>
  /** Which column in the schema serves as the row's unique identifier. */
  primaryKey?: string
  initialData: Record<string, CellValue>[]
  onSync?: (payload: SyncPayload) => Promise<SyncResult>
  serverUrl?: string
  certFingerprint?: string
  /** Search/filter parameters sent to the server as URL query parameters. */
  searchParams?: Record<string, string>
}

export function useSheet(options: SheetOptions) {
  const [state, dispatch] = useSheetReducer(options.schema, options.initialData)

  // Server-side loading via WebTransport (only when serverUrl is provided)
  const serverColumns = state.columns // columns derived from schema
  console.log('[useSheet] serverUrl=', options.serverUrl, 'columns.length=', serverColumns.length)
  useServerLoad(
    options.serverUrl
      ? { serverUrl: options.serverUrl, columns: serverColumns, primaryKey: options.primaryKey, certFingerprint: options.certFingerprint, searchParams: options.searchParams, dispatch }
      : null,
  )

  const selection = useSelection(state, dispatch)
  const keyboard = useKeyboard(state, dispatch)
  const clipboard = useClipboard(state, dispatch)
  const cellEdit = useCellEdit(state, dispatch)
  const columnResize = useColumnResize(dispatch)
  const filter = useFilter(state, dispatch)

  const setCell = (rowId: RowId, colKey: string, value: CellValue) => {
    dispatch({ type: 'SET_CELL', rowId, colKey, value })
  }

  const addRows = (count: number) => {
    dispatch({ type: 'ADD_ROWS', count })
  }

  const deleteRows = (rowIds: RowId[]) => {
    dispatch({ type: 'DELETE_ROWS', rowIds })
  }

  const undo = () => dispatch({ type: 'UNDO' })
  const redo = () => dispatch({ type: 'REDO' })

  const doValidateAll = (): ValidationResult => {
    dispatch({ type: 'VALIDATE_ALL' })
    const { summary } = validateAll(state.columns, state.rows)
    return summary
  }

  const sync = async (): Promise<SyncResult> => {
    const validation = doValidateAll()
    if (!validation.valid) {
      return { accepted: [], errors: [] }
    }

    const payload = collectDirtyRows(state)

    let result: SyncResult
    if (options.serverUrl) {
      // WebTransport sync
      result = await syncViaWebTransport(options.serverUrl, options.certFingerprint, payload, options.primaryKey, options.searchParams)
    } else if (options.onSync) {
      result = await options.onSync(payload)
    } else {
      return { accepted: [], errors: [] }
    }

    if (result.accepted.length > 0) {
      dispatch({ type: 'MARK_SYNCED', rowIds: result.accepted })
    }
    if (result.errors.length > 0) {
      dispatch({ type: 'APPLY_SERVER_ERRORS', errors: result.errors })
    }
    return result
  }

  const mergeCells = () => {
    if (!state.selection) return
    const { start, end } = state.selection
    const startRow = Math.min(start.rowIndex, end.rowIndex)
    const startCol = Math.min(start.colIndex, end.colIndex)
    const rowSpan = Math.abs(end.rowIndex - start.rowIndex) + 1
    const colSpan = Math.abs(end.colIndex - start.colIndex) + 1
    if (rowSpan === 1 && colSpan === 1) return
    dispatch({ type: 'MERGE_CELLS', merged: { startRow, startCol, rowSpan, colSpan } })
  }

  const setFrozenColumns = (count: number) => {
    dispatch({ type: 'SET_FROZEN_COLUMNS', count })
  }

  return {
    state,
    dispatch,

    // Selection
    ...selection,

    // Keyboard
    ...keyboard,

    // Clipboard
    ...clipboard,

    // Cell editing
    ...cellEdit,

    // Column resize
    ...columnResize,

    // Filter & sort
    ...filter,

    // Actions
    setCell,
    addRows,
    deleteRows,
    undo,
    redo,
    validateAll: doValidateAll,
    sync,
    mergeCells,
    setFrozenColumns,

    // Computed
    dirtyCount: getDirtyCount(state),
    errorCount: getErrorCount(state),
    totalCount: state.filteredRowOrder.length,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
  }
}
