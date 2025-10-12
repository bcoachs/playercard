import { Suspense } from 'react'
import PlayercardClient from './Client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function PlayercardPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="page-pad">Lade Playercard …</div>}>
      <PlayercardClient projectId={params.id} />
    </Suspense>
  )
}
