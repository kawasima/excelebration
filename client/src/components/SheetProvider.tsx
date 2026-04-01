import { createContext, useContext, type ReactNode } from 'react'
import * as z from 'zod'
import type { CellValue, SyncPayload, SyncResult } from '../types.ts'
import { useSheet } from '../hooks/useSheet.ts'

type SheetContextType = ReturnType<typeof useSheet>

const SheetContext = createContext<SheetContextType | null>(null)

export function useSheetContext() {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('useSheetContext must be used within SheetProvider')
  return ctx
}

export type SheetProviderProps = {
  schema: z.ZodObject<z.ZodRawShape>
  /** Which column in the schema serves as the row's unique identifier.
   *  When set, its value is used as RowId; otherwise nanoid() is used. */
  primaryKey?: string
  initialData?: Record<string, CellValue>[]
  onSync?: (payload: SyncPayload) => Promise<SyncResult>
  serverUrl?: string
  certFingerprint?: string
  /** Search/filter parameters sent to the server as URL query parameters.
   *  When changed, the connection is re-established and data is reloaded. */
  searchParams?: Record<string, string>
  children: ReactNode
}

export function SheetProvider({ schema, primaryKey, initialData = [], onSync, serverUrl, certFingerprint, searchParams, children }: SheetProviderProps) {
  const sheet = useSheet({ schema, primaryKey, initialData, onSync, serverUrl, certFingerprint, searchParams })

  return (
    <SheetContext.Provider value={sheet}>
      {children}
    </SheetContext.Provider>
  )
}
