import { useCallback, useRef, useEffect } from 'react'
import type { SheetState } from '../types.ts'
import type { SheetDispatch } from './useSheetReducer.ts'

export function useKeyboard(state: SheetState, dispatch: SheetDispatch) {
  // Use ref to avoid recreating handleKeyDown on every state change
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { focusedCell, editingCell, filteredRowOrder, columns } = stateRef.current
      if (!focusedCell) return

      const maxRow = filteredRowOrder.length - 1
      const maxCol = columns.length - 1
      const isEditing = editingCell != null

      // Ctrl+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && !isEditing) {
        if (e.key === 'z') {
          e.preventDefault()
          dispatch({ type: 'UNDO' })
          return
        }
        if (e.key === 'y') {
          e.preventDefault()
          dispatch({ type: 'REDO' })
          return
        }
      }

      // When editing, only handle Enter, Tab, Escape
      if (isEditing) {
        if (e.key === 'Escape') {
          e.preventDefault()
          dispatch({ type: 'SET_EDITING', cell: null })
          return
        }
        // Enter and Tab are handled by CellEditor
        return
      }

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          const newRow = Math.max(0, focusedCell.rowIndex - 1)
          const cell = { rowIndex: newRow, colIndex: focusedCell.colIndex }
          dispatch({ type: 'SET_FOCUS', cell })
          if (e.shiftKey && state.selection) {
            dispatch({ type: 'SET_SELECTION', selection: { start: state.selection.start, end: cell } })
          } else {
            dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const newRow = Math.min(maxRow, focusedCell.rowIndex + 1)
          const cell = { rowIndex: newRow, colIndex: focusedCell.colIndex }
          dispatch({ type: 'SET_FOCUS', cell })
          if (e.shiftKey && state.selection) {
            dispatch({ type: 'SET_SELECTION', selection: { start: state.selection.start, end: cell } })
          } else {
            dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
          }
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const newCol = Math.max(0, focusedCell.colIndex - 1)
          const cell = { rowIndex: focusedCell.rowIndex, colIndex: newCol }
          dispatch({ type: 'SET_FOCUS', cell })
          if (e.shiftKey && state.selection) {
            dispatch({ type: 'SET_SELECTION', selection: { start: state.selection.start, end: cell } })
          } else {
            dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
          }
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          const newCol = Math.min(maxCol, focusedCell.colIndex + 1)
          const cell = { rowIndex: focusedCell.rowIndex, colIndex: newCol }
          dispatch({ type: 'SET_FOCUS', cell })
          if (e.shiftKey && state.selection) {
            dispatch({ type: 'SET_SELECTION', selection: { start: state.selection.start, end: cell } })
          } else {
            dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
          }
          break
        }
        case 'Tab': {
          e.preventDefault()
          const dir = e.shiftKey ? -1 : 1
          let newCol = focusedCell.colIndex + dir
          let newRow = focusedCell.rowIndex
          if (newCol > maxCol) { newCol = 0; newRow = Math.min(maxRow, newRow + 1) }
          if (newCol < 0) { newCol = maxCol; newRow = Math.max(0, newRow - 1) }
          const cell = { rowIndex: newRow, colIndex: newCol }
          dispatch({ type: 'SET_FOCUS', cell })
          dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
          break
        }
        case 'Enter': {
          e.preventDefault()
          dispatch({ type: 'SET_EDITING', cell: focusedCell })
          break
        }
        case 'F2': {
          e.preventDefault()
          dispatch({ type: 'SET_EDITING', cell: focusedCell })
          break
        }
        case 'Delete':
        case 'Backspace': {
          e.preventDefault()
          if (state.selection) {
            const { start, end } = state.selection
            const minRow = Math.min(start.rowIndex, end.rowIndex)
            const maxRowSel = Math.max(start.rowIndex, end.rowIndex)
            const minCol = Math.min(start.colIndex, end.colIndex)
            const maxColSel = Math.max(start.colIndex, end.colIndex)
            // 行全体選択なら行削除
            if (minCol === 0 && maxColSel === maxCol) {
              const rowIds = []
              for (let r = minRow; r <= maxRowSel; r++) {
                const id = filteredRowOrder[r]
                if (id) rowIds.push(id)
              }
              if (rowIds.length > 0) dispatch({ type: 'DELETE_ROWS', rowIds })
            } else {
              const cells = []
              for (let r = minRow; r <= maxRowSel; r++) {
                for (let c = minCol; c <= maxColSel; c++) {
                  cells.push({ rowIndex: r, colIndex: c })
                }
              }
              dispatch({ type: 'DELETE_CELL_VALUES', cells })
            }
          }
          break
        }
        default: {
          // Start editing on printable character
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            dispatch({ type: 'SET_EDITING', cell: focusedCell })
          }
          break
        }
      }
    },
    [dispatch],
  )

  return { handleKeyDown }
}
