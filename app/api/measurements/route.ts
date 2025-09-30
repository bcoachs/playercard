import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { project_id, player_id, station_id, value } = body || {}
  if (!project_id || !player_id || !station_id || typeof value !== 'number' || Number.isNaN(value)) {
    return new NextResponse('Ungültige Daten', { status: 400 })
  }
  const { error } = await supabaseAdmin.from('measurements').insert({ project_id, player_id, station_id, value })
  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ ok: true })
}
