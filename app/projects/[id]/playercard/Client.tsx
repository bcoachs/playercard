"use client"

import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PlayerHeader from './PlayerHeader'
import PlayerImage from './PlayerImage'
import PlayerStats, { PlayerStat } from './PlayerStats'
import BackgroundSelector, { BackgroundOption } from './BackgroundSelector'
import { removeBackground } from '@imgly/background-removal'

const STAT_ORDER = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
] as const

const STAT_INDEX: Record<string, number> = STAT_ORDER.reduce((acc, name, index) => {
  acc[name] = index
  return acc
}, {} as Record<string, number>)

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
  photo_url?: string | null
}

type Project = { id: string; name: string; date: string | null }

type Measurement = {
  player_id: string
  station_id: string
  value: number
}

type ScoreMap = Record<string, number[]>

type CsvStatus = 'idle' | 'loading' | 'ready' | 'error'

const DEFAULT_BACKGROUNDS: BackgroundOption[] = [
  {
    id: 'gradient-dark',
    label: 'Midnight Fade',
    type: 'gradient',
    value: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,64,175,0.88))',
  },
  {
    id: 'gradient-light',
    label: 'Silver Highlight',
    type: 'gradient',
    value: 'linear-gradient(135deg, rgba(248,250,252,0.92), rgba(148,163,184,0.65))',
  },
]

const USE_S1_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S1_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

const USE_S6_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S6_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

const USE_S4_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S4_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normScore(st: Station, raw: number): number {
  const min = st.min_value ?? 0
  const max = st.max_value ?? 100
  if (max === min) return 0
  if (st.higher_is_better) return Math.round(clamp((raw - min) / (max - min), 0, 1) * 100)
  return Math.round(clamp((max - raw) / (max - min), 0, 1) * 100)
}

function nearestAgeBucket(age: number, keys: string[]): string {
  const parsed = keys.map(key => {
    const nums = key.match(/\d+/g)?.map(Number) || []
    const mid = nums.length === 2 ? (nums[0] + nums[1]) / 2 : (nums[0] || 0)
    return { key, mid }
  })
  parsed.sort((a, b) => Math.abs(a.mid - age) - Math.abs(b.mid - age))
  return parsed[0]?.key || keys[0]
}

function scoreFromTimeStep(seconds: number, rows: number[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (seconds <= rows[i]) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}

function scoreFromSpeedStep(speed: number, rows: number[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (speed >= rows[i]) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}

async function loadS1Map(gender: 'male' | 'female'): Promise<ScoreMap | null> {
  const candidates =
    gender === 'male'
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
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      if (lines.length < 2) continue
      const header = lines[0].split(';').map(s => s.trim())
      const ageCols = header.slice(1)
      const out: ScoreMap = {}
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
    } catch (err) {
      console.warn('S1 CSV konnte nicht geladen werden:', err)
    }
  }
  return null
}

async function loadS6Map(gender: 'male' | 'female'): Promise<ScoreMap | null> {
  try {
    const file = gender === 'male' ? '/config/s6_male.csv' : '/config/s6_female.csv'
    const res = await fetch(file, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length < 2) return null
    const header = lines[0].split(';').map(s => s.trim())
    const ageCols = header.slice(1)
    const out: ScoreMap = {}
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
  } catch (err) {
    console.warn('S6 CSV konnte nicht geladen werden:', err)
    return null
  }
}

async function loadS4Map(): Promise<ScoreMap | null> {
  try {
    const res = await fetch('/config/s4.csv', { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length < 3) return null
    const header = lines[0].split(';').map(s => s.trim())
    const ageCols = header.slice(1)
    const out: ScoreMap = {}
    for (const age of ageCols) out[age] = []
    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(';').map(s => s.trim())
      for (let c = 1; c < cols.length; c++) {
        const age = ageCols[c - 1]
        const kmh = Number((cols[c] || '').replace(',', '.'))
        if (Number.isFinite(kmh)) out[age].push(kmh)
      }
    }
    return out
  } catch (err) {
    console.warn('S4 CSV konnte nicht geladen werden:', err)
    return null
  }
}

function toFlagEmoji(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 2) {
    const base = 127397
    const chars = trimmed.toUpperCase().split('').map(char => char.charCodeAt(0) + base)
    return String.fromCodePoint(...chars)
  }
  return null
}

function formatBirthYearToAge(birthYear: number | null, eventYear: number): number | null {
  if (!birthYear) return null
  return Math.max(6, Math.min(49, eventYear - birthYear))
}

type PlayercardClientProps = {
  projectId: string
}

