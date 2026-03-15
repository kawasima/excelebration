import { useState, useCallback, useRef } from 'react'
import type { CellValue, SheetState } from '../types.ts'
import type { SheetDispatch } from './useSheetReducer.ts'

export function useCellEdit(state: SheetState, dispatch: SheetDispatch) {
  const [editValue, setEditValue] = useState<string>('')
  const composingRef = useRef(false)
  const committingRef = useRef(false)

  const startEdit = useCallback(
    (initialValue?: string) => {
      if (!state.focusedCell) return
      const { rowIndex, colIndex } = state.focusedCell
      const rowId = state.filteredRowOrder[rowIndex]
      const row = state.rows.get(rowId)
      const col = state.columns[colIndex]
      if (!row || !col) return

      const currentValue = row.cells[col.key]
      setEditValue(initialValue ?? (currentValue == null ? '' : String(currentValue)))
      dispatch({ type: 'SET_EDITING', cell: state.focusedCell })
    },
    [state.focusedCell, state.filteredRowOrder, state.rows, state.columns, dispatch],
  )

  const commitEdit = useCallback(() => {
    if (!state.editingCell) return
    if (committingRef.current) return
    committingRef.current = true

    const { rowIndex, colIndex } = state.editingCell
    const rowId = state.filteredRowOrder[rowIndex]
    const col = state.columns[colIndex]
    if (!rowId || !col) {
      committingRef.current = false
      return
    }

    let value: CellValue = editValue
    if (col.type === 'number' && editValue !== '') {
      const num = Number(editValue)
      if (!isNaN(num)) value = num
    }

    dispatch({ type: 'SET_CELL', rowId, colKey: col.key, value })
    dispatch({ type: 'SET_EDITING', cell: null })
    committingRef.current = false
  }, [state.editingCell, state.filteredRowOrder, state.columns, editValue, dispatch])

  const cancelEdit = useCallback(() => {
    dispatch({ type: 'SET_EDITING', cell: null })
  }, [dispatch])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (composingRef.current) return

      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit()
        // Move focus down
        if (state.editingCell) {
          const maxRow = state.filteredRowOrder.length - 1
          const newRow = Math.min(maxRow, state.editingCell.rowIndex + 1)
          const cell = { rowIndex: newRow, colIndex: state.editingCell.colIndex }
          dispatch({ type: 'SET_FOCUS', cell })
          dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        commitEdit()
        if (state.editingCell) {
          const maxCol = state.columns.length - 1
          const dir = e.shiftKey ? -1 : 1
          let newCol = state.editingCell.colIndex + dir
          let newRow = state.editingCell.rowIndex
          const maxRow = state.filteredRowOrder.length - 1
          if (newCol > maxCol) { newCol = 0; newRow = Math.min(maxRow, newRow + 1) }
          if (newCol < 0) { newCol = maxCol; newRow = Math.max(0, newRow - 1) }
          const cell = { rowIndex: newRow, colIndex: newCol }
          dispatch({ type: 'SET_FOCUS', cell })
          dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    },
    [commitEdit, cancelEdit, state.editingCell, state.filteredRowOrder, state.columns, dispatch],
  )

  return {
    editValue,
    setEditValue,
    composingRef,
    startEdit,
    commitEdit,
    cancelEdit,
    handleEditKeyDown,
  }
}
