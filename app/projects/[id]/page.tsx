'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Hero from '../../components/Hero'
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
]
const ST_INDEX: Record<string, number> = ST_ORDER.reduce((acc, n, i)=>{ acc[n]=i; return acc }, {} as Record<string, number>)

/* ---------- CSV-Lader (global: /public/config/) – nur für S6 ---------- */
async function loadS6Map(gender:'male'|'female'): Promise<Record<string, number[]>>{
  const file = gender === 'male' ? '/config/s6_male.csv' : '/config/s6_female.csv'
  const res = await fetch(file, { cache:'no-store' })
  if(!res.ok) throw new Error('CSV fehlt: ' + file)
  const text = await res.text()
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  if(lines.length < 2) throw new Error('CSV leer/ungültig')
  const header = lines[0].split(';').map(s=>s.trim())
  const ageCols = header.slice(1)
  const out: Record<string, number[]> = {}
  for(const age of ageCols) out[age] = []
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(';').map(s=>s.trim())
    for(let c=1;c<cols.length;c++){
      const age = ageCols[c-1]
      const sec = Number((cols[c]||'').replace(',', '.'))
      if(Number.isFinite(sec)) out[age].push(sec) // index 0=100P … 100=0P
    }
  }
  return out
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

  // S6 CSV Maps
  const [s6Female, setS6Female] = useState<Record<string, number[]>|null>(null)
  const [s6Male, setS6Male] = useState<Record<string, number[]>|null>(null)
  const [s6Status, setS6Status] = useState<'ok'|'fail'|'loading'>('loading')

  // Laden
  useEffect(()=>{
    fetch(`/api/projects/${projectId}`, { cache:'no-store' }).then(r=>r.json()).then(res=> setProject(res.item || null)).catch(()=>setProject(null))
    fetch(`/api/projects/${projectId}/stations`, { cache:'no-store' }).then(r=>r.json()).then(res=>{
      const st: Station[] = (res.items ?? []).slice().sort((a,b)=>{
        const ia = ST_ORDER.indexOf(a.name), ib = ST_ORDER.indexOf(b.name)
        if(ia>=0 && ib>=0) return ia-ib
        if(ia>=0) return -1
        if(ib>=0) return 1
        return a.name.localeCompare(b.name,'de')
      })
      setStations(st)
    })
    fetch(`/api/projects/${projectId}/players`, { cache:'no-store' }).then(r=>r.json()).then(res=> setPlayers(res.items || []))
    fetch(`/api/projects/${projectId}/measurements`, { cache:'no-store' }).then(r=>r.json()).then(res=> setMeas(res.items || []))
  }, [projectId])

  // CSV global laden (einmal)
  useEffect(()=>{
    setS6Status('loading')
    Promise.allSettled([loadS6Map('female'), loadS6Map('male')]).then(([f, m])=>{
      if (f.status==='fulfilled') setS6Female(f.value)
      if (m.status==='fulfilled') setS6Male(m.value)
      if (f.status==='fulfilled' || m.status==='fulfilled') setS6Status('ok')
      else setS6Status('fail')
    })
  }, [])

  const stationById = useMemo(()=>{
    const map: Record<string, Station> = {}
    stations.forEach(s=>{ map[s.id]=s })
    return map
  }, [stations])

  const measByPlayerStation = useMemo(()=>{
    const map: Record<string, Record<string, number>> = {}
    for(const m of meas){
      if(!map[m.player_id]) map[m.player_id] = {}
      map[m.player_id][m.station_id] = Number(m.value || 0)
    }
    return map
  }, [meas])

  function resolveAge(by:number|null): number{
    const eventYear = project?.date ? Number(String(project.date).slice(0,4)) : new Date().getFullYear()
    if (!by) return 16
    return Math.max(6, Math.min(49, eventYear - by))
  }

  function scoreFor(st:Station, p:Player, raw:number): number{
    const n = st.name.toLowerCase()
    if (n.includes('schnelligkeit')){ // S6 via CSV
      const map = p.gender==='male' ? s6Male : s6Female
      if (map){
        const keys = Object.keys(map)
        if (keys.length){
          const bucket = nearestAgeBucket(resolveAge(p.birth_year), keys)
          const rows = map[bucket] || []
          if (rows.length) return scoreFromTime(Number(raw), rows)
        }
      }
      // Fallback 4–20 s (weniger ist besser)
      return normScore({ ...st, min_value: 4, max_value: 20, higher_is_better: false }, Number(raw))
    }
    if (n.includes('passgenauigkeit')) {
      // Rohwert = gewichtete Punkte (11/17/33) – Score = clamp 0..100
      return Math.round(clamp(Number(raw), 0, 100))
    }
    if (n.includes('schusspräzision')) {
      // Rohwert = Punkte (max 24) – Score = (punkte/24)*100
      const pct = clamp(Number(raw)/24, 0, 1)
      return Math.round(pct*100)
    }
    return Math.round(normScore(st, Number(raw)))
  }

  // Spalten sortiert nach ST_ORDER
  const sortedStations = useMemo(()=>{
    return stations.slice().sort((a,b)=>{
      const ia = ST_INDEX[a.name] ?? 99
      const ib = ST_INDEX[b.name] ?? 99
      return ia - ib
    })
  }, [stations])

  // Spieler mit Ø berechnen + sortieren
  const rows = useMemo(()=>{
    return players.map(p=>{
      const perStation: { id:string; name:string; raw:number|null; score:number|null; unit?:string|null }[] = []
      let sum = 0
      for(const st of sortedStations){
        const raw = measByPlayerStation[p.id]?.[st.id]
        let sc: number|null = null
        if (typeof raw === 'number') {
          sc = scoreFor(st, p, raw)
          sum += sc
        }
        perStation.push({ id: st.id, name: st.name, raw: typeof raw==='number'?raw:null, score: sc, unit: st.unit })
      }
      const avg = Math.round(sum / (sortedStations.length || 1))
      return { player: p, perStation, avg }
    }).sort((a,b)=> b.avg - a.avg)
  }, [players, sortedStations, measByPlayerStation, s6Female, s6Male, project])

  return (
    <main>
      <Hero
        title={project ? project.name : 'Projekt'}
        subtitle={project?.date ? String(project.date) : undefined}
        image="/player.jpg"
        topRightLogoUrl={project?.logo_url || undefined}
      >
        {/* Infozeile S6 CSV Status */}
        <div className="text-sm hero-sub">
          S6-Tabellen: {s6Status==='ok' ? 'geladen ✅' : s6Status==='loading' ? 'lädt …' : 'nicht gefunden ❌'} (global aus /public/config)
        </div>
      </Hero>

      <section className="p-5 max-w-6xl mx-auto page-pad">
        <div className="card">
          <div className="mb-3">
            <div className="text-lg font-semibold">Spieler-Matrix</div>
            <div className="text-sm muted">Ø sortiert (absteigend). Rohwert steht jeweils klein unter dem Score.</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2 whitespace-nowrap">Spieler</th>
                  {sortedStations.map(st=>(
                    <th key={st.id} className="p-2 whitespace-nowrap">{st.name}</th>
                  ))}
                  <th className="p-2 whitespace-nowrap text-right">Ø</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({player, perStation, avg})=>(
                  <tr key={player.id} className="border-b align-top">
                    <td className="p-2 whitespace-nowrap font-medium">
                      {player.display_name} {player.birth_year?`(${player.birth_year})`:''}
                      <br/>
                      <span className="text-xs muted">
                        {player.gender ? (player.gender==='male'?'männlich':'weiblich') : '—'} • {player.club || '–'}
                        {player.fav_position ? ` • ${player.fav_position}` : ''}
                        {Number.isFinite(player.fav_number as any) ? ` • #${player.fav_number}` : ''}
                      </span>
                    </td>

                    {perStation.map(cell=>{
                      const score = cell.score
                      const raw = cell.raw
                      return (
                        <td key={cell.id} className="p-2">
                          {typeof score === 'number' ? (
                            <div>
                              <span className="badge-green">{score}</span>
                              <div className="text-[11px] muted mt-1">
                                {typeof raw==='number' ? `${raw}${cell.unit ? ` ${cell.unit}` : ''}` : '—'}
                              </div>
                            </div>
                          ) : <span className="text-xs muted">—</span>}
                        </td>
                      )
                    })}

                    <td className="p-2 text-right">
                      <span className="badge-green">{avg}</span>
                    </td>
                  </tr>
                ))}

                {!rows.length && (
                  <tr><td colSpan={2+sortedStations.length} className="p-3 text-center muted">Noch keine Spieler.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <BackFab />
    </main>
  )
}
