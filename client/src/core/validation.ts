import * as z from 'zod'
import type { CellValue, ColumnDef, RowState, ValidationResult } from '../types.ts'

export function validateCell(
  column: ColumnDef,
  value: CellValue,
  row: Record<string, CellValue>,
): string | null {
  const fieldSchema = column.zodSchema
  if (!fieldSchema) return legacyValidateCell(column, value, row)

  // Zod's optional() accepts undefined but not null — normalize null → undefined
  const result = fieldSchema.safeParse(value ?? undefined)
  if (!result.success) {
    return result.error.issues[0]?.message ?? 'Invalid value'
  }
  return null
}

// zodSchema がない ColumnDef 向けのフォールバック（後方互換）
function legacyValidateCell(
  column: ColumnDef,
  value: CellValue,
  row: Record<string, CellValue>,
): string | null {
  if (column.required && (value == null || value === '')) {
    return `${column.label}は必須です`
  }

  if (value == null || value === '') return null

  switch (column.type) {
    case 'number': {
      const num = typeof value === 'number' ? value : Number(value)
      if (isNaN(num)) return `${column.label}は数値で入力してください`
      break
    }
    case 'date': {
      const str = String(value)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || isNaN(Date.parse(str))) {
        return `${column.label}はYYYY-MM-DD形式で入力してください`
      }
      break
    }
    case 'select': {
      if (column.options && !column.options.includes(String(value))) {
        return `${column.label}の値が不正です`
      }
      break
    }
  }

  if (column.validate) {
    return column.validate(value, row)
  }

  return null
}

export function validateRow(
  columns: ColumnDef[],
  row: RowState,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {}
  for (const col of columns) {
    errors[col.key] = validateCell(col, row.cells[col.key], row.cells)
  }
  return errors
}

export function validateAll(
  columns: ColumnDef[],
  rows: Map<string, RowState>,
): { results: Map<string, Record<string, string | null>>; summary: ValidationResult } {
  const results = new Map<string, Record<string, string | null>>()
  let errorCount = 0

  for (const [id, row] of rows) {
    if (row.status === 'deleted') continue
    const errors = validateRow(columns, row)
    results.set(id, errors)
    errorCount += Object.values(errors).filter(e => e != null).length
  }

  return {
    results,
    summary: { valid: errorCount === 0, errorCount },
  }
}

export function zodObjectToRowSchema(
  schema: z.ZodObject<z.ZodRawShape>,
): z.ZodObject<z.ZodRawShape> {
  return schema
}
