export const dynamic = 'force-dynamic'

import Link from 'next/link'
// relative Import – falls du schon einen Alias hast, passt ihn an:
import { supabaseAdmin } from '../../src/lib/supabaseAdmin'

export default async function ProjectsPage() {
  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id,name,date,created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return <main className="p-8">Fehler beim Laden: {error.message}</main>
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Projekte</h1>
      <div className="space-y-2">
        {(projects ?? []).map(p => (
          <div key={p.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-neutral-600">{p.date}</div>
            </div>
            <div className="flex gap-2">
              <Link className="underline" href={`/projects/${p.id}`}>Öffnen</Link>
              <Link className="underline" href={`/leaderboard?project=${p.id}`}>Rangliste</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
