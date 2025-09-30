// app/page.tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: projects } = await supabaseAdmin
    .from('projects').select('id,name,date')
    .order('created_at', { ascending: false }).limit(6)

  return (
    <main>
      {/* HERO */}
      <section className="brand-hero hero-with-bg">
        <div className="container px-5 py-10 sm:py-14">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <div className="kicker opacity-90">Event Tool</div>
              <h1 className="text-4xl sm:text-5xl font-extrabold mt-2">Soccer Club Playercard</h1>
              <p className="mt-3 text-white/90">
                Projekte anlegen, Spieler anmelden, Stationen erfassen, Ranglisten sehen und Cards generieren.
              </p>
              <div className="flex gap-3 mt-6">
                <Link href="/projects/new" className="btn primary">Projekt anlegen</Link>
                <Link href="/projects" className="btn secondary">Bestehendes Projekt öffnen</Link>
              </div>
            </div>
            {/* optional: Platz für Logo/Artwork */}
            <div className="hidden md:block opacity-90">
              {/* Placeholder-Block – hier kann später dein Vereinswappen/Hero-Grafik rein */}
              <div className="rounded-2xl border border-white/30 px-10 py-8 text-center">
                <div className="text-sm uppercase tracking-wider text-white/70">Heute</div>
                <div className="text-3xl font-bold">SV Nufringen</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Zwei Start-Kacheln */}
      <section className="px-5 py-8">
        <div className="container grid gap-4 md:grid-cols-2">
          <Link href="/projects" className="card">
            <div className="text-lg font-semibold mb-1">Projekt wählen & weiter bearbeiten</div>
            <div className="muted text-sm">Dashboard, Spieler anlegen, Stationseingabe, Rangliste.</div>
          </Link>
          <Link href="/leaderboard?project=7304c63d-80be-4994-bc27-dfaf45eb3954" className="card">
            <div className="text-lg font-semibold mb-1">Rangliste öffnen</div>
            <div className="muted text-sm">Schneller Zugriff auf deine aktuelle Projekt-Rangliste.</div>
          </Link>
        </div>
      </section>

      {/* Zuletzt angelegt */}
      <section className="px-5 pb-12">
        <div className="container">
          <h2 className="text-xl font-semibold mb-3">Zuletzt angelegte Projekte</h2>
          <div className="grid gap-3">
            {(projects ?? []).map(p => (
              <div key={p.id} className="card flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
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
        </div>
      </section>
    </main>
  )
}
