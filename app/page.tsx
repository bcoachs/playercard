import Link from 'next/link'
import Hero from './components/Hero'
import BackFab from './components/BackFab'

// Landing Page für die Playercard-Anwendung. Hier werden vier
// Hauptaktionen angeboten: einen neuen Run anlegen, einen bestehenden
// Run laden, die Rangliste ansehen oder direkt zur Base/Capture-Ansicht
// springen. Die Buttons nutzen `btn-lg`, um besser klickbar zu sein.

export default function Home() {
  return (
    <main>
      {/* Für die Landingpage verwenden wir ein spezielles Hero-Bild und einen markanten Titel */}
      <Hero title="CLUB PLAYERCARD" image="/hero.jpg">
        <div className="pills">
          <Link href="/projects/new" className="btn pill btn-lg">NEUER RUN</Link>
          <Link href="/projects" className="btn pill btn-lg">RUN LADEN</Link>
          <Link href="/leaderboard" className="btn pill btn-lg">RANGLISTE</Link>
          <Link href="/capture" className="btn pill btn-lg">BASE</Link>
        </div>
      </Hero>
      <BackFab />
    </main>
  )
}
