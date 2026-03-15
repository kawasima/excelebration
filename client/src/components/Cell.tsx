import { memo } from 'react'
import type { CellValue } from '../types.ts'
import { CellEditor } from './CellEditor.tsx'

type CellProps = {
  value: CellValue
  error: string | null
  isEditing: boolean
  isSelected: boolean
  isFocused: boolean
  colType: 'text' | 'number' | 'date' | 'select'
  colOptions?: string[]
  multiline?: boolean
  width: number
  rowHeight: number
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  sticky?: boolean
  stickyLeft?: number
}

export const Cell = memo(function Cell({
  value,
  error,
  isEditing,
  isSelected,
  isFocused,
  colType,
  colOptions,
  multiline,
  width,
  rowHeight,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  sticky,
  stickyLeft,
}: CellProps) {
  const style: React.CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    height: rowHeight,
    ...(sticky ? { position: 'sticky', left: stickyLeft, zIndex: 1 } : {}),
  }

  const bgClass = isEditing
    ? 'bg-white'
    : error
      ? isFocused
        ? 'bg-red-100'
        : isSelected
          ? 'bg-red-100'
          : 'bg-red-50'
      : isFocused
        ? 'bg-blue-50'
        : isSelected
          ? 'bg-blue-100/50'
          : sticky
            ? 'bg-gray-50'
            : 'bg-white'

  const outlineStyle: React.CSSProperties = isEditing
    ? {}
    : isFocused
      ? { outline: '2px solid #3b82f6', outlineOffset: '-2px' }
      : error
        ? { outline: '2px solid #f87171', outlineOffset: '-2px' }
        : {}

  return (
    <div
      className={`border-r border-b border-gray-200 ${bgClass} flex ${multiline ? 'items-start' : 'items-center'} overflow-hidden shrink-0 select-none`}
      style={{ ...style, ...outlineStyle }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      title={error ?? undefined}
    >
      {isEditing ? (
        <CellEditor colType={colType} options={colOptions} multiline={multiline} />
      ) : multiline ? (
        <span className="px-1 text-sm w-full whitespace-pre-wrap break-words overflow-hidden">
          {value == null ? '' : String(value)}
        </span>
      ) : (
        <span className={`px-1 text-sm truncate w-full ${colType === 'number' ? 'text-right' : ''}`}>
          {value == null ? '' : String(value)}
        </span>
      )}
    </div>
  )
})
