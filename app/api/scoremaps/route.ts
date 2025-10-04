// app/api/scoremaps/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/** Simple CSV→JSON parser (comma, dot-decimals) */
function parseCsv(text: string){
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return []
  const headers = lines[0].split(',').map(s=>s.trim())
  const rows = lines.slice(1)
  return rows.filter(Boolean).map(r=>{
    const cols = r.split(',').map(s=>s.trim())
    const obj: any = {}
    headers.forEach((key, i)=> obj[key] = cols[i])
    if (obj.from_value !== undefined) obj.from_value = parseFloat(obj.from_value)
    if (obj.to_value   !== undefined) obj.to_value   = parseFloat(obj.to_value)
    if (obj.points     !== undefined) obj.points     = parseFloat(obj.points)
    return obj
  })
}

// GET /api/scoremaps?station=S1|S2|S6[&gender=female|male]
export async function GET(req: Request){
  const { searchParams } = new URL(req.url)
  const station = (searchParams.get('station') || '').toUpperCase()

  if (!['S1','S2','S6'].includes(station)) {
    return NextResponse.json({ items: [] })
  }

  let path = ''
  if (station === 'S1') path = 'config/s1.csv'
  if (station === 'S2') path = 'config/s2.csv'
  if (station === 'S6') {
    const gender = (searchParams.get('gender') || 'female').toLowerCase()
    path = `config/s6_${gender}.csv`
  }

  let dl = await supabaseAdmin.storage.from('config').download(path)

  // Fallback für S6 male → female
  if (!dl.data && station === 'S6' && path.endsWith('_male.csv')) {
    dl = await supabaseAdmin.storage.from('config').download('config/s6_female.csv')
  }

  if (!dl.data) {
    const msg = dl.error?.message || 'not found'
    return NextResponse.json({ error: msg, items: [] }, { status: 404 })
  }

  const text = await dl.data.text()
  return NextResponse.json({ items: parseCsv(text) })
}

// POST /api/scoremaps?station=S1|S2|S6[&gender=female|male][&pwd=...]
// -> Upload/Update globaler CSVs (einfacher Schutz via APP_PASSWORD)
export async function POST(req: Request){
  const { searchParams } = new URL(req.url)
  const station = (searchParams.get('station') || '').toUpperCase()
  const pwd     = searchParams.get('pwd') || ''
  if (!['S1','S2','S6'].includes(station)) {
    return NextResponse.json({ error: 'Unsupported station' }, { status: 400 })
  }
  if (process.env.APP_PASSWORD && pwd !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 })

  let path = ''
  if (station === 'S1') path = 'config/s1.csv'
  if (station === 'S2') path = 'config/s2.csv'
  if (station === 'S6') {
    const gender = (searchParams.get('gender') || 'female').toLowerCase()
    path = `config/s6_${gender}.csv`
  }

  const arrayBuf = await file.arrayBuffer()
  const { error } = await supabaseAdmin.storage.from('config').upload(
    path,
    new Blob([arrayBuf], { type: 'text/csv' }),
    { upsert: true }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
