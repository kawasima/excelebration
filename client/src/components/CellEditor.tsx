import { useEffect, useRef } from 'react'
import { useSheetContext } from './SheetProvider.tsx'

type CellEditorProps = {
  colType: 'text' | 'number' | 'date' | 'select'
  options?: string[]
  multiline?: boolean
}

export function CellEditor({ colType, options, multiline }: CellEditorProps) {
  const { editValue, setEditValue, composingRef, handleEditKeyDown, commitEdit } = useSheetContext()
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (colType === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        className="w-full h-full border-0 outline-none bg-white px-1 text-sm"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleEditKeyDown}
        onBlur={commitEdit}
      >
        <option value="">--</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className="w-full h-full border-0 outline-none bg-white px-1 text-sm resize-none"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && e.shiftKey) {
            // Shift+Enter は改行挿入 — デフォルト動作に任せる
            return
          }
          handleEditKeyDown(e)
        }}
        onBlur={commitEdit}
        onCompositionStart={() => { composingRef.current = true }}
        onCompositionEnd={() => { composingRef.current = false }}
      />
    )
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      className="w-full h-full border-0 outline-none bg-white px-1 text-sm"
      type={colType === 'date' ? 'date' : 'text'}
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onKeyDown={handleEditKeyDown}
      onBlur={commitEdit}
      onCompositionStart={() => { composingRef.current = true }}
      onCompositionEnd={() => { composingRef.current = false }}
    />
  )
}
