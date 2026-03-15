// Components
export { SheetProvider } from './components/SheetProvider.tsx'
export { useSheetContext } from './components/SheetProvider.tsx'
export type { SheetProviderProps } from './components/SheetProvider.tsx'
export { SheetGrid } from './components/SheetGrid.tsx'
export { SheetToolbar } from './components/SheetToolbar.tsx'
export { SheetStatusBar } from './components/SheetStatusBar.tsx'

// Hooks
export { useSheet } from './hooks/useSheet.ts'

// Types
export type {
  CellValue,
  ColumnDef,
  RowId,
  RowState,
  RowStatus,
  CellAddress,
  Selection,
  SortState,
  SortDirection,
  FilterCondition,
  MergedCell,
  SheetState,
  LoadingState,
  SyncPayload,
  SyncResult,
  ServerError,
  ValidationResult,
} from './types.ts'

// Schema utilities
export { zodToColumns } from './core/schema.ts'
export type { ColumnMeta } from './core/schema.ts'
