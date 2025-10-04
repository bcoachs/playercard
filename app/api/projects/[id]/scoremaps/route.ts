// app/api/projects/[id]/scoremaps/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function stationToKey(s: string) {
  const n = s.toLowerCase()
  if (['s1','beweglichkeit'].includes(n)) return 's1'
  if (['s2','technik'].includes(n)) return 's2'
  if (['s3','passgenauigkeit'].includes(n)) return 's3'
  if (['s4','schusskraft'].includes(n)) return 's4'
  if (['s5','schusspräzision','schusspraezision'].includes(n)) return 's5'
  if (['s6','schnelligkeit','speed','30m'].includes(n)) return 's6'
  return ''
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const station = stationToKey(searchParams.get('station') || '')
    if (!station) return NextResponse.json({ error: 'station missing' }, { status: 400 })

    const gender = (searchParams.get('gender') || '').toLowerCase()
    const tryNames = gender
      ? [`${station}_${gender}.csv`, `${station}.csv`]
      : [`${station}.csv`]

    let fileText: string | null = null

    // Projekt-spezifisch zuerst
    for (const name of tryNames) {
      const p = `config/${params.id}/${name}`
      const { data, error } = await supabaseAdmin.storage.from('config').download(p)
      if (!error && data) { fileText = await data.text(); break }
    }

    // Fallback: global
    if (!fileText) {
      for (const name of tryNames) {
        const p = `config/global/${name}`
        const { data, error } = await supabaseAdmin.storage.from('config').download(p)
        if (!error && data) { fileText = await data.text(); break }
      }
    }

    if (!fileText) return NextResponse.json({ items: [] }) // kein Mapping vorhanden

    // CSV -> JSON
    const lines = fileText.split(/\r?\n/).filter(Boolean)
    const header = lines.shift()!
    const cols = header.split(',').map(s => s.trim())
    const rows = lines.map(line => {
      const parts = line.split(',').map(s => s.trim())
      const obj: any = {}
      cols.forEach((c, i) => obj[c] = parts[i])
      // Normalisieren (Punkt-Decimal vorausgesetzt)
      obj.from_value = Number(obj.from_value)
      obj.to_value   = Number(obj.to_value)
      obj.points     = Number(obj.points)
      obj.age_range  = String(obj.age_range || obj.age || obj.range || '')
      return obj
    })

    return NextResponse.json({ items: rows, station, gender: gender || null })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const station = stationToKey(searchParams.get('station') || '')
    if (!station) return NextResponse.json({ error: 'station missing' }, { status: 400 })
    const gender = (searchParams.get('gender') || '').toLowerCase()

    const file = (await req.formData()).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const name = gender ? `${station}_${gender}.csv` : `${station}.csv`
    const path = `config/${params.id}/${name}`

    const { error } = await supabaseAdmin.storage.from('config').upload(path, buf, {
      contentType: 'text/csv',
      upsert: true,
    })
    if (error) throw error

    return NextResponse.json({ ok: true, path })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
