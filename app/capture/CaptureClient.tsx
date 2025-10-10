'use client'

import React, {useCallback, useEffect, useMemo, useState} from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
// BackFab wird hier ersetzt durch eine eigene Implementierung mit zusätzlicher Logik
import Hero from '@/app/components/Hero'

type CsvStatus = 'ok' | 'fail' | 'off' | 'loading'

type Station = {
  id: string
  name: string
  description?: string | null
  unit?: string | null
}

type Player = {
  id: string
  display_name: string
  birth_year: number | null
  gender?: 'male'|'female'|null
  club?: string | null
  fav_number?: number | null
  fav_position?: string | null
}

type Measurement = {
  id?: string
  player_id: string
  station_id: string
  value: number | null
}

const ST_ORDER = ['Beweglichkeit','Technik','Passgenauigkeit','Schusskraft','Schusspräzision','Schnelligkeit']
const ST_INDEX: Record<string, number> = {
  'Beweglichkeit': 1, 'Technik': 2, 'Passgenauigkeit': 3, 'Schusskraft': 4, 'Schusspräzision': 5, 'Schnelligkeit': 6
}

const RUNS_COUNT = 3

/** Standard-Normierung (Fallback, wenn keine CSV) */
function normScore(st: Station, raw: number){
  const n = (st.name||'').toLowerCase()
  if (n.includes('beweglichkeit')){ // 10–40s, weniger ist besser
    const min=10, max=40
    return Math.round(Math.max(0, Math.min(100, 100*(max-raw)/(max-min))))
  }
  if (n.includes('technik')){ // 20–90s, weniger ist besser
    const min=20, max=90
    return Math.round(Math.max(0, Math.min(100, 100*(max-raw)/(max-min))))
  }
  if (n.includes('passgenauigkeit')){
    // 3×10m (11 P.) + 2×14m (17 P.) + 1×18m (33 P.), max 100
    // Eingabe: h10,h14,h18 → Rohpunkte
    // Score = (roh / 100) * 100
    return Math.round(Math.max(0, Math.min(100, raw)))
  }
  if (n.includes('schusskraft')){ // km/h 0..150
    return Math.round(Math.max(0, Math.min(100, raw/150*100)))
  }
  if (n.includes('schusspräzision')){
    // S5: unten (6 Versuche), oben (6 Versuche)
    // Standardwertung (ohne CSV):
    // Unten: >=10J -> 5 P/ Treffer (max 30), <10J -> 7 P/ Treffer (max 42)
    // Oben:  >=10J -> 1-3:15, 4-5:10, 6:5 (max 70)
    //        <10J -> 1-5:10, 6:8 (max 58)
    // score kommt bereits berechnet rein (raw = 0..100), deshalb einfach begrenzen:
    return Math.round(Math.max(0, Math.min(100, raw)))
  }
  if (n.includes('schnelligkeit')){ // Fallback für S6 (ohne CSV): 4..20s
    const min=4, max=20
    return Math.round(Math.max(0, Math.min(100, 100*(max-raw)/(max-min))))
  }
  return Math.round(Math.max(0, Math.min(100, raw)))
}

/*
 * CSV‑Bewertungen
 *
 * Um in der Capture‑Ansicht identische Scores wie im Dashboard zu verwenden, laden wir
 * optionale S4‑ und S6‑Tabellen aus dem Ordner /public/config. Diese Dateien enthalten
 * altersabhängige Schwellenwerte für Schnelligkeit (S6, separat für weiblich/männlich)
 * sowie Schusskraft (S4, ohne Geschlechtsunterschied). Die Funktionen und
 * Hilfsvariablen darunter sind an page.tsx angelehnt.
 */

// Flags aus Umgebungsvariablen lesen (standardmäßig aktiv)
const USE_S1_CSV_CAPTURE = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S1_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

const USE_S6_CSV_CAPTURE = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S6_CSV
  if (v === '0' || v === 'false') return false
  return true
})()
const USE_S4_CSV_CAPTURE = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S4_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

async function loadS1MapCapture(gender: 'male' | 'female'): Promise<Record<string, number[]> | null> {
  const candidates = gender === 'male'
    ? [
        '/config/s1_male.csv',
        '/config/S1_Beweglichkeit_m.csv',
        '/config/s1_female.csv',
        '/config/S1_Beweglichkeit_w.csv',
        '/config/s1.csv',
      ]
    : ['/config/s1_female.csv', '/config/S1_Beweglichkeit_w.csv', '/config/s1.csv']
  for (const file of candidates) {
    try {
      const res = await fetch(file, { cache: 'no-store' })
      if (!res.ok) continue
      const text = await res.text()
      const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
      if (lines.length < 2) continue
      const header = lines[0].split(';').map(s => s.trim())
      const ageCols = header.slice(1)
      const out: Record<string, number[]> = {}
      for (const age of ageCols) out[age] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(s => s.trim())
        for (let c = 1; c < cols.length; c++) {
          const age = ageCols[c - 1]
          const sec = Number((cols[c] || '').replace(',', '.'))
          if (Number.isFinite(sec)) out[age].push(sec)
        }
      }
      if (Object.keys(out).length) return out
    } catch {
      // ignore and try next candidate
    }
  }
  return null
}

