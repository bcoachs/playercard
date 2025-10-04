'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import BackFab from '../components/BackFab'
import Hero from '../components/Hero'

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
  gender?: 'male' | 'female' | null
}

type Project = { id: string; name: string; date: string | null }

const ST_ORDER = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
]

function stationSort(a: Station, b: Station) {
  const ia = ST_ORDER.indexOf(a.name)
  const ib = ST_ORDER.indexOf(b.name)
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  return a.name.localeCompare(b.name, 'de')
}

/* ---------- CSV-Lader für S6 (global in /public/config/) ---------- */
async function loadS6Map(gender: 'male' | 'female'): Promise<Record<string, number[]>> {
  const file = gender === 'male' ? '/config/s6_male.csv' : '/config/s6_female.csv'
  const res = await fetch(file, { cache: 'no-store' })
  if (!res.ok) throw new Error(`CSV nicht gefunden: ${file}`)
  const text = await res.text()

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV leer/ungültig')

  // Semikolon-getrennt
  const header = lines[0].split(';').map(s => s.trim())
  const ageCols = header.slice(1)

  const out: Record<string, number[]> = {}
  for (const age of ageCols) out[age] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(s => s.trim())
    for (let c = 1; c < cols.length; c++) {
      const age = ageCols[c - 1]
      const sec = Number((cols[c] || '').replace(',', '.'))
      if (!Number.isFinite(sec)) continue
      out[age].push(sec) // Index 0 = 100 Punkte, …, Index 100 = 0 Punkte
    }
  }
  return out
}

function nearestAgeBucket(age: number, keys: string[]): string {
  const parsed = keys.map(k => {
    const nums = k.match(/\d+/g)?.map(n => Number(n)) || []
    const mid = nums.length === 2 ? (nums[0] + nums[1]) / 2 : (nums[0] || 0)
    return { key: k, mid }
  })
  parsed.sort((a, b) => Math.abs(a.mid - age) - Math.abs(b.mid - age))
  return parsed[0]?.key || keys[0]
}

function scoreFromTime(seconds: number, rows: number[]): number {
  let bestIdx = 100
  let bestDiff = Infinity
  for (let i = 0; i < rows.length; i++) {
    const diff = Math.abs(seconds - rows[i])
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
  }
  const score = 100 - bestIdx
  return Math.max(0, Math.min(100, score))
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
function normScore(st: Station, raw: number): number {
  const min = st.min_value ?? 0
  const max = st.max_value ?? 100
  if (max === min) return 0
  if (st.higher_is_better) {
    return Math.round(clamp((raw - min) / (max - min), 0, 1) * 100)
  } else {
    return Math.round(clamp((max - raw) / (max - min), 0, 1) * 100)
  }
}

/* ------- Inputs: commit erst bei Enter/Blur ------- */
function NumberCommitInput({
  label, value, min, max, onCommit
}: { label: string; value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [tmp, setTmp] = useState<string>(String(value ?? 0))
  useEffect(() => { setTmp(String(value ?? 0)) }, [value])

  function commit() {
    const v = tmp === '' ? 0 : Math.max(min, Math.min(max, Math.round(Number(tmp))))
    onCommit(Number.isFinite(v) ? v : 0)
  }

  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        value={tmp}
        onChange={e => setTmp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }}
      />
    </div>
  )
}

function DecimalCommitInput({
  label, value, placeholder, onCommit
}: { label: string; value: number; placeholder?: string; onCommit: (n: number) => void }) {
  const [tmp, setTmp] = useState<string>(value === 0 || value ? String(value) : '')
  useEffect(() => { setTmp(value === 0 || value ? String(value) : '') }, [value])

  function commit() {
    const normalized = tmp.replace(',', '.')
    const n = Number(normalized)
    onCommit(Number.isFinite(n) ? n : 0)
  }

  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <input
        className="input"
        inputMode="decimal"
        value={tmp}
        placeholder={placeholder || 'Wert'}
        onChange={e => setTmp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } }}
      />
    </div>
  )
}

