import { useCallback } from 'react'
import type { SheetState } from '../types.ts'
import type { SheetDispatch } from './useSheetReducer.ts'

export function useFilter(state: SheetState, dispatch: SheetDispatch) {
  const setFilter = useCallback(
    (colKey: string, value: string) => {
      dispatch({ type: 'SET_FILTER', filter: { colKey, value } })
    },
    [dispatch],
  )

  const removeFilter = useCallback(
    (colKey: string) => {
      dispatch({ type: 'REMOVE_FILTER', colKey })
    },
    [dispatch],
  )

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' })
  }, [dispatch])

  const toggleSort = useCallback(
    (colKey: string) => {
      dispatch({ type: 'TOGGLE_SORT', colKey })
    },
    [dispatch],
  )

  const getFilterValue = useCallback(
    (colKey: string): string => {
      const filter = state.filters.find(f => f.colKey === colKey)
      return filter?.value ?? ''
    },
    [state.filters],
  )

  const isFiltered = state.filters.length > 0
  const isSorted = state.sortState != null

  return {
    setFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    getFilterValue,
    isFiltered,
    isSorted,
    sortState: state.sortState,
  }
}
