import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id
  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get('playerId') || searchParams.get('player') || null

  const query = supabaseAdmin
    .from('measurements')
    .select('id, project_id, player_id, station_id, value, entered_at')
    .eq('project_id', project_id)
    .order('entered_at', { ascending: false })

  if (playerId) {
    query.eq('player_id', playerId)
  }

  const { data, error } = await query

  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id
  const form = await req.formData()
  const player_id = String(form.get('player_id') || '')
  const station_id = String(form.get('station_id') || '')
  const value = Number(form.get('value') || 0)

  if (!player_id || !station_id)
    return new NextResponse('player_id und station_id sind erforderlich', { status: 400 })

  // Upsert dank UNIQUE(project_id,player_id,station_id)
  const { data, error } = await supabaseAdmin
    .from('measurements')
    .upsert(
      { project_id, player_id, station_id, value, entered_at: new Date().toISOString() },
      { onConflict: 'project_id,player_id,station_id' }
    )
    .select()

  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ item: data?.[0] ?? null })
}
