import { useCallback, useMemo } from 'react'
import type { CellAddress, SheetState } from '../types.ts'
import type { SheetDispatch } from './useSheetReducer.ts'

export type SelectionRange = {
  minRow: number; maxRow: number; minCol: number; maxCol: number
} | null

export function useSelection(state: SheetState, dispatch: SheetDispatch) {
  const handleCellMouseDown = useCallback(
    (cell: CellAddress, e: React.MouseEvent) => {
      if (e.shiftKey && state.focusedCell) {
        dispatch({
          type: 'SET_SELECTION',
          selection: { start: state.focusedCell, end: cell },
        })
      } else {
        dispatch({ type: 'SET_FOCUS', cell })
        dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
      }
    },
    [state.focusedCell, dispatch],
  )

  const handleCellMouseEnter = useCallback(
    (cell: CellAddress, e: React.MouseEvent) => {
      if (e.buttons === 1 && state.focusedCell) {
        dispatch({
          type: 'SET_SELECTION',
          selection: { start: state.focusedCell, end: cell },
        })
      }
    },
    [state.focusedCell, dispatch],
  )

  // Compute selection range ONCE per selection change
  const selectionRange: SelectionRange = useMemo(() => {
    if (!state.selection) return null
    const { start, end } = state.selection
    return {
      minRow: Math.min(start.rowIndex, end.rowIndex),
      maxRow: Math.max(start.rowIndex, end.rowIndex),
      minCol: Math.min(start.colIndex, end.colIndex),
      maxCol: Math.max(start.colIndex, end.colIndex),
    }
  }, [state.selection])

  const getSelectionRange = useCallback(
    () => selectionRange,
    [selectionRange],
  )

  const isCellSelected = useCallback(
    (rowIndex: number, colIndex: number): boolean => {
      if (!selectionRange) return false
      return (
        rowIndex >= selectionRange.minRow &&
        rowIndex <= selectionRange.maxRow &&
        colIndex >= selectionRange.minCol &&
        colIndex <= selectionRange.maxCol
      )
    },
    [selectionRange],
  )

  const isCellFocused = useCallback(
    (rowIndex: number, colIndex: number): boolean => {
      if (!state.focusedCell) return false
      return state.focusedCell.rowIndex === rowIndex && state.focusedCell.colIndex === colIndex
    },
    [state.focusedCell],
  )

  const handleRowHeaderMouseDown = useCallback(
    (rowIndex: number) => {
      const maxCol = state.columns.length - 1
      dispatch({ type: 'SET_FOCUS', cell: { rowIndex, colIndex: 0 } })
      dispatch({
        type: 'SET_SELECTION',
        selection: {
          start: { rowIndex, colIndex: 0 },
          end: { rowIndex, colIndex: maxCol },
        },
      })
    },
    [state.columns.length, dispatch],
  )

  const isRowSelected = useCallback(
    (rowIndex: number): boolean => {
      if (!selectionRange) return false
      return (
        rowIndex >= selectionRange.minRow &&
        rowIndex <= selectionRange.maxRow &&
        selectionRange.minCol === 0 &&
        selectionRange.maxCol === state.columns.length - 1
      )
    },
    [selectionRange, state.columns.length],
  )

  return {
    handleCellMouseDown,
    handleCellMouseEnter,
    handleRowHeaderMouseDown,
    getSelectionRange,
    selectionRange,
    isCellSelected,
    isCellFocused,
    isRowSelected,
  }
}
