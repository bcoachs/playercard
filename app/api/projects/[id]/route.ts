// app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/projects/:id  → Projektdetails + Counts (players, stations, measurements)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id

  const [{ data: project, error: pErr }, { count: playerCount, error: plErr }, { count: stationCount, error: stErr }, { count: measCount, error: mErr }] =
    await Promise.all([
      supabaseAdmin
        .from('projects')
        .select('id,name,date,logo_url,brand_primary,brand_secondary,created_at,updated_at')
        .eq('id', id)
        .single(),
      supabaseAdmin.from('players').select('*', { count: 'exact', head: true }).eq('project_id', id),
      supabaseAdmin.from('stations').select('*', { count: 'exact', head: true }).eq('project_id', id),
      supabaseAdmin.from('measurements').select('*', { count: 'exact', head: true }).eq('project_id', id),
    ])

  if (pErr || plErr || stErr || mErr) {
    const msg = pErr?.message || plErr?.message || stErr?.message || mErr?.message || 'db error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    project,
    stats: {
      players: playerCount ?? 0,
      stations: stationCount ?? 0,
      measurements: measCount ?? 0,
    },
  })
}

// PATCH /api/projects/:id  → Projekt updaten (JSON-Body)
// Erlaubte Felder: name, date (YYYY-MM-DD), logo_url, brand_primary, brand_secondary
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json().catch(() => ({} as any))

  const payload: Record<string, any> = {}
  if (typeof body.name === 'string') payload.name = body.name.trim()
  if (typeof body.date === 'string') payload.date = body.date // erwarte YYYY-MM-DD
  if (typeof body.logo_url === 'string') payload.logo_url = body.logo_url
  if (typeof body.brand_primary === 'string') payload.brand_primary = body.brand_primary
  if (typeof body.brand_secondary === 'string') payload.brand_secondary = body.brand_secondary

  if (Object.keys(payload).length === 0) {
    return new NextResponse('No updatable fields provided', { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select('id,name,date,logo_url,brand_primary,brand_secondary')
    .single()

  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ ok: true, project: data })
}

// DELETE /api/projects/:id  → Projekt löschen (FKs sollten ON DELETE CASCADE sein)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const { error } = await supabaseAdmin.from('projects').delete().eq('id', id)
  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ ok: true })
}
