import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = params.id
  const form = await req.formData()

  const payload = {
    project_id: projectId,
    display_name: String(form.get('display_name') || '').trim(),
    birth_year: form.get('birth_year') ? Number(form.get('birth_year')) : null,
    nationality: String(form.get('nationality') || ''),
    club: String(form.get('club') || ''),
    fav_number: form.get('fav_number') ? Number(form.get('fav_number')) : null,
    fav_position: String(form.get('fav_position') || '')
  }
  if (!payload.display_name) return new NextResponse('Name fehlt', { status: 400 })

  const { data, error } = await supabaseAdmin.from('players').insert(payload).select('id').single()
  if (error) return new NextResponse(error.message, { status: 500 })

  return NextResponse.json({ ok: true, playerId: data.id })
}
