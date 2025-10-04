import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/** GET: alle Spieler eines Projekts */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id
  const { data, error } = await supabaseAdmin
    .from('players')
    .select('id, display_name, birth_year, club, fav_number, fav_position, nationality, gender, photo_url')
    .eq('project_id', project_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

/** POST: neuen Spieler anlegen (optional mit Foto) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id
  const form = await req.formData()

  const display_name = String(form.get('display_name') || '').trim()
  if (!display_name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })

  const birth_year = form.get('birth_year') ? Number(form.get('birth_year')) : null
  const club        = form.get('club')?.toString() ?? null
  const fav_number  = form.get('fav_number') ? Number(form.get('fav_number')) : null
  const fav_position= form.get('fav_position')?.toString() ?? null
  const nationality = form.get('nationality')?.toString() ?? null
  const genderVal   = form.get('gender')?.toString() ?? null      // 'male' | 'female' | null
  const photo       = form.get('photo') as File | null

  // 1) Spieler anlegen (ohne Foto)
  const { data: ins, error: iErr } = await supabaseAdmin
    .from('players')
    .insert({
      project_id, display_name, birth_year, club,
      fav_number, fav_position, nationality, gender: genderVal
    })
    .select('id')
    .single()

  if (iErr || !ins) return NextResponse.json({ error: iErr?.message || 'Insert fehlgeschlagen' }, { status: 500 })
  const playerId = ins.id as string

  // 2) Foto optional speichern
  if (photo && photo.size > 0) {
    const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `players/${playerId}/portrait.${ext}`
    const buf = Buffer.from(await photo.arrayBuffer())

    const up = await supabaseAdmin.storage.from('players').upload(path, buf, {
      contentType: photo.type || 'image/jpeg',
      upsert: true,
    })
    if (up.error) {
      // kein fataler Fehler – nur loggen
      console.error('Upload error:', up.error.message)
    } else {
      const pub = supabaseAdmin.storage.from('players').getPublicUrl(path)
      await supabaseAdmin.from('players').update({ photo_url: pub.data.publicUrl }).eq('id', playerId)
    }
  }

  return NextResponse.json({ ok: true, playerId })
}
