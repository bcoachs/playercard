import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../src/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project')
  if (!projectId) return NextResponse.json({ error: 'missing project' }, { status: 400 })

  const [players, stations] = await Promise.all([
    supabaseAdmin.from('players').select('id,display_name,fav_position,club').eq('project_id', projectId).order('display_name'),
    supabaseAdmin.from('stations').select('id,name,unit').eq('project_id', projectId).order('name')
  ])
  if (players.error || stations.error) {
    return NextResponse.json({ error: players.error?.message || stations.error?.message || 'db error' }, { status: 500 })
  }
  return NextResponse.json({ players: players.data, stations: stations.data })
}
