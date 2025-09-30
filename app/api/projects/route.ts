// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/projects  → Liste der Projekte (neueste zuerst)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id,name,date,logo_url,created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/projects  → Projekt anlegen + Default-Stationen erzeugen
// Body (JSON): { name: string, date?: "YYYY-MM-DD", logo_url?: string, brand_primary?: string, brand_secondary?: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  const name = String(body.name || '').trim()
  if (!name) return new NextResponse('name is required', { status: 400 })

  const date = typeof body.date === 'string'
    ? body.date
    : new Date().toISOString().slice(0, 10) // heute (YYYY-MM-DD)

  // 1) Projekt anlegen
  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .insert({
      name,
      date,
      logo_url: body.logo_url ?? null,
      brand_primary: body.brand_primary ?? '#0ea5e9',
      brand_secondary: body.brand_secondary ?? '#111827',
    })
    .select('id,name,date,logo_url,brand_primary,brand_secondary')
    .single()

  if (pErr || !project) {
    return NextResponse.json({ error: pErr?.message || 'insert project failed' }, { status: 500 })
  }

  // 2) Default-Stationen einfügen (deine Regeln/Ranges)
  const stations = [
    { name: 'Beweglichkeit',   unit: 's',    min_value: 10, max_value: 40, higher_is_better: false },
    { name: 'Technik',         unit: 's',    min_value: 20, max_value: 90, higher_is_better: false },
    { name: 'Passgenauigkeit', unit: 'hits', min_value: 0,  max_value: 10, higher_is_better: true  },
    { name: 'Schusskraft',     unit: 'km/h', min_value: 0,  max_value: 150,higher_is_better: true  },
    { name: 'Schusspräzision', unit: 'pts',  min_value: 0,  max_value: 24, higher_is_better: true  },
    { name: 'Schnelligkeit',   unit: 's',    min_value: 4,  max_value: 20, higher_is_better: false },
  ].map(s => ({ project_id: project.id, ...s }))

  const { error: sErr } = await supabaseAdmin.from('stations').insert(stations)
  if (sErr) {
    // optional: Projekt wieder löschen, falls Stationsanlage fehlgeschlagen ist
    await supabaseAdmin.from('projects').delete().eq('id', project.id)
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    project,
    stations_created: stations.length,
  })
}
