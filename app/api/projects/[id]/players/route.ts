import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id

  const form = await req.formData()
  const display_name = String(form.get('display_name') || '').trim()
  const birth_year   = form.get('birth_year') ? Number(form.get('birth_year')) : null

  const club         = form.get('club') ? String(form.get('club')) : null
  const fav_number   = form.get('fav_number') ? Number(form.get('fav_number')) : null
  const fav_position = form.get('fav_position') ? String(form.get('fav_position')) : null
  const nationality  = form.get('nationality') ? String(form.get('nationality')) : null

  let photoFile: File | null = null
  const f = form.get('photo')
  if (f && typeof f !== 'string') photoFile = f as File

  if (!display_name || !birth_year) {
    return new NextResponse('Name und Jahrgang sind Pflicht', { status: 400 })
  }

  // Spieler anlegen (inkl. optionaler Felder)
  const { data: player, error: insErr } = await supabaseAdmin
    .from('players')
    .insert({ project_id, display_name, birth_year, club, fav_number, fav_position, nationality })
    .select('id')
    .single()

  if (insErr || !player) {
    return NextResponse.json({ error: insErr?.message || 'insert player failed' }, { status: 500 })
  }

  const playerId = player.id

  // Foto hochladen (optional)
  if (photoFile) {
    const ext = (photoFile.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `players/${project_id}/${playerId}/portrait_original.${ext}`
    const up = await supabaseAdmin.storage.from('players')
      .upload(path, photoFile, { upsert: true, contentType: photoFile.type || undefined })
    if (!up.error) {
      const pub = supabaseAdmin.storage.from('players').getPublicUrl(path)
      await supabaseAdmin.from('players').update({ photo_url: pub.data.publicUrl }).eq('id', playerId)
    }
  }

  return NextResponse.json({ ok: true, playerId })
}
