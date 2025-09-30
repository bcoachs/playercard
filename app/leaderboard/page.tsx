import { Suspense } from 'react'
import LeaderboardClient from './Client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Lade Rangliste…</div>}>
      <LeaderboardClient />
    </Suspense>
  )
}
