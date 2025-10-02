import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Hero from '../components/Hero'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id,name,date,created_at')
    .order('created_at', { ascending: false })

  return (
    <main>
      <Hero title="Projekte" subtitle="Runs anlegen & fortsetzen" />
      <section className="p-5 max-w-5xl mx-auto">
        {error && <div className="text-red-600">Fehler: {error.message}</div>}
        <div className="grid gap-3">
          {(projects ?? []).map(p => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="muted text-sm">{p.date}</div>
              </div>
              <div className="flex gap-2">
                <Link className="btn secondary" href={`/projects/${p.id}`}>Öffnen</Link>
                <Link className="btn secondary" href={`/leaderboard?project=${p.id}`}>Rangliste</Link>
              </div>
            </div>
          ))}
          {(projects ?? []).length === 0 && (
            <div className="muted text-sm">Noch keine Projekte — lege das erste an.</div>
          )}
        </div>
      </section>
    </main>
  )
}
