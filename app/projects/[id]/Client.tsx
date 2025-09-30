'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Station = { id: string; name: string; unit: string|null }
type Player = { id: string; display_name: string; club: string|null; fav_position: string|null; fav_number: number|null; birth_year: number|null; nationality: string|null }

const POS = ['TS','IV','AV','ZM','OM','LOM','ROM','ST'] as const
const COUNTRIES = ['DE','AT','CH','GB','US','AF'] // MVP; später EU+GB+US+AF voll

export default function ProjectClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<{ id: string; name: string; date: string; logo_url?: string } | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [q, setQ] = useState('')

  // form state
  const [form, setForm] = useState({ display_name: '', club: '', fav_position: '', fav_number: '', birth_year: '', nationality: 'DE' })
  const canSave = form.display_name.trim().length > 0

  useEffect(() => {
    fetch(`/api/projects/${projectId}/dashboard`)
      .then(r => r.json())
      .then(res => {
        setProject(res.project)
        setPlayers(res.players || [])
        setStations(res.stations || [])
        setMatrix(res.matrix || {})
        setLoading(false)
      })
  }, [projectId])

  const filteredPlayers = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return players
    return players.filter(p =>
      p.display_name.toLowerCase().includes(n) ||
      (p.club||'').toLowerCase().includes(n) ||
      (p.fav_position||'').toLowerCase().includes(n)
    )
  }, [players, q])

  async function createPlayer() {
    if (!canSave) return
    const res = await fetch(`/api/projects/${projectId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: form.display_name,
        club: form.club || null,
        fav_position: form.fav_position || null,
        fav_number: form.fav_number ? Number(form.fav_number) : null,
        birth_year: form.birth_year ? Number(form.birth_year) : null,
        nationality: form.nationality || null
      })
    })
    if (!res.ok) { alert(await res.text()); return }
    const { playerId } = await res.json()
    setForm({ display_name: '', club: '', fav_position: '', fav_number: '', birth_year: '', nationality: 'DE' })
    // reload list
    const refreshed = await fetch(`/api/projects/${projectId}/dashboard`).then(r=>r.json())
    setPlayers(refreshed.players || [])
    setMatrix(refreshed.matrix || {})
    // optional: direkt zum Capture für diesen Spieler
    // router.push(`/projects/${projectId}/capture?focusPlayer=${playerId}`)
  }

  if (loading) return <main className="p-8">Lade…</main>
  if (!project) return <main className="p-8">Projekt nicht gefunden.</main>

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        {project.logo_url ? <img src={project.logo_url} alt="Logo" className="h-10 w-10 object-contain" /> : null}
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="text-sm text-neutral-600">{project.date}</div>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Spieler anmelden</h2>
          <div className="grid gap-2">
            <input className="border p-2 rounded" placeholder="Name*" value={form.display_name} onChange={e=>setForm({...form, display_name: e.target.value})}/>
            <input className="border p-2 rounded" placeholder="Verein" value={form.club} onChange={e=>setForm({...form, club: e.target.value})}/>
            <div className="grid grid-cols-2 gap-2">
              <select className="border p-2 rounded" value={form.fav_position} onChange={e=>setForm({...form, fav_position: e.target.value})}>
                <option value="">Position</option>
                {POS.map(p=> <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="border p-2 rounded" placeholder="Nr." inputMode="numeric" value={form.fav_number} onChange={e=>setForm({...form, fav_number: e.target.value})}/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="border p-2 rounded" placeholder="Jahrgang (YYYY)" inputMode="numeric" value={form.birth_year} onChange={e=>setForm({...form, birth_year: e.target.value})}/>
              <select className="border p-2 rounded" value={form.nationality} onChange={e=>setForm({...form, nationality: e.target.value})}>
                {COUNTRIES.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button disabled={!canSave} onClick={createPlayer} className="bg-black text-white px-4 py-2 rounded disabled:opacity-50">
              Speichern
            </button>
            <Link className="underline text-sm" href={`/join/${projectId}`}>…oder Self-Signup öffnen</Link>
          </div>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Stationseingabe</h2>
          <p className="text-sm text-neutral-600 mb-2">Zum Hub wechseln, Spieler & Station wählen.</p>
          <Link className="underline" href={`/projects/${projectId}/capture`}>Zum Capture-Hub</Link>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Rangliste</h2>
          <p className="text-sm text-neutral-600 mb-2">Gesamtergebnisse & Platzierung.</p>
          <Link className="underline" href={`/leaderboard?project=${projectId}`}>Zur Rangliste</Link>
        </div>
      </section>

      <section className="border rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Spieler-Übersicht</h2>
          <input className="border p-2 rounded text-sm" placeholder="Suche Name / Verein / Position…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Verein</th>
                <th className="text-left p-2">Pos</th>
                {stations.map(s => <th key={s.id} className="text-center p-2">{s.name}</th>)}
                <th className="text-right p-2">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(pl => {
                const row = matrix[pl.id] || {}
                return (
                  <tr key={pl.id} className="border-t">
                    <td className="p-2">{pl.display_name}</td>
                    <td className="p-2">{pl.club ?? '–'}</td>
                    <td className="p-2">{pl.fav_position ?? '–'}</td>
                    {stations.map(st => (
                      <td key={st.id} className="p-2 text-center">{row[st.id] ? '✓' : '–'}</td>
                    ))}
                    <td className="p-2 text-right">
                      <Link className="underline" href={`/projects/${projectId}/capture?focusPlayer=${pl.id}`}>Erfassen</Link>
                    </td>
                  </tr>
                )
              })}
              {filteredPlayers.length === 0 && (
                <tr><td className="p-4 text-neutral-600" colSpan={4 + stations.length}>Noch keine Spieler — lege welche an oder nutze den Self-Signup.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
