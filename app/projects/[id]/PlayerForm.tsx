'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const POSITIONS = ['TS', 'IV', 'AV', 'ZM', 'OM', 'LOM', 'ROM', 'ST'] as const

export default function PlayerForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Pflicht
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState<number | ''>('')

  // Optional
  const [club, setClub] = useState('')
  const [favNumber, setFavNumber] = useState<number | ''>('')
  const [favPosition, setFavPosition] = useState<string>('')
  const [nationality, setNationality] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('') // neu
  const [photo, setPhoto] = useState<File | null>(null)

  const currentYear = new Date().getFullYear()
  const minYear = 1950
  const maxYear = currentYear

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) {
      alert('Name fehlt')
      return
    }
    if (!birthYear) {
      alert('Jahrgang fehlt')
      return
    }
    // Build FormData
    const fd = new FormData()
    fd.append('display_name', displayName.trim())
    fd.append('birth_year', String(birthYear))
    if (club) fd.append('club', club)
    if (favNumber !== '' && !Number.isNaN(favNumber)) fd.append('fav_number', String(favNumber))
    if (favPosition) fd.append('fav_position', favPosition)
    if (nationality) fd.append('nationality', nationality)
    if (gender) fd.append('gender', gender) // neu
    if (photo) fd.append('photo', photo)

    const res = await fetch(`/api/projects/${projectId}/players`, {
      method: 'POST',
      body: fd,
    })
    const txt = await res.text()
    if (!res.ok) {
      alert(txt || 'Fehler beim Speichern')
      return
    }

    // Reset + neu laden
    setDisplayName('')
    setBirthYear('')
    setClub('')
    setFavNumber('')
    setFavPosition('')
    setNationality('')
    setGender('')
    setPhoto(null)

    startTransition(() => router.refresh())
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Name (Pflicht) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Spielername *</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="z. B. Alex Beispiel"
            required
          />
        </div>

        {/* Jahrgang (Pflicht) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Jahrgang *</label>
          <input
            className="input"
            type="number"
            min={minYear}
            max={maxYear}
            value={birthYear}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : Number(e.target.value)
              setBirthYear(v)
            }}
            placeholder={`${currentYear - 16}`}
            required
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Verein (optional) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Verein (optional)</label>
          <input
            className="input"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="z. B. SV Nufringen"
          />
        </div>

        {/* Lieblingsnummer (optional, nur Zahl) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Lieblingsnummer (optional)</label>
          <input
            className="input"
            type="number"
            min={0}
            max={999}
            value={favNumber}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : Number(e.target.value)
              setFavNumber(v)
            }}
            placeholder="z. B. 10"
          />
        </div>

        {/* Position (optional) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Lieblingsposition (optional)</label>
          <select
            className="input"
            value={favPosition}
            onChange={(e) => setFavPosition(e.target.value)}
          >
            <option value="">– bitte wählen –</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Nationalität (optional) – freie Eingabe (Dropdown später) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Nationalität (optional)</label>
          <input
            className="input"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="z. B. DE"
          />
        </div>

        {/* Gender (optional, aber empfohlen für S6 CSV-Auswahl) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Geschlecht (für S6 Score-Tabelle)</label>
          <select
            className="input"
            value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female' | '')}
          >
            <option value="">– nicht angegeben –</option>
            <option value="male">männlich</option>
            <option value="female">weiblich</option>
          </select>
        </div>

        {/* Foto (optional) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Foto (optional)</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn pill" type="submit" disabled={isPending}>
          {isPending ? 'Speichere…' : 'Spieler anlegen'}
        </button>
        <span className="text-sm muted">
          Pflichtfelder: <strong>Name</strong> & <strong>Jahrgang</strong>. Alle anderen Angaben optional.
        </span>
      </div>
    </form>
  )
}
