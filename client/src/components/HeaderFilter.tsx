import { useState, useEffect, useRef } from 'react'
import { useSheetContext } from './SheetProvider.tsx'

type HeaderFilterProps = {
  colKey: string
  colType: 'text' | 'number' | 'date' | 'select'
  options?: string[]
  onClose: () => void
}

export function HeaderFilter({ colKey, colType, options, onClose }: HeaderFilterProps) {
  const { getFilterValue, setFilter, removeFilter } = useSheetContext()
  const [value, setValue] = useState(getFilterValue(colKey))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const apply = () => {
    if (value) {
      setFilter(colKey, value)
    } else {
      removeFilter(colKey)
    }
    onClose()
  }

  const clear = () => {
    removeFilter(colKey)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 bg-white border border-gray-300 shadow-lg rounded p-2 min-w-[180px]"
      onClick={e => e.stopPropagation()}
    >
      {colType === 'select' && options ? (
        <select
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2"
          value={value}
          onChange={e => setValue(e.target.value)}
        >
          <option value="">All</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2"
          type="text"
          placeholder="Filter..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply() }}
          autoFocus
        />
      )}
      <div className="flex gap-1">
        <button
          className="flex-1 bg-blue-500 text-white text-xs rounded px-2 py-1 hover:bg-blue-600"
          onClick={apply}
        >
          Apply
        </button>
        <button
          className="flex-1 bg-gray-200 text-gray-700 text-xs rounded px-2 py-1 hover:bg-gray-300"
          onClick={clear}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
