// app/page.tsx
import Link from 'next/link'

export default function Home() {
  // Wenn du einen "aktiven" Projektlink für BASE haben willst,
  // kannst du hier optional deine aktuelle Project-ID setzen:
  const activeProjectId = '7304c63d-80be-4994-bc27-dfaf45eb3954' // TODO: bei Bedarf anpassen/entfernen

  return (
    <main>
      <section className="brand-hero hero-with-bg hero-full safe-area">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="grid place-items-center gap-10 text-center">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-wide uppercase drop-shadow">
              NEXT RUN
            </h1>
            <div className="pills">
              <Link href="/projects/new" className="btn pill">NEUER RUN</Link>
              <Link href="/projects" className="btn pill">RUN LADEN</Link>
              <Link href="/leaderboard" className="btn pill">RANGLISTE</Link>
              <Link href="/base" className="btn pill">BASE</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
