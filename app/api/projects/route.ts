import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← Service Role korrekt als 2. Parameter
)

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const name = String(form.get('name') || 'Unbenanntes Projekt')
  const date = String(form.get('date') || new Date().toISOString().slice(0,10))
  const file = form.get('logo') as File | null

  // create project
  const { data: proj, error: perr } = await supabaseAdmin.from('projects').insert({ name, date }).select().single()
  if (perr || !proj) return new NextResponse(perr?.message || 'DB error', { status: 500 })

  // upload logo
  if (file) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const path = `projects/${proj.id}/assets/logo.png`
    const { error: uerr } = await supabaseAdmin.storage
      .from('projects')
      .upload(path, bytes, { contentType: file.type || 'image/png', upsert: true })
    if (!uerr) {
      const { data: pub } = await supabaseAdmin.storage.from('projects').getPublicUrl(path)
      await supabaseAdmin.from('projects').update({ logo_url: pub.publicUrl }).eq('id', proj.id)
    }
  }

  // default stations
  const stations = [
    { name: 'Beweglichkeit', unit: 's', min_value: 10, max_value: 40, higher_is_better: false },
    { name: 'Technik', unit: 's', min_value: 20, max_value: 90, higher_is_better: false },
    { name: 'Passgenauigkeit', unit: 'Treffer', min_value: 0, max_value: 10, higher_is_better: true },
    { name: 'Schusskraft', unit: 'km/h', min_value: 0, max_value: 150, higher_is_better: true },
    { name: 'Schusspräzision', unit: 'Punkte', min_value: 0, max_value: 24, higher_is_better: true },
    { name: 'Schnelligkeit', unit: 's', min_value: 4, max_value: 20, higher_is_better: false },
  ].map(s => ({ ...s, project_id: proj.id }))

  await supabaseAdmin.from('stations').insert(stations)

  return NextResponse.json({ ok: true, projectId: proj.id })
}
