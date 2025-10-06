'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import BackFab from '../components/BackFab'

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

/* Reihenfolge/Index */
const ST_INDEX: Record<string, number> = {
  Beweglichkeit: 1,
  Technik: 2,
  Passgenauigkeit: 3,
  Schusskraft: 4,
  Schusspräzision: 5,
  Schnelligkeit: 6,
}
const ORDER = ['Beweglichkeit','Technik','Passgenauigkeit','Schusskraft','Schusspräzision','Schnelligkeit']
const stationIdxByName = (name:string)=> ST_INDEX[name] ?? 1

/* --- S6 CSV Helfer (global /public/config/s6_*.csv, Semikolon, Komma->Punkt) --- */
const AGE_BUCKETS = [
  '6 bis 7','8 bis 9','10 bis 11','12 bis 13','14 bis 15','16 bis 17',
  '18 bis 19','20 bis 24','25 bis 29','30 bis 34','35 bis 39','40 bis 44','45 bis 49'
] as const
type CSVMap = Record<string, number[]> // bucket → [sec@100, sec@99, ... sec@0]

function parseCSVMap(csv: string): CSVMap {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return {}
  const header = lines[0].split(';').map(s=>s.trim())
  const idx: Record<string, number> = {}
  AGE_BUCKETS.forEach(b=>{
    const i = header.findIndex(h=>h===b)
    if (i>=0) idx[b]=i
  })
  const out: CSVMap = {}; AGE_BUCKETS.forEach(b=> out[b]=[])
  for (let r=1; r<lines.length; r++){
    const cols = lines[r].split(';')
    AGE_BUCKETS.forEach(b=>{
      const i = idx[b]; if (i==null || i>=cols.length) return
      const raw = cols[i].replace(',','.').trim()
      const sec = Number(raw)
      if (!Number.isNaN(sec)) out[b].push(sec)
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
function scoreFromTime(timeSec: number, row: number[]): number {
  for (let i=0; i<row.length; i++){
    const threshold = row[i]
    if (timeSec <= threshold) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}

/* --- Fallback Normalisierung (wenn keine CSV) --- */
const clamp01 = (x:number)=> Math.max(0, Math.min(1, x))
function normScore(st: Station, raw: number): number {
  const minV = st.min_value ?? 0
  const maxV = st.max_value ?? 100
  const hib  = st.higher_is_better ?? true
  if (maxV === minV) return 0
  const t = clamp01((raw - minV) / (maxV - minV))
  const v = hib ? t : (1 - t)
  return Math.round(v*100)
}

/* --- S5 Altersregeln (ohne CSV) --- */
const clampInt = (n:number,min:number,max:number)=> Math.max(min, Math.min(max, Math.round(n)))
function s5UpperPoints(upperHits:number, ageYears:number): number {
  const n = clampInt(upperHits, 0, 6)
  if (ageYears >= 10){
    const first3 = Math.min(n,3) * 15
    const next2  = Math.max(0, Math.min(n-3,2)) * 10
    const last1  = n>=6 ? 5 : 0
    return first3 + next2 + last1 // max 70
  } else {
    const first5 = Math.min(n,5) * 10
    const last1  = n>=6 ? 8 : 0
    return first5 + last1 // max 58
  }
}
function s5LowerPoints(lowerHits:number, ageYears:number): number {
  const n = clampInt(lowerHits, 0, 6)
  return ageYears >= 10 ? n*5 : n*7 // max 30 / 42
}
function s5Score(ul:number, ur:number, ll:number, lr:number, ageYears:number): number {
  const up = s5UpperPoints((ul??0)+(ur??0), ageYears)
  const lo = s5LowerPoints((ll??0)+(lr??0), ageYears)
  return clampInt(up + lo, 0, 100)
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
  const [players,  setPlayers]  = useState<Player[]>([])

  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const [selectedPlayerId,  setSelectedPlayerId]  = useState<string>('')

  // Eingaben (für die aktuell gewählte Station/Spieler)
  const [valueStr, setValueStr] = useState<string>('')  // generisch / S6 Sekunden
  const [s3_h10, setS3_h10] = useState<number>(0)
  const [s3_h14, setS3_h14] = useState<number>(0)
  const [s3_h18, setS3_h18] = useState<number>(0)
  const [s5_ul, setS5_ul] = useState<number>(0)
  const [s5_ur, setS5_ur] = useState<number>(0)
  const [s5_ll, setS5_ll] = useState<number>(0)
  const [s5_lr, setS5_lr] = useState<number>(0)

  // S6 CSV
  const [mapFemale, setMapFemale] = useState<CSVMap | null>(null)
  const [mapMale,   setMapMale]   = useState<CSVMap | null>(null)
  const [csvStatus, setCsvStatus] = useState<'ok'|'fallback'|'loading'>('loading')

  /* Daten laden */
  useEffect(()=>{
    fetch('/api/projects', { cache:'no-store' })
      .then(r=>r.json()).then(res=> setProjects(res.items||[]))
      .catch(()=> setProjects([]))
  },[])

  useEffect(()=>{
    if (!projectId){ setProject(null); setStations([]); setPlayers([]); return }
    fetch(`/api/projects/${projectId}`, { cache:'no-store' })
      .then(r=>r.json()).then(res=> setProject(res.item||null))
      .catch(()=> setProject(null))
    fetch(`/api/projects/${projectId}/stations`, { cache:'no-store' })
      .then(r=>r.json()).then(res=>{
        const st:Station[] = (res.items??[]).slice().sort((a:Station,b:Station)=>{
          const ia = ORDER.indexOf(a.name); const ib = ORDER.indexOf(b.name)
          if (ia>=0 && ib>=0) return ia-ib
          if (ia>=0) return -1
          if (ib>=0) return 1
          return a.name.localeCompare(b.name)
        })
        setStations(st)
        const okId = qStation && st.find(s=>s.id===qStation)?.id
        setSelectedStationId(okId || st[0]?.id || '')
      })
      .catch(()=> setStations([]))
    fetch(`/api/projects/${projectId}/players`, { cache:'no-store' })
      .then(r=>r.json()).then(res=> setPlayers(res.items||[]))
      .catch(()=> setPlayers([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[projectId])

  useEffect(()=>{
    if (qProject && !projectId) setProjectId(qProject)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(()=>{
    let cancel=false
    async function load(){
      setCsvStatus('loading')
      try{
        const [fr, mr] = await Promise.all([
          fetch('/config/s6_female.csv',{cache:'no-store'}),
          fetch('/config/s6_male.csv',{cache:'no-store'})
        ])
        const ft = fr.ok ? await fr.text() : ''
        const mt = mr.ok ? await mr.text() : ''
        const fm = ft ? parseCSVMap(ft) : null
        const mm = mt ? parseCSVMap(mt) : null
        if (!cancel){
          setMapFemale(fm); setMapMale(mm)
          setCsvStatus(fm||mm ? 'ok' : 'fallback')
        }
      }catch{
        if (!cancel){ setMapFemale(null); setMapMale(null); setCsvStatus('fallback') }
      }
    }
    load()
    return ()=>{ cancel=true }
  },[])

  /* abgeleitet */
  const currentStation = useMemo(()=> stations.find(s=>s.id===selectedStationId), [stations, selectedStationId])
  const currentIndex   = currentStation ? stationIdxByName(currentStation.name) : 1
  const sketchHref     = `/station${currentIndex}.pdf`
  const currentPlayer  = useMemo(()=> players.find(p=>p.id===selectedPlayerId), [players, selectedPlayerId])

  /* Helpers */
  function resolveAge(birthYear:number|null): number {
    const eventYear = project?.date ? Number(String(project.date).slice(0,4)) : new Date().getFullYear()
    if (!birthYear || birthYear<1900) return 16
    const a = eventYear - birthYear
    return Math.max(6, Math.min(49, a))
  }
  function s6ScoreFromCSV(sec:number, gender:'male'|'female'|null|undefined, ageYears:number): number {
    const bucket = nearestAgeBucket(ageYears)
    const map = (gender==='male' ? mapMale : mapFemale) || mapFemale || mapMale
    const row = map ? (map[bucket] || []) : []
    if (!row.length) return -1
    return scoreFromTime(sec, row)
  }
  async function saveMeasurement(player:Player, station:Station, numericValue:number){
    const fd = new FormData()
    fd.append('player_id', player.id)
    fd.append('station_id', station.id)
    fd.append('value', String(numericValue))
    const res = await fetch(`/api/projects/${projectId}/measurements`, { method:'POST', body:fd })
    const txt = await res.text()
    if (!res.ok){ alert(txt || 'Fehler beim Speichern'); return }
    alert('Gespeichert.')
  }

  /* Eingabe-Panel (eine Person) */
  function StationForm(){
    const st = currentStation
    if (!st) return null
    const stName = st.name.toLowerCase()
    let liveScore: number | null = null

    if (currentPlayer){
      const age = resolveAge(currentPlayer.birth_year)
      if (stName.includes('passgenauigkeit')){
        const raw = (s3_h10*11) + (s3_h14*17) + (s3_h18*33) // 0..100
        liveScore = Math.max(0, Math.min(100, Math.round(raw)))
      } else if (stName.includes('schusspräzision')){
        liveScore = s5Score(s5_ul, s5_ur, s5_ll, s5_lr, age)
      } else if (stName.includes('schnelligkeit')){
        const sec = Number(valueStr.replace(',','.')) || 0
        const csvPts = s6ScoreFromCSV(sec, currentPlayer.gender, age)
        liveScore = csvPts >= 0 ? csvPts : normScore(st, sec)
      } else {
        const val = Number(valueStr.replace(',','.')) || 0
        liveScore = normScore(st, val)
      }
    }

    async function onSave(){
      if (!currentPlayer || !st) return
      const n = stName
      if (n.includes('passgenauigkeit')){
        const rawScore = (s3_h10*11) + (s3_h14*17) + (s3_h18*33)
        await saveMeasurement(currentPlayer, st, Math.round(rawScore))
      } else if (n.includes('schusspräzision')){
        const age = resolveAge(currentPlayer.birth_year)
        const scr = s5Score(s5_ul, s5_ur, s5_ll, s5_lr, age)
        await saveMeasurement(currentPlayer, st, scr)
      } else if (n.includes('schnelligkeit')){
        const sec = Number(valueStr.replace(',','.')) || 0
        const age = resolveAge(currentPlayer.birth_year)
        const csvPts = s6ScoreFromCSV(sec, currentPlayer.gender, age)
        const scr = csvPts >= 0 ? csvPts : normScore(st, sec)
        await saveMeasurement(currentPlayer, st, scr)
      } else {
        const val = Number(valueStr.replace(',','.')) || 0
        await saveMeasurement(currentPlayer, st, val)
      }
    }

    return (
      <div className="card glass mt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold">{st.name}</div>
            {st.description ? <div className="text-xs muted">{st.description}</div> : null}
          </div>
        </div>

        {/* Spielerwahl */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Spieler*in wählen</label>
          <select
            className="input"
            value={selectedPlayerId}
            onChange={(e)=>{
              setSelectedPlayerId(e.target.value)
              setValueStr('')
              setS3_h10(0); setS3_h14(0); setS3_h18(0)
              setS5_ul(0); setS5_ur(0); setS5_ll(0); setS5_lr(0)
            }}
          >
            <option value="">{players.length ? 'Bitte wählen' : '—'}</option>
            {players.map(p=>(
              <option key={p.id} value={p.id}>
                {p.display_name}{p.fav_number?` #${p.fav_number}`:''} {p.birth_year?`(Jg. ${p.birth_year})`:''}
              </option>
            ))}
          </select>
        </div>

        {/* Eingabe (nur wenn Spieler gewählt) */}
        {!!currentPlayer && (
          <div className="space-y-3">
            {st.name.toLowerCase().includes('passgenauigkeit') && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">10 m (0–3)</label>
                  <input className="input" type="number" min={0} max={3} value={s3_h10}
                         onChange={e=>setS3_h10(Math.max(0, Math.min(3, Number(e.target.value)||0)))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">14 m (0–2)</label>
                  <input className="input" type="number" min={0} max={2} value={s3_h14}
                         onChange={e=>setS3_h14(Math.max(0, Math.min(2, Number(e.target.value)||0)))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">18 m (0–1)</label>
                  <input className="input" type="number" min={0} max={1} value={s3_h18}
                         onChange={e=>setS3_h18(Math.max(0, Math.min(1, Number(e.target.value)||0)))} />
                </div>
              </div>
            )}

            {st.name.toLowerCase().includes('schusspräzision') && (
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">oben L (0–3)</label>
                  <input className="input" type="number" min={0} max={3} value={s5_ul}
                         onChange={e=>setS5_ul(Math.max(0, Math.min(3, Number(e.target.value)||0)))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">oben R (0–3)</label>
                  <input className="input" type="number" min={0} max={3} value={s5_ur}
                         onChange={e=>setS5_ur(Math.max(0, Math.min(3, Number(e.target.value)||0)))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">unten L (0–3)</label>
                  <input className="input" type="number" min={0} max={3} value={s5_ll}
                         onChange={e=>setS5_ll(Math.max(0, Math.min(3, Number(e.target.value)||0)))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">unten R (0–3)</label>
                  <input className="input" type="number" min={0} max={3} value={s5_lr}
                         onChange={e=>setS5_lr(Math.max(0, Math.min(3, Number(e.target.value)||0)))} />
                </div>
              </div>
            )}

            {!st.name.toLowerCase().includes('passgenauigkeit') &&
             !st.name.toLowerCase().includes('schusspräzision') && (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Messwert {st.unit ? `(${st.unit})` : ''}
                </label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder={st.unit || 'Wert'}
                  value={valueStr}
                  onChange={e=> setValueStr(e.target.value)}
                />
              </div>
            )}

            <div className="text-sm">
              <span className="muted">Live-Score: </span>
              <span className="badge-green">{liveScore ?? '–'}</span>
            </div>

            <div className="pt-2">
              <button className="btn pill" onClick={onSave}>Speichern</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* View */
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
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold hero-text">Stationseingabe</h1>
          <p className="hero-sub mt-1">{project ? `Run: ${project.name}` : 'Bitte Run auswählen'}</p>
        </div>

        {!qProject && (
          <div className="card glass w-full max-w-2xl mx-auto text-left mb-6">
            <label className="block text-sm font-semibold mb-2">Projekt wählen</label>
            <select
              className="input"
              value={projectId}
              onChange={e=>{
                setProjectId(e.target.value)
                setSelectedStationId('')
                setSelectedPlayerId('')
                setValueStr('')
                setS3_h10(0); setS3_h14(0); setS3_h18(0)
                setS5_ul(0); setS5_ur(0); setS5_ll(0); setS5_lr(0)
              }}
            >
              <option value="">{projects.length ? 'Bitte wählen' : 'Lade…'}</option>
              {projects.map(p=>(
                <option key={p.id} value={p.id}>
                  {p.name}{p.date ? ` – ${p.date}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ZWEI SPALTEN: links Sx-Buttons, rechts Skizzen-Buttons (gleich groß) */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {/* linke Spalte: Station-Buttons */}
            <div className="flex flex-col gap-3">
              {stations.map(s=>{
                const idx = stationIdxByName(s.name)
                const isActive = s.id === selectedStationId
                return (
                  <button
                    key={`st-${s.id}`}
                    className="btn pill"
                    style={{
                      minWidth: 260,
                      height: 52,
                      justifyContent: 'flex-start',
                      filter: isActive ? 'brightness(1.15)' : undefined
                    }}
                    onClick={()=>{
                      setSelectedStationId(s.id)
                      setSelectedPlayerId('')
                      setValueStr('')
                      setS3_h10(0); setS3_h14(0); setS3_h18(0)
                      setS5_ul(0); setS5_ur(0); setS5_ll(0); setS5_lr(0)
                      router.replace(projectId ? `?project=${projectId}&station=${s.id}` : `?station=${s.id}`)
                    }}
                  >
                    {`S${idx} – ${s.name}`}
                  </button>
                )
              })}
            </div>

            {/* rechte Spalte: Skizzen-Buttons */}
            <div className="flex flex-col gap-3">
              {stations.map(s=>{
                const idx = stationIdxByName(s.name)
                return (
                  <a
                    key={`sk-${s.id}`}
                    className="btn pill"
                    style={{ minWidth: 260, height: 52, justifyContent:'flex-start' }}
                    href={`/station${idx}.pdf`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    {`S${idx} – Stationsskizze`}
                  </a>
                )
              })}
            </div>
          </div>

          {/* Panel NUR für aktive Station */}
          {currentStation && <StationForm/>}
        </div>

        {/* CSV-Status */}
        <div className="mt-8 text-center text-xs muted">
          {csvStatus === 'loading' && 'S6-Tabellen: lade …'}
          {csvStatus === 'ok'       && 'S6-Tabellen: geladen ✅ (global aus /public/config)'}
          {csvStatus === 'fallback' && 'S6-Tabellen: nicht gefunden – Standardbewertung aktiv ⚠️'}
        </div>
      </div>

      <BackFab/>
    </div>
  )
}
