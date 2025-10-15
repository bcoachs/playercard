import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = params.id

  const [{ data: proj, error: pErr }, { data: stations, error: sErr }, { data: players, error: plErr }, { data: meas, error: mErr }] =
    await Promise.all([
      supabaseAdmin.from('projects').select('id,name,date,logo_url').eq('id', projectId).single(),
      supabaseAdmin.from('stations').select('id,name,unit').eq('project_id', projectId).order('name'),
      supabaseAdmin
        .from('players')
        .select(
          'id,display_name,club,fav_position,fav_number,birth_year,nationality,photo_url,club_logo_url,club_logo,number',
        )
        .eq('project_id', projectId)
        .order('display_name'),
      supabaseAdmin.from('measurements').select('player_id,station_id').eq('project_id', projectId)
    ])
  if (pErr || sErr || plErr || mErr) {
    return NextResponse.json({ error: pErr?.message || sErr?.message || plErr?.message || mErr?.message }, { status: 500 })
  }

  const matrix: Record<string, Record<string, boolean>> = {}
  for (const m of (meas ?? [])) {
    matrix[m.player_id] ||= {}
    matrix[m.player_id][m.station_id] = true
  }

  return NextResponse.json({ project: proj, stations, players, matrix })
}
