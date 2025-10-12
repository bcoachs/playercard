'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import Link from 'next/link'
import {
  PLAYER_CARD_BACKGROUNDS,
  type PlayercardBackground,
} from '@/data/backgrounds'
import { findNationality, NATIONALITIES } from '@/data/nationalities'
import { PLAYER_POSITIONS } from '@/data/positions'

// -----------------------------------------------------------------------------
// Typen & Konstanten
// -----------------------------------------------------------------------------
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

type StatField = { key: StatKey; label: string }

const STAT_FIELDS: StatField[] = [
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
  seasonLabel: string
  stats: Record<StatKey, number>
  photo?: string | null
  clubLogo?: string | null
}

const STORAGE_SELECTED_PLAYER = 'playercard:selectedPlayer'
const STORAGE_CARD_STATE = 'playercard:cardOptions'

const DEFAULT_STATS: Record<StatKey, number> = {
  agility: 78,
  technique: 82,
  passing: 80,
  shotPower: 85,
  shotAccuracy: 79,
  pace: 83,
}

function formatSeasonLabel() {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  })
  return formatter.format(new Date())
}

function createDefaultState(player?: Player | null): CardState {
  return {
    playerId: player?.id ?? null,
    name: player?.display_name ?? '',
    club: player?.club ?? '',
    position: player?.fav_position ?? '',
    favouriteNumber: player?.fav_number ? String(player.fav_number) : '',
    nationality: player?.nationality ? player.nationality.toUpperCase() : '',
    favouritePositions: player?.fav_position ?? '',
    rating: 86,
    backgroundId: PLAYER_CARD_BACKGROUNDS[0]?.id ?? 'aurora',
    seasonLabel: formatSeasonLabel(),
    stats: { ...DEFAULT_STATS },
    photo: player?.photo_url ?? null,
    clubLogo: null,
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

// html2canvas wird nur im Browser geladen
async function ensureHtml2Canvas(): Promise<Html2CanvasFn> {
  if (typeof window === 'undefined') {
    throw new Error('html2canvas kann nur im Browser geladen werden')
  }

  if (window.html2canvas) {
    return window.html2canvas
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-playercard-html2canvas="1"]',
    )
    if (existing) {
      if (window.html2canvas) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () =>
        reject(new Error('html2canvas konnte nicht geladen werden')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src =
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    script.async = true
    script.setAttribute('data-playercard-html2canvas', '1')
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error('html2canvas konnte nicht geladen werden'))
    document.head.appendChild(script)
  })

  if (!window.html2canvas) {
    throw new Error('html2canvas konnte nicht initialisiert werden')
  }

  return window.html2canvas
}

type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>

type Props = {
  projectId: string
  initialPlayerId?: string
}

type ApiState = 'idle' | 'loading' | 'error'

