// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type Player  = { id: string; display_name: string; fav_position: string | null; club: string | null; project_id: string }
type Station = { id: string; name: string; unit: string | null; min_value: number | null; max_value: number | null; higher_is_better: boolean | null; project_id: string }
type Meas    = { player_id: string; station_id: string; value: number; project_id: string }
type Project = { id: string; name: string }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function scoreFor(st: Station, raw: number): number {
  const name = (st.name || '').toLowerCase()
  if (name.includes('passgenauigkeit')) return clamp((raw / 10) * 100, 0, 100)
  if (name.includes('schusspräzision')) return clamp((raw / 24) * 100, 0, 100)
  if (name.includes('schusskraft')) return clamp((Math.min(raw, 150) / 150) * 100, 0, 100)
  const minv = st.min_value ?? 0, maxv = st.max_value ?? 1, hib = st.higher_is_better ?? true
  if (maxv === minv) return 0
  return hib
    ? clamp(((raw - minv) / (maxv - minv)) * 100, 0, 100)
    : clamp(((maxv - raw) / (maxv - minv)) * 100, 0, 100)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const projectId = url.searchParams.get('project')

  // Queries vorbereiten (optional mit .eq Filter)
  let playersQ  = supabaseAdmin.from('players')
    .select('id, display_name, fav_position, club, project_id')
  let stationsQ = supabaseAdmin.from('stations')
    .select('id, name, unit, min_value, max_value, higher_is_better, project_id')
  let measQ     = supabaseAdmin.from('measurements')
    .select('player_id, station_id, value, project_id')

  if (projectId) {
    playersQ  = playersQ.eq('project_id', projectId)
    stationsQ = stationsQ.eq('project_id', projectId)
    measQ     = measQ.eq('project_id', projectId)
  }

  const [playersRes, stationsRes, measRes, projectsRes] = await Promise.all([
    playersQ, stationsQ, measQ,
    supabaseAdmin.from('projects').select('id,name')
  ])

  const err = playersRes.error || stationsRes.error || measRes.error || projectsRes.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  const players  = (playersRes.data  ?? []) as Player[]
  const stations = (stationsRes.data ?? []) as Station[]
  const meas     = (measRes.data     ?? []) as Meas[]
  const projects = (projectsRes.data ?? []) as Project[]

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? 'Unbekannt'

  const stById = new Map<string, Station>()
  stations.forEach(s => stById.set(s.id, s))

  const byPlayer: Record<string, { total: number; per: Record<string, number> }> = {}
  for (const m of meas) {
    const st = stById.get(m.station_id); if (!st) continue
    const n = scoreFor(st, Number(m.value ?? 0))
    const p = (byPlayer[m.player_id] ||= { total: 0, per: {} })
    p.total += n
    p.per[st.name] = n
  }

  const rows = players.map(pl => ({
    playerId: pl.id,
    projectId: pl.project_id,
    projectName: projectName(pl.project_id),
    name: pl.display_name,
    club: pl.club,
    pos: pl.fav_position,
    totalScore: Math.round(byPlayer[pl.id]?.total || 0),
    perStation: byPlayer[pl.id]?.per || {}
  }))
  rows.sort((a, b) => b.totalScore - a.totalScore)

  return NextResponse.json({
    scope: projectId ? 'project' : 'global',
    projectId: projectId ?? null,
    items: rows.map((r, i) => ({ rank: i + 1, ...r }))
  })
}
