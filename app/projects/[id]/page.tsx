'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Hero from '@/app/components/Hero'
import TiledSection from '@/app/components/TiledSection'
import BackFab from '@/app/components/BackFab'

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
  fav_position: string | null
}

const ST_ORDER = ['Beweglichkeit','Technik','Passgenauigkeit','Schusskraft','Schusspräzision','Schnelligkeit']

const ST_DESCR: Record<string,string> = {
  'Beweglichkeit': '5-10-5 Lauf (Zeit in Sekunden). Range 10–40s, weniger ist besser.',
  'Technik': 'Dribbling/Parcours (Zeit in Sekunden). Range 20–90s, weniger ist besser.',
  'Passgenauigkeit': '30 Sek., Pässe in Minitore: 3×10m, 2×14m, 1×18m. Punkte = 1·10m + 2·14m + 3·18m (max 10).',
  'Schusskraft': 'Radar/Kamera, km/h. Cap 150 km/h = 100 Punkte.',
  'Schusspräzision': 'Ecken: oben L/R (je 3 Versuche, 3 Punkte/Treffer), unten L/R (je 3 Versuche, 1 Punkt/Treffer). Max 24 Punkte.',
  'Schnelligkeit': '30 m Sprint (Zeit in Sekunden). Range 4–20s, weniger ist besser.',
}

function clamp(n:number, lo:number, hi:number){ return Math.max(lo, Math.min(hi, n)) }

function normScore(st: Station, raw: number, extra?: any): number {
  const n = (st.name || '').toLowerCase()
  if (n.includes('passgenauigkeit')) {
    const wHits = raw // bereits gewichtete Treffer (0–10)
    return clamp((wHits/10)*100, 0, 100)
  }
  if (n.includes('schusspräzision')) {
    const pts = raw // 0–24
    return clamp((pts/24)*100, 0, 100)
  }
  if (n.includes('schusskraft')) {
    const kmh = raw
    return clamp((Math.min(kmh,150)/150)*100, 0, 100)
  }
  // generisch: min/max + higher_is_better
  const minv = st.min_value ?? 0
  const maxv = st.max_value ?? 1
  const hib  = st.higher_is_better ?? true
  if (maxv === minv) return 0
  return hib
    ? clamp(((raw - minv) / (maxv - minv)) * 100, 0, 100)
    : clamp(((maxv - raw) / (maxv - minv)) * 100, 0, 100)
}

