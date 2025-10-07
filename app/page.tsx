import Link from 'next/link'
import Hero from './components/Hero'
import BackFab from './components/BackFab'

// Landing Page für die Playercard-Anwendung. Hier werden vier
// Hauptaktionen angeboten: einen neuen Run anlegen, einen bestehenden
// Run laden, die Rangliste ansehen oder direkt zur Base/Capture-Ansicht
// springen. Die Buttons greifen auf das Standard-Buttonlayout zurück.

export default function Home() {
  return (
    <main>
      {/* Für die Landingpage verwenden wir ein spezielles Hero-Bild und einen markanten Titel */}
      <Hero title="CLUB PLAYERCARD" image="/hero.jpg">
        <div className="pills">
          <Link href="/projects/new" className="btn">NEUER RUN</Link>
          <Link href="/projects" className="btn">RUN LADEN</Link>
          <Link href="/leaderboard" className="btn">RANGLISTE</Link>
          <Link href="/capture" className="btn">BASE</Link>
        </div>
      </Hero>
      <BackFab />
    </main>
  )
}
