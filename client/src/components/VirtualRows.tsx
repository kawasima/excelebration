import { useRef, useCallback } from 'react'
import { useSheetContext } from './SheetProvider.tsx'
import { useVirtualRows } from '../hooks/useVirtualRows.ts'
import { Row } from './Row.tsx'

export function VirtualRows() {
  const {
    state,
    selectionRange,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleRowHeaderMouseDown,
    startEdit,
    dispatch,
    handleKeyDown,
    handleCopy,
    handlePaste,
  } = useSheetContext()

  const containerRef = useRef<HTMLDivElement>(null)

  const { startIdx, endIdx, totalHeight, offsetY, onScroll } = useVirtualRows(
    state.filteredRowOrder,
    state.rows,
    state.rowHeight,
    containerRef,
  )

  const visibleIds = state.filteredRowOrder.slice(startIdx, endIdx)

  // Memoize columns array reference to prevent Row re-renders
  const columns = state.columns
  const columnWidths = state.columnWidths

  const onCellDoubleClick = useCallback((cell: { rowIndex: number; colIndex: number }) => {
    dispatch({ type: 'SET_FOCUS', cell })
    dispatch({ type: 'SET_SELECTION', selection: { start: cell, end: cell } })
    startEdit()
  }, [dispatch, startEdit])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto outline-none"
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      onPaste={handlePaste}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleIds.map((rowId, i) => {
            const row = state.rows.get(rowId)
            if (!row) return null
            const rowIndex = startIdx + i
            const rowHeight = row.height ?? state.rowHeight

            return (
              <Row
                key={rowId}
                row={row}
                rowIndex={rowIndex}
                columns={columns}
                columnWidths={columnWidths}
                rowHeight={rowHeight}
                editingCell={state.editingCell}
                frozenColumns={state.frozenColumns}
                selectionRange={selectionRange}
                focusedCell={state.focusedCell}
                colCount={columns.length}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                onCellDoubleClick={onCellDoubleClick}
                onRowHeaderMouseDown={handleRowHeaderMouseDown}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
