"use client"

import { getCountryCode, getCountryLabel } from '@/lib/countries'
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toPng } from 'html-to-image'
import PlayerHeader from './PlayerHeader'
import PlayerCardPreview from './PlayerCardPreview'
import PlayerStats, { PlayerStat } from './PlayerStats'
import BackgroundSelector, { BackgroundOption } from './BackgroundSelector'
import { blobToDataUrl } from './blobToDataUrl'
import { resolvePlayerPhotoUrl } from './resolvePlayerPhotoUrl'
import { STAT_ORDER, type PlayerPerformanceEntry } from '@/lib/playerPerformance'

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
  club_logo_url?: string | null
  club_logo?: string | null
  clubLogoUrl?: string | null
  number?: number | null
}

type Project = { id: string; name: string; date: string | null }

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

const PLACEHOLDER_IMAGE = '/public/placeholder.png'

function formatBirthYearToAge(birthYear: number | null, eventYear: number): number | null {
  if (!birthYear) return null
  return Math.max(6, Math.min(49, eventYear - birthYear))
}

type PlayercardClientProps = {
  projectId: string
  initialPlayerId?: string | null
}

export default function PlayercardClient({ projectId, initialPlayerId }: PlayercardClientProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [performances, setPerformances] = useState<Record<string, PlayerPerformanceEntry>>({})

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => {
    if (typeof initialPlayerId === 'string' && initialPlayerId) {
      return initialPlayerId
    }
    return ''
  })

  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundOption[]>(DEFAULT_BACKGROUNDS)
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(DEFAULT_BACKGROUNDS[0].id)

  const [manifestStatus, setManifestStatus] = useState<'idle' | 'error'>('idle')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [displayImage, setDisplayImage] = useState<string | null>(null)
  const [localPhoto, setLocalPhoto] = useState<string | null>(null)
  const [photoOffset, setPhotoOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const playercardRef = useRef<HTMLDivElement | null>(null)
  const loadPlayerImage = useCallback(async (photoPath: string): Promise<string> => {
    const trimmed = photoPath.trim()
    if (!trimmed) {
      throw new Error('Empty photo path')
    }
    if (trimmed.startsWith('data:')) {
      return trimmed
    }

    const resolvedUrl = await resolvePlayerPhotoUrl(trimmed)
    if (!resolvedUrl) {
      throw new Error('Failed to resolve public player photo URL')
    }

    const res = await fetch(resolvedUrl, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status}`)
    }
    const blob = await res.blob()
    return blobToDataUrl(blob)
  }, [])

  useEffect(() => {
    if (typeof initialPlayerId === 'string' && initialPlayerId) {
      setSelectedPlayerId(initialPlayerId)
    }
  }, [initialPlayerId])

  const applyDisplayImage = useCallback((url: string | null) => {
    setDisplayImage(url)
    setPhotoOffset(prev => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
    if (!url) {
      setLocalPhoto(PLACEHOLDER_IMAGE)
      return
    }
    if (url.startsWith('data:')) {
      setLocalPhoto(url)
    } else {
      setLocalPhoto(PLACEHOLDER_IMAGE)
    }
  }, [])

  const handlePhotoOffsetChange = useCallback((offset: { x: number; y: number }) => {
    setPhotoOffset(prev => {
      if (Math.abs(prev.x - offset.x) < 0.1 && Math.abs(prev.y - offset.y) < 0.1) {
        return prev
      }
      return { x: offset.x, y: offset.y }
    })
  }, [])

  useEffect(() => {
    let isMounted = true
    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/dashboard`, { cache: 'no-store' })
        if (!res.ok) {
          const message = await res.text().catch(() => '')
          if (isMounted) {
            setProject(null)
            setPlayers([])
            setStations([])
            setPerformances({})
            setLoadError(message || 'Projekt konnte nicht geladen werden.')
          }
          return
        }

        const data = await res.json().catch(() => ({}))
        if (!isMounted) return

        const projectData = data?.project || null
        const playerItems: Player[] = Array.isArray(data?.players) ? data.players : []
        const stationItems: Station[] = Array.isArray(data?.stations) ? data.stations : []
        const performanceMap: Record<string, PlayerPerformanceEntry> =
          data && typeof data.performances === 'object' && data.performances !== null ? data.performances : {}

        setProject(projectData)
        setPlayers(playerItems)
        setStations(stationItems)
        setPerformances(performanceMap)
        setLoadError(null)
      } catch (err) {
        if (!isMounted) return
        // Bei Fehlern alle lokal gehaltenen Daten zurücksetzen
        setProject(null)
        setStations([])
        setPlayers([])
        setPerformances({})
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
    if (!players.length) return
    if (selectedPlayerId && players.some(player => player.id === selectedPlayerId)) return
    setSelectedPlayerId(players[0].id)
  }, [players, selectedPlayerId])

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return players.find(player => player.id === selectedPlayerId) || null
  }, [players, selectedPlayerId])

  const eventYear = useMemo(() => {
    if (!project?.date) return new Date().getFullYear()
    const parsed = Number(String(project.date).slice(0, 4))
    if (!Number.isFinite(parsed)) return new Date().getFullYear()
    return parsed
  }, [project?.date])

  const stats = useMemo<PlayerStat[]>(() => {
    if (!selectedPlayerId) {
      return stations.map(station => ({
        id: station.id,
        label: station.name,
        score: null,
        raw: null,
        unit: station.unit,
      }))
    }
    const entry = performances[selectedPlayerId]
    if (entry?.stats) {
      return entry.stats
    }
    if (stations.length) {
      return stations.map(station => ({
        id: station.id,
        label: station.name,
        score: null,
        raw: null,
        unit: station.unit,
      }))
    }
    return []
  }, [performances, selectedPlayerId, stations])

  const totalScore = performances[selectedPlayerId]?.totalScore ?? null

  const stationValues = useMemo(
    () =>
      STAT_ORDER.map(label => {
        const stat = stats.find(entry => entry.label === label)
        return { label, value: typeof stat?.score === 'number' ? stat.score : null }
      }),
    [stats],
  )

  const derivedAge = useMemo(() => formatBirthYearToAge(selectedPlayer?.birth_year ?? null, eventYear), [selectedPlayer, eventYear])
  const nationalityCode = useMemo(
    () => getCountryCode(selectedPlayer?.nationality),
    [selectedPlayer?.nationality],
  )
  const nationalityLabel = useMemo(() => {
    if (nationalityCode) {
      const fromCode = getCountryLabel(nationalityCode)
      if (fromCode) return fromCode
    }
    const raw = selectedPlayer?.nationality?.trim()
    return raw && raw.length ? raw : null
  }, [nationalityCode, selectedPlayer?.nationality])

  const clubLogoUrl = useMemo(() => {
    if (!selectedPlayer) return null
    return selectedPlayer.club_logo_url ?? selectedPlayer.club_logo ?? selectedPlayer.clubLogoUrl ?? null
  }, [selectedPlayer])

  const kitNumber = useMemo(() => {
    if (!selectedPlayer) return null
    if (typeof selectedPlayer.fav_number === 'number') return selectedPlayer.fav_number
    if (typeof selectedPlayer.number === 'number') return selectedPlayer.number
    return null
  }, [selectedPlayer])

  const currentBackground = useMemo(() => {
    return backgroundOptions.find(option => option.id === selectedBackgroundId) || backgroundOptions[0]
  }, [backgroundOptions, selectedBackgroundId])

  const cardBackgroundStyle = useMemo(() => {
    if (!currentBackground) return undefined
    if (currentBackground.type === 'gradient') {
      return { backgroundImage: currentBackground.value }
    }
    return {
      backgroundImage: `url(${currentBackground.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }, [currentBackground])

  const handleBackgroundSelect = useCallback((id: string) => {
    setSelectedBackgroundId(id)
  }, [])

  const triggerFileDialog = useCallback(() => {
    setErrorMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }, [])

  const handleDownload = useCallback(async () => {
    const cardEl = document.getElementById('playerCardRoot')
    if (!cardEl) return
    try {
      const dataUrl = await toPng(cardEl, {
        cacheBust: true,
        backgroundColor: '#0a1e38',
        filter: (node: HTMLElement) => node.dataset?.exportIgnore !== 'true',
      })
      const link = document.createElement('a')
      link.download = `${selectedPlayer?.display_name ?? 'player'}_card.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export fehlgeschlagen:', err)
      if (err instanceof Error) {
        alert(`Export fehlgeschlagen: ${err.message}`)
      } else {
        alert('Export fehlgeschlagen. Prüfen Sie die Konsole auf Details.')
      }
    }
  }, [selectedPlayer])

  useEffect(() => {
    let cancelled = false
    setErrorMessage(null)

    if (!selectedPlayer) {
      setOriginalImage(null)
      applyDisplayImage(null)
      return () => {
        cancelled = true
      }
    }

    const photoUrl = typeof selectedPlayer.photo_url === 'string' ? selectedPlayer.photo_url.trim() : ''
    if (!photoUrl.length) {
      setOriginalImage(null)
      applyDisplayImage(null)
      return () => {
        cancelled = true
      }
    }

    if (photoUrl.startsWith('data:')) {
      setOriginalImage(photoUrl)
      applyDisplayImage(photoUrl)
      return () => {
        cancelled = true
      }
    }

    setOriginalImage(null)
    applyDisplayImage(null)

    const fetchPhoto = async () => {
      try {
        const dataUrl = await loadPlayerImage(photoUrl)
        if (!cancelled) {
          setOriginalImage(dataUrl)
          applyDisplayImage(dataUrl)
        }
      } catch (err) {
        console.warn('Spielerfoto konnte nicht geladen werden. Platzhalter wird genutzt.', err)
        if (!cancelled) {
          setOriginalImage(null)
          setErrorMessage('Spielerfoto konnte nicht geladen werden. Platzhalter wird angezeigt.')
          applyDisplayImage(null)
        }
      }
    }

    fetchPhoto()

    return () => {
      cancelled = true
    }
  }, [selectedPlayer, applyDisplayImage, loadPlayerImage])

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Bitte eine Bilddatei auswählen.')
        return
      }
      try {
        const dataUrl = await blobToDataUrl(file)
        setOriginalImage(dataUrl)
        setErrorMessage(null)
        applyDisplayImage(dataUrl)
      } catch (error) {
        console.error('Bilddatei konnte nicht gelesen werden.', error)
        setErrorMessage('Die ausgewählte Datei konnte nicht geladen werden.')
      }
    },
    [applyDisplayImage],
  )

  const resetToOriginal = useCallback(() => {
    if (!originalImage) return
    setErrorMessage(null)
    applyDisplayImage(originalImage)
  }, [originalImage, applyDisplayImage])

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
          <div className="playercard-grid">
            <div className="playercard-overlay" />
            <section className="playercard-column playercard-column--info">
              <PlayerHeader
                projectName={project?.name || 'Playercard'}
                players={players}
                player={selectedPlayer}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                age={derivedAge}
                nationalityCode={nationalityCode}
                nationalityLabel={nationalityLabel}
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
              </div>
            </section>
            <section className="playercard-column playercard-column--photo">
              <PlayerCardPreview
                imageSrc={localPhoto}
                onTriggerUpload={triggerFileDialog}
                onReset={canReset ? resetToOriginal : undefined}
                errorMessage={errorMessage}
                hasImage={Boolean(localPhoto && localPhoto !== PLACEHOLDER_IMAGE)}
                cardRef={playercardRef}
                playerName={selectedPlayer?.display_name ?? null}
                position={selectedPlayer?.fav_position ?? null}
                totalScore={totalScore}
                nationalityCode={nationalityCode}
                nationalityLabel={nationalityLabel}
                clubLogoUrl={clubLogoUrl}
                kitNumber={kitNumber}
                stationValues={stationValues}
                cardBackgroundStyle={cardBackgroundStyle}
                photoOffset={photoOffset}
                onPhotoOffsetChange={handlePhotoOffsetChange}
              />
              <div className="playercard-export">
                <button className="btn" type="button" onClick={handleDownload}>
                  Playercard senden
                </button>
              </div>
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
