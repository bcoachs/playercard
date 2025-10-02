'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayerForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [year, setYear] = useState<number | ''>('') // TS ist jetzt happy (getypte useState)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !year) {
      alert('Bitte Name und Jahrgang ausfüllen.')
      return
    }
    try {
      setSubmitting(true)
      const fd = new FormData()
      fd.append('display_name', name.trim())
      fd.append('birth_year', String(year))
      const res = await fetch(`/api/projects/${projectId}/players`, { method: 'POST', body: fd })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Fehler beim Anlegen')
      }
      // Seite neu laden, damit Liste & Matrix aktualisiert werden
      router.refresh()
      setName('')
      setYear('')
    } catch (err: any) {
      alert(err.message || 'Fehler')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <h3 className="font-semibold text-lg">Spieler anlegen</h3>

      <div>
        <label className="block text-sm font-semibold mb-1">Name *</label>
        <input
          className="input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Alex Mustermann"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Jahrgang *</label>
        <input
          className="input"
          type="number"
          required
          min={1950}
          max={new Date().getFullYear()}
          value={year}
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
          placeholder="z. B. 2010"
        />
      </div>

      <div className="flex justify-end">
        <button className="btn pill" disabled={submitting}>
          {submitting ? 'Speichern…' : 'Spieler speichern'}
        </button>
      </div>
    </form>
  )
}
