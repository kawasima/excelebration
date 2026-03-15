import { useSheetContext } from './SheetProvider.tsx'

export function SheetToolbar() {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    validateAll,
    sync,
    addRows,
    mergeCells,
    state,
    clearFilters,
    isFiltered,
    deleteRows,
  } = useSheetContext()

  const handleDeleteSelected = () => {
    if (!state.selection) return
    const { start, end } = state.selection
    const minRow = Math.min(start.rowIndex, end.rowIndex)
    const maxRow = Math.max(start.rowIndex, end.rowIndex)
    const rowIds = []
    for (let r = minRow; r <= maxRow; r++) {
      const id = state.filteredRowOrder[r]
      if (id) rowIds.push(id)
    }
    if (rowIds.length > 0) deleteRows(rowIds)
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-50 border-b border-gray-300">
      <button
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
        onClick={() => addRows(1)}
        title="Add Row"
      >
        + Row
      </button>
      <button
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
        onClick={handleDeleteSelected}
        disabled={!state.selection}
        title="Delete selected rows"
      >
        Delete Row
      </button>
      <button
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
        onClick={mergeCells}
        disabled={!state.selection}
        title="Merge selected cells"
      >
        Merge
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {isFiltered && (
        <button
          className="px-2 py-1 text-xs bg-yellow-100 border border-yellow-400 rounded hover:bg-yellow-200"
          onClick={clearFilters}
          title="Clear all filters and sort"
        >
          Clear Filters
        </button>
      )}

      <div className="flex-1" />

      <button
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
        onClick={() => validateAll()}
        title="Validate All"
      >
        Validate
      </button>
      <button
        className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => sync()}
        title="Save changes"
      >
        Save
      </button>
    </div>
  )
}
