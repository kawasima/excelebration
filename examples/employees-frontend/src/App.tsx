import * as z from 'zod'
import type { SyncPayload, SyncResult } from 'excelebration'
import { SheetProvider, SheetGrid, SheetToolbar, SheetStatusBar } from 'excelebration'

const schema = z.object({
  id: z.number()
    .meta({ label: 'ID', width: 60 }),
  name: z.string().min(1)
    .meta({ label: '名前', width: 150 }),
  age: z.number().optional()
    .meta({ label: '年齢', width: 80 }),
  dept: z.enum(['営業', '開発', '総務', '人事', '経理']).optional()
  .meta({ label: '部署', width: 120 }),
  joinDate: z.iso.date().optional()
    .meta({ label: '入社日', width: 130 }),
  email: z.email({ error: 'メール形式が不正です' }).optional()
    .meta({ label: 'メール', width: 200 }),
  note: z.string().optional()
    .meta({ label: '備考', width: 200, multiline: true }),
})

async function handleSync(payload: SyncPayload): Promise<SyncResult> {
  console.log('Sync payload:', payload)
  await new Promise(r => setTimeout(r, 500))
  return {
    accepted: payload.upserts.map(u => u.id),
    errors: [],
  }
}

const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined
const certFingerprint = import.meta.env.VITE_CERT_FINGERPRINT as string | undefined

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold">
        Excelebration Demo
      </div>
      <SheetProvider schema={schema} primaryKey="id" onSync={handleSync}
        serverUrl={serverUrl}
        certFingerprint={certFingerprint}>
        <SheetToolbar />
        <SheetGrid />
        <SheetStatusBar />
      </SheetProvider>
    </div>
  )
}
