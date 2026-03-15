import { useReducer, useCallback } from 'react'
import * as z from 'zod'
import type { CellValue, SheetState } from '../types.ts'
import { createInitialState, sheetReducer, type SheetAction } from '../core/reducer.ts'
import { zodToColumns } from '../core/schema.ts'

export function useSheetReducer(schema: z.ZodObject<z.ZodRawShape>, initialData: Record<string, CellValue>[]) {
  const [state, dispatch] = useReducer(sheetReducer, undefined, () => {
    const base = createInitialState()
    return sheetReducer(base, { type: 'INIT', data: initialData, columns: zodToColumns(schema) })
  })

  const stableDispatch = useCallback((action: SheetAction) => {
    dispatch(action)
  }, [])

  return [state, stableDispatch] as const
}

export type SheetDispatch = (action: SheetAction) => void
export type { SheetState, SheetAction }
