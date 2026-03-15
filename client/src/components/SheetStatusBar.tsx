import { useSheetContext } from './SheetProvider.tsx'

export function SheetStatusBar() {
  const { totalCount, dirtyCount, errorCount, isFiltered, state } = useSheetContext()
  const { loadingState } = state

  if (loadingState.status === 'loading') {
    const loaded = loadingState.loadedCount
    const total = loadingState.totalCount
    const pct = total ? Math.round((loaded / total) * 100) : null
    return (
      <div className="flex items-center gap-3 px-3 py-1 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
        <span className="text-blue-600">
          Loading... {loaded.toLocaleString()} rows{total ? ` / ${total.toLocaleString()}` : ''}
          {pct !== null ? ` (${pct}%)` : ''}
        </span>
        <div className="flex-1 bg-gray-200 rounded h-1.5 max-w-xs">
          <div
            className="bg-blue-500 h-1.5 rounded transition-all"
            style={{ width: pct !== null ? `${pct}%` : '100%', opacity: pct !== null ? 1 : 0.4 }}
          />
        </div>
      </div>
    )
  }

  if (loadingState.status === 'error') {
    return (
      <div className="flex items-center gap-4 px-3 py-1 bg-gray-50 border-t border-gray-300 text-xs text-red-600">
        Load error: {loadingState.error}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 px-3 py-1 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
      <span>Rows: {totalCount}</span>
      {isFiltered && (
        <span className="text-yellow-600">
          (filtered from {state.rowOrder.length})
        </span>
      )}
      {dirtyCount > 0 && (
        <span className="text-blue-600">Changed: {dirtyCount}</span>
      )}
      {errorCount > 0 && (
        <span className="text-red-600">Errors: {errorCount}</span>
      )}
    </div>
  )
}
