'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { PLAYER_CARD_BACKGROUNDS } from '@/data/backgrounds'
import { findNationality, NATIONALITIES } from '@/data/nationalities'
import { PLAYER_POSITIONS } from '@/data/positions'

type Player = {
  id: string
  display_name: string
  club: string | null
  fav_number: number | null
  fav_position: string | null
  nationality: string | null
  photo_url?: string | null
}

type StatKey =
  | 'agility'
  | 'technique'
  | 'passing'
  | 'shotPower'
  | 'shotAccuracy'
  | 'pace'

const STAT_FIELDS: { key: StatKey; label: string }[] = [
  { key: 'agility', label: 'Beweglichkeit' },
  { key: 'technique', label: 'Technik' },
  { key: 'passing', label: 'Passgenauigkeit' },
  { key: 'shotPower', label: 'Schusskraft' },
  { key: 'shotAccuracy', label: 'Schusspräzision' },
  { key: 'pace', label: 'Schnelligkeit' },
]

type CardState = {
  playerId: string | null
  name: string
  club: string
  position: string
  favouriteNumber: string
  nationality: string
  favouritePositions: string
  rating: number
  backgroundId: string
  stats: Record<StatKey, number>
  photo?: string | null
  clubLogo?: string | null
}

const STORAGE_SELECTED_PLAYER = 'playercard:selectedPlayer'
const STORAGE_CARD_STATE = 'playercard:cardOptions'

