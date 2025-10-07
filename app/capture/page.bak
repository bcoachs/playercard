// app/capture/page.tsx
import { Suspense } from 'react'
import CaptureClient from './CaptureClient'

// Achtung: CaptureClient ist eine Client Component und nutzt useSearchParams.
// Daher hier eine Suspense-Boundary, sonst meckert Next bei der Prerendering-Phase.
export default function Page() {
  return (
    <Suspense fallback={
      <main className="p-6 text-center">
        <div className="text-xl font-semibold">Lade Stations-Erfassung…</div>
      </main>
    }>
      <CaptureClient />
    </Suspense>
  )
}
