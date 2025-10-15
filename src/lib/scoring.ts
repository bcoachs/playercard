import type { StationSummary } from './data'

export type ScoreMap = Record<string, number[]>

export interface PlayerForScoring {
  birth_year: number | null
  gender?: string | null
}

export interface ScoreDependencies {
  eventYear: number
  s1Female?: ScoreMap | null
  s1Male?: ScoreMap | null
  s6Female?: ScoreMap | null
  s6Male?: ScoreMap | null
  s4Map?: ScoreMap | null
}

export function normalizeGender(
  value: PlayerForScoring['gender'] | string | null | undefined,
): 'male' | 'female' | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (
    normalized === 'male' ||
    normalized === 'm' ||
    normalized === 'mann' ||
    normalized === 'männlich' ||
    normalized === 'maennlich' ||
    normalized === 'herr' ||
    normalized === 'boy'
  ) {
    return 'male'
  }
  if (
    normalized === 'female' ||
    normalized === 'f' ||
    normalized === 'frau' ||
    normalized === 'weiblich' ||
    normalized === 'weibl' ||
    normalized === 'mädchen' ||
    normalized === 'maedchen' ||
    normalized === 'girl' ||
    normalized === 'w'
  ) {
    return 'female'
  }
  return null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normScore(station: StationSummary, raw: number): number {
  const min = station.min_value ?? 0
  const max = station.max_value ?? 100
  if (max === min) return 0
  if (station.higher_is_better) {
    return Math.round(clamp((raw - min) / (max - min), 0, 1) * 100)
  }
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

function resolveAge(eventYear: number, birthYear: number | null): number {
  if (!birthYear) return 16
  return Math.max(6, Math.min(49, eventYear - birthYear))
}

export function scoreForStation(
  station: StationSummary,
  player: PlayerForScoring,
  raw: number,
  deps: ScoreDependencies,
): number {
  const n = station.name.toLowerCase()
  const gender = normalizeGender(player.gender)
  const age = resolveAge(deps.eventYear, player.birth_year)

  if (n.includes('beweglichkeit')) {
    if (deps.s1Female || deps.s1Male) {
      const map = gender === 'male' ? deps.s1Male : deps.s1Female
      if (map) {
        const keys = Object.keys(map)
        if (keys.length) {
          const bucket = nearestAgeBucket(age, keys)
          const rows = map[bucket] || []
          if (rows.length) return scoreFromTimeStep(Number(raw), rows)
        }
      }
    }
    return normScore({ ...station, min_value: 10, max_value: 40, higher_is_better: false }, Number(raw))
  }

  if (n.includes('schnelligkeit')) {
    if (deps.s6Female || deps.s6Male) {
      const map = gender === 'male' ? deps.s6Male : deps.s6Female
      if (map) {
        const keys = Object.keys(map)
        if (keys.length) {
          const bucket = nearestAgeBucket(age, keys)
          const rows = map[bucket] || []
          if (rows.length) return scoreFromTimeStep(Number(raw), rows)
        }
      }
    }
    return normScore({ ...station, min_value: 4, max_value: 20, higher_is_better: false }, Number(raw))
  }

  if (n.includes('schusskraft')) {
    if (deps.s4Map) {
      const keys = Object.keys(deps.s4Map)
      if (keys.length) {
        const bucket = nearestAgeBucket(age, keys)
        const rows = deps.s4Map[bucket] || []
        if (rows.length) return scoreFromSpeedStep(Number(raw), rows)
      }
    }
    return normScore({ ...station, min_value: 0, max_value: 150, higher_is_better: true }, Number(raw))
  }

  if (n.includes('passgenauigkeit')) {
    return Math.round(clamp(Number(raw), 0, 100))
  }

  if (n.includes('schusspräzision')) {
    const pct = clamp(Number(raw) / 24, 0, 1)
    return Math.round(pct * 100)
  }

  return Math.round(normScore(station, Number(raw)))
}

export function aggregateScore(values: (number | null)[]): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!finite.length) return null
  const sum = finite.reduce((total, value) => total + value, 0)
  return Math.round(sum / finite.length)
}
