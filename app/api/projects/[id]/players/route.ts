// app/api/projects/[id]/players/route.ts
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type Params = { params: { id: string } }

// kleine Helper
function numOrNull(v: FormDataEntryValue | null) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function strOrNull(v: FormDataEntryValue | null) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}
function genderOrNull(v: FormDataEntryValue | null) {
  const s = String(v || '').toLowerCase()
  if (s === 'male' || s === 'female') return s as 'male' | 'female'
  return null
}

const PLAYER_PHOTO_BUCKET = 'player-photos'

function inferExtension(file: File) {
  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  if (dot >= 0 && dot < name.length - 1) {
    return name.slice(dot + 1).toLowerCase()
  }
  const type = (file.type || '').toLowerCase()
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

async function uploadPlayerPhoto(projectId: string, file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = inferExtension(file)
  const path = `${projectId}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const publicUrlResponse = supabaseAdmin.storage
    .from(PLAYER_PHOTO_BUCKET)
    .getPublicUrl(path)

  if ('error' in publicUrlResponse && publicUrlResponse.error) {
    throw new Error(publicUrlResponse.error.message)
  }

  const publicUrl = publicUrlResponse.data?.publicUrl
  if (!publicUrl) {
    throw new Error('Konnte keine öffentliche URL für das Spielerfoto abrufen')
  }
  return publicUrl
}

/** GET /api/projects/:id/players
 *  Listet alle Spieler eines Projekts
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const projectId = params.id
  const { data, error } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}

/** POST /api/projects/:id/players
 *  Erstellt einen neuen Spieler (FormData)
 *  Pflicht: display_name, birth_year (YYYY)
 *  Optional: club, fav_number, fav_position, nationality, gender
 */
export async function POST(req: NextRequest, { params }: Params) {
  const projectId = params.id
  const fd = await req.formData()

  const display_name = strOrNull(fd.get('display_name'))
  const birth_year = numOrNull(fd.get('birth_year'))
  const club = strOrNull(fd.get('club'))
  const fav_number = numOrNull(fd.get('fav_number'))
  const fav_position = strOrNull(fd.get('fav_position'))
  const nationality = strOrNull(fd.get('nationality'))
  const gender = genderOrNull(fd.get('gender'))
  const photoEntry = fd.get('photo')
  const photoFile = photoEntry && typeof photoEntry !== 'string' ? (photoEntry as File) : null
  let photoUrl: string | null = null
  if (photoFile) {
    try {
      photoUrl = await uploadPlayerPhoto(projectId, photoFile)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Foto-Upload fehlgeschlagen'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (!display_name) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
  }
  if (!birth_year || String(birth_year).length !== 4) {
    return NextResponse.json({ error: 'birth_year (YYYY) is required' }, { status: 400 })
  }

  const payload: Record<string, any> = {
    project_id: projectId,
    display_name,
    birth_year,
    club,
    fav_number,
    fav_position,
    nationality,
    gender, // nullable in DB
  }
  if (photoUrl) payload.photo_url = photoUrl

  const { data, error } = await supabaseAdmin
    .from('players')
    .insert([payload])
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ item: data }, { status: 201 })
}

/** PUT /api/projects/:id/players
 *  Aktualisiert einen Spieler (FormData)
 *  Pflicht: id
 *  Optional: dieselben Felder wie POST
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const projectId = params.id
  const fd = await req.formData()

  const id = strOrNull(fd.get('id'))
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Felder vorbereiten – nur setzen, wenn übergeben
  const patch: Record<string, any> = {}
  const display_name = strOrNull(fd.get('display_name'))
  const birth_year = numOrNull(fd.get('birth_year'))
  const club = strOrNull(fd.get('club'))
  const fav_number = numOrNull(fd.get('fav_number'))
  const fav_position = strOrNull(fd.get('fav_position'))
  const nationality = strOrNull(fd.get('nationality'))
  const gender = genderOrNull(fd.get('gender'))
  const removePhoto = String(fd.get('remove_photo') || '').toLowerCase() === '1'
  const photoEntry = fd.get('photo')
  const photoFile = photoEntry && typeof photoEntry !== 'string' ? (photoEntry as File) : null
  let photoUrl: string | null = null
  if (photoFile) {
    try {
      photoUrl = await uploadPlayerPhoto(projectId, photoFile)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Foto-Upload fehlgeschlagen'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (display_name !== null) patch.display_name = display_name
  if (birth_year !== null) patch.birth_year = birth_year
  if (club !== null) patch.club = club
  if (fav_number !== null) patch.fav_number = fav_number
  if (fav_position !== null) patch.fav_position = fav_position
  if (nationality !== null) patch.nationality = nationality
  if (gender !== null) patch.gender = gender
  if (photoUrl !== null) patch.photo_url = photoUrl
  else if (removePhoto) patch.photo_url = null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('players')
    .update(patch)
    .eq('id', id)
    .eq('project_id', projectId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ item: data })
}

/** DELETE /api/projects/:id/players?id=UUID
 *  Löscht einen Spieler (und dank FK on delete cascade auch Messungen)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const projectId = params.id
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('players')
    .delete()
    .eq('id', id)
    .eq('project_id', projectId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
