import { memo } from 'react'
import type { RowState, ColumnDef, CellAddress } from '../types.ts'
import type { SelectionRange } from '../hooks/useSelection.ts'
import { Cell } from './Cell.tsx'

type RowProps = {
  row: RowState
  rowIndex: number
  columns: ColumnDef[]
  columnWidths: Record<string, number>
  rowHeight: number
  editingCell: CellAddress | null
  frozenColumns: number
  selectionRange: SelectionRange
  focusedCell: CellAddress | null
  colCount: number
  onCellMouseDown: (cell: CellAddress, e: React.MouseEvent) => void
  onCellMouseEnter: (cell: CellAddress, e: React.MouseEvent) => void
  onCellDoubleClick: (cell: CellAddress) => void
  onRowHeaderMouseDown: (rowIndex: number) => void
}

const ROW_HEADER_WIDTH = 40

export const Row = memo(function Row({
  row,
  rowIndex,
  columns,
  columnWidths,
  rowHeight,
  editingCell,
  frozenColumns,
  selectionRange,
  focusedCell,
  colCount,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onRowHeaderMouseDown,
}: RowProps) {
  const rowSelected = selectionRange != null &&
    rowIndex >= selectionRange.minRow &&
    rowIndex <= selectionRange.maxRow &&
    selectionRange.minCol === 0 &&
    selectionRange.maxCol === colCount - 1

  const statusColor = row.status === 'dirty'
    ? 'bg-blue-500'
    : row.status === 'new'
      ? 'bg-green-500'
      : row.status === 'deleted'
        ? 'bg-red-500'
        : 'bg-transparent'

  let stickyOffset = ROW_HEADER_WIDTH

  return (
    <div className={`flex ${row.status === 'deleted' ? 'opacity-40 line-through' : ''}`} style={{ height: rowHeight }}>
      {/* Row number header */}
      <div
        className={`shrink-0 border-r border-b border-gray-200 flex items-center justify-end select-none cursor-pointer ${rowSelected ? 'bg-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`}
        style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: rowHeight, position: 'sticky', left: 0, zIndex: 1 }}
        onMouseDown={() => onRowHeaderMouseDown(rowIndex)}
      >
        <div className={`w-1 self-stretch ${statusColor}`} />
        <span className="text-xs text-gray-500 pr-1 flex-1 text-right">{rowIndex + 1}</span>
      </div>

      {columns.map((col, colIndex) => {
        const width = columnWidths[col.key] ?? 120
        const isEditing =
          editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex
        const isSelected = selectionRange != null &&
          rowIndex >= selectionRange.minRow &&
          rowIndex <= selectionRange.maxRow &&
          colIndex >= selectionRange.minCol &&
          colIndex <= selectionRange.maxCol
        const isFocused = focusedCell != null &&
          focusedCell.rowIndex === rowIndex &&
          focusedCell.colIndex === colIndex
        const sticky = colIndex < frozenColumns
        const left = sticky ? stickyOffset : undefined

        if (sticky) stickyOffset += width

        return (
          <Cell
            key={col.key}
            value={row.cells[col.key]}
            error={row.errors[col.key] ?? null}
            isEditing={isEditing}
            isSelected={isSelected}
            isFocused={isFocused}
            colType={col.type}
            colOptions={col.options}
            multiline={col.multiline ?? false}
            width={width}
            rowHeight={rowHeight}
            onMouseDown={e => onCellMouseDown({ rowIndex, colIndex }, e)}
            onMouseEnter={e => onCellMouseEnter({ rowIndex, colIndex }, e)}
            onDoubleClick={() => onCellDoubleClick({ rowIndex, colIndex })}
            sticky={sticky}
            stickyLeft={left}
          />
        )
      })}
    </div>
  )
})
