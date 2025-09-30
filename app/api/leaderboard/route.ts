import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
export const dynamic = 'force-dynamic'

type Station = {
  id: string; name: string; unit: string | null;
  min_value: number | null; max_value: number | null; higher_is_better: boolean | null
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
function scoreFor(st: Station, raw: number): number {
  const name = (st.name || '').toLowerCase()
  if (name.includes('passgenauigkeit')) return clamp((raw / 10) * 100, 0, 100)
  if (name.includes('schusspräzision')) return clamp((raw / 24) * 100, 0, 100)
  if (name.includes('schusskraft')) return clamp((Math.min(raw, 150) / 150) * 100, 0, 100)
  const minv = st.min_value ?? 0, maxv = st.max_value ?? 1, hib = st.higher_is_better ?? true
  if (maxv === minv) return 0
  return hib ? clamp(((raw - minv) / (maxv - minv)) * 100, 0, 100)
             : clamp(((maxv - raw) / (maxv - minv)) * 100, 0, 100)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const projectId = url.searchParams.get('project') // optional

  // Grunddaten laden
  const [playersQ, stationsQ, measQ, projectsQ] = await Promise.all([
    supabaseAdmin.from('players').select('id, display_name, fav_position, club, project_id' + (projectId ? '' : ', project_id')),
    supabaseAdmin.from('stations').select('id, name, unit, min_value, max_value, higher_is_better' + (projectId ? '' : ', project_id')),
    supabaseAdmin.from('measurements').select('player_id, station_id, value' + (projectId ? '' : ', project_id')),
    supabaseAdmin.from('projects').select('id,name')
  ])

  // Fehler?
  const err = playersQ.error || stationsQ.error || measQ.error || projectsQ.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  // ggf. filtern
  const players = (playersQ.data ?? []).filter(p => !projectId || p.project_id === projectId)
  const stations = (stationsQ.data ?? []).filter(s => !projectId || (s as any).project_id === projectId)
  const meas = (measQ.data ?? []).filter(m => !projectId || (m as any).project_id === projectId)

  const projectName = (id: string) => projectsQ.data?.find(p => p.id === id)?.name ?? 'Unbekannt'
  const stById = new Map<string, Station>()
  stations.forEach(s => stById.set(s.id, s as Station))

  const byPlayer: Record<string, { total: number; per: Record<string, number> }> = {}
  meas.forEach(m => {
    const st = stById.get(m.station_id); if (!st) return
    const n = scoreFor(st, Number(m.value ?? 0))
    const p = (byPlayer[m.player_id] ||= { total: 0, per: {} })
    p.total += n
    p.per[st.name] = n
  })

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

  return NextResponse.json({ scope: projectId ? 'project' : 'global', projectId, items: rows.map((r, i) => ({ rank: i + 1, ...r })) })
}
