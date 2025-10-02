'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Hero from '../../components/Hero'
import BackFab from '../../components/BackFab'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [logo, setLogo] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name', name.trim())
    fd.append('date', date)
    if (logo) fd.append('logo', logo)
    setSubmitting(true)
    const res = await fetch('/api/projects', { method: 'POST', body: fd })
    setSubmitting(false)
    if (!res.ok) { alert('Fehler beim Anlegen'); return }
    const json = await res.json()
    router.push(`/projects/${json.project.id}`)
  }

  return (
    <main>
      <Hero
        title="Neuer Run"
        subtitle="Name, Datum & Logo festlegen"
        image="/run.jpg"
      >
        {/* Formular liegt jetzt im Hero, auf dem Foto */}
        <form onSubmit={onSubmit} className="card glass w-full max-w-xl mx-auto text-left grid gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Run/Projekt-Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              required
              placeholder="z. B. SV Nufringen – 30.09.2025"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Datum *</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e)=>setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Vereinslogo (optional)</label>
            <input
              type="file"
              accept="image/*"
              className="input"
              onChange={(e)=>setLogo(e.target.files?.[0] ?? null)}
            />
            <p className="muted text-xs mt-1">PNG/SVG/JPG, wird oben rechts im Projekt angezeigt.</p>
          </div>
          <div className="flex justify-end">
            <button className="btn pill" disabled={submitting}>
              {submitting ? 'Anlegen…' : 'Run anlegen'}
            </button>
          </div>
        </form>
      </Hero>

      <BackFab />
    </main>
  )
}
