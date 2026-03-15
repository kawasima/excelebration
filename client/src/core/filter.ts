import type { CellValue, ColumnDef, FilterCondition, RowId, RowState, SortState } from '../types.ts'

export function filterRows(
  rowOrder: RowId[],
  rows: Map<RowId, RowState>,
  filters: FilterCondition[],
): RowId[] {
  if (filters.length === 0) return rowOrder

  return rowOrder.filter(id => {
    const row = rows.get(id)
    if (!row || row.status === 'deleted') return false

    return filters.every(filter => {
      const cellValue = row.cells[filter.colKey]
      if (cellValue == null) return filter.value === ''
      return String(cellValue).toLowerCase().includes(filter.value.toLowerCase())
    })
  })
}

function compareCellValues(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a).localeCompare(String(b), 'ja')
}

export function sortRows(
  rowOrder: RowId[],
  rows: Map<RowId, RowState>,
  sortState: SortState,
  _columns: ColumnDef[],
): RowId[] {
  if (!sortState) return rowOrder

  const sorted = [...rowOrder]
  const { colKey, direction } = sortState
  const multiplier = direction === 'asc' ? 1 : -1

  sorted.sort((aId, bId) => {
    const aRow = rows.get(aId)
    const bRow = rows.get(bId)
    if (!aRow || !bRow) return 0

    return multiplier * compareCellValues(aRow.cells[colKey], bRow.cells[colKey])
  })

  return sorted
}

export function applyFilterAndSort(
  rowOrder: RowId[],
  rows: Map<RowId, RowState>,
  filters: FilterCondition[],
  sortState: SortState,
  columns: ColumnDef[],
): RowId[] {
  const filtered = filterRows(rowOrder, rows, filters)
  return sortRows(filtered, rows, sortState, columns)
}
