import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Hero from '../components/Hero'
import BackFab from '../components/BackFab'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const { data: all } = await supabaseAdmin
    .from('projects')
    .select('id,name,date')
    .order('created_at', { ascending: false })

  const recent = (all ?? []).slice(0,3)

  return (
    <main>
      <Hero title="Runs" subtitle="Wähle einen bestehenden Run" image="/player.jpg">
        <div className="pills">
          {recent.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} className="btn pill">
              {p.name}
            </Link>
          ))}
          <a href="#all" className="btn pill">Weitere Projekte</a>
        </div>
      </Hero>

      <section id="all" className="p-5 container">
        <h2 className="text-xl font-semibold mb-3">Alle Projekte</h2>
        <div className="grid gap-3">
          {(all ?? []).map(p => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="muted text-sm">{p.date}</div>
              </div>
              <div className="flex gap-2">
                <Link className="btn pill" href={`/projects/${p.id}`}>Öffnen</Link>
                <Link className="btn pill" href={`/leaderboard?project=${p.id}`}>Rangliste</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BackFab />
    </main>
  )
}