export default function CaptureClient() {
  const router = useRouter()
  const sp = useSearchParams()

  const qProject = sp.get('project') || ''
  const qStation = sp.get('station') || ''

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>(qProject)
  const [project, setProject] = useState<Project | null>(null)

  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<string>(qStation)

  const [values, setValues] = useState<Record<string, any>>({})
  const [saved, setSaved] = useState<Record<string, number>>({})

  // CSV-Maps für S6 + Status
  const [s6Female, setS6Female] = useState<Record<string, number[]> | null>(null)
  const [s6Male, setS6Male] = useState<Record<string, number[]> | null>(null)
  const [csvStatus, setCsvStatus] = useState<{ female: 'ok' | 'fail' | 'loading'; male: 'ok' | 'fail' | 'loading' }>({ female: 'loading', male: 'loading' })

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(res => setProjects(res.items || [])).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    if (!projectId) return
    setStations([]); setPlayers([]); setProject(null)

    fetch(`/api/projects/${projectId}`).then(r => r.json()).then(res => setProject(res.item || null)).catch(() => setProject(null))

    fetch(`/api/projects/${projectId}/stations`).then(r => r.json()).then(res => {
      const st: Station[] = (res.items ?? []).slice().sort(stationSort)
      setStations(st)
      const fromUrl = sp.get('station')
      if (fromUrl && st.find(s => s.id === fromUrl)) {
        setSelected(fromUrl)
      } else if (st[0]) {
        setSelected(st[0].id)
        router.replace(`?project=${projectId}&station=${st[0].id}`)
      }
    })

    fetch(`/api/projects/${projectId}/players`).then(r => r.json()).then(res => setPlayers(res.items || [])).catch(() => setPlayers([]))
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCsvStatus(s => ({ ...s, female: 'loading' }))
    loadS6Map('female').then(map => { setS6Female(map); setCsvStatus(s => ({ ...s, female: 'ok' })) })
                       .catch(() => setCsvStatus(s => ({ ...s, female: 'fail' })))
    setCsvStatus(s => ({ ...s, male: 'loading' }))
    loadS6Map('male').then(map => { setS6Male(map); setCsvStatus(s => ({ ...s, male: 'ok' })) })
                     .catch(() => setCsvStatus(s => ({ ...s, male: 'fail' })))
  }, [])

  const currentStation = useMemo(() => stations.find(s => s.id === selected) || null, [stations, selected])

  /* -------- Score-/Raw-Helfer -------- */
  function resolveAge(by: number | null): number {
    const eventYear = project?.date ? Number(String(project.date).slice(0, 4)) : new Date().getFullYear()
    if (!by) return 16
    return Math.max(6, Math.min(49, eventYear - by))
  }

  function resolveRaw(st: Station, v: any) {
    const n = st.name.toLowerCase()
    if (!v) return 0
    if (n.includes('passgenauigkeit')) return (v.h10 || 0) * 11 + (v.h14 || 0) * 17 + (v.h18 || 0) * 33
    if (n.includes('schusspräzision')) return (v.ul || 0 + v.ur || 0) * 3 + (v.ll || 0 + v.lr || 0) * 1
    return Number(v.value || 0)
  }

  function scoreFor(st: Station, p: Player, raw: number): number {
    const n = st.name.toLowerCase()

    // S6
    if (n.includes('schnelligkeit')) {
      const age = resolveAge(p.birth_year)
      const map = p.gender === 'male' ? s6Male : s6Female
      if (map) {
        const keys = Object.keys(map)
        if (keys.length) {
          const bucket = nearestAgeBucket(age, keys)
          const rows = map[bucket] || []
          if (rows.length) return scoreFromTime(Number(raw), rows)
        }
      }
      return normScore({ ...st, min_value: 4, max_value: 20, higher_is_better: false }, Number(raw))
    }

    // S3/S5 sind schon 0..100
    if (n.includes('passgenauigkeit') || n.includes('schusspräzision')) {
      return Math.round(clamp(Number(raw), 0, 100))
    }

    // Rest: DB-Min/Max
    return Math.round(normScore(st, Number(raw)))
  }

  function sortPlayersByScore() {
    const st = currentStation
    if (!st) return
    setPlayers(prev => {
      const arr = [...prev]
      arr.sort((a, b) => {
        const va = values[a.id], vb = values[b.id]
        const sa = scoreFor(st, a, resolveRaw(st, va))
        const sb = scoreFor(st, b, resolveRaw(st, vb))
        return sb - sa
      })
      return arr
    })
  }

  /* -------- UI-Subkomponenten -------- */
  function ProjectsSelect() {
    if (qProject) return null
    return (
      <div className="card glass w-full max-w-2xl mx-auto text-left">
        <label className="block text-sm font-semibold mb-2">Projekt wählen</label>
        <select
          className="input"
          value={projectId}
          onChange={e => {
            const id = e.target.value
            setProjectId(id); setSelected(''); setValues({}); setSaved({})
            if (id) router.replace(`?project=${id}`)
          }}
        >
          <option value="">{projects.length ? 'Bitte wählen' : 'Lade…'}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.date ? ` – ${p.date}` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  function StationButtons() {
    if (!stations.length) return null
    return (
      <div className="pills">
        {stations.map(s => (
          <button
            key={s.id}
            className="btn pill"
            onClick={() => {
              setSelected(s.id)
              router.replace(projectId ? `?project=${projectId}&station=${s.id}` : `?station=${s.id}`)
            }}
            style={s.id === selected ? { filter: 'brightness(1.15)' } : {}}
          >
            {s.name}
          </button>
        ))}
      </div>
    )
  }

  function PlayerRow({ p }: { p: Player }) {
    const st = currentStation!; const n = st.name.toLowerCase()
    const v = values[p.id] || {}; let raw = 0; let inputs: React.ReactNode = null

    if (n.includes('passgenauigkeit')) {
      const h10 = v.h10 ?? 0, h14 = v.h14 ?? 0, h18 = v.h18 ?? 0
      raw = h10 * 11 + h14 * 17 + h18 * 33
      inputs = (
        <div className="grid grid-cols-3 gap-2">
          <NumberCommitInput label="10 m (0–3)" value={h10} min={0} max={3}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], h10: x } }))} />
          <NumberCommitInput label="14 m (0–2)" value={h14} min={0} max={2}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], h14: x } }))} />
          <NumberCommitInput label="18 m (0–1)" value={h18} min={0} max={1}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], h18: x } }))} />
        </div>
      )
    } else if (n.includes('schusspräzision')) {
      const ul = v.ul ?? 0, ur = v.ur ?? 0, ll = v.ll ?? 0, lr = v.lr ?? 0
      raw = (ul + ur) * 3 + (ll + lr) * 1
      inputs = (
        <div className="grid grid-cols-4 gap-2">
          <NumberCommitInput label="oben L (0–3)" value={ul} min={0} max={3}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], ul: x } }))} />
          <NumberCommitInput label="oben R (0–3)" value={ur} min={0} max={3}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], ur: x } }))} />
          <NumberCommitInput label="unten L (0–3)" value={ll} min={0} max={3}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], ll: x } }))} />
          <NumberCommitInput label="unten R (0–3)" value={lr} min={0} max={3}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], lr: x } }))} />
        </div>
      )
    } else {
      const val = typeof v.value === 'number' ? v.value : 0
      raw = Number(val || 0)
      inputs = (
        <div className="grid grid-cols-2 gap-2">
          <DecimalCommitInput
            label={`Messwert ${st.unit ? `(${st.unit})` : ''}`}
            value={val}
            placeholder={st.unit || 'Wert'}
            onCommit={x => setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], value: x } }))}
          />
        </div>
      )
    }

    const score = scoreFor(st, p, raw)

    async function saveOne() {
      const body = new FormData()
      body.append('player_id', p.id)
      body.append('station_id', st.id)
      body.append('value', String(raw))
      const res = await fetch(`/api/projects/${projectId}/measurements`, { method: 'POST', body })
      const txt = await res.text()
      if (!res.ok) { alert(txt || 'Fehler beim Speichern'); return }
      setSaved(prev => ({ ...prev, [p.id]: Number(raw) }))
      sortPlayersByScore()
    }

    return (
      <tr className="border-b align-top">
        <td className="p-2 whitespace-nowrap font-medium">
          {p.display_name} {p.birth_year ? `(${p.birth_year})` : ''}
          <br /><span className="text-xs muted">
            {p.gender ? (p.gender === 'male' ? 'männlich' : 'weiblich') : '—'} • {p.club || '–'} {p.fav_position ? `• ${p.fav_position}` : ''}
          </span>
        </td>
        <td className="p-2">{inputs}</td>
        <td className="p-2 text-center"><span className="badge-green">{score}</span></td>
        <td className="p-2 text-right"><button className="btn pill" onClick={saveOne}>Speichern</button></td>
      </tr>
    )
  }

  const currentIndex = currentStation ? Math.max(1, ST_ORDER.indexOf(currentStation.name) + 1) : 1
  const sketchHref = `/station${currentIndex}.pdf`

  return (
    <main>
      <Hero title="Stationseingabe" subtitle={project ? project.name : 'Projekt wählen'} image="/base.jpg">
        <ProjectsSelect />
        <div className="mt-4"><StationButtons /></div>

        {/* CSV-Statuszeile für S6 */}
        <div className="mt-3 text-sm hero-sub">
          <span className="mr-3">S6-Tabellen:</span>
          <span className={csvStatus.female === 'ok' ? 'text-green-200' : csvStatus.female === 'fail' ? 'text-red-200' : 'text-yellow-200'}>
            weiblich {csvStatus.female === 'ok' ? '✅' : csvStatus.female === 'fail' ? '❌' : '…'}
          </span>
          <span className="mx-2">|</span>
          <span className={csvStatus.male === 'ok' ? 'text-green-200' : csvStatus.male === 'fail' ? 'text-red-200' : 'text-yellow-200'}>
            männlich {csvStatus.male === 'ok' ? '✅' : csvStatus.male === 'fail' ? '❌' : '…'}
          </span>
        </div>

        {!!currentStation && (
          <div className="mt-3">
            <a className="btn pill" href={sketchHref} target="_blank" rel="noreferrer">Stationsskizze öffnen</a>
          </div>
        )}
      </Hero>

      {/* Matrix-Bereich – mit zusätzlichem Abstand unten */}
      <section className="p-5 max-w-5xl mx-auto page-pad">
        {!projectId && (
          <div className="card mb-4">
            <div className="font-semibold">Hinweis</div>
            <div className="text-sm muted">Bitte wähle oben ein Projekt aus.</div>
          </div>
        )}

        {projectId && !stations.length && (
          <div className="card mb-4">
            <div className="font-semibold">Keine Stationen gefunden</div>
            <div className="text-sm muted">Für dieses Projekt sind keine Stationen angelegt. Lege einen neuen Run an oder prüfe die DB.</div>
          </div>
        )}

        {projectId && !!stations.length && (
          <div className="card">
            <div className="mb-3">
              <div className="text-lg font-semibold">{currentStation?.name || 'Station'}</div>
              <div className="text-sm muted">Bitte Messwerte eintragen. Punkte werden nach Enter/Blur berechnet; Liste sortiert automatisch nach Punktzahl.</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Spieler</th>
                    <th className="p-2">Messung</th>
                    <th className="p-2 text-center">Score</th>
                    <th className="p-2 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => <PlayerRow key={p.id} p={p} />)}
                  {!players.length && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center muted">Noch keine Spieler in diesem Projekt.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <BackFab />
    </main>
  )
}
