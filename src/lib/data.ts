export type MetricKey =
  | 'agility'
  | 'technique'
  | 'passing'
  | 'shot_power'
  | 'shot_accuracy'
  | 'speed'

export interface RawMetrics {
  agility: number | null
  technique: number | null
  passing: number | null
  shot_power: number | null
  shot_accuracy: number | null
  speed: number | null
}

export interface StationSummary {
  id: string
  name: string
  unit: string | null
  min_value: number | null
  max_value: number | null
  higher_is_better: boolean | null
}

export interface MeasurementRow {
  player_id: string
  station_id: string
  value: number | null | undefined
}

export type PlayerStationAverages = Record<string, Record<string, number>>

const METRIC_PATTERNS: [MetricKey, RegExp][] = [
  ['agility', /beweglichkeit|agility/i],
  ['technique', /technik|technical/i],
  ['passing', /passgenauigkeit|pass/i],
  ['shot_power', /schusskraft|shot.?power|power/i],
  ['shot_accuracy', /schusspr[äa]zision|shot.?accuracy|accuracy/i],
  ['speed', /schnelligkeit|speed|sprint/i],
]

export function emptyRawMetrics(): RawMetrics {
  return {
    agility: null,
    technique: null,
    passing: null,
    shot_power: null,
    shot_accuracy: null,
    speed: null,
  }
}

export function buildPlayerStationAverages(measurements: MeasurementRow[]): PlayerStationAverages {
  const sums: Record<string, Record<string, { sum: number; count: number }>> = {}

  for (const measurement of measurements) {
    const { player_id, station_id } = measurement
    const value = Number(measurement.value)
    if (!player_id || !station_id || !Number.isFinite(value)) continue

    if (!sums[player_id]) {
      sums[player_id] = {}
    }
    if (!sums[player_id][station_id]) {
      sums[player_id][station_id] = { sum: 0, count: 0 }
    }

    const entry = sums[player_id][station_id]
    entry.sum += value
    entry.count += 1
  }

  const averages: PlayerStationAverages = {}
  for (const playerId of Object.keys(sums)) {
    const stations = sums[playerId]
    averages[playerId] = {}
    for (const stationId of Object.keys(stations)) {
      const { sum, count } = stations[stationId]
      averages[playerId][stationId] = count > 0 ? sum / count : 0
    }
  }

  return averages
}

export function resolveMetricKey(stationName: string | null | undefined): MetricKey | null {
  if (!stationName) return null
  for (const [key, pattern] of METRIC_PATTERNS) {
    if (pattern.test(stationName)) return key
  }
  return null
}

export function measurementsToRawMetrics(
  stations: StationSummary[],
  stationValues: Record<string, number> | undefined,
): RawMetrics {
  const metrics = emptyRawMetrics()
  const collected: Record<MetricKey, number[]> = {
    agility: [],
    technique: [],
    passing: [],
    shot_power: [],
    shot_accuracy: [],
    speed: [],
  }

  for (const station of stations) {
    const raw = stationValues?.[station.id]
    if (typeof raw !== 'number' || Number.isNaN(raw)) continue
    const metricKey = resolveMetricKey(station.name)
    if (!metricKey) continue
    collected[metricKey].push(raw)
  }

  (Object.keys(collected) as MetricKey[]).forEach(key => {
    const values = collected[key]
    if (!values.length) {
      metrics[key] = null
      return
    }
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    metrics[key] = Number.isFinite(avg) ? avg : null
  })

  return metrics
}
