import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buildPlayerPerformances,
  sortStationsForPerformance,
  type PlayerPerformanceEntry,
} from '@/lib/playerPerformance'
import { loadS1ScoreMap, loadS4ScoreMap, loadS6ScoreMap } from '@/lib/scoreMapsServer'
import type { ScoreDependencies } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

const USE_S1_CSV = (() => {
  const value = process.env.NEXT_PUBLIC_USE_S1_CSV
  if (value === '0' || value === 'false') return false
  return true
})()

const USE_S6_CSV = (() => {
  const value = process.env.NEXT_PUBLIC_USE_S6_CSV
  if (value === '0' || value === 'false') return false
  return true
})()

const USE_S4_CSV = (() => {
  const value = process.env.NEXT_PUBLIC_USE_S4_CSV
  if (value === '0' || value === 'false') return false
  return true
})()

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = params.id

  const [
    { data: proj, error: pErr },
    { data: stations, error: sErr },
    { data: players, error: plErr },
    { data: meas, error: mErr },
  ] = await Promise.all([
    supabaseAdmin.from('projects').select('id,name,date,logo_url').eq('id', projectId).single(),
    supabaseAdmin
      .from('stations')
      .select('id,name,unit,min_value,max_value,higher_is_better')
      .eq('project_id', projectId)
      .order('name'),
    supabaseAdmin
      .from('players')
      .select('*')
      .eq('project_id', projectId)
      .order('display_name'),
    supabaseAdmin.from('measurements').select('player_id,station_id,value').eq('project_id', projectId),
  ])

  if (pErr || sErr || plErr || mErr) {
    return NextResponse.json({ error: pErr?.message || sErr?.message || plErr?.message || mErr?.message }, { status: 500 })
  }

  const matrix: Record<string, Record<string, boolean>> = {}
  for (const m of meas ?? []) {
    matrix[m.player_id] ||= {}
    matrix[m.player_id][m.station_id] = true
  }

  const stationSummaries = (stations ?? []).map(station => ({
    id: station.id,
    name: station.name,
    unit: station.unit,
    min_value: station.min_value,
    max_value: station.max_value,
    higher_is_better: station.higher_is_better,
  }))

  const sortedStations = sortStationsForPerformance(stationSummaries)
  const eventYear = proj?.date ? Number(String(proj.date).slice(0, 4)) || new Date().getFullYear() : new Date().getFullYear()

  let s1Female: ScoreDependencies['s1Female'] = null
  let s1Male: ScoreDependencies['s1Male'] = null
  let s6Female: ScoreDependencies['s6Female'] = null
  let s6Male: ScoreDependencies['s6Male'] = null
  let s4Map: ScoreDependencies['s4Map'] = null

  if (USE_S1_CSV) {
    const [female, male] = await Promise.all([loadS1ScoreMap('female'), loadS1ScoreMap('male')])
    s1Female = female
    s1Male = male
  }

  if (USE_S6_CSV) {
    const [female, male] = await Promise.all([loadS6ScoreMap('female'), loadS6ScoreMap('male')])
    s6Female = female
    s6Male = male
  }

  if (USE_S4_CSV) {
    s4Map = await loadS4ScoreMap()
  }

  const scoreDeps: ScoreDependencies = {
    eventYear,
    s1Female: s1Female ?? undefined,
    s1Male: s1Male ?? undefined,
    s6Female: s6Female ?? undefined,
    s6Male: s6Male ?? undefined,
    s4Map: s4Map ?? undefined,
  }

  const measurementRows = (meas ?? []).map(entry => ({
    player_id: entry.player_id,
    station_id: entry.station_id,
    value: entry.value,
  }))

  const scoringPlayers = (players ?? []).map(player => ({
    id: player.id,
    birth_year: player.birth_year ?? null,
    gender: player.gender ?? null,
  }))

  let performances: Record<string, PlayerPerformanceEntry> = {}
  if (scoringPlayers.length && sortedStations.length) {
    performances = buildPlayerPerformances({
      players: scoringPlayers,
      stations: sortedStations,
      measurements: measurementRows,
      scoreDeps,
    })
  }

  return NextResponse.json({ project: proj, stations: sortedStations, players, matrix, performances })
}
