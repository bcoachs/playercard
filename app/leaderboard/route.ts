import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type Station = {
  id: string
  name: string
  unit: string | null
  min_value: number | null
  max_value: number | null
  higher_is_better: boolean | null
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function scoreFor(st: Station, raw: number): number {
  const name = st.name.toLowerCase()
  // Spezialfälle nach deiner Logik:
  if (name.includes('passgenauigkeit')) {
    // weighted hits 0..10 → 0..100
    return clamp((raw / 10) * 100, 0, 100)
  }
  if (name.includes('schusspräzision')) {
    // top=3, bottom=1 → max 24 → 0..100
    return clamp((raw / 24) * 100, 0, 100)
  }
  if (name.includes('schusskraft')) {
    // cap 150 km/h
    return clamp((Math.min(raw, 150) / 150) * 100, 0, 100)
  }

  // Generisch: linear min..max, ggf. invertiert
  const minv = st.min_value ?? 0
  const maxv = st.max_value ?? 1
  const hib  = st.higher_is_better ?? true
  if (maxv === minv) return 0
  if (hib) {
    return clamp(((raw - minv) / (maxv - minv)) * 100, 0, 100)
  } else {
    return clamp(((maxv - raw) / (maxv - minv)) * 100, 0, 100)
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project')
  if (!projectId) {
    return NextResponse.json({ error: 'missing project' }, { status: 400 })
  }

  // Basisdaten holen
  const [{ data: players, error: pErr }, { data: stations, error: sErr }, { data: meas, error: mErr }] =
    await Promise.all([
      supabaseAdmin.from('players').select('id, display_name, fav_position, club').eq('project_id', projectId),
      supabaseAdmin.from('stations').select('id, name, unit, min_value, max_value, higher_is_better').eq('project_id', projectId),
      supabaseAdmin.from('measurements').select('player_id, station_id, value').eq('project_id', projectId)
    ])

  if (pErr || sErr || mErr) {
    const msg = pErr?.message || sErr?.message || mErr?.message || 'db error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const stationById = new Map<string, Station>()
  stations?.forEach(s => stationById.set(s.id, s as Station))

  // pro Spieler aggregieren
  const byPlayer: Record<string, { total: number; count: number; per: Record<string, number> }> = {}
  meas?.forEach(m => {
    const st = stationById.get(m.station_id)
    if (!st) return
    const norm = scoreFor(st, Number(m.value ?? 0))
    const p = (byPlayer[m.player_id] ||= { total: 0, count: 0, per: {} })
    p.total += norm
    p.count += 1
    p.per[st.name] = norm
  })

  const rows = (players || []).map(pl => {
    const agg = byPlayer[pl.id] || { total: 0, count: 0, per: {} }
    const totalScore = agg.total // Summe (bei 6 Stationen max 600)
    return {
      playerId: pl.id,
      name: pl.display_name,
      club: pl.club,
      pos: pl.fav_position,
      totalScore: Math.round(totalScore),
      perStation: agg.per
    }
  })

  // Ranking absteigend
  rows.sort((a, b) => b.totalScore - a.totalScore)
  const withRank = rows.map((r, i) => ({ rank: i + 1, ...r }))

  return NextResponse.json({ projectId, items: withRank })
}
