import type { CellValue, RowId } from '../types.ts'
import { nanoid } from 'nanoid'

export type LoadedRow = { id: RowId; cells: Record<string, CellValue> }

/**
 * Async generator that reads length-prefixed Arrow IPC batches from a stream.
 *
 * @param primaryKey - If set, the value of this column is used as the row's ID.
 *                     Otherwise, a nanoid() is generated for each row.
 */
export async function* arrowLoader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  primaryKey?: string,
): AsyncGenerator<LoadedRow[]> {
  const { tableFromIPC } = await import('apache-arrow')

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

  while (true) {
    const lenBytes = await readExact(4)
    if (!lenBytes) break

    const length = new DataView(lenBytes.buffer, lenBytes.byteOffset, 4).getUint32(0, false)
    if (length === 0) break

    const ipcBytes = await readExact(length)
    if (!ipcBytes) break

    const table = tableFromIPC(ipcBytes)
    const fieldNames = table.schema.fields.map(f => f.name)
    const numRows = table.numRows

    const rows: LoadedRow[] = []
    for (let i = 0; i < numRows; i++) {
      const cells: Record<string, CellValue> = {}
      let rowId: string = nanoid()
      for (let c = 0; c < fieldNames.length; c++) {
        const name = fieldNames[c]
        const col = table.getChildAt(c)
        const val = col?.get(i) ?? null

        // Extract row ID from the primary key column
        if (primaryKey && name === primaryKey && val != null) {
          rowId = String(val)
        }

        if (val === null || val === undefined) {
          cells[name] = null
        } else if (typeof val === 'bigint') {
          cells[name] = Number(val)
        } else {
          cells[name] = val as CellValue
        }
      }
      rows.push({ id: rowId, cells })
    }

    yield rows
  }
}
