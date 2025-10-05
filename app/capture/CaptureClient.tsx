'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

/* ------------------------------- Types ------------------------------- */

type Project = {
  id: string
  name: string
  date?: string | null
  logo_url?: string | null
}

type Station = {
  id: string
  project_id: string
  name: string
  description?: string | null
  unit?: string | null
  min_value?: number | null
  max_value?: number | null
  higher_is_better?: boolean | null
}

type Player = {
  id: string
  project_id: string
  display_name: string
  birth_year: number | null
  gender?: 'male' | 'female' | null
  club?: string | null
  fav_number?: number | null
  fav_position?: string | null
}

/** lokaler Wert pro Spieler je Station:
 * - S3 (Passgenauigkeit): h10(0..3), h14(0..2), h18(0..1)
 * - S5 (Schusspräzision): ul,ur,ll,lr (je 0..3)
 * - Sonst: value (string → Zahl bei blur/Enter)
 */
type ValueMap = Record<string, any>

/* -------------------------- Stationen-Reihenfolge -------------------------- */

const ST_NAMES = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
] as const

const ST_INDEX: Record<string, number> = {
  Beweglichkeit: 1,
  Technik: 2,
  Passgenauigkeit: 3,
  Schusskraft: 4,
  Schusspräzision: 5,
  Schnelligkeit: 6,
}

function stationIndexByName(name: string): number {
  return ST_INDEX[name] ?? 1
}

/* --------------------------- CSV (S6) – Helpers --------------------------- */
/** Erwartetes Format (semicolon; comma-decimal):
 * Kopf:
 * Punkte/Alter;6 bis 7;8 bis 9;10 bis 11;12 bis 13;14 bis 15;16 bis 17;18 bis 19;20 bis 24;25 bis 29;30 bis 34;35 bis 39;40 bis 44;45 bis 49
 * Dann Zeilen 100..0, je Zelle Sekunden als Dezimal mit Komma.
 */

const AGE_BUCKETS = [
  '6 bis 7','8 bis 9','10 bis 11','12 bis 13','14 bis 15','16 bis 17',
  '18 bis 19','20 bis 24','25 bis 29','30 bis 34','35 bis 39','40 bis 44','45 bis 49'
] as const

type CSVMap = Record<string, number[]> // z.B. { '6 bis 7': [sec100, sec99, ... , sec0], ... }

function parseCSVMap(csv: string): CSVMap {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return {}

  const header = lines[0].split(';').map(s => s.trim())
  const idxByBucket: Record<string, number> = {}
  AGE_BUCKETS.forEach(bucket => {
    const idx = header.findIndex(h => h === bucket)
    if (idx >= 0) idxByBucket[bucket] = idx
  })

  const out: CSVMap = {}
  AGE_BUCKETS.forEach(bucket => { out[bucket] = [] })

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';')
    // erste Spalte (Punktzahl) ignorieren – wir gehen von 100..0 in Reihenfolge aus
    AGE_BUCKETS.forEach(bucket => {
      const idx = idxByBucket[bucket]
      if (idx == null || idx >= cols.length) return
      const raw = cols[idx].replace(',', '.').trim()
      const sec = Number(raw)
      if (!Number.isNaN(sec)) out[bucket].push(sec)
    })
  }
  return out
}

function nearestAgeBucket(age: number): typeof AGE_BUCKETS[number] {
  if (age <= 7) return '6 bis 7'
  if (age <= 9) return '8 bis 9'
  if (age <= 11) return '10 bis 11'
  if (age <= 13) return '12 bis 13'
  if (age <= 15) return '14 bis 15'
  if (age <= 17) return '16 bis 17'
  if (age <= 19) return '18 bis 19'
  if (age <= 24) return '20 bis 24'
  if (age <= 29) return '25 bis 29'
  if (age <= 34) return '30 bis 34'
  if (age <= 39) return '35 bis 39'
  if (age <= 44) return '40 bis 44'
  return '45 bis 49'
}

