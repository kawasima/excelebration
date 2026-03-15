import type { SyncPayload, SyncResult, RowId } from '../types.ts'

export async function syncViaWebTransport(
  serverUrl: string,
  certFingerprint: string | undefined,
  payload: SyncPayload,
  primaryKey?: string,
): Promise<SyncResult> {
  const arrow = await import('apache-arrow')
  const { tableFromIPC, tableToIPC, Utf8, vectorFromArray, makeTable } = arrow

  const upsertBytes = buildUpsertsIPC(payload, primaryKey, { tableToIPC, Utf8, vectorFromArray, makeTable })
  const deleteBytes = buildDeletesIPC(payload, primaryKey, { tableToIPC, Utf8, vectorFromArray, makeTable })

  const options: WebTransportOptions = certFingerprint
    ? { serverCertificateHashes: [{ algorithm: 'sha-256', value: hexToBuffer(certFingerprint) }] }
    : {}

  const transport = new WebTransport(serverUrl + '/api/sync', options)
  await transport.ready

  try {
    const { readable, writable } = await transport.createBidirectionalStream()

    const writer = writable.getWriter()
    await writer.write(lengthPrefix(upsertBytes))
    await writer.write(lengthPrefix(deleteBytes))
    await writer.close()

    const reader = readable.getReader()
    const responseBytes = await readLengthPrefixed(reader)
    if (!responseBytes) return { accepted: [], errors: [] }

    const table = tableFromIPC(responseBytes)
    const acceptedIds: RowId[] = []
    const col = table.getChildAt(0)
    for (let i = 0; i < table.numRows; i++) {
      const v = col?.get(i)
      if (v) acceptedIds.push(v as RowId)
    }

    return { accepted: acceptedIds, errors: [] }
  } finally {
    transport.close()
  }
}

/**
 * Build Arrow IPC for upserts.
 *
 * When primaryKey is set, the row's ID is already in cells[primaryKey],
 * so we add a `_rowId` column with the internal RowId for the server to return.
 * When primaryKey is not set, `_rowId` is the only way to identify the row.
 */
function buildUpsertsIPC(payload: SyncPayload, _primaryKey: string | undefined, arrow: any): Uint8Array {
  const { tableToIPC, Utf8, vectorFromArray, makeTable } = arrow
  if (payload.upserts.length === 0) return new Uint8Array(0)

  const keys = Object.keys(payload.upserts[0].cells)
  const tbl = makeTable({
    _rowId: vectorFromArray(payload.upserts.map(u => u.id), new Utf8()),
    ...Object.fromEntries(keys.map(k => [
      k,
      vectorFromArray(
        payload.upserts.map(u => u.cells[k] == null ? null : String(u.cells[k])),
        new Utf8(),
      ),
    ])),
  })
  return tableToIPC(tbl)
}

function buildDeletesIPC(payload: SyncPayload, _primaryKey: string | undefined, arrow: any): Uint8Array {
  const { tableToIPC, Utf8, vectorFromArray, makeTable } = arrow
  if (payload.deletes.length === 0) return new Uint8Array(0)

  const tbl = makeTable({ _rowId: vectorFromArray(payload.deletes, new Utf8()) })
  return tableToIPC(tbl)
}

function lengthPrefix(bytes: Uint8Array): Uint8Array {
  const buf = new Uint8Array(4 + bytes.length)
  new DataView(buf.buffer).setUint32(0, bytes.length, false)
  buf.set(bytes, 4)
  return buf
}

async function readLengthPrefixed(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array | null> {
  let buffer = new Uint8Array(0)

  const readExact = async (n: number): Promise<Uint8Array | null> => {
    while (buffer.length < n) {
      const { done, value } = await reader.read()
      if (done) return null
      const merged = new Uint8Array(buffer.length + value.length)
      merged.set(buffer)
      merged.set(value, buffer.length)
      buffer = merged
    }
    const result = buffer.slice(0, n)
    buffer = buffer.slice(n)
    return result
  }

  const lenBytes = await readExact(4)
  if (!lenBytes) return null
  const length = new DataView(lenBytes.buffer, lenBytes.byteOffset, 4).getUint32(0, false)
  if (length === 0) return null
  return readExact(length)
}

function hexToBuffer(hex: string): ArrayBuffer {
  const clean = hex.replace(/:/g, '')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes.buffer
}
