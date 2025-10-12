import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id,name,date,logo_url,brand_primary,brand_secondary,created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctype = req.headers.get('content-type') || ''
  let name = '', date = new Date().toISOString().slice(0,10)
  let brand_primary = '#ec0347'
  let brand_secondary = '#ab0000'
  let logoFile: File | null = null

  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData()
    name = String(form.get('name') || '').trim()
    date = String(form.get('date') || date)
    brand_primary = String(form.get('brand_primary') || brand_primary)
    brand_secondary = String(form.get('brand_secondary') || brand_secondary)
    const f = form.get('logo')
    logoFile = (f && typeof f !== 'string') ? (f as File) : null
  } else {
    const body = await req.json().catch(() => ({} as any))
    name = String(body.name || '').trim()
    date = String(body.date || date)
    brand_primary = String(body.brand_primary || brand_primary)
    brand_secondary = String(body.brand_secondary || brand_secondary)
  }

  if (!name) return new NextResponse('name is required', { status: 400 })

  // 1) Projekt anlegen
  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .insert({ name, date, brand_primary, brand_secondary })
    .select('id,name,date,logo_url,brand_primary,brand_secondary')
    .single()
  if (pErr || !project) return NextResponse.json({ error: pErr?.message || 'insert project failed' }, { status: 500 })

  const projectId = project.id

  // 2) Logo hochladen (optional)
  let logo_url: string | null = null
  if (logoFile) {
    const ext = (logoFile.name?.split('.').pop() || 'png').toLowerCase()
    const path = `projects/${projectId}/assets/logo.${ext}`
    const up = await supabaseAdmin.storage.from('projects').upload(path, logoFile, { upsert: true, contentType: logoFile.type || undefined })
    if (!up.error) {
      const publicUrlResponse = supabaseAdmin.storage.from('projects').getPublicUrl(path)
      if ('error' in publicUrlResponse && publicUrlResponse.error) {
        console.error('Supabase Error: Fehler beim Abrufen der Logo-URL aus Supabase.')
      } else {
        const { publicUrl } = publicUrlResponse.data
        logo_url = publicUrl ?? null
      }
      await supabaseAdmin.from('projects').update({ logo_url }).eq('id', projectId)
    }
  }

  // 3) Default-Stationen
  const stations = [
    { name: 'Beweglichkeit',   unit: 's',    min_value: 10, max_value: 40, higher_is_better: false },
    { name: 'Technik',         unit: 's',    min_value: 20, max_value: 90, higher_is_better: false },
    { name: 'Passgenauigkeit', unit: 'hits', min_value: 0,  max_value: 10, higher_is_better: true  },
    { name: 'Schusskraft',     unit: 'km/h', min_value: 0,  max_value: 150,higher_is_better: true  },
    { name: 'Schusspräzision', unit: 'pts',  min_value: 0,  max_value: 24, higher_is_better: true  },
    { name: 'Schnelligkeit',   unit: 's',    min_value: 4,  max_value: 20, higher_is_better: false },
  ].map(s => ({ project_id: projectId, ...s }))

  const { error: sErr } = await supabaseAdmin.from('stations').insert(stations)
  if (sErr) {
    await supabaseAdmin.from('projects').delete().eq('id', projectId)
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, project: { ...project, logo_url } })
}
