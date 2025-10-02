import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project_id = params.id
  const form = await req.formData()
  const display_name = String(form.get('display_name') || '').trim()
  const birth_year = form.get('birth_year') ? Number(form.get('birth_year')) : null

  if (!display_name || !birth_year) return new NextResponse('Name und Jahrgang sind Pflicht', { status: 400 })

  const { error, data } = await supabaseAdmin
    .from('players')
    .insert({ project_id, display_name, birth_year })
    .select('id')
    .single()
  if (error) return new NextResponse(error.message, { status: 500 })
  return NextResponse.json({ ok: true, playerId: data.id })
}
