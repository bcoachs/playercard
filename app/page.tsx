import Link from 'next/link'
import BackFab from './components/BackFab'

/**
 * Landing page for the Playercard application.  Instead of relying on the
 * generic Hero component, this page defines its own hero section so that
 * buttons can be positioned centrally on the page and sized for mobile
 * devices.  The background image spans the full viewport height and a
 * semi‑transparent overlay ensures that the white text remains legible.
 */
export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Hero section */}
      <div className="relative flex-1 flex items-center justify-center text-center">
        {/* Background image */}
        <img
          src="/hero.jpg"
          alt="Football stadium background"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        {/* Dark overlay for better text contrast */}
        <div className="absolute inset-0 -z-10 bg-black/50" />
        <div className="space-y-10 px-4">
          <h1 className="hero-text text-5xl sm:text-6xl md:text-7xl font-bold">
            NEXT RUN
          </h1>
          <div className="flex flex-col sm:flex-row flex-wrap gap-5 sm:gap-6 justify-center items-center">
            <Link
              href="/projects/new"
              className="btn pill px-8 py-4 text-lg sm:text-xl"
            >
              NEUER RUN
            </Link>
            <Link
              href="/projects"
              className="btn pill px-8 py-4 text-lg sm:text-xl"
            >
              RUN LADEN
            </Link>
            <Link
              href="/leaderboard"
              className="btn pill px-8 py-4 text-lg sm:text-xl"
            >
              RANGLISTE
            </Link>
            <Link
              href="/capture"
              className="btn pill px-8 py-4 text-lg sm:text-xl"
            >
              BASE
            </Link>
          </div>
        </div>
      </div>
      {/* Back button remains small and fixed to the bottom right */}
      <BackFab />
    </main>
  )
}
