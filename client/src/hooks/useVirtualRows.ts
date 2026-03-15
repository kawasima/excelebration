import { useState, useMemo, useCallback, type RefObject } from 'react'
import type { RowId, SheetState } from '../types.ts'

const BUFFER = 20

/** Binary search on cumulative heights array */
function findRowIndex(cumHeights: number[], scrollTop: number): number {
  let lo = 0
  let hi = cumHeights.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumHeights[mid] <= scrollTop) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Build cumulative heights array from filteredRowOrder + rows map.
 * Returns both the cumulative heights and total height.
 */
function buildCumHeights(
  filteredRowOrder: RowId[],
  rows: SheetState['rows'],
  defaultRowHeight: number,
): { cumHeights: number[]; totalHeight: number } {
  const n = filteredRowOrder.length
  const cumHeights = new Array<number>(n + 1)
  cumHeights[0] = 0
  for (let i = 0; i < n; i++) {
    cumHeights[i + 1] = cumHeights[i] + (rows.get(filteredRowOrder[i])?.height ?? defaultRowHeight)
  }
  return { cumHeights, totalHeight: cumHeights[n] }
}

export function useVirtualRows(
  filteredRowOrder: RowId[],
  rows: SheetState['rows'],
  defaultRowHeight: number,
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const [scrollTop, setScrollTop] = useState(0)

  const { cumHeights, totalHeight } = useMemo(
    () => buildCumHeights(filteredRowOrder, rows, defaultRowHeight),
    [filteredRowOrder, rows, defaultRowHeight],
  )

  const viewportHeight = containerRef.current?.clientHeight ?? 600
  const totalCount = filteredRowOrder.length

  const startIdx = Math.max(0, findRowIndex(cumHeights, scrollTop) - BUFFER)
  const endIdx = Math.min(totalCount, findRowIndex(cumHeights, scrollTop + viewportHeight) + BUFFER)
  const offsetY = cumHeights[startIdx]

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return { startIdx, endIdx, totalHeight, offsetY, onScroll }
}
