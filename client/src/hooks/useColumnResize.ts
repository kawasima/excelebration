import { useCallback, useRef } from 'react'
import type { SheetDispatch } from './useSheetReducer.ts'

export function useColumnResize(dispatch: SheetDispatch) {
  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null)

  const startResize = useCallback(
    (colKey: string, startWidth: number, e: React.PointerEvent) => {
      e.preventDefault()
      resizingRef.current = { colKey, startX: e.clientX, startWidth }

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!resizingRef.current) return
        const delta = moveEvent.clientX - resizingRef.current.startX
        const newWidth = resizingRef.current.startWidth + delta
        dispatch({ type: 'RESIZE_COLUMN', colKey: resizingRef.current.colKey, width: newWidth })
      }

      const onPointerUp = () => {
        resizingRef.current = null
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
      }

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    },
    [dispatch],
  )

  return { startResize }
}
