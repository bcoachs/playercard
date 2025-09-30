export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { supabaseAdmin } from '../../../src/lib/supabaseAdmin'

type Props = { params: { id: string } }

export default async function ProjectDashboard({ params }: Props) {
  const projectId = params.id
  const [{ data: proj }, { data: stations }, { data: players }] = await Promise.all([
    supabaseAdmin.from('projects').select('id,name,date,logo_url').eq('id', projectId).single(),
    supabaseAdmin.from('stations').select('id,name').eq('project_id', projectId).order('name'),
    supabaseAdmin.from('players').select('id,display_name,fav_position,club').eq('project_id', projectId).order('created_at', { ascending: false })
  ])

  if (!proj) return <main className="p-8">Projekt nicht gefunden.</main>

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-4">
        {proj.logo_url ? <img src={proj.logo_url} alt="Logo" className="h-10 w-10 object-contain" /> : null}
        <div>
          <h1 className="text-2xl font-bold">{proj.name}</h1>
          <div className="text-sm text-neutral-600">{proj.date}</div>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Spieler anmelden</h2>
          <p className="text-sm text-neutral-600 mb-2">Self-Signup Formular öffnen.</p>
          <Link className="underline" href={`/join/${projectId}`}>Zum Signup</Link>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Stationseingabe</h2>
          <p className="text-sm text-neutral-600 mb-2">Hub zum Erfassen der Messwerte.</p>
          <Link className="underline" href={`/projects/${projectId}/capture`}>Zum Capture-Hub</Link>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Rangliste</h2>
          <p className="text-sm text-neutral-600 mb-2">Gesamtergebnisse & Platzierung.</p>
          <Link className="underline" href={`/leaderboard?project=${projectId}`}>Zur Rangliste</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Stationen ({stations?.length ?? 0})</h3>
          <ul className="text-sm list-disc pl-5">
            {(stations ?? []).map(s => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </div>

        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Letzte Spieler ({players?.length ?? 0})</h3>
          <ul className="text-sm list-disc pl-5">
            {(players ?? []).slice(0, 8).map(pl => (
              <li key={pl.id}>{pl.display_name} {pl.fav_position ? `(${pl.fav_position})` : ''}{pl.club ? ` – ${pl.club}` : ''}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
