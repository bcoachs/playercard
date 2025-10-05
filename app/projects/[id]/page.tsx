'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BackFab from '../../components/BackFab'

type Station = {
  id: string
  name: string
  unit: string | null
  min_value: number | null
  max_value: number | null
  higher_is_better: boolean | null
}
type Player = {
  id: string
  display_name: string
  birth_year: number | null
  club: string | null
  fav_number: number | null
  fav_position: string | null
  nationality: string | null
  gender?: 'male'|'female'|null
}
type Project = { id: string; name: string; date: string | null; logo_url?: string | null }
type Measurement = { player_id: string; station_id: string; value: number }

const ST_ORDER = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
] as const
const ST_INDEX: Record<string, number> =
  ST_ORDER.reduce((acc, n, i)=>{ acc[n]=i; return acc }, {} as Record<string, number>)

/* S6 via CSV global (optional) */
const USE_S6_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S6_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

async function loadS6Map(gender:'male'|'female'): Promise<Record<string, number[]>|null>{
  try{
    const file = gender === 'male' ? '/config/s6_male.csv' : '/config/s6_female.csv'
    const res = await fetch(file, { cache:'no-store' })
    if(!res.ok) return null
    const text = await res.text()
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    if(lines.length < 2) return null
    const header = lines[0].split(';').map(s=>s.trim())
    const ageCols = header.slice(1)
    const out: Record<string, number[]> = {}
    for(const age of ageCols) out[age] = []
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(';').map(s=>s.trim())
      for(let c=1;c<cols.length;c++){
        const age = ageCols[c-1]
        const sec = Number((cols[c]||'').replace(',', '.'))
        if(Number.isFinite(sec)) out[age].push(sec) // Index 0 = 100 Punkte … 100 = 0 Punkte
      }
    }
    return out
  }catch{ return null }
}
function nearestAgeBucket(age:number, keys:string[]): string{
  const parsed = keys.map(k=>{
    const nums = k.match(/\d+/g)?.map(Number) || []
    const mid = nums.length===2 ? (nums[0]+nums[1])/2 : (nums[0]||0)
    return { key:k, mid }
  })
  parsed.sort((a,b)=>Math.abs(a.mid-age)-Math.abs(b.mid-age))
  return parsed[0]?.key || keys[0]
}
function scoreFromTime(seconds:number, rows:number[]): number{
  let idx = 100, best = Infinity
  for(let i=0;i<rows.length;i++){
    const d = Math.abs(seconds-rows[i])
    if(d<best){ best=d; idx=i }
  }
  return Math.max(0, Math.min(100, 100-idx))
}
function clamp(n:number,min:number,max:number){ return Math.max(min, Math.min(max, n)) }
function normScore(st:Station, raw:number): number{
  const min = st.min_value ?? 0
  const max = st.max_value ?? 100
  if (max===min) return 0
  if (st.higher_is_better) return Math.round(clamp((raw-min)/(max-min),0,1)*100)
  return Math.round(clamp((max-raw)/(max-min),0,1)*100)
}

