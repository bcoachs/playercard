'use client'
import { useSearchParams } from 'next/navigation'

export default function Capture() {
  const sp = useSearchParams()
  const project = sp.get('project')
  const station = sp.get('station')
  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-2">Erfassung</h1>
      <p>Projekt: <b>{project}</b> – Station: <b>{station}</b></p>
      <p>Hier kommt die Eingabemaske je Station hin.</p>
    </main>
  )
}
