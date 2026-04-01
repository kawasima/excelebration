import { useEffect } from 'react'
import type { ColumnDef } from '../types.ts'
import { arrowLoader } from '../core/arrowLoader.ts'
import type { SheetAction } from '../core/reducer.ts'

type UseServerLoadOptions = {
  serverUrl: string
  columns: ColumnDef[]
  primaryKey?: string
  certFingerprint?: string
  searchParams?: Record<string, string>
  dispatch: React.Dispatch<SheetAction>
} | null

export function useServerLoad(options: UseServerLoadOptions) {
  const serverUrl = options?.serverUrl ?? ''
  const certFingerprint = options?.certFingerprint
  const primaryKey = options?.primaryKey
  const searchParams = options?.searchParams
  const columns = options?.columns ?? []
  const dispatch = options?.dispatch
  // Stable string key for searchParams to use in effect deps
  const searchParamsKey = searchParams ? JSON.stringify(searchParams) : ''

  useEffect(() => {
    if (!serverUrl || !dispatch) return
    let cancelled = false

    const run = async () => {
      dispatch({ type: 'LOAD_BEGIN', columns, totalCount: null })

      let transport: WebTransport | null = null
      try {
        const wtOptions: WebTransportOptions = certFingerprint
          ? { serverCertificateHashes: [{ algorithm: 'sha-256', value: hexToBuffer(certFingerprint) }] }
          : {}

        transport = new WebTransport(buildUrl(serverUrl, '/api/rows', searchParams), wtOptions)
        await transport.ready
        if (cancelled) { transport.close(); return }

        const streamReader = transport.incomingUnidirectionalStreams.getReader()
        const { value: receiveStream } = await streamReader.read()
        streamReader.releaseLock()
        if (!receiveStream || cancelled) { transport.close(); return }

        const reader = receiveStream.getReader()
        for await (const batch of arrowLoader(reader, primaryKey)) {
          if (cancelled) break
          dispatch({ type: 'LOAD_BATCH', rows: batch })
          await new Promise(r => setTimeout(r, 0))
        }

        if (!cancelled) dispatch({ type: 'LOAD_COMPLETE' })
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          dispatch({ type: 'LOAD_ERROR', error: message })
        }
      } finally {
        transport?.close()
      }
    }

    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, certFingerprint, searchParamsKey])
}

function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, base)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  return url.toString()
}

function hexToBuffer(hex: string): ArrayBuffer {
  const clean = hex.replace(/:/g, '')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes.buffer
}