type Html2CanvasFn = (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>

const DEFAULT_STATS: Record<StatKey, number> = {
  agility: 78,
  technique: 82,
  passing: 80,
  shotPower: 85,
  shotAccuracy: 79,
  pace: 83,
}

function createDefaultState(player?: Player | null): CardState {
  return {
    playerId: player?.id ?? null,
    name: player?.display_name ?? '',
    club: player?.club ?? '',
    position: player?.fav_position ?? '',
    favouriteNumber: player?.fav_number ? String(player.fav_number) : '',
    nationality: player?.nationality ?? '',
    favouritePositions: player?.fav_position ?? '',
    rating: 86,
    backgroundId: PLAYER_CARD_BACKGROUNDS[0]?.id ?? 'aurora',
    stats: { ...DEFAULT_STATS },
    photo: player?.photo_url ?? null,
    clubLogo: null,
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

async function ensureHtml2Canvas(): Promise<Html2CanvasFn> {
  if (typeof window === 'undefined') {
    throw new Error('html2canvas kann nur im Browser geladen werden')
  }

  if (window.html2canvas) {
    return window.html2canvas
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-playercard-html2canvas="1"]')
    if (existing) {
      if (window.html2canvas) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('html2canvas konnte nicht geladen werden')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    script.async = true
    script.setAttribute('data-playercard-html2canvas', '1')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('html2canvas konnte nicht geladen werden'))
    document.head.appendChild(script)
  })

  if (!window.html2canvas) {
    throw new Error('html2canvas konnte nicht initialisiert werden')
  }

  return window.html2canvas
}

type Props = {
  projectId: string
  initialPlayerId?: string
}

type ApiState = 'idle' | 'loading' | 'error'

export default function PlayercardClient({ projectId, initialPlayerId = '' }: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId)
  const [cardState, setCardState] = useState<CardState>(() => createDefaultState(null))
  const [cardStateRestored, setCardStateRestored] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setApiState('loading')
    setErrorMessage('')
    fetch(`/api/projects/${projectId}/players`, { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) {
          throw new Error('Spieler konnten nicht geladen werden')
        }
        return res.json() as Promise<{ items: Player[] }>
      })
      .then(data => {
        setPlayers(data.items || [])
        setApiState('idle')
      })
      .catch(err => {
        console.error(err)
        setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler')
        setApiState('error')
      })
  }, [projectId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedPlayer = window.localStorage.getItem(STORAGE_SELECTED_PLAYER)
    if (!initialPlayerId && savedPlayer && !selectedPlayerId) {
      setSelectedPlayerId(savedPlayer)
    }
    const rawState = window.localStorage.getItem(STORAGE_CARD_STATE)
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState) as CardState
        setCardState({ ...createDefaultState(null), ...parsed })
      } catch (err) {
        console.warn('Konnte gespeicherte Playercard-Optionen nicht laden', err)
      }
    }
    setCardStateRestored(true)
  }, [initialPlayerId, selectedPlayerId])

  useEffect(() => {
    if (!cardStateRestored || typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_CARD_STATE, JSON.stringify(cardState))
  }, [cardState, cardStateRestored])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedPlayerId) {
      window.localStorage.setItem(STORAGE_SELECTED_PLAYER, selectedPlayerId)
      setShowSelector(false)
    }
  }, [selectedPlayerId])

  useEffect(() => {
    if (apiState === 'loading') return
    if (!selectedPlayerId) {
      setShowSelector(true)
    }
  }, [apiState, selectedPlayerId])

  const selectedPlayer = useMemo(
    () => players.find(p => p.id === selectedPlayerId) || null,
    [players, selectedPlayerId],
  )

  useEffect(() => {
    if (!selectedPlayer) return
    setCardState(prev => {
      if (prev.playerId === selectedPlayer.id) {
        return prev
      }
      const defaults = createDefaultState(selectedPlayer)
      return {
        ...defaults,
        backgroundId: prev.backgroundId || defaults.backgroundId,
      }
    })
  }, [selectedPlayer])

  const handleFieldChange = useCallback(<K extends keyof CardState>(key: K, value: CardState[K]) => {
    setCardState(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleStatChange = useCallback((key: StatKey, value: number) => {
    setCardState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [key]: value,
      },
    }))
  }, [])

  const handlePhotoUpload = useCallback((file: File, key: 'photo' | 'clubLogo') => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      if (result) {
        setCardState(prev => ({ ...prev, [key]: result }))
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDownload = useCallback(async () => {
    const node = cardRef.current
    if (!node) return
    setDownloading(true)
    try {
      const html2canvas = await ensureHtml2Canvas()
      const canvas = await html2canvas(node, {
        backgroundColor: null,
        scale: window.devicePixelRatio > 1 ? 2 : 1.5,
      })
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      const fallbackName = cardState.name ? cardState.name.replace(/\s+/g, '_') : 'playercard'
      link.download = `${fallbackName}.png`
      link.click()
    } catch (err) {
      console.error(err)
      alert('Download fehlgeschlagen. Bitte stelle eine Internetverbindung sicher und versuche es erneut.')
    } finally {
      setDownloading(false)
    }
  }, [cardState.name])

  const background = useMemo(
    () => PLAYER_CARD_BACKGROUNDS.find(bg => bg.id === cardState.backgroundId) || PLAYER_CARD_BACKGROUNDS[0],
    [cardState.backgroundId],
  )

  const nationalityOption = findNationality(cardState.nationality)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-10 lg:flex-row">
        <section className="flex flex-1 items-center justify-center">
          <div className="relative flex w-full max-w-sm justify-center">
            <div className="relative w-full max-w-sm transition-transform duration-300 hover:-translate-y-1">
              <div className="relative aspect-[9/19.5] rounded-[3rem] border-[12px] border-slate-900 bg-slate-900/80 shadow-[0_30px_80px_rgba(15,23,42,0.8)] before:absolute before:inset-x-[20%] before:top-1 before:h-1.5 before:rounded-full before:bg-slate-600/60 after:absolute after:bottom-14 after:left-1/2 after:h-14 after:w-28 after:-translate-x-1/2 after:rounded-[999px] after:bg-slate-800/70">
                <div className="absolute inset-[18px] rounded-[2.2rem] bg-slate-900/90 p-4">
                  <div
                    ref={cardRef}
                    className={cn(
                      'relative flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.6)]',
                      background?.gradientClass,
                      background?.overlayClass,
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/40" aria-hidden />
                    <div className="relative z-10 flex flex-col gap-4 p-5">
                      <header className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-2 ring-white/20">
                            {cardState.photo ? (
                              <img
                                src={cardState.photo}
                                alt={cardState.name || 'Spielerfoto'}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs uppercase tracking-wide text-white/70">Foto</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm uppercase tracking-widest text-white/70">Gesamtrating</p>
                            <p className="text-4xl font-black text-white drop-shadow">{cardState.rating}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          {cardState.clubLogo && (
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-black/40 p-1">
                              <img src={cardState.clubLogo} alt="Vereinslogo" className="h-full w-full object-contain" />
                            </div>
                          )}
                          <p className="font-semibold uppercase tracking-widest text-white/80">
                            {cardState.position || 'POS'}
                          </p>
                          <div className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                            {cardState.favouriteNumber ? `#${cardState.favouriteNumber}` : '—'}
                            {nationalityOption && (
                              <span className="text-base" aria-label={nationalityOption.name}>
                                {nationalityOption.flag}
                              </span>
                            )}
                          </div>
                        </div>
                      </header>
                      <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black uppercase tracking-wide text-white drop-shadow">
                          {cardState.name || 'Spielername'}
                        </h1>
                        {cardState.club && (
                          <p className="text-sm font-medium uppercase tracking-wider text-white/80">
                            {cardState.club}
                          </p>
                        )}
                        {cardState.favouritePositions && (
                          <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                            {cardState.favouritePositions}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-3 rounded-2xl bg-black/35 p-4 backdrop-blur">
                        {STAT_FIELDS.map(stat => {
                          const value = cardState.stats[stat.key]
                          return (
                            <div key={stat.key} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
                                <span>{stat.label}</span>
                                <span>{value}</span>
                              </div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-white to-white/40"
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-auto flex items-center justify-between rounded-2xl bg-white/10 p-3 text-xs uppercase tracking-wide text-white/80">
                        <span>Pro Edition</span>
                        <span>Skillscore {Math.round(
                          (Object.values(cardState.stats).reduce((sum, val) => sum + val, 0) /
                            STAT_FIELDS.length +
                            cardState.rating) /
                            2,
                        )}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="w-full max-w-xl space-y-8">
          <header className="space-y-3">
            <Link href={`/projects/${projectId}`} className="text-xs uppercase tracking-widest text-slate-400 transition hover:text-white/90">
              ← Zurück zur Projektübersicht
            </Link>
            <div>
              <h2 className="text-3xl font-semibold text-white">Playercard konfigurieren</h2>
              <p className="text-sm text-slate-400">
                Passe Foto, Daten und Hintergrund an – alle Änderungen werden live in der Smartphone-Vorschau angezeigt.
              </p>
            </div>
          </header>

          <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Spieler auswählen</label>
              <select
                value={selectedPlayerId}
                onChange={event => setSelectedPlayerId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/40"
              >
                <option value="">– Spieler wählen –</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.display_name}
                  </option>
                ))}
              </select>
              {apiState === 'loading' && (
                <p className="text-xs text-slate-400">Spieler werden geladen …</p>
              )}
              {apiState === 'error' && (
                <p className="text-xs text-red-400">{errorMessage}</p>
              )}
              {apiState === 'idle' && players.length === 0 && (
                <p className="text-xs text-slate-400">Noch keine Spieler im Projekt vorhanden.</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name *">
                <input
                  className="input-modern"
                  value={cardState.name}
                  onChange={event => handleFieldChange('name', event.target.value)}
                  placeholder="Vorname Nachname"
                  required
                />
              </Field>
              <Field label="Position *">
                <select
                  className="input-modern"
                  value={cardState.position}
                  onChange={event => handleFieldChange('position', event.target.value)}
                >
                  <option value="">– Position –</option>
                  {PLAYER_POSITIONS.map(pos => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Verein">
                <input
                  className="input-modern"
                  value={cardState.club}
                  onChange={event => handleFieldChange('club', event.target.value)}
                  placeholder="Vereinsname"
                />
              </Field>
              <Field label="Lieblingsnummer">
                <input
                  className="input-modern"
                  value={cardState.favouriteNumber}
                  onChange={event => handleFieldChange('favouriteNumber', event.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  placeholder="7"
                />
              </Field>
              <Field label="Nationalität">
                <select
                  className="input-modern"
                  value={cardState.nationality}
                  onChange={event => handleFieldChange('nationality', event.target.value)}
                >
                  <option value="">– Auswahl –</option>
                  {NATIONALITIES.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.flag} {option.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lieblingspositionen">
                <input
                  className="input-modern"
                  value={cardState.favouritePositions}
                  onChange={event => handleFieldChange('favouritePositions', event.target.value)}
                  placeholder="ST • ZOM"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Rating">
                <input
                  type="range"
                  min={40}
                  max={99}
                  step={1}
                  value={cardState.rating}
                  onChange={event => handleFieldChange('rating', Number(event.target.value))}
                  className="w-full"
                />
                <div className="text-right text-xs text-slate-300">{cardState.rating}</div>
              </Field>
              <Field label="Hintergrund">
                <select
                  className="input-modern"
                  value={cardState.backgroundId}
                  onChange={event => handleFieldChange('backgroundId', event.target.value)}
                >
                  {PLAYER_CARD_BACKGROUNDS.map(bg => (
                    <option key={bg.id} value={bg.id}>
                      {bg.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Stats anpassen</p>
              <div className="grid gap-4">
                {STAT_FIELDS.map(stat => (
                  <div key={stat.key} className="space-y-1 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span>{stat.label}</span>
                      <span className="font-semibold">{cardState.stats[stat.key]}</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={99}
                      step={1}
                      value={cardState.stats[stat.key]}
                      onChange={event => handleStatChange(stat.key, Number(event.target.value))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <UploadField
                label="Spielerfoto"
                description="Freigestelltes Bild hochladen"
                preview={cardState.photo}
                onUpload={file => handlePhotoUpload(file, 'photo')}
              />
              <UploadField
                label="Vereinslogo"
                description="Optionales Logo für die Karte"
                preview={cardState.clubLogo}
                onUpload={file => handlePhotoUpload(file, 'clubLogo')}
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Hintergründe</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PLAYER_CARD_BACKGROUNDS.map(bg => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => handleFieldChange('backgroundId', bg.id)}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl border p-0.5 text-left transition focus:outline-none focus:ring-2 focus:ring-white/60',
                      cardState.backgroundId === bg.id
                        ? 'border-white/80 shadow-lg'
                        : 'border-white/10 hover:border-white/40',
                    )}
                  >
                    <div className={cn('h-24 w-full rounded-2xl', bg.gradientClass)} />
                    <div className="p-2">
                      <p className="text-xs font-semibold text-white">{bg.name}</p>
                      <p className="text-[10px] text-slate-400">{bg.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 px-6 py-4 text-base font-semibold uppercase tracking-wide text-white shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-pink-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={downloading || !cardState.name || !cardState.position}
            >
              {downloading ? 'Wird erstellt …' : 'Playercard herunterladen'}
            </button>
          </div>
        </aside>
      </div>

      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-2xl font-semibold">Spieler auswählen</h3>
            <p className="mt-2 text-sm text-slate-300">
              Bitte wähle einen Spieler aus, um die Playercard zu gestalten. Du kannst auch zur Verwaltung zurückkehren.
            </p>
            <div className="mt-5 space-y-3">
              <select
                value={selectedPlayerId}
                onChange={event => setSelectedPlayerId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm"
              >
                <option value="">– Spieler wählen –</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.display_name}
                  </option>
                ))}
              </select>
              <Link
                href={`/projects/${projectId}`}
                className="block w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition hover:border-white/40"
              >
                Zur Auswahlseite
              </Link>
              <button
                type="button"
                onClick={() => setShowSelector(false)}
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/20"
                disabled={!selectedPlayerId}
              >
                Weiter zur Karte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type FieldProps = {
  label: string
  children: ReactNode
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
      {label}
      {children}
    </label>
  )
}

type UploadFieldProps = {
  label: string
  description: string
  preview?: string | null
  onUpload: (file: File) => void
}

function UploadField({ label, description, preview, onUpload }: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        {preview ? (
          <img src={preview} alt="Preview" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 text-xs text-slate-300">
            Kein Bild
          </div>
        )}
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/20"
        onClick={() => inputRef.current?.click()}
      >
        Bild wählen
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) {
            onUpload(file)
          }
        }}
      />
    </div>
  )
}

declare global {
  interface Window {
    html2canvas?: Html2CanvasFn
  }
}