export default function ProjectDashboard(){
  const params = useParams<{id:string}>()
  const projectId = params.id

  const [project, setProject] = useState<Project|null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [meas, setMeas] = useState<Measurement[]>([])

  // Spieler-Form (Create/Update)
  const [editId, setEditId] = useState<string|''>('')

  const [pName, setPName] = useState('')
  const [pYear, setPYear] = useState<number|''>('')
  const [pClub, setPClub] = useState('')
  const [pNum, setPNum] = useState<number|''>('')
  const [pPos, setPPos] = useState('')
  const [pNat, setPNat] = useState('')
  const [pGender, setPGender] = useState<'male'|'female'|''>('')

  // S6 CSV (global)
  const [s6Female, setS6Female] = useState<Record<string, number[]>|null>(null)
  const [s6Male, setS6Male] = useState<Record<string, number[]>|null>(null)
  const [s6Status, setS6Status] = useState<'ok'|'fail'|'off'|'loading'>(USE_S6_CSV ? 'loading' : 'off')

  /* Laden */
  useEffect(()=>{
    fetch(`/api/projects/${projectId}`, { cache:'no-store' })
      .then(r=>r.json()).then(res=> setProject(res.item || null))
      .catch(()=>setProject(null))

    fetch(`/api/projects/${projectId}/stations`, { cache:'no-store' })
      .then(r=>r.json()).then(res=>{
        const items: Station[] = (res.items ?? [])
        const st: Station[] = items.slice().sort((a: Station, b: Station)=>{
          const ia = ST_ORDER.indexOf(a.name as typeof ST_ORDER[number])
          const ib = ST_ORDER.indexOf(b.name as typeof ST_ORDER[number])
          if(ia>=0 && ib>=0) return ia-ib
          if(ia>=0) return -1
          if(ib>=0) return 1
          return a.name.localeCompare(b.name,'de')
        })
        setStations(st)
      })

    fetch(`/api/projects/${projectId}/players`, { cache:'no-store' })
      .then(r=>r.json()).then(res=> setPlayers(res.items || []))

    fetch(`/api/projects/${projectId}/measurements`, { cache:'no-store' })
      .then(r=>r.json()).then(res=> setMeas(res.items || []))
  }, [projectId])

  // CSV global laden
  useEffect(()=>{
    if (!USE_S6_CSV){ setS6Status('off'); return }
    setS6Status('loading')
    Promise.allSettled([loadS6Map('female'), loadS6Map('male')]).then(([f, m])=>{
      const fOK = f.status==='fulfilled' && f.value
      const mOK = m.status==='fulfilled' && m.value
      if (fOK) setS6Female(f.value)
      if (mOK) setS6Male(m.value)
      setS6Status((fOK || mOK) ? 'ok' : 'fail')
    })
  }, [])

  const measByPlayerStation = useMemo(()=>{
    const map: Record<string, Record<string, number>> = {}
    for(const m of meas){
      if(!map[m.player_id]) map[m.player_id] = {}
      map[m.player_id][m.station_id] = Number(m.value || 0)
    }
    return map
  }, [meas])

  /* Scoring */
  function resolveAge(by:number|null): number{
    const eventYear = project?.date ? Number(String(project.date).slice(0,4)) : new Date().getFullYear()
    if (!by) return 16
    return Math.max(6, Math.min(49, eventYear - by))
  }
  function scoreFor(st:Station, p:Player, raw:number): number{
    const n = st.name.toLowerCase()
    if (n.includes('schnelligkeit')){ // S6 via CSV (falls da), sonst Fallback
      if (USE_S6_CSV){
        const map = p.gender==='male' ? s6Male : s6Female
        if (map){
          const keys = Object.keys(map)
          if (keys.length){
            const bucket = nearestAgeBucket(resolveAge(p.birth_year), keys)
            const rows = map[bucket] || []
            if (rows.length) return scoreFromTime(Number(raw), rows)
          }
        }
      }
      return normScore({ ...st, min_value: 4, max_value: 20, higher_is_better: false }, Number(raw))
    }
    if (n.includes('passgenauigkeit')) {
      // Rohwert in Capture bereits 0–100 (11/17/33-Gewichtung) → direkt
      return Math.round(clamp(Number(raw), 0, 100))
    }
    if (n.includes('schusspräzision')) {
      const pct = clamp(Number(raw)/24, 0, 1)
      return Math.round(pct*100)
    }
    return Math.round(normScore(st, Number(raw)))
  }

  const sortedStations = useMemo<Station[]>(()=>{
    return stations.slice().sort((a: Station, b: Station)=>{
      const ia = (ST_INDEX as any)[a.name] ?? 99
      const ib = (ST_INDEX as any)[b.name] ?? 99
      return ia - ib
    })
  }, [stations])

  const rows = useMemo(()=>{
    type Row = {
      player: Player
      perStation: { id:string; name:string; raw:number|null; score:number|null; unit?:string|null }[]
      avg: number
    }
    const out: Row[] = players.map((p: Player)=>{
      const perStation: Row['perStation'] = []
      let sum = 0, count = 0
      for(const st of sortedStations){
        const raw = measByPlayerStation[p.id]?.[st.id]
        let sc: number|null = null
        if (typeof raw === 'number') {
          sc = scoreFor(st, p, raw)
          sum += sc; count++
        }
        perStation.push({ id: st.id, name: st.name, raw: typeof raw==='number'?raw:null, score: sc, unit: st.unit })
      }
      const avg = count ? Math.round(sum / count) : 0
      return { player: p, perStation, avg }
    })
    out.sort((a, b)=> b.avg - a.avg)
    return out
  }, [players, sortedStations, measByPlayerStation, s6Female, s6Male, project])

  /* Helpers: Formular befüllen/Reset */
  function fillForm(p: Player){
    setEditId(p.id)
    setPName(p.display_name || '')
    setPYear(p.birth_year || '')
    setPClub(p.club || '')
    setPNum(typeof p.fav_number==='number' ? p.fav_number : '')
    setPPos(p.fav_position || '')
    setPNat(p.nationality || '')
    setPGender((p.gender as any) || '')
  }
  function resetForm(){
    setEditId('')
    setPName(''); setPYear(''); setPClub(''); setPNum(''); setPPos(''); setPNat(''); setPGender('')
  }

  /* Actions: Create/Update/Delete */
  async function addOrUpdatePlayer(e: React.FormEvent){
    e.preventDefault()
    if (!pName.trim()){ alert('Bitte Name eingeben'); return }
    if (!pYear || String(pYear).length!==4){ alert('Bitte Jahrgang (YYYY) eingeben'); return }

    const body = new FormData()
    body.append('display_name', pName.trim())
    body.append('birth_year', String(pYear))
    if (pClub) body.append('club', pClub)
    if (pNum!=='') body.append('fav_number', String(pNum))
    if (pPos) body.append('fav_position', pPos)
    if (pNat) body.append('nationality', pNat)
    if (pGender) body.append('gender', pGender)

    const method = editId ? 'PUT' : 'POST'
    if (editId) body.append('id', editId)

    const res = await fetch(`/api/projects/${projectId}/players`, { method, body })
    const js = await res.json().catch(()=> ({}))
    if (!res.ok){ alert(js?.error || 'Fehler beim Speichern'); return }

    const updated = await fetch(`/api/projects/${projectId}/players`, { cache:'no-store' }).then(r=>r.json())
    setPlayers(updated.items || [])
    if (!editId) resetForm() // bei neuem Spieler Formular leeren
  }

  async function deletePlayer(){
    if (!editId) return
    const yes = confirm('Willst du wirklich diesen Spieler löschen?')
    if (!yes) return
    const res = await fetch(`/api/projects/${projectId}/players?id=${encodeURIComponent(editId)}`, { method:'DELETE' })
    if (!res.ok){ const t = await res.text(); alert(t || 'Fehler beim Löschen'); return }
    const updated = await fetch(`/api/projects/${projectId}/players`, { cache:'no-store' }).then(r=>r.json())
    setPlayers(updated.items || [])
    resetForm()
  }

  /* Render */
  return (
    <main>

      {/* Sektion 1: Spieler-Eingabe über player.jpg */}
      <section className="hero-full safe-area bg-player">
        <div className="container w-full px-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold hero-text">
                Run: {project?.name ?? '—'}
              </h1>
              {project?.date && <div className="hero-sub">{String(project.date)}</div>}
            </div>
            {project?.logo_url && (
              <img src={project.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
            )}
          </div>

          {/* Formular-Card (dunkles Glas) */}
          <div className="card-glass-dark max-w-5xl">
            <div className="text-lg font-semibold mb-3">{editId ? 'Spieler bearbeiten' : 'Spieler hinzufügen'}</div>

            <form onSubmit={addOrUpdatePlayer} className="grid gap-3 md:grid-cols-3">
              {/* Jede Spalte gleich breit und bündig */}
              <div>
                <label className="block text-xs font-semibold mb-1">Name *</label>
                <input className="input" value={pName} onChange={e=>setPName(e.target.value)} placeholder="Vorname Nachname" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Jahrgang *</label>
                <input className="input" inputMode="numeric" pattern="\d{4}" placeholder="YYYY"
                  value={pYear} onChange={e=>setPYear(e.target.value as any)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Verein</label>
                <input className="input" value={pClub} onChange={e=>setPClub(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Lieblingsnummer</label>
                <input className="input" inputMode="numeric"
                  value={pNum} onChange={e=>setPNum(e.target.value===''? '' : Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Position</label>
                <select className="input" value={pPos} onChange={e=>setPPos(e.target.value)}>
                  <option value="">–</option>
                  {['TS','IV','AV','ZM','OM','LOM','ROM','ST'].map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nationalität</label>
                <input className="input" value={pNat} onChange={e=>setPNat(e.target.value)} placeholder="DE, FR, ..." />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Geschlecht</label>
                <select className="input" value={pGender} onChange={e=>setPGender(e.target.value as any)}>
                  <option value="">–</option>
                  <option value="male">männlich</option>
                  <option value="female">weiblich</option>
                </select>
              </div>

              {/* Spacing nach „Geschlecht“ */}
              <div className="md:col-span-3" />

              {/* Buttons mit Abstand, rechts ausgerichtet */}
              <div className="md:col-span-3 flex items-center gap-3 justify-end">
                <button className="btn pill" type="submit">
                  {editId ? 'Spieler speichern' : 'Spieler anlegen'}
                </button>
                <Link href={`/capture?project=${projectId}`} className="btn pill">Capture</Link>
                {editId && (
                  <button type="button" className="btn pill"
                          onClick={deletePlayer}>
                    Spieler löschen
                  </button>
                )}
              </div>

              {/* Zusätzliche Leerzeile nach dem Button-Block */}
              <div className="md:col-span-3 h-2" />
            </form>
          </div>
        </div>
      </section>

      {/* Sektion 2: Matrix über matrix.jpg mit „Glass“-Rahmen + Abstand & Hover */}
      <section className="bg-matrix page-pad">
        <div className="container w-full px-5 py-8">
          {/* kleiner äußerer Rand */}
          <div className="mx-2 md:mx-3 mt-2">
            <div className="card-glass-dark table-dark overflow-x-auto">
              <div className="mb-3">
                <div className="text-lg font-semibold">Spieler-Matrix</div>
                <div className="text-sm" style={{color:'rgba(255,255,255,.82)'}}>
                  Ø = Durchschnitt über alle erfassten Stationen. Klick auf einen Spieler lädt die Daten oben ins Formular.
                </div>
              </div>

              <table className="w-full text-sm matrix-table">
                <thead>
                  <tr className="text-left">
                    <th className="p-2 whitespace-nowrap">Spieler</th>
                    <th className="p-2 whitespace-nowrap">Ø</th>
                    {stations.length ? ST_ORDER.map(n=>{
                      const st = stations.find(s=>s.name===n)
                      return st ? <th key={st.id} className="p-2 whitespace-nowrap">{st.name}</th> : null
                    }) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({player, perStation, avg})=>(
                    <tr key={player.id}
                        className="align-top hoverable-row"
                        onClick={()=>fillForm(player)}
                        style={{cursor:'pointer'}}>
                      <td className="p-2 whitespace-nowrap font-medium">
                        {player.display_name}{Number.isFinite(player.fav_number as any) ? ` #${player.fav_number}` : ''}
                      </td>
                      <td className="p-2"><span className="badge-green">{avg}</span></td>

                      {perStation.map(cell=>{
                        const score = cell.score
                        const raw = cell.raw
                        return (
                          <td key={cell.id} className="p-2">
                            {typeof score === 'number' ? (
                              <div>
                                <span className="badge-green">{score}</span>
                                <div className="text-[11px]" style={{color:'rgba(255,255,255,.75)'}}>
                                  {typeof raw==='number' ? `${raw}${cell.unit ? ` ${cell.unit}` : ''}` : '—'}
                                </div>
                              </div>
                            ) : <span className="text-xs" style={{color:'rgba(255,255,255,.7)'}}>—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={2+stations.length} className="p-3 text-center" style={{color:'rgba(255,255,255,.85)'}}>
                        Noch keine Spieler.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* F: Extra Abstand vor dem Hinweis */}
            {USE_S6_CSV && (
              <div className="mt-6 text-sm" style={{color:'rgba(255,255,255,.86)'}}>
                S6-Tabellen: {s6Status==='ok' ? 'geladen ✅' : s6Status==='loading' ? 'lädt …' : 'nicht gefunden – Fallback aktiv ⚠️'}
              </div>
            )}
          </div>
        </div>
      </section>

      <BackFab />
    </main>
  )
}
