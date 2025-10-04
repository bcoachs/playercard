import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/** GET: Messungen eines Projekts (optional gefiltert auf Station) */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const station = req.nextUrl.searchParams.get('station')
  const q = supabaseAdmin
    .from('measurements')
    .select('id, player_id, station_id, value')
    .eq('project_id', params.id)

  const { data, error } = station ? await q.eq('station_id', station) : await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

/** POST: Messwert upsert (pro player_id+station_id) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const form = await req.formData()
  const project_id = params.id
  const player_id  = String(form.get('player_id') || '')
  const station_id = String(form.get('station_id') || '')
  const value      = Number(form.get('value') || 0)

  if (!player_id || !station_id) {
    return NextResponse.json({ error: 'player_id/station_id fehlt' }, { status: 400 })
  }

  // Gibt es schon einen Messwert?
  const { data: exist, error: qErr } = await supabaseAdmin
    .from('measurements')
    .select('id')
    .eq('project_id', project_id)
    .eq('player_id', player_id)
    .eq('station_id', station_id)
    .maybeSingle()

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  if (exist?.id) {
    const { error: uErr } = await supabaseAdmin
      .from('measurements')
      .update({ value })
      .eq('id', exist.id)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  } else {
    const { error: iErr } = await supabaseAdmin
      .from('measurements')
      .insert({ project_id, player_id, station_id, value })
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
