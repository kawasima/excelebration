import { useCallback } from 'react'
import type { SheetState } from '../types.ts'
import type { SheetDispatch } from './useSheetReducer.ts'
import { formatTSV } from '../core/clipboard.ts'

export function useClipboard(state: SheetState, dispatch: SheetDispatch) {
  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (!state.selection) return

      const { start, end } = state.selection
      const minRow = Math.min(start.rowIndex, end.rowIndex)
      const maxRow = Math.max(start.rowIndex, end.rowIndex)
      const minCol = Math.min(start.colIndex, end.colIndex)
      const maxCol = Math.max(start.colIndex, end.colIndex)

      const data = []
      for (let r = minRow; r <= maxRow; r++) {
        const rowId = state.filteredRowOrder[r]
        const row = state.rows.get(rowId)
        if (!row) continue

        const rowData = []
        for (let c = minCol; c <= maxCol; c++) {
          const col = state.columns[c]
          if (!col) continue
          rowData.push(row.cells[col.key])
        }
        data.push(rowData)
      }

      e.preventDefault()
      e.clipboardData.setData('text/plain', formatTSV(data))
    },
    [state],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (state.editingCell) return

      const anchor = state.focusedCell
      if (!anchor) return

      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      if (!text) return

      dispatch({ type: 'PASTE', tsv: text, anchor })
    },
    [state.focusedCell, state.editingCell, dispatch],
  )

  return { handleCopy, handlePaste }
}