async function loadS6MapCapture(gender: 'male' | 'female'): Promise<Record<string, number[]> | null> {
  try {
    const file = gender === 'male' ? '/config/s6_male.csv' : '/config/s6_female.csv'
    const res = await fetch(file, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
    if (lines.length < 2) return null
    const header = lines[0].split(';').map(s => s.trim())
    const ageCols = header.slice(1)
    const out: Record<string, number[]> = {}
    for (const age of ageCols) out[age] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';').map(s => s.trim())
      for (let c = 1; c < cols.length; c++) {
        const age = ageCols[c - 1]
        const sec = Number((cols[c] || '').replace(',', '.'))
        if (Number.isFinite(sec)) out[age].push(sec)
      }
    }
    return out
  } catch {
    return null
  }
}

async function loadS4MapCapture(): Promise<Record<string, number[]> | null> {
  try {
    const file = '/config/s4.csv'
    const res = await fetch(file, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
    if (lines.length < 3) return null
    const header = lines[0].split(';').map(s => s.trim())
    const ageCols = header.slice(1)
    const out: Record<string, number[]> = {}
    for (const age of ageCols) out[age] = []
    // skip second row (index 1) as header-like
    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(';').map(s => s.trim())
      for (let c = 1; c < cols.length; c++) {
        const age = ageCols[c - 1]
        const kmh = Number((cols[c] || '').replace(',', '.'))
        if (Number.isFinite(kmh)) out[age].push(kmh)
      }
    }
    return out
  } catch {
    return null
  }
}

function nearestAgeBucketCapture(age: number, keys: string[]): string {
  const parsed = keys.map(k => {
    const nums = k.match(/\d+/g)?.map(Number) || []
    const mid = nums.length === 2 ? (nums[0] + nums[1]) / 2 : nums[0] || 0
    return { key: k, mid }
  })
  parsed.sort((a, b) => Math.abs(a.mid - age) - Math.abs(b.mid - age))
  return parsed[0]?.key || keys[0]
}

