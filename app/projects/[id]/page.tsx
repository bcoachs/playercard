// app/projects/[id]/page.tsx
import Hero from '@/app/components/Hero'
import TiledSection from '@/app/components/TiledSection'
import BackFab from '@/app/components/BackFab'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Link from 'next/link'
import PlayerForm from './PlayerForm'

export const dynamic = 'force-dynamic'

type Station = {
  id: string
  name: string
  unit: string | null
  min_value: number | null
  max_value: number | null
  higher_is_better: boolean | null
}

type Player = {
  id: string
  display_name: string
  birth_year: number | null
  club: string | null
  fav_position: string | null
}

type Measurement = {
  player_id: string
  station_id: string
  value: number
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function normScore(st: Station, raw: number): number {
  const name = (st.name || '').toLowerCase()

  // S3 – Passgenauigkeit: gewichtete Treffer 0..10
  if (name.includes('passgenauigkeit')) {
    const wHits = raw
    return clamp((wHits / 10) * 100, 0, 100)
  }

  // S5 – Schusspräzision: Punkte 0..24
  if (name.includes('schusspräzision')) {
    const pts = raw
    return clamp((pts / 24) * 100, 0, 100)
  }

  // S4 – Schusskraft: km/h, Cap 150
  if (name.includes('schusskraft')) {
    const kmh = raw
    return clamp((Math.min(kmh, 150) / 150) * 100, 0, 100)
  }

  // Generisch min/max (+ higher_is_better)
  const minv = st.min_value ?? 0
  const maxv = st.max_value ?? 1
  const hib = st.higher_is_better ?? true
  if (maxv === minv) return 0

  const sc = hib
    ? ((raw - minv) / (maxv - minv)) * 100
    : ((maxv - raw) / (maxv - minv)) * 100

  return clamp(sc, 0, 100)
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const projectId = params.id

  // Daten parallel laden (Server-seitig, kein Client-Hook nötig)
  const [
    { data: project, error: pErr },
    { data: stations, error: sErr },
    { data: players, error: plErr },
    { data: measurements, error: mErr },
  ] = await Promise.all([
    supabaseAdmin.from('projects').select('id,name,date,logo_url').eq('id', projectId).single(),
    supabaseAdmin
      .from('stations')
      .select('id,name,unit,min_value,max_value,higher_is_better')
      .eq('project_id', projectId)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('players')
      .select('id,display_name,birth_year,club,fav_position')
      .eq('project_id', projectId)
      .order('display_name', { ascending: true }),
    supabaseAdmin
      .from('measurements')
      .select('player_id,station_id,value')
      .eq('project_id', projectId),
  ])

  if (pErr) throw new Error(pErr.message)
  if (sErr) throw new Error(sErr.message)
  if (plErr) throw new Error(plErr.message)
  if (mErr) throw new Error(mErr.message)

  // Indexe für schnelle Nachschau
  const stById = new Map<string, Station>()
  ;(stations ?? []).forEach((s) => stById.set(s.id, s as Station))

  // Werte je Spieler/Station vorrechnen (raw + norm)
  const values: Record<string, Record<string, { raw: number; norm: number }>> = {}
  for (const m of (measurements ?? []) as Measurement[]) {
    const st = stById.get(m.station_id)
    if (!st) continue
    const raw = Number(m.value)
    const norm = Math.round(normScore(st, raw))
    values[m.player_id] ||= {}
    values[m.player_id][m.station_id] = { raw, norm }
  }

  return (
    <main>
      {/* Kopfbereich auf player.jpg, Inhalt oben ausrichten */}
      <Hero
        title={project?.name ?? 'Run'}
        subtitle={project?.date ?? ''}
        image="/player.jpg"
        topRightLogoUrl={project?.logo_url ?? undefined}
        align="top"
      >
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Schnellzugriffe */}
          <div className="pills">
            <Link href={`/leaderboard?project=${projectId}`} className="btn pill">Rangliste</Link>
            <Link href={`/projects/${projectId}/capture`} className="btn pill">Capture</Link>
          </div>

          {/* Spieleranlage – Client-Komponente auf dem Hintergrund */}
          <div className="card glass w-full max-w-2xl text-left">
            <PlayerForm projectId={projectId} />
          </div>
        </div>
      </Hero>

      {/* Matrix-Bereich mit eigenem kachelnden Hintergrund */}
      <TiledSection image="/matrix.jpg">
        <div className="card glass w-full text-left pb-8">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white/90 backdrop-blur">
                <tr className="border-b">
                  <th className="text-left p-2">Spieler</th>
                  {(stations ?? []).map((s) => (
                    <th key={s.id} className="text-center p-2">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(players ?? []).map((pl: Player) => (
                  <tr key={pl.id} className="border-b">
                    <td className="p-2 whitespace-nowrap font-medium">
                      {pl.display_name} {pl.birth_year ? `(${pl.birth_year})` : ''}
                      <br />
                      <span className="text-xs muted">
                        {pl.club || '–'} {pl.fav_position ? `• ${pl.fav_position}` : ''}
                      </span>
                    </td>

                    {(stations ?? []).map((st) => {
                      const cell = values[pl.id]?.[st.id]
                      return (
                        <td key={st.id} className="p-2 text-center">
                          {cell ? (
                            <span
                              className="badge-green"
                              title={`Rohwert: ${cell.raw}${st.unit ? ' ' + st.unit : ''}`}
                            >
                              {cell.norm}
                            </span>
                          ) : (
                            <span className="badge-red" title="Noch nicht erfasst">×</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* etwas Luft am Ende */}
        <div className="h-16" />
      </TiledSection>

      <BackFab />
    </main>
  )
}
