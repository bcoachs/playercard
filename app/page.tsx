import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-8 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Playercard – MVP</h1>
      <div className="grid gap-2">
        <Link href="/projects/new" className="underline text-blue-700">Projekt anlegen</Link>
        <Link href="/leaderboard" className="underline text-blue-700">Rangliste</Link>
      </div>
    </main>
  )
}