/** Schrittlogik: schneller (Zeit kleiner) → höherer Score. */
function scoreFromTimeStepCapture(seconds: number, rows: number[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (seconds <= rows[i]) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}

/** Schrittlogik für S4: schneller (km/h größer) → höherer Score. */
function scoreFromSpeedStepCapture(speed: number, rows: number[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (speed >= rows[i]) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}


/** S5 Standard-Bewertung (wenn keine CSV genutzt wird) */
function s5Score(ageYears: number, topHits: number, bottomHits: number){
  const olderOrEq10 = ageYears >= 10
  let bottomMax = olderOrEq10 ? 30 : 42
  let bottomPer = olderOrEq10 ? 5 : 7
  const bottom = Math.min(bottomHits, 6) * bottomPer

  let top = 0
  if (olderOrEq10){
    // 1–3: 15, 4–5: 10, 6: 5
    const t = Math.min(topHits, 6)
    for (let i=1;i<=t;i++){
      if (i<=3) top += 15
      else if (i<=5) top += 10
      else top += 5
    }
  }else{
    // 1–5: 10, 6: 8
    const t = Math.min(topHits, 6)
    for (let i=1;i<=t;i++){
      top += (i<=5) ? 10 : 8
    }
  }
  const total = top + bottom
  const max = olderOrEq10 ? (70+30) : (58+42) // 100
  return Math.round(Math.max(0, Math.min(100, total / max * 100)))
}

export default function CaptureClient(){
  const sp = useSearchParams()
  const router = useRouter()
  const qProject = sp.get('project') || ''
  const qStation = sp.get('station') || ''

  const [projects, setProjects] = useState<{id:string;name:string;date?:string|null}[]>([])
  const [projectId, setProjectId] = useState<string>(qProject)
  const [project, setProject] = useState<{id:string;name:string;date?:string|null}|null>(null)

  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<string>(qStation || '')
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('')

  // Werte pro Spieler (pro Station unterschiedlich aufgebaut)
  const [values, setValues] = useState<Record<string, any>>({}) // key = playerId
  const [saved, setSaved]   = useState<Record<string, number>>({}) // gespeicherter Score (zur Info)
  const [measurements, setMeasurements] = useState<Measurement[]>([])

  // CSV Maps für S4/S6 (analog Dashboard). Wir laden sie einmalig, um im Capture die
  // gleichen Bewertungstabellen zu verwenden wie in der Spieler-Matrix.
  const [s1FemaleMap, setS1FemaleMap] = useState<Record<string, number[]> | null>(null)
  const [s1MaleMap, setS1MaleMap] = useState<Record<string, number[]> | null>(null)
  const [s6FemaleMap, setS6FemaleMap] = useState<Record<string, number[]> | null>(null)
  const [s6MaleMap, setS6MaleMap] = useState<Record<string, number[]> | null>(null)
  const [s4Map, setS4Map] = useState<Record<string, number[]> | null>(null)

  const [s1Status, setS1Status] = useState<CsvStatus>(USE_S1_CSV_CAPTURE ? 'loading' : 'off')
  const [s6Status, setS6Status] = useState<CsvStatus>(USE_S6_CSV_CAPTURE ? 'loading' : 'off')
  const [s4Status, setS4Status] = useState<CsvStatus>(USE_S4_CSV_CAPTURE ? 'loading' : 'off')

  /* Daten holen */
  useEffect(()=>{ fetch('/api/projects').then(r=>r.json()).then(res=> setProjects(res.items||[])) },[])
  useEffect(()=>{
    if (!projectId) return
    // Projekt
    fetch(`/api/projects/${projectId}`, {cache:'no-store'}).then(r=>r.json()).then(res=> 
setProject(res.item||null)).catch(()=>setProject(null))
    // Stationen
    fetch(`/api/projects/${projectId}/stations`, {cache:'no-store'}).then(r=>r.json()).then(res=>{
      const st: Station[] = (res.items??[]).slice().sort((a:Station,b:Station)=>{
        const ia = ST_ORDER.indexOf(a.name), ib = ST_ORDER.indexOf(b.name)
        if (ia>=0 && ib>=0) return ia-ib
        if (ia>=0) return -1
        if (ib>=0) return 1
        return a.name.localeCompare(b.name)
      })
      setStations(st)
      // initial station aus URL; wenn keine angegeben ist, wird keine Station vorgewählt
      if (qStation && st.find(s=>s.id===qStation)) setSelected(qStation)
      else setSelected('')
    })
    // Spieler
    fetch(`/api/projects/${projectId}/players`, {cache:'no-store'})
      .then(r=>r.json())
      .then(res=> setPlayers(res.items||[]))
  },[projectId, qStation])

  const currentStation = useMemo(()=> stations.find(s=>s.id===selected), [stations, selected])
  const currentIndex   = currentStation ? (ST_INDEX[currentStation.name] ?? 1) : 1
  const sketchHref     = `/station${currentIndex}.pdf`

  const loadMeasurements = useCallback(async () => {
    if (!projectId) {
      setMeasurements([])
      return
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/measurements`, { cache: 'no-store' })
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []
      setMeasurements(items as Measurement[])
    } catch {
      // Messwerte sind optional – bei Fehlern behalten wir den aktuellen Stand bei.
    }
  }, [projectId])

  useEffect(() => {
    loadMeasurements()
  }, [loadMeasurements])

  const stationHighscore = useMemo(() => {
    if (!selected) return null
    const st = stations.find(s => s.id === selected)
    if (!st) return null
    let best: number | null = null
    for (const m of measurements) {
      if (m.station_id !== selected) continue
      const raw = Number(m.value)
      if (!Number.isFinite(raw)) continue
      const player = players.find(pl => pl.id === m.player_id)
      if (!player) continue
      const score = scoreFor(st, player, raw)
      if (!Number.isFinite(score)) continue
      best = best === null ? score : Math.max(best, score)
    }
    return best
  }, [measurements, selected, stations, players])

  useEffect(() => {
    if (!selected || !currentPlayerId) return
    const measurement = measurements.find(
      m => m.station_id === selected && m.player_id === currentPlayerId
    )
    if (!measurement || !Number.isFinite(Number(measurement.value))) {
      setSaved(prev => {
        if (!(currentPlayerId in prev)) return prev
        const copy = { ...prev }
        delete copy[currentPlayerId]
        return copy
      })
      return
    }
    const st = stations.find(s => s.id === selected)
    const p = players.find(pl => pl.id === currentPlayerId)
    if (!st || !p) return
    const score = scoreFor(st, p, Number(measurement.value))
    setSaved(prev => {
      if (prev[currentPlayerId] === score) return prev
      return { ...prev, [currentPlayerId]: score }
    })
  }, [measurements, selected, currentPlayerId, stations, players])

  /* Helfer */
  function resolveAge(by: number|null){
    const eventYear = project?.date ? Number(String(project.date).slice(0,4)) : new Date().getFullYear()
    if (!by) return 16
    return Math.max(6, Math.min(49, eventYear - by))
  }

  function resolveRaw(st: Station, v: any): number{
    const n = st.name.toLowerCase()
    if (!v) return 0
    if (n.includes('passgenauigkeit')){ // Rohpunkte 0..100
      // Eingabe-Felder: h10 (0..3), h14 (0..2), h18 (0..1)
      const h10 = Number(v.h10)||0
      const h14 = Number(v.h14)||0
      const h18 = Number(v.h18)||0
      const raw = h10*11 + h14*17 + h18*33 // 0..(3*11+2*17+1*33)=100
      return Math.max(0, Math.min(100, raw))
    }
    if (n.includes('schusspräzision')){
      // Eingabe-Felder: ul, ur, ll, lr (jeweils 0–3)
      const ul = Number(v.ul)||0, ur = Number(v.ur)||0, ll = Number(v.ll)||0, lr = Number(v.lr)||0
      const top = Math.min(ul + ur, 6)
      const bottom = Math.min(ll + lr, 6)
      // Rohwert: Punkte aufaddiert (oben=3 P, unten=1 P), 0..24
      const rawHits = top * 3 + bottom
      return rawHits
    }

    const runs = Array.isArray(v.runs)
      ? v.runs
          .map((entry: unknown) => Number(entry))
          .filter((entry: number) => Number.isFinite(entry))
          .slice(-RUNS_COUNT)
      : []
    if (runs.length) {
      return Math.min(...runs)
    }

    // generisch (Zahl)
    const num = Number(v.value||0)
    return isNaN(num) ? 0 : num
  }

  function scoreFor(st: Station, p: Player, raw: number){
    const n = (st.name || '').toLowerCase()
    if (n.includes('beweglichkeit')) {
      if (USE_S1_CSV_CAPTURE) {
        const map = p.gender === 'male' ? s1MaleMap : s1FemaleMap
        if (map) {
          const keys = Object.keys(map)
          if (keys.length) {
            const age = resolveAge(p.birth_year)
            const bucket = nearestAgeBucketCapture(age, keys)
            const rows = map[bucket] || []
            if (rows.length) return scoreFromTimeStepCapture(Number(raw), rows)
          }
        }
      }
      return normScore(st, raw)
    }

    // Sonderfall Schnelligkeit (S6): zuerst CSV schauen, sonst Fallback (4–20 s)
    if (n.includes('schnelligkeit')) {
      if (USE_S6_CSV_CAPTURE) {
        const map = p.gender === 'male' ? s6MaleMap : s6FemaleMap
        if (map) {
          const keys = Object.keys(map)
          if (keys.length) {
            const age = resolveAge(p.birth_year)
            const bucket = nearestAgeBucketCapture(age, keys)
            const rows = map[bucket] || []
            if (rows.length) return scoreFromTimeStepCapture(Number(raw), rows)
          }
        }
      }
      // Fallback: 4–20 s → 0–100 (weniger ist besser)
      // min=4, max=20
      const min = 4, max = 20
      return Math.round(Math.max(0, Math.min(100, 100 * (max - Number(raw)) / (max - min))))
    }
    // Sonderfall Schusskraft (S4): CSV oder Fallback
    if (n.includes('schusskraft')) {
      if (USE_S4_CSV_CAPTURE && s4Map) {
        const keys = Object.keys(s4Map)
        if (keys.length) {
          const age = resolveAge(p.birth_year)
          const bucket = nearestAgeBucketCapture(age, keys)
          const rows = s4Map[bucket] || []
          if (rows.length) return scoreFromSpeedStepCapture(Number(raw), rows)
        }
      }
      // Fallback: 0–150 km/h → 0–100 (mehr ist besser)
      const val = Number(raw)
      return Math.round(Math.max(0, Math.min(100, (val / 150) * 100)))
    }
    // Passgenauigkeit: Score = Raw (0–100) direkt
    if (n.includes('passgenauigkeit')) {
      const v = Number(raw)
      return Math.round(Math.max(0, Math.min(100, v)))
    }
    // Schusspräzision: Raw = 0–24 → Score = raw/24*100
    if (n.includes('schusspräzision')) {
      const v = Number(raw)
      const pct = Math.max(0, Math.min(1, v / 24))
      return Math.round(pct * 100)
    }
    // Beweglichkeit, Technik oder generisch → Fallback definieren
    return normScore(st, raw)
  }

  async function saveOne(st: Station, p: Player){
    const v = values[p.id] || {}
    const raw = resolveRaw(st, v)
    const body = new FormData()
    body.append('player_id', p.id)
    body.append('station_id', st.id)
    body.append('value', String(raw))
    const res = await fetch(`/api/projects/${projectId}/measurements`, { method:'POST', body })
    const txt = await res.text()
    if (!res.ok){ alert(txt || 'Fehler beim Speichern'); return }
    // Score für Anzeige berechnen: identisch zur Matrix-Logik (inklusive CSV-Auswertung)
    const score = scoreFor(st, p, raw)
    setSaved(prev => ({ ...prev, [p.id]: score }))
    await loadMeasurements()
    alert('Gespeichert.')
  }

  const updatePlayerValues = useCallback((playerId: string, patch: Record<string, any>) => {
    setValues(prev => {
      const existing = prev[playerId] ?? {}
      return { ...prev, [playerId]: { ...existing, ...patch } }
    })
  }, [setValues])

  // CSV Maps laden (nur einmal). Bei Fehler bleibt Map null → Fallback in Score.
  useEffect(() => {
    if (USE_S1_CSV_CAPTURE) {
      Promise.allSettled([loadS1MapCapture('female'), loadS1MapCapture('male')]).then(([f, m]) => {
        if (f.status === 'fulfilled' && f.value) {
          setS1FemaleMap(f.value as Record<string, number[]>)
        }
        if (m.status === 'fulfilled' && m.value) {
          setS1MaleMap(m.value as Record<string, number[]>)
        }
      })
    }

    if (USE_S6_CSV_CAPTURE) {
      setS6Status('loading')
      // beide Gender parallel laden
      Promise.allSettled([loadS6MapCapture('female'), loadS6MapCapture('male')]).then(([f, m]) => {
        if (f.status === 'fulfilled' && f.value) {
          setS6FemaleMap(f.value as Record<string, number[]>)
        }
        if (m.status === 'fulfilled' && m.value) {
          setS6MaleMap(m.value as Record<string, number[]>)
        }
      })
    } else {
      setS6Status('off')
    }

    if (USE_S4_CSV_CAPTURE) {
      setS4Status('loading')
      loadS4MapCapture().then(map => {
        if (map) {
          setS4Map(map)
        }
      })
    } else {
      setS4Status('off')
    }
  }, [])

  /* UI-Bausteine */

  function ProjectsSelect(){
    if (qProject) return null
    return (
      <div className="card glass mx-0 text-left">  
        <label className="block text-sm font-semibold mb-2">Projekt wählen</label>
        <select className="input" value={projectId}
          onChange={e=>{ setProjectId(e.target.value); setSelected(''); setValues({}); setSaved({}) }}>
          <option value="">{projects.length ? 'Bitte wählen' : 'Lade…'}</option>
          {projects.map(p=> <option key={p.id} value={p.id}>{p.name}{p.date?` – ${p.date}`:''}</option>)}
        </select>
      </div>
    )
  }



  function StationButtonRow() {
    if (!stations.length) return null

    if (selected) return null

    const ordered = stations.slice().sort((a, b) => {
      const ia = ST_INDEX[a.name] ?? 99
      const ib = ST_INDEX[b.name] ?? 99
      if (ia !== ib) return ia - ib
      return a.name.localeCompare(b.name, 'de')
    })

    if (!ordered.length) return null

    return (
      <div className="capture-stations">
        {ordered.map(s => {
          const idx = ST_INDEX[s.name]
          const displayIdx = idx ?? '?'
          const hrefIdx = idx ?? 1
          const href = `/station${hrefIdx}.pdf`
          const sketchLabel = `S${displayIdx}-Skizze`

          const handleSelectStation = () => {
            setSelected(s.id)
            setCurrentPlayerId('')
            router.replace(
              projectId ? `?project=${projectId}&station=${s.id}` : `?station=${s.id}`
            )
          }

          return (
            <div key={s.id} className="capture-stations__row">
              <button
                className="btn capture-stations__station-button"
                onClick={handleSelectStation}
                style={s.id === selected ? { filter: 'brightness(1.12)' } : {}}
              >
                {`S${displayIdx} - ${s.name}`}
              </button>
              <a
                className="btn btn-icon capture-stations__sketch-button"
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={sketchLabel}
              >
                <span className="btn-icon__label">{sketchLabel}</span>
                <span className="btn-icon__icon" aria-hidden>
                  📄
                </span>
              </a>
            </div>
          )
        })}
      </div>
    )
  }

  function InputsForSelected(){
    const station = currentStation
    if (!station) return null

    const stationUnit = station.unit || ''
    const stationUnitLabel = stationUnit ? `(${stationUnit})` : ''
    const stationId = station.id

    const handleSave = (target: Player) => {
      void saveOne(station, target)
    }

    const n = station.name.toLowerCase()
    const displayIdx = ST_INDEX[station.name] ?? '?'
    const heading = `S${displayIdx} - ${station.name}`.toUpperCase()
    const player = players.find(x => x.id === currentPlayerId) || null
    const playerScore = player ? saved[player.id] : undefined
    const playerValues = player ? values[player.id] : undefined
    const rawRuns = Array.isArray(playerValues?.runs)
      ? (playerValues?.runs as unknown[])
      : []
    const playerRuns = rawRuns
      .map((entry: unknown) => Number(entry))
      .filter((entry: number) => Number.isFinite(entry))
      .slice(-RUNS_COUNT)
    const runScores = player && playerRuns.length
      ? playerRuns.map(run => scoreFor(station, player, run))
      : []
    const lastRunScore = runScores.length
      ? runScores[runScores.length - 1]
      : playerScore
    const isTimeStation =
      n.includes('beweglichkeit') || n.includes('technik') || n.includes('schnelligkeit')
    const bestLocalScore = isTimeStation
      ? (runScores.length ? Math.max(...runScores) : undefined)
      : undefined
    const effectiveHighscore =
      bestLocalScore ?? playerScore ?? (stationHighscore !== null ? stationHighscore : undefined)
    const highscoreDisplay =
      effectiveHighscore !== undefined
        ? String(effectiveHighscore).padStart(3, '0')
        : '###'
    const letzterRunDisplay =
      lastRunScore !== undefined ? String(lastRunScore).padStart(3, '0') : null
    const sketchLabel = `S${displayIdx}-Skizze`

    const renderPdfButton = (extraClass = '') => (
      <a
        className={`btn btn-icon capture-panel__pdf-button${extraClass ? ` ${extraClass}` : ''}`}
        href={sketchHref}
        target="_blank"
        rel="noreferrer"
        aria-label={sketchLabel}
      >
        <span className="btn-icon__label">PDF</span>
        <span className="btn-icon__icon" aria-hidden>
          📄
        </span>
      </a>
    )

    function PassForm({ player }: { player: Player }) {
      const v = values[player.id] || {}
      const h10 = v.h10 ?? 0
      const h14 = v.h14 ?? 0
      const h18 = v.h18 ?? 0

      return (
        <div className="capture-panel__form-card">
          <div className="capture-panel__inputs-grid capture-panel__inputs-grid--thirds">
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">10 m (0–3)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={h10}
                onChange={e => updatePlayerValues(player.id, { h10: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">14 m (0–2)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={2}
                value={h14}
                onChange={e => updatePlayerValues(player.id, { h14: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">18 m (0–1)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={1}
                value={h18}
                onChange={e => updatePlayerValues(player.id, { h18: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="capture-panel__form-actions">
            <button className="btn" type="button" onClick={() => handleSave(player)}>
              Speichern
            </button>
            {renderPdfButton()}
          </div>
        </div>
      )
    }

    function PrecisionForm({ player }: { player: Player }) {
      const v = values[player.id] || {}
      const ul = v.ul ?? 0
      const ur = v.ur ?? 0
      const ll = v.ll ?? 0
      const lr = v.lr ?? 0

      return (
        <div className="capture-panel__form-card">
          <div className="capture-panel__inputs-grid capture-panel__inputs-grid--quarters">
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">oben L (0–3)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={ul}
                onChange={e => updatePlayerValues(player.id, { ul: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">oben R (0–3)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={ur}
                onChange={e => updatePlayerValues(player.id, { ur: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">unten L (0–3)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={ll}
                onChange={e => updatePlayerValues(player.id, { ll: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div className="capture-panel__input-group">
              <label className="capture-panel__input-label">unten R (0–3)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={lr}
                onChange={e => updatePlayerValues(player.id, { lr: Number(e.target.value) })}
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="capture-panel__form-actions">
            <button className="btn" type="button" onClick={() => handleSave(player)}>
              Speichern
            </button>
            {renderPdfButton()}
          </div>
        </div>
      )
    }

    function GenericForm({ player }: { player: Player }) {
      const v = values[player.id] || {}
      const val = v.value ?? ''
      const isTimeStation =
        n.includes('beweglichkeit') || n.includes('technik') || n.includes('schnelligkeit')
      const storedRuns = React.useMemo(() => {
        if (!Array.isArray(v.runs)) return []
        return (v.runs as unknown[])
          .map(entry => Number(entry))
          .filter(entry => Number.isFinite(entry))
          .slice(-RUNS_COUNT)
      }, [v.runs])
      const measurementRun = React.useMemo(() => {
        if (!isTimeStation) return null
        const entry = measurements.find(
          m => m.station_id === stationId && m.player_id === player.id
        )
        if (!entry) return null
        const numeric = Number(String(entry.value ?? '').replace(',', '.'))
        return Number.isFinite(numeric) ? numeric : null
      }, [isTimeStation, measurements, player.id, stationId])
      const normalizedRuns = React.useMemo(() => {
        return storedRuns
      }, [storedRuns])
      const normalizedValue = React.useMemo(() => {
        if (val) return val
        if (!isTimeStation && measurementRun !== null) return measurementRun.toFixed(2)
        return ''
      }, [val, measurementRun, isTimeStation])

      const [localVal, setLocalVal] = React.useState<string>(normalizedValue)
      const [localRuns, setLocalRuns] = React.useState<number[]>(normalizedRuns)
      const [stopwatchStart, setStopwatchStart] = React.useState<number | null>(null)
      const [elapsed, setElapsed] = React.useState<number>(0)
      const [timerId, setTimerId] = React.useState<ReturnType<typeof setInterval> | null>(null)
      const running = stopwatchStart !== null

      React.useEffect(() => {
        setLocalVal(normalizedValue)
      }, [normalizedValue])

      React.useEffect(() => {
        setLocalRuns(normalizedRuns)
      }, [normalizedRuns])

      React.useEffect(() => {
        return () => {
          if (timerId) clearInterval(timerId)
        }
      }, [timerId])

      const formatTime = (seconds: number) => {
        if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
        const totalHundredths = Math.round(seconds * 100)
        const ss = Math.floor(totalHundredths / 100)
        const hh = Math.abs(totalHundredths % 100)
        const cappedSeconds = Math.min(ss, 99)
        return `${String(cappedSeconds).padStart(2, '0')}:${String(hh).padStart(2, '0')}`
      }

      const startStopwatch = () => {
        if (running) return
        const start = Date.now()
        setStopwatchStart(start)
        const id = setInterval(() => {
          const now = Date.now()
          setElapsed((now - start) / 1000)
        }, 50)
        setTimerId(id)
      }

      const stopStopwatch = () => {
        if (!running) return
        if (timerId) clearInterval(timerId)
        const finalVal = (Date.now() - (stopwatchStart || Date.now())) / 1000
        const valStr = finalVal.toFixed(2)
        const nextRuns = [...localRuns, finalVal].slice(-RUNS_COUNT)
        const best = nextRuns.length ? Math.min(...nextRuns) : finalVal
        setStopwatchStart(null)
        setElapsed(finalVal)
        setTimerId(null)
        setLocalVal(valStr)
        setLocalRuns(nextRuns)
        updatePlayerValues(player.id, {
          runs: nextRuns,
          value: best.toFixed(2),
        })
      }

      const resetStopwatch = () => {
        if (timerId) clearInterval(timerId)
        setStopwatchStart(null)
        setElapsed(0)
        setTimerId(null)
        setLocalVal('')
        setLocalRuns([])
        updatePlayerValues(player.id, { runs: [], value: '' })
      }

      const handleManualChange = (inputVal: string) => {
        const sanitized = inputVal.replace(/[^0-9.,]/g, '').replace(',', '.')
        setLocalVal(sanitized)
        updatePlayerValues(player.id, { value: sanitized })
      }

      const displaySeconds = running
        ? elapsed
        : localRuns.length
          ? localRuns[localRuns.length - 1]
          : Number(localVal || 0)
      const formatted = formatTime(displaySeconds)
      const saveDisabled = isTimeStation
        ? localRuns.length === 0 || !currentPlayerId
        : !localVal || !currentPlayerId

      if (!isTimeStation) {
        return (
          <div className="capture-panel__form-card capture-panel__form-card--single">
            <label className="capture-panel__input-label">
              Messwert {stationUnitLabel}
            </label>
            <input
              className="input capture-panel__input"
              type="tel"
              value={localVal}
              onChange={e => handleManualChange(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              onKeyDownCapture={e => e.stopPropagation()}
              onKeyUp={e => e.stopPropagation()}
              onKeyPress={e => e.stopPropagation()}
              placeholder={stationUnit || 'Wert'}
            />
            <div className="capture-panel__form-actions capture-panel__form-actions--inline">
              <button
                className="btn"
                type="button"
                onClick={() => handleSave(player)}
                disabled={saveDisabled}
              >
                Speichern
              </button>
              {renderPdfButton()}
            </div>
          </div>
        )
      }

      return (
        <>
          <div className="capture-panel__timer">
            <div className={`capture-panel__timer-display timer-display${running ? ' is-running' : ''}`}>
              {formatted}
            </div>
            <div className={`capture-panel__timer-bar${running ? ' is-running' : ''}`} />
          </div>
          <div className="capture-panel__runs">
            {Array.from({ length: RUNS_COUNT }).map((_, idx) => {
              const runVal = localRuns[idx]
              const hasRun = typeof runVal === 'number' && Number.isFinite(runVal)
              return (
                <div key={idx} className="capture-panel__run-row">
                  <span className="capture-panel__run-label">{`RUN ${idx + 1}:`}</span>
                  <span className="capture-panel__run-value">
                    {hasRun ? formatTime(runVal) : '--:--'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="capture-panel__buttons capture-actions">
            <button
              className="btn btn-capture"
              type="button"
              onClick={running ? stopStopwatch : startStopwatch}
            >
              {running ? 'STOP' : 'START'}
            </button>
            <button className="btn btn-capture" type="button" onClick={resetStopwatch}>
              RESET
            </button>
            <button
              className="btn btn-capture"
              type="button"
              onClick={() => handleSave(player)}
              disabled={saveDisabled}
            >
              SPEICHERN
            </button>
            {renderPdfButton('btn-capture')}
          </div>
        </>
      )
    }

    let content: React.ReactNode
    if (!player) {
      content = null
    } else if (n.includes('passgenauigkeit')) {
      content = <PassForm player={player} />
    } else if (n.includes('schusspräzision')) {
      content = <PrecisionForm player={player} />
    } else {
      content = <GenericForm player={player} />
    }

    return (
      <div className="capture-panel-shell">
        <section className="capture-panel">
          <div className="capture-panel__header font-league capture-title">{heading}</div>
          <div className="capture-panel__player">
            {!player && (
              <p className="capture-panel__player-label">SPIELER*IN WÄHLEN</p>
            )}
            <p className="capture-panel__player-name capture-player-name">
              {(player ? player.display_name : 'NAME').toUpperCase()}
            </p>
            {!player && (
              <div className="capture-panel__player-select">
                <select
                  className="input capture-panel__select"
                  value={currentPlayerId}
                  onChange={e => setCurrentPlayerId(e.target.value)}
                >
                  <option value="">Bitte wählen…</option>
                  {players.map(pl => (
                    <option key={pl.id} value={pl.id}>
                      {pl.display_name}
                      {pl.fav_number ? ` #${pl.fav_number}` : ''}
                      {pl.birth_year ? ` (${pl.birth_year})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {player && (
            <div className="capture-panel__highscore">
              <span className="capture-panel__highscore-label">AKTUELLER HIGHSCORE:</span>
              <span className="capture-panel__highscore-value">{highscoreDisplay}</span>
            </div>
          )}
          {player && letzterRunDisplay && (
            <div className="capture-panel__saved">Letzter Run: {letzterRunDisplay}</div>
          )}
          {content}
        </section>
      </div>
    )
  }

  /**
   * Eigene Zurück-Schaltfläche. Wenn eine Station gewählt ist, blendet sie diese aus
   * und zeigt wieder alle Stationen an. Erst wenn keine Station mehr gewählt ist,
   * springt der Button zur vorherigen Seite zurück.
   */
  function CaptureBackFab(){
    return (
      <div className="capture-fixed-button capture-fixed-button--right">
        <button
          onClick={() => {
            if (selected) {
              // Station abwählen → alle Stationen wieder anzeigen
              setSelected('')
              setCurrentPlayerId('')
              if (projectId) router.replace(`?project=${projectId}`)
              else router.replace('')
            } else {
              // Keine Station gewählt → zurück zur vorherigen Seite
              router.back()
            }
          }}
          className="btn btn-back"
          aria-label="Zurück"
          title="Zurück"
          type="button"
        >
          ← Zurück
        </button>
      </div>
    )
  }

  function CapturePlayerSwitchButton() {
    if (!selected || !currentPlayerId) return null

    return (
      <div className="capture-fixed-button capture-fixed-button--left">
        <button
          type="button"
          onClick={() => setCurrentPlayerId('')}
          className="btn btn-back capture-player-switch"
        >
          Spielerwechsel
        </button>
      </div>
    )
  }

  const heroTitle = selected ? '' : 'Stationseingabe'
  const heroSubtitle = selected ? undefined : project ? project.name : undefined

  return (
    <main>
      {/* align="center" stellt sicher, dass der Inhalt auch vertikal zentriert wird */}
      <Hero title={heroTitle} image="/base.jpg" subtitle={heroSubtitle} align="center">
        {/*
          Wir verwenden einen flexiblen Container, der alle Inhalte vertikal stapelt und
          horizontal zentriert. Die Abstände zwischen den Abschnitten werden über
          space-y-6 definiert. Die page-pad-Klasse wird entfernt, damit der
          Inhalt durch das Hero-Grid vertikal zentriert bleibt.
        */}
        <div className="hero-stack">
          <ProjectsSelect />
          <StationButtonRow />
          <InputsForSelected />
        </div>
      </Hero>

      {/* Zurück-FAB fixiert unten rechts */}
      <CaptureBackFab />
      <CapturePlayerSwitchButton />
    </main>
  )
}
