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
            <Link key={p.id} href={`/projects/${p.id}`} className="btn pill">{p.name}</Link>
          ))}
          <a href="#all" className="btn pill">Weitere Projekte</a>
        </div>
      </Hero>
      {/* …restliche Liste… */}
      <BackFab />
    </main>
  )
}
