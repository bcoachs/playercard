import Hero from '@/app/components/Hero'
import BackFab from '@/app/components/BackFab'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Station = { id: string; name: string; unit: string | null; min_value: number | null; max_value: number | null; higher_is_better: boolean | null }
type Player  = { id: string; display_name: string; birth_year: number | null; club: string | null; fav_position: string | null }

function clamp(n:number,lo:number,hi:number){ return Math.max(lo, Math.min(hi, n)) }
function normScore(st: Station, raw: number): number {
  const name = (st.name || '').toLowerCase()
  if (name.includes('passgenauigkeit')) return clamp((raw/10)*100, 0, 100)
  if (name.includes('schusspräzision')) return clamp((raw/24)*100, 0, 100)
  if (name.includes('schusskraft')) return clamp((Math.min(raw,150)/150)*100, 0, 100)
  const minv = st.min_value ?? 0, maxv = st.max_value ?? 1, hib = st.higher_is_better ?? true
  if (maxv === minv) return 0
  return hib ? clamp(((raw-minv)/(maxv-minv))*100,0,100) : clamp(((maxv-raw)/(maxv-minv))*100,0,100)
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const [{ data: project }, { data: stations }, { data: players }, { data: measurements }] =
    await Promise.all([
      supabaseAdmin.from('projects').select('id,name,date,logo_url').eq('id', projectId).single(),
      supabaseAdmin.from('stations').select('id,name,unit,min_value,max_value,higher_is_better').eq('project_id', projectId).order('name'),
      supabaseAdmin.from('players').select('id,display_name,birth_year,club,fav_position').eq('project_id', projectId).order('display_name'),
      supabaseAdmin.from('measurements').select('player_id,station_id,value').eq('project_id', projectId)
    ])

  const stById = new Map<string, Station>()
  stations?.forEach(s => stById.set(s.id, s as Station))
  const values: Record<string, Record<string, { raw:number, norm:number }>> = {}
  for (const m of (measurements ?? [])) {
    const st = stById.get(m.station_id); if (!st) continue
    values[m.player_id] ||= {}
    values[m.player_id][m.station_id] = { raw: Number(m.value), norm: Math.round(normScore(st, Number(m.value))) }
  }

  return (
    <main>
      <Hero
        title={project?.name ?? 'Run'}
        subtitle={project?.date ?? ''}
        image="/player.jpg"
        topRightLogoUrl={project?.logo_url ?? undefined}
      >
        <div className="pills">
          <Link href={`/leaderboard?project=${projectId}`} className="btn pill">Rangliste</Link>
          <Link href={`/projects/${projectId}/capture`} className="btn pill">Capture</Link>
        </div>
      </Hero>

      {/* Spieler anlegen */}
      <section className="p-5 container">
        <div className="card max-w-xl">
          <PlayerForm projectId={projectId} />
        </div>
      </section>

      {/* Matrix */}
      <section className="p-5 container">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left p-2">Spieler</th>
                {stations?.map(s => (
                  <th key={s.id} className="text-center p-2">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(players ?? []).map(pl => (
                <tr key={pl.id} className="border-b">
                  <td className="p-2 whitespace-nowrap font-medium">{pl.display_name} {pl.birth_year ? `(${pl.birth_year})` : ''}</td>
                  {stations?.map(st => {
                    const cell = values[pl.id]?.[st.id]
                    return (
                      <td key={st.id} className="p-2 text-center">
                        {cell
                          ? <span className="badge-green" title={`Rohwert: ${cell.raw}${st.unit ? ' ' + st.unit : ''}`}>{cell.norm}</span>
                          : <span className="badge-red" title="Noch nicht erfasst">×</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BackFab />
    </main>
  )
}

function PlayerForm({ projectId }: { projectId: string }) {
  // Client-Komponente inline:
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const React = require('react')
  const { useState } = React
  const { useRouter } = require('next/navigation')
  const router = useRouter()
  const [name, setName] = useState('')
  const [year, setYear] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: any){
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    fd.append('display_name', name.trim())
    if (year) fd.append('birth_year', String(year))
    const res = await fetch(`/api/projects/${projectId}/players`, { method: 'POST', body: fd })
    setSubmitting(false)
    if (!res.ok) { alert('Fehler beim Anlegen'); return }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <h3 className="font-semibold text-lg">Spieler anlegen</h3>
      <div>
        <label className="block text-sm font-semibold mb-1">Name *</label>
        <input className="input" required value={name} onChange={(e:any)=>setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Jahrgang *</label>
        <input className="input" type="number" required min={1950} max={new Date().getFullYear()} value={year}
               onChange={(e:any)=>setYear(e.target.value ? Number(e.target.value) : '')} />
      </div>
      <div className="flex justify-end">
        <button className="btn pill" disabled={submitting}>{submitting ? 'Speichern…' : 'Spieler speichern'}</button>
      </div>
    </form>
  )
}
