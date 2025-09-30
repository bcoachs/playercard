// page.tsx
import { Suspense } from 'react'
import CaptureHubClient from './Client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params, searchParams }: any) {
  return (
    <Suspense fallback={<div className="p-8">Lade Capture-Hub…</div>}>
      <CaptureHubClient projectId={params.id} />
    </Suspense>
  )
}
