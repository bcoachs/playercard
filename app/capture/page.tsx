import { Suspense } from 'react'
import CaptureClient from './Client'

export const dynamic = 'force-dynamic'   // kein SSG für diese Route
export const revalidate = 0

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Lade Erfassung…</div>}>
      <CaptureClient />
    </Suspense>
  )
}