export default function CapturePage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const sp = useSearchParams()
  const router = useRouter()

  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<string>('') // station_id
  const [values, setValues] = useState<Record<string, any>>({}) // per player inputs
  const [saved, setSaved] = useState<Record<string, number>>({}) // player_id -> saved raw value

  // Laden: Stationen, Spieler, Messungen (für aktuelle Station)
  useEffect(() => {
    fetch(`/api/projects/${projectId}/stations`)
      .then(r=>r.json()).then(res=>{
        const st = (res.items || []).sort((a:Station,b:Station)=>{
          return ST_ORDER.indexOf(a.name) - ST_ORDER.indexOf(b.name)
        })
        setStations(st)
        // initial per URL ?station=...
        const urlSt = sp.get('station')
        if (urlSt && st.find(s=>s.id===urlSt)) setSelected(urlSt)
        else if (st[0]) setSelected(st[0].id)
      })
    fetch(`/api/projects/${projectId}/players`).then(r=>r.json()).then(res=> setPlayers(res.items || []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (!selected) return
    fetch(`/api/projects/${projectId}/measurements?station=${selected}`)
      .then(r=>r.json())
      .then(res=>{
        const map: Record<string, any> = {}
        const savedMap: Record<string, number> = {}
        for (const m of (res.items || [])) {
          // Rohwert (für S3/S5 ist das bereits gewichtete Summe/Punkte)
          savedMap[m.player_id] = Number(m.value)
          // Standard-Vorbelegung: ein Feld 'value'
          map[m.player_id] = { value: Number(m.value) }
        }
        setValues(map)
        setSaved(savedMap)
      })
  }, [selected, projectId])

  const currentStation = useMemo<Station|undefined>(()=> stations.find(s=>s.id===selected), [stations, selected])

  // UI: Stations-Buttons
  function StationButtons(){
    return (
      <div className="pills">
        {stations.map(s => (
          <button
            key={s.id}
            className="btn pill"
            onClick={() => {
              setSelected(s.id)
              router.replace(`?station=${s.id}`)
            }}
            style={ s.id===selected ? { filter:'brightness(1.15)' } : {} }
          >
            {s.name}
          </button>
        ))}
      </div>
    )
  }

  // Eingabefelder je Spieler abhängig von Station
  function PlayerRow({ p }: { p: Player }){
    const st = currentStation!
    const n = st.name.toLowerCase()

    const v = values[p.id] || {}
    let raw = 0

    // Renderer pro Station:
    let inputs: React.ReactNode = null

    if (n.includes('passgenauigkeit')) {
      // 3*10m, 2*14m, 1*18m
      const h10 = v.h10 ?? 0
      const h14 = v.h14 ?? 0
      const h18 = v.h18 ?? 0
      raw = (h10*1) + (h14*2) + (h18*3) // 0..10
      inputs = (
        <div className="grid grid-cols-3 gap-2">
          <NumberInput label="10 m (0–3)" value={h10} min={0} max={3} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], h10:x}}))}/>
          <NumberInput label="14 m (0–2)" value={h14} min={0} max={2} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], h14:x}}))}/>
          <NumberInput label="18 m (0–1)" value={h18} min={0} max={1} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], h18:x}}))}/>
        </div>
      )
    } else if (n.includes('schusspräzision')) {
      // oben 2× (je 3), unten 2× (je 3)
      const ul = v.ul ?? 0, ur = v.ur ?? 0, ll = v.ll ?? 0, lr = v.lr ?? 0
      raw = (ul+ur)*3 + (ll+lr)*1 // 0..24
      inputs = (
        <div className="grid grid-cols-4 gap-2">
          <NumberInput label="oben L (0–3)" value={ul} min={0} max={3} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], ul:x}}))}/>
          <NumberInput label="oben R (0–3)" value={ur} min={0} max={3} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], ur:x}}))}/>
          <NumberInput label="unten L (0–3)" value={ll} min={0} max={3} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], ll:x}}))}/>
          <NumberInput label="unten R (0–3)" value={lr} min={0} max={3} onChange={(x)=>setValues(prev=>({...prev,[p.id]:{...prev[p.id], lr:x}}))}/>
        </div>
      )
    } else {
      // einfache Einzel-Eingabe
      const val = v.value ?? ''
      inputs = (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Messwert {st.unit ? `(${st.unit})` : ''}
            </label>
            <input
              className="input"
              inputMode="decimal"
              value={val}
              onChange={(e)=> setValues(prev=>({...prev,[p.id]:{...prev[p.id], value:e.target.value}}))}
              placeholder={st.unit || 'Wert'}
            />
          </div>
        </div>
      )

      raw = Number(val || 0)
    }

    const score = Math.round(normScore(st, Number(raw)))

    return (
      <tr className="border-b align-top">
        <td className="p-2 whitespace-nowrap font-medium">
          {p.display_name} {p.birth_year ? `(${p.birth_year})` : ''}<br/>
          <span className="text-xs muted">
            {p.club || '–'} {p.fav_position ? `• ${p.fav_position}` : ''}
          </span>
        </td>
        <td className="p-2">{inputs}</td>
        <td className="p-2 text-center">
          <span className="badge-green" title="berechneter Norm-Score (0–100)">{score}</span>
          {typeof saved[p.id] !== 'undefined' && <div className="text-[11px] mt-1 muted">(gespeichert)</div>}
        </td>
        <td className="p-2 text-right">
          <button className="btn pill" onClick={() => saveOne(p.id, st, raw)}>
            Speichern
          </button>
        </td>
      </tr>
    )
  }

  function NumberInput({label, value, min, max, onChange}:{label:string; value:number; min:number; max:number; onChange:(n:number)=>void}){
    return (
      <div>
        <label className="block text-xs font-semibold mb-1">{label}</label>
        <input
          className="input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e=> onChange(e.target.value===''?0: Math.max(min, Math.min(max, Number(e.target.value))))}
        />
      </div>
    )
  }

  async function saveOne(playerId: string, st: Station, raw: number){
    // Für S3/S5 speichern wir die aggregierte Zahl (weighted hits / points)
    const body = new FormData()
    body.append('player_id', playerId)
    body.append('station_id', st.id)
    body.append('value', String(raw))

    const res = await fetch(`/api/projects/${projectId}/measurements`, { method:'POST', body })
    const text = await res.text()
    if (!res.ok){
      alert(text || 'Fehler beim Speichern')
      return
    }
    setSaved(prev=> ({...prev, [playerId]: Number(raw)}))
    // nach Score sortieren
    sortPlayersByScore()
  }

  function sortPlayersByScore(){
    const st = currentStation
    if (!st) return
    setPlayers(prev=>{
      const arr = [...prev]
      arr.sort((a,b)=>{
        const va = values[a.id]
        const vb = values[b.id]
        const ra = resolveRaw(st, va)
        const rb = resolveRaw(st, vb)
        const sa = normScore(st, Number(ra))
        const sb = normScore(st, Number(rb))
        return sb - sa
      })
      return arr
    })
  }

  function resolveRaw(st: Station, v: any){
    const n = st.name.toLowerCase()
    if (!v) return 0
    if (n.includes('passgenauigkeit')) return (v.h10||0)*1 + (v.h14||0)*2 + (v.h18||0)*3
    if (n.includes('schusspräzision')) return (v.ul||0 + v.ur||0)*3 + (v.ll||0 + v.lr||0)*1
    return Number(v.value||0)
  }

  return (
    <main>
      {/* Kopf: Base-Hintergrund, Station wählen */}
      <Hero
        title="Stations-Erfassung"
        subtitle="Projekt wählen → Station wählen → Werte erfassen"
        image="/base.jpg"
        align="top"
      >
        <div className="flex flex-col items-center gap-4 w-full">
          <StationButtons />

          {/* Info-Block + Skizze (Platzhalter) */}
          {currentStation && (
            <div className="grid md:grid-cols-3 gap-4 w-full">
              <div className="card glass text-left md:col-span-2">
                <h3 className="font-semibold text-lg">{currentStation.name}</h3>
                <p className="text-sm mt-1">{ST_DESCR[currentStation.name] || 'Stationsbeschreibung'}</p>
                <div className="mt-3">
                  <Link href="#" className="btn pill pointer-events-none opacity-60" title="Später editierbar">Skizze/Text bearbeiten (später)</Link>
                </div>
              </div>
              <div className="card glass text-left">
                <div className="text-sm font-semibold mb-2">Stationsskizze</div>
                <div className="aspect-video bg-white/70 flex items-center justify-center text-xs text-gray-600 rounded">
                  (Platzhalter: PDF/JPG einblendbar)
                </div>
              </div>
            </div>
          )}
        </div>
      </Hero>

      {/* Matrix/Liste: gleicher (kachelnder) Base-Hintergrund */}
      <TiledSection image="/base.jpg">
        <div className="card glass w-full">
          <div className="overflow-auto">
            <table className="min-w-full text-sm align-top">
              <thead className="sticky top-0 bg-white/90 backdrop-blur">
                <tr className="border-b">
                  <th className="text-left p-2">Spieler</th>
                  <th className="text-left p-2">Eingabe</th>
                  <th className="text-center p-2">Score</th>
                  <th className="text-right p-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {currentStation && players.map(p => <PlayerRow key={p.id} p={p} />)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="h-16" />
      </TiledSection>

      <BackFab />
    </main>
  )
}
