import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/:id/players
 * Liste aller Spieler eines Projekts
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id

  const { data, error } = await supabaseAdmin
    .from('players')
    .select('id, display_name, birth_year, club, fav_number, fav_position, nationality, photo_url')
    .eq('project_id', project_id)
    .order('display_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

/**
 * POST /api/projects/:id/players
 * Spieler anlegen (Name & Jahrgang Pflicht), optional: club, fav_number, fav_position, nationality, photo
 * Hinweis: Für MVP sollte der Storage-Bucket "players" public sein,
 *          sonst hier alternativ signed URLs erzeugen.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id

  // Wir erwarten multipart/form-data
  const form = await req.formData()

  const display_name = String(form.get('display_name') || '').trim()
  const birth_year   = form.get('birth_year') ? Number(form.get('birth_year')) : null

  const club         = form.get('club')         ? String(form.get('club'))         : null
  const fav_number   = form.get('fav_number')   ? Number(form.get('fav_number'))   : null
  const fav_position = form.get('fav_position') ? String(form.get('fav_position')) : null
  const nationality  = form.get('nationality')  ? String(form.get('nationality'))  : null

  let photoFile: File | null = null
  const f = form.get('photo')
  if (f && typeof f !== 'string') photoFile = f as File

  if (!display_name || !birth_year) {
    return new NextResponse('Name und Jahrgang sind Pflicht', { status: 400 })
  }

  // 1) Spieler anlegen (ohne Foto, damit wir die ID bekommen)
  const { data: player, error: insErr } = await supabaseAdmin
    .from('players')
    .insert({
      project_id,
      display_name,
      birth_year,
      club,
      fav_number,
      fav_position,
      nationality,
    })
    .select('id')
    .single()

  if (insErr || !player) {
    return NextResponse.json({ error: insErr?.message || 'insert player failed' }, { status: 500 })
  }

  const playerId = player.id

  // 2) Foto optional hochladen & URL speichern
  if (photoFile) {
    const ext = (photoFile.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `players/${project_id}/${playerId}/portrait_original.${ext}`

    const up = await supabaseAdmin.storage
      .from('players')
      .upload(path, photoFile, {
        upsert: true,
        contentType: photoFile.type || undefined,
      })

    if (up.error) {
      // Upload fehlgeschlagen: Spieler behalten, aber Info zurückgeben
      return NextResponse.json(
        { ok: true, playerId, warning: `Foto-Upload fehlgeschlagen: ${up.error.message}` },
        { status: 200 },
      )
    }

    // Public URL (für MVP: Bucket "players" auf PUBLIC stellen)
    const pub = supabaseAdmin.storage.from('players').getPublicUrl(path)
    const photo_url = pub.data.publicUrl

    // Spieler mit photo_url updaten (Fehler hier nicht fatal)
    await supabaseAdmin.from('players').update({ photo_url }).eq('id', playerId)
  }

  return NextResponse.json({ ok: true, playerId })
}
