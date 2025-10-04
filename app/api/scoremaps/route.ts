// app/api/scoremaps/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// CSV -> JSON Parser (einfach)
function parseCsv(text: string){
  const lines = text.trim().split(/\r?\n/)
  const [h, ...rows] = lines
  const headers = h.split(',').map(s=>s.trim())
  return rows.map(r=>{
    const cols = r.split(',').map(s=>s.trim())
    const obj: any = {}
    headers.forEach((key, i)=> obj[key] = cols[i])
    // Normalisieren
    if (obj.from_value !== undefined) obj.from_value = parseFloat(obj.from_value)
    if (obj.to_value   !== undefined) obj.to_value   = parseFloat(obj.to_value)
    if (obj.points     !== undefined) obj.points     = parseFloat(obj.points)
    return obj
  })
}

// GET /api/scoremaps?station=S6&gender=female|male
export async function GET(req: Request){
  const { searchParams } = new URL(req.url)
  const station = searchParams.get('station') || 'S6'
  const gender  = searchParams.get('gender')  || 'female'

  // aktuell nur S6
  if (station !== 'S6'){
    return NextResponse.json({ items: [] })
  }

  const path = `config/s6_${gender}.csv`
  const { data, error } = await supabaseAdmin.storage.from('config').download(path)

  // Fallback: wenn male fehlt -> female
  if (error) {
    if (gender === 'male'){
      const alt = await supabaseAdmin.storage.from('config').download('config/s6_female.csv')
      if (alt.data){
        const text = await alt.data.text()
        return NextResponse.json({ items: parseCsv(text) })
      }
    }
    return NextResponse.json({ error: error.message, items: [] }, { status: 404 })
  }

  const text = await data.text()
  return NextResponse.json({ items: parseCsv(text) })
}

// POST /api/scoremaps?station=S6&gender=female|male
// Lade CSV in den globalen Bucket hoch (nur einfache Absicherung via APP_PASSWORD)
export async function POST(req: Request){
  const { searchParams } = new URL(req.url)
  const station = searchParams.get('station') || 'S6'
  const gender  = searchParams.get('gender')  || 'female'
  const pwd     = searchParams.get('pwd') || ''

  if (process.env.APP_PASSWORD && pwd !== process.env.APP_PASSWORD){
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (station !== 'S6'){
    return NextResponse.json({ error: 'Unsupported station' }, { status: 400 })
  }

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 })

  const arrayBuf = await file.arrayBuffer()
  const path = `config/s6_${gender}.csv`
  const { error } = await supabaseAdmin.storage.from('config').upload(
    path,
    new Blob([arrayBuf], { type: 'text/csv' }),
    { upsert: true }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
