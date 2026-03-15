import { HeaderRow } from './HeaderRow.tsx'
import { VirtualRows } from './VirtualRows.tsx'

export function SheetGrid() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden border border-gray-300">
      <HeaderRow />
      <VirtualRows />
    </div>
  )
}
