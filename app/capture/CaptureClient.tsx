'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Hero from '@/app/components/Hero'
import TiledSection from '@/app/components/TiledSection'
import BackFab from '@/app/components/BackFab'

type Project = { id: string; name: string; date?: string | null }
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
  gender?: string | null // 'female' | 'male' | null (optional; fallback female)
}

const ST_ORDER = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
] as const
const ORDER_INDEX: Record<string, number> = Object.fromEntries(
  (ST_ORDER as readonly string[]).map((n, i) => [n, i])
)

const ST_INDEX: Record<string, number> = {
  Beweglichkeit: 1,
  Technik: 2,
  Passgenauigkeit: 3,
  Schusskraft: 4,
  Schusspräzision: 5,
  Schnelligkeit: 6,
}

const ST_DESCR: Record<string, string> = {
  Beweglichkeit: '5-10-5 Lauf (Zeit in Sekunden). Range 10–40s, weniger ist besser.',
  Technik: 'Dribbling/Parcours (Zeit in Sekunden). Range 20–90s, weniger ist besser.',
  Passgenauigkeit:
    '30 Sek., Pässe in Minitore: 3×10m, 2×14m, 1×18m. Gewichtet 1/2/3 → max 10.',
  Schusskraft: 'Radar/Kamera, km/h. Cap 150 km/h = 100 Punkte.',
  Schusspräzision:
    'Ecken: oben L/R (3 Punkte/Treffer), unten L/R (1 Punkt/Treffer). Max 24 Punkte.',
  Schnelligkeit: '30 m Sprint (Zeit in Sekunden). Je schneller, desto besser.',
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
function normScore(st: Station, raw: number): number {
  const n = (st.name || '').toLowerCase()
  if (n.includes('passgenauigkeit')) return clamp((raw / 10) * 100, 0, 100) // 0..10
  if (n.includes('schusspräzision')) return clamp((raw / 24) * 100, 0, 100) // 0..24
  if (n.includes('schusskraft')) return clamp((Math.min(raw, 150) / 150) * 100, 0, 100)
  const minv = st.min_value ?? 0,
    maxv = st.max_value ?? 1,
    hib = st.higher_is_better ?? true
  if (maxv === minv) return 0
  const sc = hib
    ? ((raw - minv) / (maxv - minv)) * 100
    : ((maxv - raw) / (maxv - minv)) * 100
  return clamp(sc, 0, 100)
}

/* ---------- S6 Scoremap: Altersbuckets & Interpolation ---------- */

const AGE_BUCKETS = [
  '6-7',
  '8-9',
  '10-11',
  '12-13',
  '14-15',
  '16-17',
  '18-19',
  '20-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
] as const
type AgeBucket = (typeof AGE_BUCKETS)[number]

type ScoreRow = {
  age_range: string // z.B. "12-13"
  from_value: number // Sekunden (Punkt-Notation)
  to_value: number
  points: number // 0..100
}
type ScoreMap = Record<AgeBucket, ScoreRow[]>

function bucketMid(b: string) {
  const [a, b2] = b.split('-').map(Number)
  return (a + b2) / 2
}
function nearestAgeBucket(age: number): AgeBucket {
  let best = AGE_BUCKETS[AGE_BUCKETS.length - 1] as AgeBucket
  let bestDiff = Infinity
  for (const b of AGE_BUCKETS) {
    const d = Math.abs(bucketMid(b) - age)
    if (d < bestDiff) {
      best = b
      bestDiff = d
    }
  }
  return best
}

function buildScoreMap(items: ScoreRow[]): ScoreMap {
  const map: Partial<ScoreMap> = {}
  for (const it of items) {
    const key = (it.age_range as AgeBucket) || ('45-49' as AgeBucket)
    if (!map[key]) map[key] = []
    map[key]!.push(it)
  }
  // pro Bucket: nach Punkten (absteigend) sortieren
  for (const k of Object.keys(map) as AgeBucket[]) {
    map[k]!.sort((a, b) => b.points - a.points)
  }
  return map as ScoreMap
}

// Linear zwischen den Punktzeilen interpolieren
function scoreFromTime(timeSec: number, rows: ScoreRow[]): number {
  if (!rows.length) return 0
  const r100 = rows.find((r) => r.points === 100) || rows[0]
  const r0 = rows.find((r) => r.points === 0) || rows[rows.length - 1]
  const t100 = r100.from_value
  const t0 = r0.from_value
  if (timeSec <= t100) return 100
  if (timeSec >= t0) return 0

  const seg = [...rows].sort((a, b) => b.points - a.points)
  for (let i = 0; i < seg.length - 1; i++) {
    const hi = seg[i],
      lo = seg[i + 1]
    const thi = hi.from_value,
      tlo = lo.from_value
    if (timeSec >= thi && timeSec <= tlo) {
      const ratio = (timeSec - thi) / (tlo - thi)
      const p = hi.points + (lo.points - hi.points) * ratio
      return Math.max(0, Math.min(100, Math.round(p)))
    }
  }
  // Fallback (sollte selten auftreten)
  return Math.round(100 * (t0 - timeSec) / (t0 - t100))
}

/* ------------------------ Komponente ------------------------ */

export default function CaptureClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const qProject = sp.get('project') || '' // vorgewählt (aus /capture?project=...)

  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [projectId, setProjectId] = useState<string>(qProject)
  const [selected, setSelected] = useState<string>('') // station_id

  const [values, setValues] = useState<Record<string, any>>({})
  const [saved, setSaved] = useState<Record<string, number>>({})

  // S6 Scoremap
  const [scoreMapS6, setScoreMapS6] = useState<ScoreMap | null>(null)

  /* Projekte (nur wenn keine Vorauswahl) */
  useEffect(() => {
    if (projectId) return
    fetch('/api/projects')
      .then((r) => r.json())
      .then((res) => setProjects(res.items ?? []))
  }, [projectId])

  /* Projekt + Stationen + Spieler laden */
  useEffect(() => {
    if (!projectId) return
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/stations`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/players`).then((r) => r.json()),
    ]).then(([projRes, stRes, plRes]) => {
      setProject(projRes.item ?? null)
      const st: Station[] = (stRes.items ?? []).sort(
        (a: Station, b: Station) =>
          (ORDER_INDEX[a.name] ?? 999) - (ORDER_INDEX[b.name] ?? 999)
      )
      setStations(st)
      setPlayers(plRes.items ?? [])
      const urlSt = sp.get('station')
      if (urlSt && st.find((s: Station) => s.id === urlSt)) setSelected(urlSt)
      else if (st[0]) setSelected(st[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  /* Messungen für die gewählte Station + ggf. Scoremap (S6) laden */
  useEffect(() => {
    if (!projectId || !selected) return

    // Messwerte
    fetch(`/api/projects/${projectId}/measurements?station=${selected}`)
      .then((r) => r.json())
      .then((res) => {
        const map: Record<string, any> = {}
        const savedMap: Record<string, number> = {}
        for (const m of (res.items ?? [])) {
          savedMap[m.player_id] = Number(m.value)
          map[m.player_id] = { value: Number(m.value) }
        }
        setValues(map)
        setSaved(savedMap)
      })

    // Scoremap nur für S6
    const st = stations.find((s) => s.id === selected)
    if (!st) return
    if (st.name.toLowerCase().includes('schnelligkeit')) {
      const gender = 'female' // MVP: Default female; sobald players.gender vorhanden, pro Spieler lesen
      fetch(
        `/api/projects/${projectId}/scoremaps?station=S6&gender=${encodeURIComponent(
          gender
        )}`
      )
        .then((r) => r.json())
        .then((res) => {
          const items = (res.items || []) as ScoreRow[]
          setScoreMapS6(buildScoreMap(items))
        })
        .catch(() => setScoreMapS6(null))
    } else {
      setScoreMapS6(null)
    }
  }, [projectId, selected, stations])

  const currentStation = useMemo<Station | undefined>(
    () => stations.find((s) => s.id === selected),
    [stations, selected]
  )

  /* --- UI-Bausteine --- */

  function ProjectsSelect() {
    if (qProject) return null
    return (
      <div className="card glass w-full max-w-2xl mx-auto text-left">
        <label className="block text-sm font-semibold mb-2">Projekt wählen</label>
        <select
          className="input"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value)
            setSelected('')
            setValues({})
            setSaved({})
          }}
        >
          <option value="">{projects.length ? 'Bitte wählen' : 'Lade…'}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.date ? ` – ${p.date}` : ''}
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
        {stations.map((s) => (
          <button
            key={s.id}
            className="btn pill"
            onClick={() => {
              setSelected(s.id)
              router.replace(
                projectId ? `?project=${projectId}&station=${s.id}` : `?station=${s.id}`
              )
            }}
            style={s.id === selected ? { filter: 'brightness(1.15)' } : {}}
          >
            {s.name}
          </button>
        ))}
      </div>
    )
  }

  function NumberInput({
    label,
    value,
    min,
    max,
    onChange,
  }: {
    label: string
    value: number
    min: number
    max: number
    onChange: (n: number) => void
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
          onChange={(e) =>
            onChange(
              e.target.value === ''
                ? 0
                : Math.max(min, Math.min(max, Number(e.target.value)))
            )
          }
        />
      </div>
    )
  }

  // Alter aus Projektjahr (falls vorhanden) sonst aktuelles Jahr
  function resolveAge(by: number | null): number {
    const eventYear = project?.date ? Number(String(project.date).slice(0, 4)) : new Date().getFullYear()
    if (!by) return 16
    return Math.max(6, Math.min(49, eventYear - by))
  }

  function resolveRaw(st: Station, v: any) {
    const n = st.name.toLowerCase()
    if (!v) return 0
    if (n.includes('passgenauigkeit'))
      return (v.h10 || 0) * 1 + (v.h14 || 0) * 2 + (v.h18 || 0) * 3
    if (n.includes('schusspräzision'))
      return (v.ul || 0 + v.ur || 0) * 3 + (v.ll || 0 + v.lr || 0) * 1
    return Number(v.value || 0)
  }

  function scoreFor(st: Station, p: Player, raw: number): number {
    const isS6 = st.name.toLowerCase().includes('schnelligkeit')
    if (isS6 && scoreMapS6) {
      const age = resolveAge(p.birth_year)
      const bucket = nearestAgeBucket(age)
      const rows = scoreMapS6[bucket] || []
      return scoreFromTime(Number(raw), rows)
    }
    return Math.round(normScore(st, Number(raw)))
  }

  function sortPlayersByScore() {
    const st = currentStation
    if (!st) return
    setPlayers((prev) => {
      const arr = [...prev]
      arr.sort((a, b) => {
        const va = values[a.id],
          vb = values[b.id]
        const ra = resolveRaw(st, va),
          rb = resolveRaw(st, vb)
        return scoreFor(st, b, rb) - scoreFor(st, a, ra)
      })
      return arr
    })
  }

  function PlayerRow({ p }: { p: Player }) {
    const st = currentStation!
    const n = st.name.toLowerCase()
    const v = values[p.id] || {}
    let raw = 0
    let inputs: React.ReactNode = null

    if (n.includes('passgenauigkeit')) {
      const h10 = v.h10 ?? 0
      const h14 = v.h14 ?? 0
      const h18 = v.h18 ?? 0
      raw = h10 * 1 + h14 * 2 + h18 * 3 // 0..10
      inputs = (
        <div className="grid grid-cols-3 gap-2">
          <NumberInput
            label="10 m (0–3)"
            value={h10}
            min={0}
            max={3}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], h10: x } }))
            }
          />
          <NumberInput
            label="14 m (0–2)"
            value={h14}
            min={0}
            max={2}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], h14: x } }))
            }
          />
          <NumberInput
            label="18 m (0–1)"
            value={h18}
            min={0}
            max={1}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], h18: x } }))
            }
          />
        </div>
      )
    } else if (n.includes('schusspräzision')) {
      const ul = v.ul ?? 0,
        ur = v.ur ?? 0,
        ll = v.ll ?? 0,
        lr = v.lr ?? 0
      raw = (ul + ur) * 3 + (ll + lr) * 1 // 0..24
      inputs = (
        <div className="grid grid-cols-4 gap-2">
          <NumberInput
            label="oben L (0–3)"
            value={ul}
            min={0}
            max={3}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], ul: x } }))
            }
          />
          <NumberInput
            label="oben R (0–3)"
            value={ur}
            min={0}
            max={3}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], ur: x } }))
            }
          />
          <NumberInput
            label="unten L (0–3)"
            value={ll}
            min={0}
            max={3}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], ll: x } }))
            }
          />
          <NumberInput
            label="unten R (0–3)"
            value={lr}
            min={0}
            max={3}
            onChange={(x) =>
              setValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], lr: x } }))
            }
          />
        </div>
      )
    } else {
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
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [p.id]: { ...prev[p.id], value: e.target.value },
                }))
              }
              placeholder={st.unit || 'Wert'}
            />
          </div>
        </div>
      )
      raw = Number(val || 0)
    }

    const score = scoreFor(st, p, raw)

    async function saveOne() {
      const body = new FormData()
      body.append('player_id', p.id)
      body.append('station_id', st.id)
      body.append('value', String(raw))
      const res = await fetch(`/api/projects/${projectId}/measurements`, {
        method: 'POST',
        body,
      })
      const text = await res.text()
      if (!res.ok) {
        alert(text || 'Fehler beim Speichern')
        return
      }
      setSaved((prev) => ({ ...prev, [p.id]: Number(raw) }))
      sortPlayersByScore()
    }

    return (
      <tr className="border-b align-top">
        <td className="p-2 whitespace-nowrap font-medium">
          {p.display_name} {p.birth_year ? `(${p.birth_year})` : ''}
          <br />
          <span className="text-xs muted">
            {p.club || '–'} {p.fav_position ? `• ${p.fav_position}` : ''}
          </span>
        </td>
        <td className="p-2">{inputs}</td>
        <td className="p-2 text-center">
          <span className="badge-green" title="berechneter Norm-Score (0–100)">
            {score}
          </span>
          {typeof saved[p.id] !== 'undefined' && (
            <div className="text-[11px] mt-1 muted">(gespeichert)</div>
          )}
        </td>
        <td className="p-2 text-right">
          <button className="btn pill" onClick={saveOne}>
            Speichern
          </button>
        </td>
      </tr>
    )
  }

  const currentStationIndex = currentStation ? ST_INDEX[currentStation.name] ?? 1 : 1
  const sketchHref = `/station${currentStationIndex}.pdf`

  return (
    <main>
      <Hero
        title="Stations-Erfassung"
        subtitle="Projekt wählen → Station wählen → Werte erfassen"
        image="/base.jpg"
        align="top"
      >
        <div className="flex flex-col items-center gap-4 w-full">
          <ProjectsSelect />
          <StationButtons />

          {projectId && currentStation && (
            <div className="grid md:grid-cols-3 gap-4 w-full">
              <div className="card glass text-left md:col-span-2">
                <h3 className="font-semibold text-lg">{currentStation.name}</h3>
                <p className="text-sm mt-1">
                  {ST_DESCR[currentStation.name] || 'Stationsbeschreibung'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href={sketchHref} target="_blank" className="btn pill">
                    Skizze öffnen
                  </Link>
                  <button
                    className="btn pill pointer-events-none opacity-60"
                    title="Später editierbar"
                  >
                    Skizze/Text bearbeiten
                  </button>
                </div>
              </div>
              <div className="card glass text-left">
                <div className="text-sm font-semibold mb-2">Vorschau</div>
                <div className="aspect-video bg-white/70 flex items-center justify-center text-xs text-gray-600 rounded">
                  (Platzhalter-Vorschau – öffne die PDF)
                </div>
              </div>
            </div>
          )}
        </div>
      </Hero>

      {projectId && currentStation && (
        <TiledSection image="/matrix.jpg">
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
                <tbody>{players.map((p) => <PlayerRow key={p.id} p={p} />)}</tbody>
              </table>
            </div>
          </div>
          <div className="h-16" />
        </TiledSection>
      )}

      <BackFab />
    </main>
  )
}
