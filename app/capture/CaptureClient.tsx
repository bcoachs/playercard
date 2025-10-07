'use client'

import React, {useEffect, useMemo, useState} from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
// BackFab wird hier ersetzt durch eine eigene Implementierung mit zusätzlicher Logik
import Hero from '@/app/components/Hero'

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

const ST_ORDER = ['Beweglichkeit','Technik','Passgenauigkeit','Schusskraft','Schusspräzision','Schnelligkeit']
const ST_INDEX: Record<string, number> = {
  'Beweglichkeit': 1, 'Technik': 2, 'Passgenauigkeit': 3, 'Schusskraft': 4, 'Schusspräzision': 5, 'Schnelligkeit': 6
}

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

  // CSV Maps für S4/S6 (analog Dashboard). Wir laden sie einmalig, um im Capture die
  // gleichen Bewertungstabellen zu verwenden wie in der Spieler-Matrix.
  const [s6FemaleMap, setS6FemaleMap] = useState<Record<string, number[]> | null>(null)
  const [s6MaleMap, setS6MaleMap] = useState<Record<string, number[]> | null>(null)
  const [s4Map, setS4Map] = useState<Record<string, number[]> | null>(null)

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
    // generisch (Zahl)
    const num = Number(v.value||0)
    return isNaN(num) ? 0 : num
  }

  function scoreFor(st: Station, p: Player, raw: number){
    const n = (st.name || '').toLowerCase()
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
    alert('Gespeichert.')
  }

  /* Messungen laden und Score setzen, wenn Spieler/Station gewechselt */
  useEffect(() => {
    if (!projectId || !selected || !currentPlayerId) return
    // Alle Messungen dieses Projekts laden, passendes Measurement für Spieler/Station suchen
    fetch(`/api/projects/${projectId}/measurements`, { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        const items = res.items || []
        const m = items.find((m: any) => m.player_id === currentPlayerId && m.station_id === selected)
        if (m && typeof m.value === 'number') {
          const rawVal = Number(m.value)
          const st = stations.find(s => s.id === selected)
          const p = players.find(pl => pl.id === currentPlayerId)
          if (st && p) {
            const sc = scoreFor(st, p, rawVal)
            setSaved(prev => ({ ...prev, [currentPlayerId]: sc }))
          }
        } else {
          // Keine Messung vorhanden → gespeicherten Score entfernen
          setSaved(prev => {
            const copy: Record<string, number> = { ...prev }
            delete copy[currentPlayerId]
            return copy
          })
        }
      })
      .catch(() => {})
  }, [projectId, selected, currentPlayerId, stations])

  // CSV Maps laden (nur einmal). Bei Fehler bleibt Map null → Fallback in Score.
  useEffect(() => {
    if (USE_S6_CSV_CAPTURE) {
      // beide Gender parallel laden
      Promise.allSettled([loadS6MapCapture('female'), loadS6MapCapture('male')]).then(([f, m]) => {
        if (f.status === 'fulfilled' && f.value) setS6FemaleMap(f.value)
        if (m.status === 'fulfilled' && m.value) setS6MaleMap(m.value)
      })
    }
    if (USE_S4_CSV_CAPTURE) {
      loadS4MapCapture().then(map => {
        if (map) setS4Map(map)
      })
    }
  }, [])

  /* UI-Bausteine */
  function ProjectsSelect(){
    if (qProject) return null
    return (
      <div className="card glass w-full max-w-2xl mx-auto text-left">
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

  // Stufe 2: Wenn eine Station gewählt ist, nur diese anzeigen – sonst alle
  const visibleStations = selected
    ? stations.filter(s => s.id === selected)
    : stations

  return (
    // Outer grid: zentriert, mit Abstand zwischen Zeilen
    <div className="w-fit mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8">
      {visibleStations.map((s) => (
        // Zeilen-Container: Buttons/Icons zentriert + Abstand
        <div key={s.id} className="flex items-center justify-center gap-8">

          {/* Hauptbutton für die Station */}
          <button
            className="btn pill btn-lg btn--wide"
            onClick={() => {
              setSelected(s.id)
              setCurrentPlayerId('')
              router.replace(
                projectId ? `?project=${projectId}&station=${s.id}` : `?station=${s.id}`
              )
            }}
            style={s.id === selected ? { filter: 'brightness(1.12)' } : {}}
          >
            {`S${ST_INDEX[s.name] ?? '?' } - ${s.name}`}
          </button>

          {/* Lange Stationsskizzen-Schaltfläche ab sm (≥640px) */}
          <a
            className="hidden sm:flex btn pill btn-lg btn--wide items-center justify-center"
            href={`/station${ST_INDEX[s.name] ?? 1}.pdf`}
            target="_blank"
            rel="noreferrer"
          >
            {`S${ST_INDEX[s.name] ?? '?' } - Stationsskizze`}
          </a>

          {/* Rundes PDF-Icon unter sm */}
          <a
            className="flex sm:hidden items-center justify-center btn pill btn-sm rounded-full p-0"
            style={{ width: 'var(--btn-wide-height)', height: 'var(--btn-wide-height)' }}
            href={`/station${ST_INDEX[s.name] ?? 1}.pdf`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Stationsskizze S${ST_INDEX[s.name] ?? '?'}`}
          >
            📄
          </a>
        </div>
      ))}
    </div>
  )
}

  function PlayerPicker(){
    if (!currentStation) return null
    return (
      <div className="card glass w-full max-w-3xl mx-auto">
        <label className="block text-sm font-semibold mb-2">Spieler*in wählen</label>
        {/*
          Das Dropdown für die Spieler*innen-Auswahl erhält eine größere Höhe
          für bessere Bedienbarkeit auf dem Handy. */}
        <select className="input h-14" value={currentPlayerId} onChange={e=> setCurrentPlayerId(e.target.value)}>
          <option value="">Bitte wählen…</option>
          {players.map(p=>(<option key={p.id} value={p.id}>
            {p.display_name}{p.fav_number?` #${p.fav_number}`:''}{p.birth_year?` (${p.birth_year})`:''}
          </option>))}
        </select>
      </div>
    )
  }

  function InputsForSelected(){
    const st = currentStation
    const p = players.find(x=>x.id===currentPlayerId)
    if (!st || !p) return null
    const n = st.name.toLowerCase()
    const v = values[p.id] || {}
    
    if (n.includes('passgenauigkeit')){
      const h10=v.h10??0, h14=v.h14??0, h18=v.h18??0
      return (
        <div className="card glass w-full max-w-3xl mx-auto">
          {/* Score anzeigen, falls vorhanden */}
          {saved[p.id]!==undefined && (
            <div className="mb-2 text-sm">Bisheriger Score: {saved[p.id]}</div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">10 m (0–3)</label>
                   <input
                     className="input"
                     type="number"
                     min={0}
                     max={3}
                     value={h10}
                     onChange={e => setValues(prev => ({
                       ...prev,
                       [p.id]: { ...prev[p.id], h10: Number(e.target.value) },
                     }))}
                     // stop key events in both capture and bubble phase so that global hotkeys do not interfere
                     onKeyDown={e => e.stopPropagation()}
                     onKeyDownCapture={e => e.stopPropagation()}
                     onKeyUp={e => e.stopPropagation()}
                     onKeyPress={e => e.stopPropagation()}
                   />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">14 m (0–2)</label>
                   <input
                     className="input"
                     type="number"
                     min={0}
                     max={2}
                     value={h14}
                     onChange={e => setValues(prev => ({
                       ...prev,
                       [p.id]: { ...prev[p.id], h14: Number(e.target.value) },
                     }))}
                     onKeyDown={e => e.stopPropagation()}
                     onKeyDownCapture={e => e.stopPropagation()}
                     onKeyUp={e => e.stopPropagation()}
                     onKeyPress={e => e.stopPropagation()}
                   />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">18 m (0–1)</label>
                   <input
                     className="input"
                     type="number"
                     min={0}
                     max={1}
                     value={h18}
                     onChange={e => setValues(prev => ({
                       ...prev,
                       [p.id]: { ...prev[p.id], h18: Number(e.target.value) },
                     }))}
                     onKeyDown={e => e.stopPropagation()}
                     onKeyDownCapture={e => e.stopPropagation()}
                     onKeyUp={e => e.stopPropagation()}
                     onKeyPress={e => e.stopPropagation()}
                   />
            </div>
          </div>
          <div className="mt-4 text-right">
            {/* Verwende die zentrale btn-lg Klasse für größere Buttons */}
            <button className="btn pill btn-lg" onClick={()=>saveOne(st, p)}>Speichern</button>
          </div>
        </div>
      )
    }

    if (n.includes('schusspräzision')){
      const ul=v.ul??0, ur=v.ur??0, ll=v.ll??0, lr=v.lr??0
      return (
        <div className="card glass w-full max-w-3xl mx-auto">
          {/* Score anzeigen, falls vorhanden */}
          {saved[p.id]!==undefined && (
            <div className="mb-2 text-sm">Bisheriger Score: {saved[p.id]}</div>
          )}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">oben L (0–3)</label>
                   <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={ul}
                onChange={e =>
                  setValues(prev => ({
                    ...prev,
                    [p.id]: { ...prev[p.id], ul: Number(e.target.value) },
                  }))
                }
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">oben R (0–3)</label>
                   <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={ur}
                onChange={e =>
                  setValues(prev => ({
                    ...prev,
                    [p.id]: { ...prev[p.id], ur: Number(e.target.value) },
                  }))
                }
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">unten L (0–3)</label>
                   <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={ll}
                onChange={e =>
                  setValues(prev => ({
                    ...prev,
                    [p.id]: { ...prev[p.id], ll: Number(e.target.value) },
                  }))
                }
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">unten R (0–3)</label>
                   <input
                className="input"
                type="number"
                min={0}
                max={3}
                value={lr}
                onChange={e =>
                  setValues(prev => ({
                    ...prev,
                    [p.id]: { ...prev[p.id], lr: Number(e.target.value) },
                  }))
                }
                onKeyDown={e => e.stopPropagation()}
                onKeyDownCapture={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="mt-4 text-right">
            {/* Verwende die zentrale btn-lg Klasse für größere Buttons */}
            <button className="btn pill btn-lg" onClick={()=>saveOne(st, p)}>Speichern</button>
          </div>
        </div>
      )
    }

    // Generische Messung (z.B. Schusskraft, Schnelligkeit Fallback) oder zeitbasierte Stationen.
    const val = v.value ?? ''
    // Zeitstationen: Beweglichkeit (S1), Technik (S2), Schnelligkeit (S6) → Stoppuhr nutzen
    const isTimeStation = n.includes('beweglichkeit') || n.includes('technik') || n.includes('schnelligkeit')
    // Lokaler Zustand für das Eingabefeld / Stoppuhr
    const [localVal, setLocalVal] = React.useState<string>(val)
    const [stopwatchStart, setStopwatchStart] = React.useState<number | null>(null)
    const [elapsed, setElapsed] = React.useState<number>(0)
    const [timerId, setTimerId] = React.useState<any>(null)
    const running = stopwatchStart !== null
    // synchronisiere lokalen Wert, wenn externe Messung geändert wird
    React.useEffect(() => {
      setLocalVal(val)
    }, [val])
    // cleanup bei unmount/wechsel
    React.useEffect(() => {
      return () => {
        if (timerId) clearInterval(timerId)
      }
    }, [timerId])
    const startStopwatch = () => {
      if (running) return
      const start = Date.now()
      setStopwatchStart(start)
      const id = setInterval(() => {
        const now = Date.now()
        const diff = (now - start) / 1000
        setElapsed(diff)
      }, 100)
      setTimerId(id)
    }
    const stopStopwatch = () => {
      if (!running) return
      if (timerId) clearInterval(timerId)
      const finalVal = (Date.now() - (stopwatchStart || Date.now())) / 1000
      const valStr = finalVal.toFixed(2)
      setStopwatchStart(null)
      setElapsed(finalVal)
      setLocalVal(valStr)
      // Wert auch im globalen State aktualisieren
      setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], value: valStr } }))
    }
    const resetStopwatch = () => {
      if (timerId) clearInterval(timerId)
      setStopwatchStart(null)
      setElapsed(0)
      setLocalVal('')
      setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], value: '' } }))
    }
    return (
      <div className="card glass w-full max-w-3xl mx-auto">
        {/* Score anzeigen, falls vorhanden */}
        {saved[p.id] !== undefined && (
          <div className="mb-2 text-sm">Bisheriger Score: {saved[p.id]}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Messwert {st.unit ? `(${st.unit})` : ''}
            </label>
            {isTimeStation && (
              <div className="flex items-center gap-2 mb-2">
                {!running ? (
                  <button className="btn pill btn-lg" type="button" onClick={startStopwatch}>
                    Start
                  </button>
                ) : (
                  <button className="btn pill btn-lg" type="button" onClick={stopStopwatch}>
                    Stop
                  </button>
                )}
                <span className="text-sm font-mono" style={{ minWidth: '60px' }}>
                  {running ? elapsed.toFixed(2) : localVal || ''}
                  {st.unit || 's'}
                </span>
                <button
                  className="btn pill btn-lg"
                  type="button"
                  onClick={resetStopwatch}
                  disabled={running && !localVal}
                >
                  Reset
                </button>
              </div>
            )}
            {/* Eingabefeld für manuelle Eingabe oder zur Anzeige des gemessenen Werts */}
            <input
              /* Eine größere Höhe (h-14) verbessert die Eingabe auf Mobilgeräten */
              className="input h-14"
              type="tel"
              value={localVal}
              onChange={e => {
                const inputVal = e.target.value
                const sanitized = inputVal.replace(/[^0-9.,]/g, '').replace(',', '.')
                setLocalVal(sanitized)
                setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], value: sanitized } }))
              }}
              onKeyDown={e => e.stopPropagation()}
              onKeyDownCapture={e => e.stopPropagation()}
              onKeyUp={e => e.stopPropagation()}
              onKeyPress={e => e.stopPropagation()}
              placeholder={st.unit || 'Wert'}
            />
          </div>
        </div>
        <div className="mt-4 text-right">
          {/* Verwende die zentrale btn-lg Klasse für größere Buttons */}
          <button className="btn pill btn-lg" onClick={() => saveOne(st, p)}>Speichern</button>
        </div>
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
        style={{ position: 'fixed', right: '16px', bottom: '16px', zIndex: 9999 }}
        className="btn pill btn-sm"
        aria-label="Zurück"
        title="Zurück"
      >
        ← Zurück
      </button>
    )
  }

  return (
    <main>
      {/* align="center" stellt sicher, dass der Inhalt auch vertikal zentriert wird */}
      <Hero title="Stationseingabe" image="/base.jpg" subtitle={project ? project.name : undefined} align="center">
        {/*
          Wir verwenden einen flexiblen Container, der alle Inhalte vertikal stapelt und
          horizontal zentriert. Die Abstände zwischen den Abschnitten werden über
          space-y-6 definiert. Die page-pad-Klasse wird entfernt, damit der
          Inhalt durch das Hero-Grid vertikal zentriert bleibt.
        */}
        <div className="flex flex-col items-center space-y-6 w-full px-4">
          <ProjectsSelect />
          <StationButtonRow />
          <PlayerPicker />
          <InputsForSelected />
        </div>
      </Hero>

      {/* Zurück-FAB fixiert unten rechts */}
      <div className="back-fab-fixed">
        <CaptureBackFab />
      </div>
    </main>
  )
}
