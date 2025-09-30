import { Suspense } from 'react'
import ProjectClient from './Client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-8">Lade Projekt…</div>}>
      <ProjectClient projectId={params.id} />
    </Suspense>
  )
}
