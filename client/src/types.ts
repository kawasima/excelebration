export type CellValue = string | number | null

export type RowId = string

export type ColumnDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  width?: number
  options?: string[]
  required?: boolean
  validate?: (value: unknown, row: Record<string, CellValue>) => string | null
  /** Zod フィールドスキーマ。セット時はこちらでバリデーション */
  zodSchema?: import('zod').ZodTypeAny
  multiline?: boolean
}

export type RowStatus = 'clean' | 'dirty' | 'new' | 'deleted'

export type RowState = {
  id: RowId
  status: RowStatus
  cells: Record<string, CellValue>
  errors: Record<string, string | null>
  original?: Record<string, CellValue>
  height?: number
}

export type CellAddress = {
  rowIndex: number
  colIndex: number
}

export type Selection = {
  start: CellAddress
  end: CellAddress
} | null

export type SortDirection = 'asc' | 'desc'

export type SortState = {
  colKey: string
  direction: SortDirection
} | null

export type FilterCondition = {
  colKey: string
  value: string
}

export type MergedCell = {
  startRow: number
  startCol: number
  rowSpan: number
  colSpan: number
}

export type Command = {
  type: string
  execute: (state: SheetState) => SheetState
  undo: (state: SheetState) => SheetState
}

export type LoadingState = {
  status: 'idle' | 'loading' | 'complete' | 'error'
  loadedCount: number
  totalCount: number | null
  error?: string
}

export type SheetState = {
  columns: ColumnDef[]
  rows: Map<RowId, RowState>
  rowOrder: RowId[]
  filteredRowOrder: RowId[]
  selection: Selection
  focusedCell: CellAddress | null
  editingCell: CellAddress | null
  undoStack: Command[]
  redoStack: Command[]
  sortState: SortState
  filters: FilterCondition[]
  mergedCells: MergedCell[]
  columnWidths: Record<string, number>
  rowHeight: number
  frozenColumns: number
  loadingState: LoadingState
}

export type SyncPayload = {
  upserts: Array<{ id: RowId; cells: Record<string, CellValue> }>
  deletes: RowId[]
}

export type ServerError = {
  rowId: RowId
  colKey: string
  message: string
}

export type SyncResult = {
  accepted: RowId[]
  errors: ServerError[]
}

export type ValidationResult = {
  valid: boolean
  errorCount: number
}
