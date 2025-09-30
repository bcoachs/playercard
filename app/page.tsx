import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: projects } = await supabaseAdmin
    .from('projects').select('id,name,date')
    .order('created_at', { ascending: false }).limit(6)

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Soccer Club Playercard</h1>
        <Link href="/projects/new" className="btn">Projekt anlegen</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/projects" className="card">
          <div className="text-lg font-semibold mb-1">Bestehendes Projekt öffnen</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            Projekt wählen & weiter bearbeiten (Dashboard, Spieler, Stationen).
          </div>
        </Link>
        <Link href="/leaderboard?project=7304c63d-80be-4994-bc27-dfaf45eb3954" className="card">
          <div className="text-lg font-semibold mb-1">Rangliste (aktuelles Projekt)</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            Direkt zur Rangliste deines letzten Projekts.
          </div>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Zuletzt angelegt</h2>
        <div className="grid gap-3">
          {(projects ?? []).map(p => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{p.date}</div>
              </div>
              <div className="flex gap-3">
                <Link className="btn secondary" href={`/projects/${p.id}`}>Öffnen</Link>
                <Link className="btn secondary" href={`/leaderboard?project=${p.id}`}>Rangliste</Link>
              </div>
            </div>
          ))}
          {(projects ?? []).length === 0 && (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              Noch keine Projekte — lege das erste an.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
