import { aggregateScore, scoreForStation, type ScoreDependencies } from './scoring'
import { buildPlayerStationAverages, type MeasurementRow, type StationSummary } from './data'

export const STAT_ORDER = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
] as const

export type StationForPerformance = StationSummary & { id: string; name: string }

export type PlayerForPerformance = {
  id: string
  birth_year: number | null
  gender?: string | null
}

export type PlayerStatEntry = {
  id: string
  label: string
  raw: number | null
  score: number | null
  unit: string | null | undefined
}

export type PlayerPerformanceEntry = {
  stats: PlayerStatEntry[]
  totalScore: number | null
}

export function sortStationsForPerformance<T extends StationForPerformance>(stations: T[]): T[] {
  const order = new Map<(typeof STAT_ORDER)[number], number>()
  STAT_ORDER.forEach((label, index) => {
    order.set(label, index)
  })
  return stations.slice().sort((a, b) => {
    const ia = order.get(a.name as (typeof STAT_ORDER)[number]) ?? 99
    const ib = order.get(b.name as (typeof STAT_ORDER)[number]) ?? 99
    return ia - ib
  })
}

export function buildPlayerPerformances({
  players,
  stations,
  measurements,
  scoreDeps,
}: {
  players: PlayerForPerformance[]
  stations: StationForPerformance[]
  measurements: MeasurementRow[]
  scoreDeps: ScoreDependencies
}): Record<string, PlayerPerformanceEntry> {
  if (players.length === 0 || stations.length === 0) {
    return {}
  }

  const averages = buildPlayerStationAverages(measurements)
  const result: Record<string, PlayerPerformanceEntry> = {}

  for (const player of players) {
    const perStation: PlayerStatEntry[] = stations.map(station => {
      const raw = averages[player.id]?.[station.id]
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        return {
          id: station.id,
          label: station.name,
          raw: null,
          score: null,
          unit: station.unit,
        }
      }

      const score = scoreForStation(station, player, raw, scoreDeps)
      return {
        id: station.id,
        label: station.name,
        raw,
        score,
        unit: station.unit,
      }
    })

    result[player.id] = {
      stats: perStation,
      totalScore: aggregateScore(perStation.map(entry => entry.score)),
    }
  }

  return result
}
