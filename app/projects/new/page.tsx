'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Hero from '../../components/Hero'
import BackFab from '../../components/BackFab'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [logo, setLogo] = useState<File | null>(null)
  const [primary, setPrimary] = useState('#ec0347')   // optional
  const [secondary, setSecondary] = useState('#ab0000') // optional
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name', name.trim())
    fd.append('date', date)
    fd.append('brand_primary', primary)
    fd.append('brand_secondary', secondary)
    if (logo) fd.append('logo', logo)

    try {
      setSubmitting(true)
      const res = await fetch('/api/projects', { method: 'POST', body: fd })
      const text = await res.text()
      if (!res.ok) {
        // Server versucht JSON zu liefern? Dann auslesen, sonst Text zeigen
        try {
          const j = JSON.parse(text)
          throw new Error(j?.error || 'Fehler beim Anlegen')
        } catch {
          throw new Error(text || 'Fehler beim Anlegen')
        }
      }
      const json = JSON.parse(text)
      router.push(`/projects/${json.project.id}`)
    } catch (err: any) {
      alert(err.message || 'Unbekannter Fehler')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <Hero
        title="Neuer Run"
        subtitle="Name, Datum & Branding festlegen"
        image="/run.jpg"
      >
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Primärfarbe</label>
              <input type="color" className="input p-1" value={primary} onChange={(e)=>setPrimary(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Sekundärfarbe</label>
              <input type="color" className="input p-1" value={secondary} onChange={(e)=>setSecondary(e.target.value)} />
            </div>
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
            <button className="btn" disabled={submitting}>
              {submitting ? 'Anlegen…' : 'Run anlegen'}
            </button>
          </div>
        </form>
      </Hero>

      <BackFab />
    </main>
  )
}
