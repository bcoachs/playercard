import Link from 'next/link'
import Hero from './components/Hero'
import BackFab from './components/BackFab'

export default function Home() {
  return (
    <main>
      <Hero title="PLAYERCARD" image="/hero.jpg">
        <div className="pills">
          <Link href="/projects/new" className="btn pill">NEUER RUN</Link>
          <Link href="/projects" className="btn pill">RUN LADEN</Link>
          <Link href="/leaderboard" className="btn pill">RANGLISTE</Link>
          <Link href="/capture" className="btn pill">BASE</Link>
        </div>
      </Hero>
      <BackFab />
    </main>
  )
}
