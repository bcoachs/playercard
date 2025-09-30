import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id
  const data = await req.json().catch(() => ({}))
  const display_name = String(data.display_name || '').trim()
  if (!display_name) return new NextResponse('Name fehlt', { status: 400 })

  const payload = {
    project_id,
    display_name,
    club: data.club ? String(data.club) : null,
    fav_position: data.fav_position ? String(data.fav_position) : null,
    fav_number: data.fav_number ? Number(data.fav_number) : null,
    birth_year: data.birth_year ? Number(data.birth_year) : null,
    nationality: data.nationality ? String(data.nationality) : null
  }

  const { data: ins, error } = await supabaseAdmin.from('players').insert(payload).select('id').single()
  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ ok: true, playerId: ins.id })
}
