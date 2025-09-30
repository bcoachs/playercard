import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id,name,date')
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Playercard – MVP test</h1>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/projects/new" className="border rounded p-4 hover:bg-neutral-50">
          <div className="font-semibold mb-1">Projekt anlegen</div>
          <div className="text-sm text-neutral-600">Neues Event (Name, Datum, Logo).</div>
        </Link>
        <Link href="/projects" className="border rounded p-4 hover:bg-neutral-50">
          <div className="font-semibold mb-1">Bestehendes Projekt öffnen</div>
          <div className="text-sm text-neutral-600">Projekt wählen & weiter bearbeiten.</div>
        </Link>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Zuletzt angelegt</h2>
        <div className="space-y-2">
          {(projects ?? []).map(p => (
            <div key={p.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-neutral-600">{p.date}</div>
              </div>
              <div className="flex gap-3">
                <Link className="underline" href={`/projects/${p.id}`}>Öffnen</Link>
                <Link className="underline" href={`/leaderboard?project=${p.id}`}>Rangliste</Link>
              </div>
            </div>
          ))}
          {(projects ?? []).length === 0 && (
            <div className="text-sm text-neutral-600">Noch keine Projekte — lege das erste an.</div>
          )}
        </div>
      </section>
    </main>
  )
}
