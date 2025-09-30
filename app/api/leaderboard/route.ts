import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type Station = {
  id: string
  name: string
  unit: string | null
  min_value: number | null
  max_value: number | null
  higher_is_better: boolean | null
}

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
  const projectId = new URL(req.url).searchParams.get('project')
  if (!projectId) return NextResponse.json({ error: 'missing project' }, { status: 400 })

  const [{ data: players, error: pErr }, { data: stations, error: sErr }, { data: meas, error: mErr }] =
    await Promise.all([
      supabaseAdmin.from('players').select('id, display_name, fav_position, club').eq('project_id', projectId),
      supabaseAdmin.from('stations').select('id, name, unit, min_value, max_value, higher_is_better').eq('project_id', projectId),
      supabaseAdmin.from('measurements').select('player_id, station_id, value').eq('project_id', projectId)
    ])
  if (pErr || sErr || mErr) return NextResponse.json({ error: pErr?.message || sErr?.message || mErr?.message }, { status: 500 })

  const stById = new Map<string, Station>()
  stations?.forEach(s => stById.set(s.id, s as Station))

  const byPlayer: Record<string, { total: number; per: Record<string, number> }> = {}
  meas?.forEach(m => {
    const st = stById.get(m.station_id); if (!st) return
    const n = scoreFor(st, Number(m.value ?? 0))
    const p = (byPlayer[m.player_id] ||= { total: 0, per: {} })
    p.total += n
    p.per[st.name] = n
  })

  const rows = (players || []).map(pl => ({
    playerId: pl.id,
    name: pl.display_name,
    club: pl.club,
    pos: pl.fav_position,
    totalScore: Math.round(byPlayer[pl.id]?.total || 0),
    perStation: byPlayer[pl.id]?.per || {}
  }))
  rows.sort((a, b) => b.totalScore - a.totalScore)
  return NextResponse.json({ projectId, items: rows.map((r, i) => ({ rank: i + 1, ...r })) })
}
