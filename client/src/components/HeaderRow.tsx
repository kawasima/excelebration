import { useState } from 'react'
import { useSheetContext } from './SheetProvider.tsx'
import { HeaderFilter } from './HeaderFilter.tsx'

export function HeaderRow() {
  const { state, startResize, toggleSort, sortState } = useSheetContext()
  const [filterCol, setFilterCol] = useState<string | null>(null)

  const ROW_HEADER_WIDTH = 40
  let stickyOffset = ROW_HEADER_WIDTH

  return (
    <div className="flex border-b-2 border-gray-300 bg-gray-100 sticky top-0 z-10">
      {/* 行番号列ヘッダ */}
      <div
        className="shrink-0 border-r border-gray-300 bg-gray-100"
        style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, height: 32, position: 'sticky', left: 0, zIndex: 2 }}
      />
      {state.columns.map((col, colIndex) => {
        const width = state.columnWidths[col.key] ?? 120
        const isSorted = sortState?.colKey === col.key
        const sortDir = isSorted ? sortState.direction : null
        const sticky = colIndex < state.frozenColumns
        const left = sticky ? stickyOffset : undefined
        if (sticky) stickyOffset += width

        const hasFilter = state.filters.some(f => f.colKey === col.key)

        return (
          <div
            key={col.key}
            className={`relative flex items-center border-r border-gray-300 select-none shrink-0 ${sticky ? 'z-20 bg-gray-100' : ''}`}
            style={{
              width,
              minWidth: width,
              maxWidth: width,
              height: 32,
              ...(sticky ? { position: 'sticky', left } : {}),
            }}
          >
            <button
              className="flex-1 text-left px-2 text-xs font-semibold text-gray-700 truncate hover:bg-gray-200 h-full"
              onClick={() => toggleSort(col.key)}
            >
              {col.label}
              {isSorted && (
                <span className="ml-1 text-blue-600">
                  {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                </span>
              )}
            </button>

            <button
              className={`px-1 text-xs hover:bg-gray-200 h-full ${hasFilter ? 'text-blue-600' : 'text-gray-400'}`}
              onClick={e => {
                e.stopPropagation()
                setFilterCol(filterCol === col.key ? null : col.key)
              }}
              title="Filter"
            >
              ▽
            </button>

            {filterCol === col.key && (
              <HeaderFilter
                colKey={col.key}
                colType={col.type}
                options={col.options}
                onClose={() => setFilterCol(null)}
              />
            )}

            <div
              className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-400"
              onPointerDown={e => startResize(col.key, width, e)}
            />
          </div>
        )
      })}
    </div>
  )
}