// -----------------------------------------------------------------------------
// Hauptkomponente
// -----------------------------------------------------------------------------
export default function PlayercardClient({
  projectId,
  initialPlayerId = '',
}: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [apiState, setApiState] = useState<ApiState>('idle')
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId)
  const [cardState, setCardState] = useState<CardState>(() =>
    createDefaultState(null),
  )
  const [cardStateRestored, setCardStateRestored] = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Spieler laden
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
        setErrorMessage(
          err instanceof Error ? err.message : 'Unbekannter Fehler',
        )
        setApiState('error')
      })
  }, [projectId])

  // lokale Speicherung wiederherstellen
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
    () => players.find(player => player.id === selectedPlayerId) || null,
    [players, selectedPlayerId],
  )

  // Playerwechsel -> Standardwerte einsetzen
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

  const handleFieldChange = useCallback(<K extends keyof CardState>(
    key: K,
    value: CardState[K],
  ) => {
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

  const handlePhotoUpload = useCallback(
    (file: File, key: 'photo' | 'clubLogo') => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null
        if (result) {
          setCardState(prev => ({ ...prev, [key]: result }))
        }
      }
      reader.readAsDataURL(file)
    },
    [],
  )

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
      const fallbackName = cardState.name
        ? cardState.name.replace(/\s+/g, '_')
        : 'playercard'
      link.href = canvas.toDataURL('image/png')
      link.download = `${fallbackName}.png`
      link.click()
    } catch (err) {
      console.error(err)
      alert(
        'Download fehlgeschlagen. Bitte stelle eine Internetverbindung sicher und versuche es erneut.',
      )
    } finally {
      setDownloading(false)
    }
  }, [cardState.name])

  const background = useMemo(
    () =>
      PLAYER_CARD_BACKGROUNDS.find(bg => bg.id === cardState.backgroundId) ||
      PLAYER_CARD_BACKGROUNDS[0],
    [cardState.backgroundId],
  )

  const nationalityOption = findNationality(cardState.nationality)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 pb-16 pt-10 lg:flex-row">
        <section className="flex flex-1 flex-col items-center gap-6">
          <CardPreview
            ref={cardRef}
            state={cardState}
            background={background}
            nationality={nationalityOption?.flag ?? ''}
          />

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="btn min-w-[220px] px-10 py-3 text-lg disabled:opacity-70"
            >
              {downloading ? 'Wird vorbereitet…' : 'Playercard als PNG sichern'}
            </button>
            <a
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white hover:text-white"
              href="https://www.remove.bg/"
              target="_blank"
              rel="noreferrer"
            >
              Hintergrund entfernen (remove.bg)
            </a>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-300">{errorMessage}</p>
          )}
        </section>

        <Configurator
          cardState={cardState}
          onFieldChange={handleFieldChange}
          onStatChange={handleStatChange}
          onPhotoUpload={handlePhotoUpload}
          nationalityOption={nationalityOption?.code ?? ''}
          onPlayerPicker={() => setShowSelector(true)}
        />
      </div>

      {showSelector && (
        <PlayerSelectModal
          players={players}
          onClose={() => setShowSelector(false)}
          onSelect={playerId => setSelectedPlayerId(playerId)}
          loading={apiState === 'loading'}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Card Preview
// -----------------------------------------------------------------------------
type CardPreviewProps = {
  state: CardState
  background: PlayercardBackground
  nationality: string
}

const CardPreview = forwardRef<HTMLDivElement, CardPreviewProps>(
  ({ state, background, nationality }, ref) => {
    const statPairs = useMemo(() => {
      const pairs: StatField[][] = []
      for (let index = 0; index < STAT_FIELDS.length; index += 2) {
        pairs.push(STAT_FIELDS.slice(index, index + 2))
      }
      return pairs
    }, [])

    return (
      <div className="w-full max-w-[min(640px,90vw)]">
        <div
          ref={ref}
          className={cn(
            'relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-[64px] border border-white/12 shadow-[0_40px_100px_rgba(15,23,42,0.9)]',
            background.gradientClass,
            background.overlayClass,
          )}
          style={{
            maxWidth: '1080px',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/60" />

          <div className="relative flex h-full flex-col">
            <div className="relative flex-[2] overflow-hidden px-[6%] pt-[7%]">
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {state.photo ? (
                <img
                  src={state.photo}
                  alt={state.name || 'Spielerportrait'}
                  className="relative z-10 mx-auto h-full w-auto max-w-[92%] translate-y-[10%] object-contain"
                  style={{
                    filter: 'drop-shadow(0px 18px 36px rgba(8,9,16,0.55)) saturate(1.05)',
                    WebkitMaskImage:
                      'radial-gradient(circle at 50% 30%, black 55%, rgba(0,0,0,0.25) 72%, transparent 95%)',
                    maskImage:
                      'radial-gradient(circle at 50% 30%, black 55%, rgba(0,0,0,0.25) 72%, transparent 95%)',
                  }}
                />
              ) : (
                <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[48px] border-2 border-dashed border-white/30 text-center text-white/60 backdrop-blur-sm">
                  <p className="max-w-[80%] text-lg font-medium">
                    Lade ein freigestelltes Portrait hoch, um die Card zu füllen.
                  </p>
                </div>
              )}

              {state.clubLogo && (
                <div className="absolute left-[7%] top-[7%] flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-black/40 p-2 shadow-lg shadow-black/50">
                  <img
                    src={state.clubLogo}
                    alt="Vereinslogo"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}

              <div className="absolute right-[7%] top-[7%] flex flex-col items-end gap-3 text-right">
                <div className="rounded-full bg-black/35 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                  {state.position || 'Position'}
                </div>
                <div className="flex items-center gap-3 rounded-[32px] bg-white/15 px-6 py-3 text-white/95 backdrop-blur-sm">
                  <span className="text-5xl font-black leading-none">
                    {state.rating}
                  </span>
                  {nationality ? (
                    <span className="text-3xl leading-none">{nationality}</span>
                  ) : null}
                </div>
                {state.favouriteNumber && (
                  <div className="rounded-2xl bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
                    Nr. {state.favouriteNumber}
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex-[1] px-[8%] pb-[6%] pt-[4%]">
              <div className="absolute inset-0 rounded-[48px] bg-white/12 backdrop-blur-md" />
              <div className="relative z-10 flex h-full flex-col">
                <p
                  className="text-[56px] font-semibold italic text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.45)]"
                  style={{ fontFamily: "'Great Vibes', 'Pacifico', cursive" }}
                >
                  {state.name || 'Dein Name'}
                </p>

                <div className="mt-4 grid flex-1 grid-cols-2 gap-x-10 gap-y-3 text-base font-semibold text-white/90">
                  {statPairs.map((pair, index) => (
                    <div key={index} className="flex flex-col gap-3">
                      {pair.map(stat => (
                        <div
                          key={stat.key}
                          className="flex items-center justify-between rounded-full bg-white/10 px-4 py-2 text-sm uppercase tracking-[0.2em]"
                        >
                          <span className="text-[0.75rem] text-white/70">
                            {stat.label}
                          </span>
                          <span className="text-xl text-white">
                            {state.stats[stat.key] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.45em] text-white/75">
                  <span className="truncate">
                    {state.club || 'Verein deiner Wahl'}
                  </span>
                  <span>{state.seasonLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)
CardPreview.displayName = 'CardPreview'

// -----------------------------------------------------------------------------
// Konfigurator
// -----------------------------------------------------------------------------
type ConfiguratorProps = {
  cardState: CardState
  onFieldChange: <K extends keyof CardState>(key: K, value: CardState[K]) => void
  onStatChange: (key: StatKey, value: number) => void
  onPhotoUpload: (file: File, key: 'photo' | 'clubLogo') => void
  nationalityOption: string
  onPlayerPicker: () => void
}

function Configurator({
  cardState,
  onFieldChange,
  onStatChange,
  onPhotoUpload,
  nationalityOption,
  onPlayerPicker,
}: ConfiguratorProps) {
  const handleInput = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = event.target
      const key = name as keyof CardState
      if (key === 'rating') {
        onFieldChange(key, Number(value))
        return
      }
      if (key === 'nationality') {
        onFieldChange(key, value.toUpperCase() as CardState[typeof key])
        return
      }
      onFieldChange(key, value as CardState[typeof key])
    },
    [onFieldChange],
  )

  const handleStatInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target
      onStatChange(name as StatKey, Number(value))
    },
    [onStatChange],
  )

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files, dataset } = event.target
      if (!files || !files[0] || !dataset.key) return
      onPhotoUpload(files[0], dataset.key as 'photo' | 'clubLogo')
    },
    [onPhotoUpload],
  )

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault()
  }, [])

  return (
    <aside className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(8,12,30,0.6)] backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">
            Spieler auswählen
          </p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:text-white"
            onClick={onPlayerPicker}
          >
            Aktive Liste öffnen
          </button>
        </div>
        <Link
          href="/projects"
          className="text-xs uppercase tracking-[0.3em] text-white/50 transition hover:text-white"
        >
          Zurück zu Projekten
        </Link>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
            Stammdaten
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Spielername
              <input
                className="input"
                name="name"
                value={cardState.name}
                onChange={handleInput}
                placeholder="Pflichtfeld"
                required
              />
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Verein
              <input
                className="input"
                name="club"
                value={cardState.club}
                onChange={handleInput}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Lieblingsnummer
              <input
                className="input"
                name="favouriteNumber"
                value={cardState.favouriteNumber}
                onChange={handleInput}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Position
              <select
                className="input"
                name="position"
                value={cardState.position}
                onChange={handleInput}
              >
                <option value="">Wählen…</option>
                {PLAYER_POSITIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Nationalität
              <select
                className="input"
                name="nationality"
                value={nationalityOption}
                onChange={handleInput}
              >
                <option value="">Wählen…</option>
                {NATIONALITIES.map(option => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Gesamtrating
              <input
                type="number"
                min={1}
                max={99}
                className="input"
                name="rating"
                value={cardState.rating}
                onChange={handleInput}
              />
            </label>
            <label className="space-y-2 text-xs uppercase tracking-[0.25em] text-white/60">
              Saison/Datum
              <input
                className="input"
                name="seasonLabel"
                value={cardState.seasonLabel}
                onChange={handleInput}
                placeholder="z. B. April 2024"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
            Portrait & Logo
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ImageUploadField
              label="Playerportrait"
              helper="Vor Upload Hintergrund entfernen"
              dataKey="photo"
              onChange={handleFileInput}
            />
            <ImageUploadField
              label="Vereinslogo"
              helper="PNG oder SVG"
              dataKey="clubLogo"
              onChange={handleFileInput}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
            Leistungswerte
          </h2>
          <div className="space-y-4">
            {STAT_FIELDS.map(stat => (
              <StatSlider
                key={stat.key}
                stat={stat}
                value={cardState.stats[stat.key]}
                onChange={handleStatInput}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
            Hintergrund
          </h2>
          <BackgroundPicker
            selectedId={cardState.backgroundId}
            onSelect={backgroundId => onFieldChange('backgroundId', backgroundId)}
          />
        </section>
      </form>
    </aside>
  )
}

// -----------------------------------------------------------------------------
// Unterkomponenten
// -----------------------------------------------------------------------------
type StatSliderProps = {
  stat: { key: StatKey; label: string }
  value: number
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function StatSlider({ stat, value, onChange }: StatSliderProps) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
        <span>{stat.label}</span>
        <span className="text-white/90">{value}</span>
      </div>
      <input
        className="w-full accent-pink-500"
        type="range"
        name={stat.key}
        min={10}
        max={99}
        step={1}
        value={value}
        onChange={onChange}
      />
    </label>
  )
}

type BackgroundPickerProps = {
  selectedId: string
  onSelect: (backgroundId: string) => void
}

function BackgroundPicker({ selectedId, onSelect }: BackgroundPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {PLAYER_CARD_BACKGROUNDS.map(background => (
        <button
          key={background.id}
          type="button"
          onClick={() => onSelect(background.id)}
          className={cn(
            'group relative flex aspect-[9/16] items-end overflow-hidden rounded-3xl border border-white/20 p-3 text-left transition-transform hover:-translate-y-1 hover:shadow-lg',
            selectedId === background.id
              ? 'ring-4 ring-offset-2 ring-offset-slate-900 ring-white/70'
              : 'opacity-80',
          )}
        >
          <span className="relative z-10 text-xs font-semibold uppercase tracking-[0.25em] text-white">
            {background.name}
          </span>
          <span className="absolute inset-0 opacity-100 transition-opacity group-hover:opacity-80" />
          <span
            className={cn(
              'absolute inset-0 opacity-90',
              background.gradientClass,
              background.overlayClass,
            )}
          />
        </button>
      ))}
    </div>
  )
}

type ImageUploadFieldProps = {
  label: string
  helper: string
  dataKey: 'photo' | 'clubLogo'
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function ImageUploadField({ label, helper, dataKey, onChange }: ImageUploadFieldProps) {
  return (
    <label className="flex h-full flex-col rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-xs uppercase tracking-[0.25em] text-white/60">
      {label}
      <span className="mt-2 flex-1 text-[0.65rem] text-white/40 normal-case">
        {helper}
      </span>
      <input
        type="file"
        accept="image/*"
        className="mt-4 text-xs"
        data-key={dataKey}
        onChange={onChange}
      />
    </label>
  )
}

type PlayerSelectModalProps = {
  players: Player[]
  onClose: () => void
  onSelect: (playerId: string) => void
  loading: boolean
}

function PlayerSelectModal({ players, onClose, onSelect, loading }: PlayerSelectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Spieler auswählen</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/60 transition hover:text-white"
          >
            Schließen
          </button>
        </div>
        {loading ? (
          <p className="py-10 text-center text-white/60">Spieler werden geladen…</p>
        ) : players.length === 0 ? (
          <div className="space-y-4 py-10 text-center text-white/60">
            <p>Für dieses Projekt sind noch keine Spieler hinterlegt.</p>
            <Link
              href="/projects"
              className="text-sm font-semibold text-white underline decoration-dashed"
            >
              Zurück zur Übersicht
            </Link>
          </div>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-2">
            {players.map(player => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => onSelect(player.id)}
                  className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left text-sm transition hover:bg-white/10"
                >
                  <span className="font-semibold">{player.display_name}</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                    {player.fav_position || '–'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    html2canvas?: Html2CanvasFn
  }
}
