import * as z from 'zod'
import type { ColumnDef } from '../types.ts'

export type ColumnMeta = {
  label: string
  width?: number
  options?: string[]
}

declare module 'zod' {
  interface GlobalMeta {
    label?: string
    width?: number
    options?: string[]
    multiline?: boolean
  }
}

type ColType = ColumnDef['type']

function inferColType(shape: z.ZodTypeAny): ColType {
  const inner = unwrap(shape)
  if (inner instanceof z.ZodNumber) return 'number'
  if (inner instanceof z.ZodEnum) return 'select'
  if (inner instanceof z.ZodDate) return 'date'
  if (inner instanceof z.ZodEmail) return 'text'
  // z.iso.date() → ZodISODate
  if (inner.constructor.name === 'ZodISODate') return 'date'
  return 'text'
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrap(schema.unwrap() as z.ZodTypeAny)
  }
  if (schema instanceof z.ZodDefault) {
    return unwrap(schema._def.innerType as z.ZodTypeAny)
  }
  return schema
}

function isRequired(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return false
  if (schema instanceof z.ZodDefault) return false
  return true
}

export function zodToColumns(schema: z.ZodObject<z.ZodRawShape>): ColumnDef[] {
  return Object.entries(schema.shape).map(([key, fieldSchema]) => {
    const meta = (fieldSchema as z.ZodTypeAny).meta() ?? {}
    const inner = unwrap(fieldSchema as z.ZodTypeAny)
    const colType: ColType =
      meta.options ? 'select' : inferColType(fieldSchema as z.ZodTypeAny)

    // ZodEnum の場合は values を options として使う
    const options: string[] | undefined =
      meta.options ??
      (inner instanceof z.ZodEnum ? (inner.options as string[]) : undefined)

    return {
      key,
      label: meta.label ?? key,
      type: colType,
      width: meta.width,
      options,
      required: isRequired(fieldSchema as z.ZodTypeAny),
      zodSchema: fieldSchema as z.ZodTypeAny,
      multiline: meta.multiline ?? false,
    }
  })
}
