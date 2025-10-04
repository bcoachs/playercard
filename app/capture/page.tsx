// app/capture/page.tsx
import { Suspense } from 'react'
import CaptureClient from './CaptureClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page() {
  return (
    <Suspense fallback={<main><div style={{height:'50vh'}} /></main>}>
      <CaptureClient />
    </Suspense>
  )
}
