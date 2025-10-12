import type { Metadata } from 'next'
import PlayercardClient from './PlayercardClient'

type Params = {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}

export const metadata: Metadata = {
  title: 'Playercard Designer',
  description: 'Interaktive Vorschau & Export einer individuellen Fußball-Playercard.',
}

export default function PlayercardPage({ params, searchParams }: Params) {
  const initialPlayerId = (() => {
    if (!searchParams) return ''
    const value = searchParams.player || searchParams.playerId || ''
    return Array.isArray(value) ? value[0] ?? '' : value ?? ''
  })()

  return (
    <PlayercardClient projectId={params.id} initialPlayerId={initialPlayerId} />
  )
}