/** time (Sekunden, z.B. 6.12) → Punktzahl 0..100 anhand einer Bucket-Zeile (Index 0 = 100 Punkte) */
function scoreFromTime(timeSec: number, row: number[]): number {
  // row[i] ist der Sekunden-Schwellenwert für Punktzahl (100 - i)
  // Idee: finde höchstes P, dessen Schwelle >= timeSec (je schneller, desto mehr Punkte)
  // row kann leichte Ungenauigkeiten haben – wir gehen linear runter.
  for (let i = 0; i < row.length; i++) {
    const threshold = row[i]
    if (timeSec <= threshold) {
      const pts = 100 - i
      return Math.max(0, Math.min(100, pts))
    }
  }
  return 0
}

/* ---------------------- Norm-Score (ohne CSV-Fallback) --------------------- */

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

function normScore(st: Station, raw: number): number {
  const minV = st.min_value ?? 0
  const maxV = st.max_value ?? 100
  const hib = st.higher_is_better ?? true

  if (maxV === minV) return 0
  const t = clamp01((raw - minV) / (maxV - minV))
  const val = hib ? t : (1 - t)
  return Math.round(val * 100)
}

/* ------------------------- S5 – Altersabhängige Regeln ------------------------- */

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function s5UpperPoints(upperHits: number, ageYears: number): number {
  const n = clampInt(upperHits, 0, 6)
  if (ageYears >= 10) {
    // 1–3: 15, 4–5: 10, 6: 5  → max 70
    const first3 = Math.min(n, 3) * 15
    const next2  = Math.max(0, Math.min(n - 3, 2)) * 10
    const last1  = n >= 6 ? 5 : 0
    return first3 + next2 + last1
  } else {
    // 1–5: 10, 6: 8  → max 58
    const first5 = Math.min(n, 5) * 10
    const last1  = n >= 6 ? 8 : 0
    return first5 + last1
  }
}
function s5LowerPoints(lowerHits: number, ageYears: number): number {
  const n = clampInt(lowerHits, 0, 6)
  return ageYears >= 10 ? n * 5 : n * 7 // max 30 bzw. 42
}
function s5ScoreFromCounts(upperHits: number, lowerHits: number, ageYears: number): number {
  const up = s5UpperPoints(upperHits, ageYears)
  const lo = s5LowerPoints(lowerHits, ageYears)
  return clampInt(up + lo, 0, 100) // Summe ist in beiden Altersgruppen max 100
}

/* ------------------------------ UI Controls ------------------------------ */

function NumberInput({
  label, value, min, max, onChange, onCommit
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  onCommit?: () => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e)=> onChange(e.target.value===''? 0 : Math.max(min, Math.min(max, Number(e.target.value))))}
        onBlur={onCommit}
        onKeyDown={(e)=>{ if(e.key==='Enter'){ e.currentTarget.blur(); onCommit?.() }}}
      />
    </div>
  )
}

/* -------------------------------- Component -------------------------------- */

