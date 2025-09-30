'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const POS = ['TS','IV','AV','ZM','OM','LOM','ROM','ST'] as const
const COUNTRIES = ['DE','AT','CH','GB','US','AF'] // MVP, wird später erweitert

export default function JoinPage({ params }: { params: { projectId: string } }) {
  const router = useRouter()
  const sp = useSearchParams()
  const projectId = params.projectId
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await fetch(`/api/projects/${projectId}/join`, { method: 'POST', body: formData })
    if (!res.ok) { alert(await res.text()); setLoading(false); return }
    const { playerId } = await res.json()
    // Nach Signup direkt zum Capture-Hub oder zur Rangliste
    router.push(`/projects/${projectId}/capture?focusPlayer=${playerId}`)
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Anmeldung Spieler*in</h1>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <input name="display_name" placeholder="Name*" required className="border p-2 rounded" />
        <input name="birth_year" placeholder="Jahrgang (YYYY)" pattern="\\d{4}" className="border p-2 rounded" />
        <select name="nationality" className="border p-2 rounded">
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input name="club" placeholder="Verein" className="border p-2 rounded" />
        <input name="fav_number" placeholder="Lieblingsnummer (Zahl)" inputMode="numeric" className="border p-2 rounded" />
        <select name="fav_position" className="border p-2 rounded">
          {POS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button disabled={loading} className="bg-black text-white px-4 py-2 rounded">
          {loading ? 'Speichere…' : 'Anmelden'}
        </button>
      </form>
    </main>
  )
}
