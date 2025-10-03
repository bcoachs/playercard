import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const station = req.nextUrl.searchParams.get('station')
  const q = supabaseAdmin
    .from('measurements')
    .select('player_id,station_id,value')
    .eq('project_id', params.id)
  const { data, error } = station ? await q.eq('station_id', station) : await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const form = await req.formData()
  const project_id = params.id
  const player_id  = String(form.get('player_id') || '')
  const station_id = String(form.get('station_id') || '')
  const value      = Number(form.get('value') || NaN)
  if (!player_id || !station_id || Number.isNaN(value)) {
    return new NextResponse('player_id, station_id, value required', { status: 400 })
  }

  // Upsert: existiert bereits Messung? -> update, sonst insert
  const { data: existing } = await supabaseAdmin
    .from('measurements')
    .select('id')
    .eq('project_id', project_id)
    .eq('player_id', player_id)
    .eq('station_id', station_id)
    .maybeSingle()

  if (existing?.id) {
    const { error: uErr } = await supabaseAdmin
      .from('measurements')
      .update({ value })
      .eq('id', existing.id)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  } else {
    const { error: iErr } = await supabaseAdmin
      .from('measurements')
      .insert({ project_id, player_id, station_id, value })
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