export default function CaptureClient(){
  const sp = useSearchParams()
  const router = useRouter()

  const qProject = sp.get('project') || ''
  const qStation = sp.get('station') || ''

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>(qProject)
  const [project, setProject] = useState<Project | null>(null)

  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])

  const [selected, setSelected] = useState<string>('') // station_id
  const [values, setValues] = useState<ValueMap>({})   // per player input
  const [saved,  setSaved]  = useState<Record<string, number>>({}) // playerId → last saved raw

  // S6 score tables
  const [scoreMapFemale, setScoreMapFemale] = useState<CSVMap | null>(null)
  const [scoreMapMale,   setScoreMapMale]   = useState<CSVMap | null>(null)
  const [csvStatus, setCsvStatus] = useState<'ok'|'fallback'|'loading'>('loading')

  /* ---------------------------- initial fetches ---------------------------- */

  useEffect(() => {
    // Projekte laden
    fetch('/api/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then((res:any) => setProjects(res.items || []))
      .catch(()=> setProjects([]))
  }, [])

  useEffect(() => {
    if (!projectId) { setProject(null); setStations([]); setPlayers([]); return }
    // Projekt
    fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((res:any)=> setProject(res.item || null))
      .catch(()=> setProject(null))
    // Stationen
    fetch(`/api/projects/${projectId}/stations`, { cache: 'no-store' })
      .then(r=>r.json())
      .then((res:any)=>{
        const st: Station[] = (res.items ?? []).slice().sort((a:Station,b:Station)=>{
          const ia = stationIndexByName(a.name)
          const ib = stationIndexByName(b.name)
          return ia - ib
        })
        setStations(st)
        // Vorwahl via URL ?station=… oder erste Station
        if (qStation && st.find(s=>s.id===qStation)) setSelected(qStation)
        else if (st[0]) setSelected(st[0].id)
      })
      .catch(()=> setStations([]))
    // Spieler
    fetch(`/api/projects/${projectId}/players`, { cache: 'no-store' })
      .then(r=>r.json())
      .then((res:any)=> setPlayers(res.items || []))
      .catch(()=> setPlayers([]))

    // query sync
    router.replace(qStation ? `?project=${projectId}&station=${qStation}` : `?project=${projectId}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Initiale Projektvorauswahl aus URL
  useEffect(()=>{
    if (qProject && !projectId) setProjectId(qProject)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // CSV Maps (global) – aus /public/config/
  useEffect(()=>{
    let cancelled = false
    async function loadCSV(){
      setCsvStatus('loading')
      try{
        const [fRes, mRes] = await Promise.all([
          fetch('/config/s6_female.csv', { cache: 'no-store' }),
          fetch('/config/s6_male.csv',   { cache: 'no-store' }),
        ])
        const fTxt = fRes.ok ? await fRes.text() : ''
        const mTxt = mRes.ok ? await mRes.text() : ''
        const fMap = fTxt ? parseCSVMap(fTxt) : null
        const mMap = mTxt ? parseCSVMap(mTxt) : null
        if (!cancelled){
          setScoreMapFemale(fMap)
          setScoreMapMale(mMap)
          setCsvStatus(fMap || mMap ? 'ok' : 'fallback')
        }
      } catch {
        if (!cancelled){
          setScoreMapFemale(null)
          setScoreMapMale(null)
          setCsvStatus('fallback')
        }
      }
    }
    loadCSV()
    return ()=>{ cancelled = true }
  },[])

  /* ------------------------------ Calculations ----------------------------- */

  function resolveAge(birthYear: number | null): number {
    const eventYear = project?.date ? Number(String(project.date).slice(0,4)) : new Date().getFullYear()
    if (!birthYear || birthYear < 1900) return 16
    const a = eventYear - birthYear
    return Math.max(6, Math.min(49, a))
  }

  function resolveRaw(st: Station, v: any): number {
    const n = st.name.toLowerCase()
    if (!v) return 0
    if (n.includes('passgenauigkeit')) {
      // 3×10m (0..3) → 11 Punkte je, 2×14m (0..2) → 17 je, 1×18m (0..1) → 33
      const h10 = v.h10 ?? 0, h14 = v.h14 ?? 0, h18 = v.h18 ?? 0
      return (h10 * 11) + (h14 * 17) + (h18 * 33) // bereits 0..100
    }
    if (n.includes('schusspräzision')) {
      // raw ist hier uninteressant – Score kommt aus s5*()
      const ul=v.ul??0, ur=v.ur??0, ll=v.ll??0, lr=v.lr??0
      const upper = (ul + ur)
      const lower = (ll + lr)
      // für Anzeige könnten wir raw = up*? + lo*? setzen – aber Score nutzt s5ScoreFromCounts()
      return upper*10 + lower*5 // rein kosmetisch
    }
    return Number(v.value || 0)
  }

  function scoreFor(st: Station, p: Player, raw: number, v?: any): number {
    const n = st.name.toLowerCase()
    // S5 – Altersabhängige Staffel (Standardbewertung, keine CSV nötig)
    if (n.includes('schusspräzision') && v) {
      const age = resolveAge(p.birth_year)
      const upper = (v.ul ?? 0) + (v.ur ?? 0)
      const lower = (v.ll ?? 0) + (v.lr ?? 0)
      return s5ScoreFromCounts(upper, lower, age)
    }
    // S6 – CSV Map (female/male), Fallback auf Norm
    if (n.includes('schnelligkeit')) {
      const age = resolveAge(p.birth_year)
      const bucket = nearestAgeBucket(age)
      const map = (p.gender === 'male' ? scoreMapMale : scoreMapFemale) || scoreMapFemale || scoreMapMale
      const rows = map ? (map[bucket] || []) : []
      if (rows.length) return scoreFromTime(Number(raw), rows)
    }
    // S1, S2, S3, S4 -> Normierung (S3 raw ist schon 0..100, aber schadet nicht)
    return Math.round(normScore(st, Number(raw)))
  }

  function sortPlayersByCurrentStation(): void {
    const st = currentStation
    if (!st) return
    setPlayers(prev => {
      const arr = [...prev]
      arr.sort((a: Player, b: Player) => {
        const va = values[a.id], vb = values[b.id]
        const sa = scoreFor(st, a, resolveRaw(st, va), va)
        const sb = scoreFor(st, b, resolveRaw(st, vb), vb)
        return sb - sa
      })
      return arr
    })
  }

  /* ------------------------------ Derived state ----------------------------- */

  const currentStation = useMemo<Station | undefined>(() => {
    return stations.find(s => s.id === selected)
  }, [stations, selected])

  const currentIndex = currentStation ? stationIndexByName(currentStation.name) : 1
  const sketchHref = `/station${currentIndex}.pdf`

  /* --------------------------------- Save API -------------------------------- */

  async function saveOneValue(p: Player, st: Station, raw: number): Promise<void> {
    const body = new FormData()
    body.append('player_id', p.id)
    body.append('station_id', st.id)
    body.append('value', String(raw))
    const res = await fetch(`/api/projects/${projectId}/measurements`, { method: 'POST', body })
    const txt = await res.text()
    if (!res.ok) { alert(txt || 'Fehler beim Speichern'); return }
    setSaved(prev => ({ ...prev, [p.id]: Number(raw) }))
    sortPlayersByCurrentStation()
  }

  /* --------------------------------- Renderers -------------------------------- */

  function ProjectsSelect(){
    if (qProject) return null
    return (
      <div className="card glass w-full max-w-2xl mx-auto text-left">
        <label className="block text-sm font-semibold mb-2">Projekt wählen</label>
        <select
          className="input"
          value={projectId}
          onChange={e=>{ setProjectId(e.target.value); setSelected(''); setValues({}); setSaved({}) }}
        >
          <option value="">{projects.length ? 'Bitte wählen' : 'Lade…'}</option>
          {projects.map(p=> (
            <option key={p.id} value={p.id}>
              {p.name}{p.date ? ` – ${p.date}` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function StationHeader({s}:{s:Station}){
    const idx = stationIndexByName(s.name)
    return (
      <div className="flex items-center gap-2">
        <button
          className="btn pill"
          onClick={()=>{
            setSelected(s.id)
            router.replace(projectId ? `?project=${projectId}&station=${s.id}` : `?station=${s.id}`)
          }}
          style={s.id===selected ? {filter:'brightness(1.15)'} : {}}
        >
          {`S${idx} – ${s.name}`}
        </button>
        <a
          className="btn pill"
          href={`/station${idx}.pdf`}
          target="_blank" rel="noopener noreferrer"
        >
          {`S${idx} – Stationsskizze`}
        </a>
      </div>
    )
  }

  function PlayerRow({p, st}:{p:Player; st:Station}){
    const n = st.name.toLowerCase()
    const v = values[p.id] || {}
    let raw = 0
    let inputs: React.ReactNode = null

    if (n.includes('passgenauigkeit')){
      const h10: number = v.h10 ?? 0
      const h14: number = v.h14 ?? 0
      const h18: number = v.h18 ?? 0
      raw = (h10*11) + (h14*17) + (h18*33) // 0..100
      inputs = (
        <div className="grid grid-cols-3 gap-2">
          <NumberInput label="10 m (0–3)" value={h10} min={0} max={3}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], h10:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
          <NumberInput label="14 m (0–2)" value={h14} min={0} max={2}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], h14:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
          <NumberInput label="18 m (0–1)" value={h18} min={0} max={1}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], h18:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
        </div>
      )
    }
    else if (n.includes('schusspräzision')){
      const ul:number = v.ul ?? 0, ur:number = v.ur ?? 0, ll:number = v.ll ?? 0, lr:number = v.lr ?? 0
      const upper = ul + ur
      const lower = ll + lr
      raw = upper*10 + lower*5 // rein kosmetisch
      inputs = (
        <div className="grid grid-cols-4 gap-2">
          <NumberInput label="oben L (0–3)"  value={ul} min={0} max={3}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], ul:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
          <NumberInput label="oben R (0–3)"  value={ur} min={0} max={3}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], ur:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
          <NumberInput label="unten L (0–3)" value={ll} min={0} max={3}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], ll:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
          <NumberInput label="unten R (0–3)" value={lr} min={0} max={3}
            onChange={(x)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], lr:x} }))}
            onCommit={()=> saveOneValue(p, st, raw)}
          />
        </div>
      )
    }
    else {
      // generischer Einzelwert – erst bei Blur/Enter speichern
      const valStr: string = v.value ?? ''
      raw = Number(valStr || 0)
      const min = st.min_value ?? 0
      const max = st.max_value ?? 9999
      inputs = (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Messwert {st.unit ? `(${st.unit})` : ''}
            </label>
            <input
              className="input"
              inputMode="decimal"
              value={valStr}
              placeholder={st.unit || 'Wert'}
              onChange={(e)=> setValues(prev=>({ ...prev, [p.id]:{...prev[p.id], value:e.target.value} }))}
              onBlur={()=> saveOneValue(p, st, Number(valStr || 0))}
              onKeyDown={(e)=>{ if(e.key==='Enter'){ (e.currentTarget as HTMLInputElement).blur() } }}
              min={min}
              max={max}
            />
          </div>
        </div>
      )
    }

    const score = scoreFor(st, p, raw, v)

    return (
      <tr className="border-b align-top">
        <td className="p-2 whitespace-nowrap font-medium">
          {p.display_name} {p.fav_number ? `#${p.fav_number}` : ''}
          <br/>
          <span className="text-xs muted">
            {p.birth_year ? `Jg. ${p.birth_year}` : 'Jg. –'} • {p.gender ? (p.gender==='male'?'männlich':'weiblich') : '—'} • {p.club || '–'}
          </span>
        </td>
        <td className="p-2">{inputs}</td>
        <td className="p-2 text-center"><span className="badge-green">{score}</span></td>
        <td className="p-2 text-right">
          <button className="btn pill" onClick={()=> saveOneValue(p, st, raw)}>Speichern</button>
        </td>
      </tr>
    )
  }

  function StationPanel({s}:{s:Station}){
    if (s.id !== selected) return null
    return (
      <div className="card glass my-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold">{s.name}</div>
            {s.description ? <div className="text-xs muted">{s.description}</div> : null}
          </div>
          <a className="btn pill" href={`/station${stationIndexByName(s.name)}.pdf`} target="_blank" rel="noopener noreferrer">
            Stationsskizze öffnen
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2 w-56">Spieler</th>
                <th className="p-2">Eingabe</th>
                <th className="p-2 w-24 text-center">Score</th>
                <th className="p-2 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p)=> <PlayerRow key={p.id} p={p} st={s} />)}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ---------------------------------- View ---------------------------------- */

  return (
    <div
      className="hero-full safe-area page-pad"
      style={{
        backgroundImage: 'url(/base.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="container w-full px-4">
        {/* Kopf */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold hero-text">Stationseingabe</h1>
          <p className="hero-sub mt-1">{project ? `Run: ${project.name}` : 'Bitte Run auswählen'}</p>
        </div>

        {/* Projekt wählen (wenn nicht via ?project=… vorgewählt) */}
        <ProjectsSelect />

        {/* Stationsliste: vertikal; Panel klappt zwischen den Zeilen auf */}
        <div className="mt-6 max-w-3xl mx-auto flex flex-col gap-3">
          {stations.map((s)=>(
            <React.Fragment key={s.id}>
              <StationHeader s={s}/>
              <StationPanel  s={s}/>
            </React.Fragment>
          ))}
        </div>

        {/* CSV-Status ganz unten */}
        <div className="mt-8 text-center text-xs muted">
          {csvStatus === 'loading' && 'S6-Tabellen: lade …'}
          {csvStatus === 'ok'       && 'S6-Tabellen: geladen ✅ (global aus /public/config)'}
          {csvStatus === 'fallback' && 'S6-Tabellen: nicht gefunden – Standardbewertung aktiv ⚠️'}
        </div>
      </div>
    </div>
  )
}