export default function PlayercardClient({ projectId }: PlayercardClientProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])

  const [selectedPlayerId, setSelectedPlayerId] = useState('')

  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundOption[]>(DEFAULT_BACKGROUNDS)
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(DEFAULT_BACKGROUNDS[0].id)

  const [manifestStatus, setManifestStatus] = useState<'idle' | 'error'>('idle')

  const [s1Female, setS1Female] = useState<ScoreMap | null>(null)
  const [s1Male, setS1Male] = useState<ScoreMap | null>(null)
  const [s6Female, setS6Female] = useState<ScoreMap | null>(null)
  const [s6Male, setS6Male] = useState<ScoreMap | null>(null)
  const [s4Map, setS4Map] = useState<ScoreMap | null>(null)
  const [scoreStatus, setScoreStatus] = useState<CsvStatus>('idle')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [displayImage, setDisplayImage] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [projectRes, stationRes, playerRes, measurementRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { cache: 'no-store' }),
          fetch(`/api/projects/${projectId}/stations`, { cache: 'no-store' }),
          fetch(`/api/projects/${projectId}/players`, { cache: 'no-store' }),
          fetch(`/api/projects/${projectId}/measurements`, { cache: 'no-store' }),
        ])
        if (!projectRes.ok) throw new Error('Projekt konnte nicht geladen werden.')
        if (!stationRes.ok) throw new Error('Stationen konnten nicht geladen werden.')
        if (!playerRes.ok) throw new Error('Spieler konnten nicht geladen werden.')
        if (!measurementRes.ok) throw new Error('Messwerte konnten nicht geladen werden.')

        const projectData = await projectRes.json().catch(() => ({}))
        const stationData = await stationRes.json().catch(() => ({}))
        const playerData = await playerRes.json().catch(() => ({}))
        const measurementData = await measurementRes.json().catch(() => ({}))

        if (!isMounted) return

        setProject(projectData.item || null)
        setStations(Array.isArray(stationData.items) ? stationData.items : [])
        setPlayers(Array.isArray(playerData.items) ? playerData.items : [])
        setMeasurements(Array.isArray(measurementData.items) ? measurementData.items : [])
      } catch (err) {
        if (!isMounted) return
        setLoadError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Laden')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [projectId])

  useEffect(() => {
    fetch('/backgrounds/manifest.json')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((payload: any) => {
        const items = Array.isArray(payload?.items) ? payload.items : []
        const extras: BackgroundOption[] = items
          .map((item: any): BackgroundOption => ({
            id: String(item.id || item.src || Math.random()),
            label: String(item.label || item.id || 'Hintergrund'),
            type: 'image' as const,
            value: String(item.src),
            thumbnail: String(item.thumbnail || item.src || ''),
          }))
          .filter((option: BackgroundOption): option is BackgroundOption => Boolean(option.value))
        setBackgroundOptions(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const merged = [...prev]
          for (const option of extras) {
            if (!existingIds.has(option.id)) merged.push(option)
          }
          return merged
        })
      })
      .catch(() => setManifestStatus('error'))
  }, [])

  useEffect(() => {
    if (!backgroundOptions.some(option => option.id === selectedBackgroundId) && backgroundOptions.length) {
      setSelectedBackgroundId(backgroundOptions[0].id)
    }
  }, [backgroundOptions, selectedBackgroundId])

  useEffect(() => {
    let cancelled = false
    if (scoreStatus !== 'idle') return
    setScoreStatus('loading')
    const promises: Promise<void>[] = []
    if (USE_S1_CSV) {
      promises.push(
        Promise.allSettled([loadS1Map('female'), loadS1Map('male')]).then(([female, male]) => {
          if (cancelled) return
          if (female.status === 'fulfilled' && female.value) setS1Female(female.value)
          if (male.status === 'fulfilled' && male.value) setS1Male(male.value)
        })
      )
    }
    if (USE_S6_CSV) {
      promises.push(
        Promise.allSettled([loadS6Map('female'), loadS6Map('male')]).then(([female, male]) => {
          if (cancelled) return
          if (female.status === 'fulfilled' && female.value) setS6Female(female.value)
          if (male.status === 'fulfilled' && male.value) setS6Male(male.value)
        })
      )
    }
    if (USE_S4_CSV) {
      promises.push(
        loadS4Map().then(map => {
          if (cancelled) return
          if (map) setS4Map(map)
        })
      )
    }
    Promise.all(promises)
      .then(() => {
        if (!cancelled) setScoreStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setScoreStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [scoreStatus])

  useEffect(() => {
    if (!players.length) return
    if (selectedPlayerId && players.some(player => player.id === selectedPlayerId)) return
    setSelectedPlayerId(players[0].id)
  }, [players, selectedPlayerId])

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return players.find(player => player.id === selectedPlayerId) || null
  }, [players, selectedPlayerId])

  useEffect(() => {
    if (objectUrl) {
      return () => {
        URL.revokeObjectURL(objectUrl)
      }
    }
    return () => undefined
  }, [objectUrl])

  useEffect(() => {
    const photo = selectedPlayer?.photo_url ?? null
    setOriginalImage(photo)
    setDisplayImage(photo)
    setProcessingError(null)
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      setObjectUrl(null)
    }
  }, [selectedPlayer])

  const eventYear = useMemo(() => {
    if (!project?.date) return new Date().getFullYear()
    const parsed = Number(String(project.date).slice(0, 4))
    if (!Number.isFinite(parsed)) return new Date().getFullYear()
    return parsed
  }, [project?.date])

  const measByPlayerStation = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const m of measurements) {
      if (!map[m.player_id]) map[m.player_id] = {}
      map[m.player_id][m.station_id] = Number(m.value || 0)
    }
    return map
  }, [measurements])

  const sortedStations = useMemo(() => {
    return stations.slice().sort((a, b) => {
      const ia = STAT_INDEX[a.name as (typeof STAT_ORDER)[number]] ?? 99
      const ib = STAT_INDEX[b.name as (typeof STAT_ORDER)[number]] ?? 99
      return ia - ib
    })
  }, [stations])

  const stats = useMemo<PlayerStat[]>(() => {
    if (!selectedPlayer) return []
    const playerMeasurements = measByPlayerStation[selectedPlayer.id] || {}
    const entries: PlayerStat[] = []
    for (const station of sortedStations) {
      const raw = playerMeasurements[station.id]
      if (typeof raw === 'undefined') {
        entries.push({
          id: station.id,
          label: station.name,
          score: null,
          raw: null,
          unit: station.unit,
        })
        continue
      }
      const score = scoreForStation(station, selectedPlayer, raw, {
        s1Female,
        s1Male,
        s6Female,
        s6Male,
        s4Map,
        eventYear,
      })
      entries.push({ id: station.id, label: station.name, score, raw, unit: station.unit })
    }
    return entries
  }, [selectedPlayer, sortedStations, measByPlayerStation, s1Female, s1Male, s6Female, s6Male, s4Map, eventYear])

  const totalScore = useMemo(() => {
    const values = stats.map(stat => stat.score).filter((value): value is number => typeof value === 'number')
    if (!values.length) return null
    const sum = values.reduce((acc, value) => acc + value, 0)
    return Math.round(sum / values.length)
  }, [stats])

  const derivedAge = useMemo(() => formatBirthYearToAge(selectedPlayer?.birth_year ?? null, eventYear), [selectedPlayer, eventYear])
  const nationalityFlag = useMemo(() => toFlagEmoji(selectedPlayer?.nationality), [selectedPlayer?.nationality])

  const currentBackground = useMemo(() => {
    return backgroundOptions.find(option => option.id === selectedBackgroundId) || backgroundOptions[0]
  }, [backgroundOptions, selectedBackgroundId])

  const profileBackgroundStyle = useMemo(() => {
    if (!currentBackground) return undefined
    if (currentBackground.type === 'gradient') {
      return { backgroundImage: currentBackground.value }
    }
    return {
      backgroundImage: `url(${currentBackground.value})`,
    }
  }, [currentBackground])

  const handleBackgroundSelect = useCallback((id: string) => {
    setSelectedBackgroundId(id)
  }, [])

  const triggerFileDialog = useCallback(() => {
    setProcessingError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }, [])

  const processFile = useCallback(async (file: File) => {
    setProcessingError(null)
    setIsProcessingImage(true)
    try {
      const blob = await removeBackground(file)
      const url = URL.createObjectURL(blob)
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      setObjectUrl(url)
      setDisplayImage(url)
    } catch (err) {
      console.error('Freistellung fehlgeschlagen', err)
      setProcessingError('Freistellung fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsProcessingImage(false)
    }
  }, [objectUrl])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setProcessingError('Bitte eine Bilddatei auswählen.')
        return
      }
      processFile(file)
    },
    [processFile]
  )

  const reapplyBackgroundRemoval = useCallback(() => {
    if (!originalImage) return
    setProcessingError(null)
    fetch(originalImage)
      .then(res => res.blob())
      .then(blob => processFile(new File([blob], 'player-photo.png', { type: blob.type || 'image/png' })))
      .catch(() => setProcessingError('Originalbild konnte nicht geladen werden.'))
  }, [originalImage, processFile])

  const resetToOriginal = useCallback(() => {
    setProcessingError(null)
    setDisplayImage(originalImage)
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      setObjectUrl(null)
    }
  }, [originalImage, objectUrl])

  const canReapply = Boolean(originalImage)
  const canReset = Boolean(originalImage) && displayImage !== originalImage

  const infoText = useMemo(() => {
    return (
      <p className="playercard-intro">
        Willkommen im Playercard-Studio! Hier wird das persönliche Profil eines Spielers aus der Spielermatrix
        dargestellt. Wähle einen Spieler aus, passe den Hintergrund an und bringe die Statistiken auf den neuesten
        Stand – perfekt für individuelle Highlight-Cards.
      </p>
    )
  }, [])

  return (
    <main className="playercard-page">
      <div className="page-pad">
        <div className="playercard-shell">
          {infoText}
          {loadError && <div className="playercard-alert">{loadError}</div>}
          <div className="playercard-grid" style={profileBackgroundStyle}>
            <div className="playercard-overlay" />
            <section className="playercard-column playercard-column--info">
              <PlayerHeader
                projectName={project?.name || 'Playercard'}
                players={players}
                player={selectedPlayer}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                age={derivedAge}
                nationalityFlag={nationalityFlag}
                totalScore={totalScore}
              />
              <PlayerStats stats={stats} totalScore={totalScore} isLoading={isLoading} loadError={loadError} />
              <BackgroundSelector
                options={backgroundOptions}
                selectedId={currentBackground?.id || selectedBackgroundId}
                onSelect={handleBackgroundSelect}
                manifestError={manifestStatus === 'error'}
              />
              <div className="playercard-cta">
                <Link href={`/projects/${projectId}`} className="btn-secondary">
                  Zur Spielermatrix
                </Link>
                <button type="button" className="btn" onClick={() => alert('Download-Funktion folgt in Kürze!')}>
                  Karte herunterladen
                </button>
              </div>
            </section>
            <section className="playercard-column playercard-column--photo">
              <PlayerImage
                imageSrc={displayImage}
                isProcessing={isProcessingImage}
                onTriggerUpload={triggerFileDialog}
                onReset={canReset ? resetToOriginal : undefined}
                onReapply={canReapply ? reapplyBackgroundRemoval : undefined}
                processingError={processingError}
                hasImage={Boolean(displayImage)}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

type ScoreDependencies = {
  s1Female: ScoreMap | null
  s1Male: ScoreMap | null
  s6Female: ScoreMap | null
  s6Male: ScoreMap | null
  s4Map: ScoreMap | null
  eventYear: number
}

function scoreForStation(station: Station, player: Player, raw: number, deps: ScoreDependencies): number {
  const name = station.name.toLowerCase()
  if (name.includes('beweglichkeit')) {
    if (USE_S1_CSV) {
      const map = player.gender === 'male' ? deps.s1Male : deps.s1Female
      if (map) {
        const keys = Object.keys(map)
        if (keys.length) {
          const bucket = nearestAgeBucket(resolveAge(player.birth_year, deps.eventYear), keys)
          const rows = map[bucket] || []
          if (rows.length) return scoreFromTimeStep(Number(raw), rows)
        }
      }
    }
    return normScore({ ...station, min_value: 10, max_value: 40, higher_is_better: false }, Number(raw))
  }
  if (name.includes('schnelligkeit')) {
    if (USE_S6_CSV) {
      const map = player.gender === 'male' ? deps.s6Male : deps.s6Female
      if (map) {
        const keys = Object.keys(map)
        if (keys.length) {
          const bucket = nearestAgeBucket(resolveAge(player.birth_year, deps.eventYear), keys)
          const rows = map[bucket] || []
          if (rows.length) return scoreFromTimeStep(Number(raw), rows)
        }
      }
    }
    return normScore({ ...station, min_value: 4, max_value: 20, higher_is_better: false }, Number(raw))
  }
  if (name.includes('schusskraft')) {
    if (USE_S4_CSV && deps.s4Map) {
      const keys = Object.keys(deps.s4Map)
      if (keys.length) {
        const bucket = nearestAgeBucket(resolveAge(player.birth_year, deps.eventYear), keys)
        const rows = deps.s4Map[bucket] || []
        if (rows.length) return scoreFromSpeedStep(Number(raw), rows)
      }
    }
    return normScore({ ...station, min_value: 0, max_value: 150, higher_is_better: true }, Number(raw))
  }
  if (name.includes('passgenauigkeit')) {
    return Math.round(clamp(Number(raw), 0, 100))
  }
  if (name.includes('schusspräzision')) {
    const pct = clamp(Number(raw) / 24, 0, 1)
    return Math.round(pct * 100)
  }
  return Math.round(normScore(station, Number(raw)))
}

function resolveAge(birthYear: number | null | undefined, eventYear: number): number {
  if (!birthYear) return 16
  return Math.max(6, Math.min(49, eventYear - birthYear))
}
