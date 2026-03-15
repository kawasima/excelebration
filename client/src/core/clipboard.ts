import type { CellValue } from '../types.ts'

export function parseTSV(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .trimEnd()
    .split('\n')
    .map(line => line.split('\t'))
}

export function formatTSV(data: CellValue[][]): string {
  return data
    .map(row => row.map(cell => (cell == null ? '' : String(cell))).join('\t'))
    .join('\n')
}
