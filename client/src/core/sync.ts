import type { RowId, SheetState, SyncPayload } from '../types.ts'

export function collectDirtyRows(state: SheetState): SyncPayload {
  const upserts: SyncPayload['upserts'] = []
  const deletes: RowId[] = []

  for (const [id, row] of state.rows) {
    switch (row.status) {
      case 'dirty':
      case 'new':
        upserts.push({ id, cells: { ...row.cells } })
        break
      case 'deleted':
        if (row.original) {
          deletes.push(id)
        }
        break
    }
  }

  return { upserts, deletes }
}

export function getDirtyCount(state: SheetState): number {
  let count = 0
  for (const row of state.rows.values()) {
    if (row.status !== 'clean') count++
  }
  return count
}

export function getErrorCount(state: SheetState): number {
  let count = 0
  for (const row of state.rows.values()) {
    if (row.status === 'deleted') continue
    for (const error of Object.values(row.errors)) {
      if (error != null) count++
    }
  }
  return count
}
