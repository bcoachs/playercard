'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Project = {
  id: string
  name: string
  date?: string | null
  logo_url?: string | null
}

type Player = {
  id: string
  project_id: string
  display_name: string
  birth_year: number | null
  club?: string | null
  fav_number?: number | null
  fav_position?: string | null
  nationality?: string | null
  gender?: 'male' | 'female' | null
  created_at?: string
}

type Station = {
  id: string
  project_id: string
  name: string
  unit?: string | null
  min_value?: number | null
  max_value?: number | null
  higher_is_better?: boolean | null
}

const POSITIONS = ['TS','IV','AV','ZM','OM','LOM','ROM','ST']

export default function ProjectPage(){
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params?.id

  const [project, setProject] = useState<Project | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // --- Form State (Create/Update) ---
  const [editId, setEditId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState<string>('') // string für Eingabe
  const [club, setClub] = useState('')
  const [favNumber, setFavNumber] = useState<string>('') // string für Eingabe
  const [favPosition, setFavPosition] = useState('')
  const [nationality, setNationality] = useState('')
  const [gender, setGender] = useState<'male'|'female'|''>('')

  // --- Laden Projekt / Stationen / Spieler ---
  useEffect(()=>{
    if (!projectId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({item:null})),
      fetch(`/api/projects/${projectId}/stations`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({items:[] as Station[]})),
      fetch(`/api/projects/${projectId}/players`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({items:[] as Player[]})),
    ]).then(([pRes, sRes, plRes])=>{
      setProject(pRes?.item ?? null)
      setStations((sRes?.items ?? []).slice())
      setPlayers((plRes?.items ?? []).slice())
    }).finally(()=>setLoading(false))
  }, [projectId])

  // --- Helpers ---
  const title = useMemo(()=> `Run: ${project?.name ?? '–'}`, [project?.name])

  function resetForm(){
    setEditId(null)
    setDisplayName('')
    setBirthYear('')
    setClub('')
    setFavNumber('')
    setFavPosition('')
    setNationality('')
    setGender('')
  }

  function loadIntoForm(p: Player){
    setEditId(p.id)
    setDisplayName(p.display_name || '')
    setBirthYear(p.birth_year ? String(p.birth_year) : '')
    setClub(p.club || '')
    setFavNumber(p.fav_number!=null ? String(p.fav_number) : '')
    setFavPosition(p.fav_position || '')
    setNationality(p.nationality || '')
    setGender(p.gender ?? '')
    // Scroll etwas nach oben, damit das Formular im Fokus ist
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitPlayer(e: React.FormEvent){
    e.preventDefault()
    if (!projectId) return

    const fd = new FormData()
    fd.append('display_name', displayName.trim())
    if (birthYear) fd.append('birth_year', birthYear.trim())
    if (club) fd.append('club', club.trim())
    if (favNumber) fd.append('fav_number', favNumber.trim())
    if (favPosition) fd.append('fav_position', favPosition.trim())
    if (nationality) fd.append('nationality', nationality.trim())
    if (gender) fd.append('gender', gender)

    const url = `/api/projects/${projectId}/players`
    const method = editId ? 'PUT' : 'POST'
    if (editId) fd.append('id', editId)

    const res = await fetch(url, { method, body: fd })
    const js = await res.json().catch(()=>null)
    if (!res.ok){
      alert(js?.error || 'Fehler beim Speichern')
      return
    }
    // Liste neu laden
    const list = await fetch(`/api/projects/${projectId}/players`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({items:[]}))
    setPlayers(list.items || [])
    if (!editId) resetForm() // nach Neuanlage leeren
  }

  async function deletePlayer(id: string){
    if (!projectId) return
    const ok = confirm('Willst du diesen Spieler wirklich löschen?')
    if (!ok) return
    const res = await fetch(`/api/projects/${projectId}/players?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok){
      const t = await res.text(); alert(t || 'Fehler beim Löschen'); return
    }
    // Liste aktualisieren
    setPlayers(prev => prev.filter(p => p.id !== id))
    // falls wir gerade editiert haben -> Formular leeren
    if (editId === id) resetForm()
  }

  // --- Durchschnittsscore (Platzhalter / später Messungen aggregieren) ---
  // Hier brauchst du später echte Aggregation (z. B. GET /leaderboard?project=... oder Messungen joinen).
  // Für die UI-Struktur lassen wir ihn erst einmal leer bzw.  "–".
  function averageScorePlaceholder(_p: Player){ return '–' }

  return (
    <main>
      {/* Kopfbereich mit player.jpg */}
      <section
        className="hero-full safe-area bg-cover bg-center text-white"
        style={{ backgroundImage: "url('/player.jpg')" }}
      >
        <div className="container w-full px-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold hero-text">{title}</h1>
              {project?.date && (
                <p className="hero-sub mt-1">Datum: {project.date}</p>
              )}
            </div>
            {!!project?.logo_url && (
              <img
                src={project.logo_url}
                alt="Logo"
                className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-lg border border-white/40 shadow"
              />
            )}
          </div>

          {/* Formular-Card */}
          <form onSubmit={submitPlayer} className="card card-glass-dark mt-6 max-w-3xl">
            <h2 className="text-xl font-bold mb-3">{editId ? 'Spieler bearbeiten' : 'Spieler anlegen'}</h2>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Name *</label>
                <input className="input" required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="z. B. Nila" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Jahrgang *</label>
                <input className="input" required type="number" inputMode="numeric" min={1950} max={2100} value={birthYear} onChange={e=>setBirthYear(e.target.value)} placeholder="YYYY" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Verein (optional)</label>
                <input className="input" value={club} onChange={e=>setClub(e.target.value)} placeholder="Verein" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Lieblingsnummer (optional)</label>
                <input className="input" type="number" inputMode="numeric" min={0} max={999} value={favNumber} onChange={e=>setFavNumber(e.target.value)} placeholder="z. B. 13" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Position (optional)</label>
                <select className="input" value={favPosition} onChange={e=>setFavPosition(e.target.value)}>
                  <option value="">Bitte wählen</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Nationalität (optional)</label>
                <input className="input" value={nationality} onChange={e=>setNationality(e.target.value)} placeholder="DE, FR, ..." />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Geschlecht (für S6-CSV)</label>
                <select className="input" value={gender} onChange={e=>setGender(e.target.value as any)}>
                  <option value="">ohne Angabe</option>
                  <option value="male">männlich</option>
                  <option value="female">weiblich</option>
                </select>
              </div>
            </div>

            {/* Luft nach dem letzten Feld */}
            <div className="h-2" />

            {/* Buttons mit Abstand */}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn pill">
                {editId ? 'Änderungen speichern' : 'Spieler anlegen'}
              </button>

              {/* Capture rechts daneben */}
              <Link href={`/capture?project=${projectId}`} className="btn pill">
                Capture
              </Link>

              {/* Löschen nur im Edit-Modus */}
              {editId && (
                <button
                  type="button"
                  className="btn pill"
                  onClick={()=> deletePlayer(editId)}
                  style={{ background: 'linear-gradient(180deg,#991b1b,#7f1d1d)' }}
                >
                  Spieler löschen
                </button>
              )}

              {/* Zurücksetzen */}
              {editId && (
                <button
                  type="button"
                  className="btn"
                  onClick={resetForm}
                  style={{ border: '1px solid rgba(255,255,255,.45)', color:'#fff' }}
                >
                  Abbrechen
                </button>
              )}
            </div>

            {/* Extra Luft nach Button-Block */}
            <div className="h-3" />
          </form>
        </div>
      </section>

      {/* Matrix-Bereich mit eigenem dunklen Hintergrund (matrix.jpg), heller Card & dezente Borders */}
      <section
        className="bg-repeat-y bg-top text-white page-pad"
        style={{
          backgroundImage: "url('/matrix.jpg')",
          backgroundSize: '100% auto'
        }}
      >
        <div className="container px-5 py-6">
          <div className="card card-glass-dark" style={{ borderColor: 'rgba(255,255,255,.18)', borderWidth: 1 }}>
            <h3 className="text-lg font-bold mb-3">Spieler-Matrix</h3>

            <div className="overflow-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,.16)' }}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-left">
                    <th className="px-3 py-2 border-b border-white/10">Ø-Score</th>
                    <th className="px-3 py-2 border-b border-white/10">Name</th>
                    <th className="px-3 py-2 border-b border-white/10">#</th>
                    <th className="px-3 py-2 border-b border-white/10">Position</th>
                    <th className="px-3 py-2 border-b border-white/10">Jg.</th>
                    <th className="px-3 py-2 border-b border-white/10">Verein</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p=>(
                    <tr
                      key={p.id}
                      className="hover:bg-white/6 cursor-pointer"
                      onClick={()=> loadIntoForm(p)}
                    >
                      <td className="px-3 py-2 border-b border-white/10">
                        <span className="badge-green">{averageScorePlaceholder(p)}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-white/10">
                        {p.display_name}
                      </td>
                      <td className="px-3 py-2 border-b border-white/10">
                        {p.fav_number!=null ? `#${p.fav_number}` : '–'}
                      </td>
                      <td className="px-3 py-2 border-b border-white/10">{p.fav_position || '–'}</td>
                      <td className="px-3 py-2 border-b border-white/10">{p.birth_year ?? '–'}</td>
                      <td className="px-3 py-2 border-b border-white/10">{p.club || '–'}</td>
                    </tr>
                  ))}
                  {!players.length && !loading && (
                    <tr>
                      <td className="px-3 py-4 text-white/80" colSpan={6}>Noch keine Spieler erfasst.</td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td className="px-3 py-4 text-white/80" colSpan={6}>Lade…</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* etwas Luft zum unteren Bildschirmrand ist durch .page-pad bereits da */}
          </div>

          {/* Info-Hinweis ganz ans Ende verschoben */}
          <p className="mt-6 text-xs text-white/80">
            Hinweis: S6-Tabellen (CSV) werden global aus <code>/public/config</code> geladen.
          </p>
        </div>
      </section>
    </main>
  )
}
