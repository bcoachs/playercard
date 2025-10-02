'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const POSITIONS = ['TS','IV','AV','ZM','OM','LOM','ROM','ST'] as const

// EU + UK + USA + Afghanistan (ISO Code + Label)
const COUNTRIES = [
  ['DE','Deutschland'],['AT','Österreich'],['CH','Schweiz'],
  ['BE','Belgien'],['BG','Bulgarien'],['CZ','Tschechien'],['DK','Dänemark'],
  ['EE','Estland'],['ES','Spanien'],['FI','Finnland'],['FR','Frankreich'],
  ['GR','Griechenland'],['HR','Kroatien'],['HU','Ungarn'],['IE','Irland'],
  ['IT','Italien'],['LT','Litauen'],['LU','Luxemburg'],['LV','Lettland'],
  ['MT','Malta'],['NL','Niederlande'],['PL','Polen'],['PT','Portugal'],
  ['RO','Rumänien'],['SE','Schweden'],['SI','Slowenien'],['SK','Slowakei'],
  ['GB','Vereinigtes Königreich'],['US','USA'],['AF','Afghanistan'],
]

export default function PlayerForm({ projectId }: { projectId: string }) {
  const router = useRouter()

  // Pflichtfelder
  const [name, setName] = useState<string>('')
  const [year, setYear] = useState<number | ''>('')

  // Optional
  const [position, setPosition] = useState<string>('')
  const [nationality, setNationality] = useState<string>('')
  const [photo, setPhoto] = useState<File | null>(null)

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
      fd.append('display_name', name.trim())           // <- WICHTIG: Name-Feld korrekt
      fd.append('birth_year', String(year))
      if (position)   fd.append('fav_position', position)
      if (nationality)fd.append('nationality', nationality)
      if (photo)      fd.append('photo', photo)        // optionales Foto

      const res = await fetch(`/api/projects/${projectId}/players`, {
        method: 'POST',
        body: fd,
      })

      const text = await res.text()
      if (!res.ok) {
        try { const j = JSON.parse(text); throw new Error(j?.error || 'Fehler') }
        catch { throw new Error(text || 'Fehler beim Speichern') }
      }

      // Erfolg → Liste aktualisieren & Formular leeren
      router.refresh()
      setName('')
      setYear('')
      setPosition('')
      setNationality('')
      setPhoto(null)
    } catch (err: any) {
      alert(err.message || 'Unbekannter Fehler')
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

      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label className="block text-sm font-semibold mb-1">Position (optional)</label>
          <select className="input" value={position} onChange={(e)=>setPosition(e.target.value)}>
            <option value="">Bitte wählen</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold mb-1">Nationalität (optional)</label>
          <select className="input" value={nationality} onChange={(e)=>setNationality(e.target.value)}>
            <option value="">Bitte wählen</option>
            {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Foto (optional)</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            // Handy-Kamera öffnen bevorzugt:
            capture="environment"
            onChange={(e)=>setPhoto(e.target.files?.[0] ?? null)}
          />
          <p className="muted text-xs mt-1">Tipp: Direkt mit der Handy-Kamera aufnehmen.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn pill" disabled={submitting}>
          {submitting ? 'Speichern…' : 'Spieler speichern'}
        </button>
      </div>
    </form>
  )
}
