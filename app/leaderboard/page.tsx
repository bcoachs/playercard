'use client'

import { useEffect, useState } from 'react'
import Hero from '../components/Hero'

type Project = { id: string; name: string }
type Row = {
  rank: number
  playerId: string
  name: string
  club: string | null
  pos: string | null
  totalScore: number
  projectId: string
  projectName: string
}

export default function LeaderboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(res => setProjects(res.items ?? []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const url = projectId ? `/api/leaderboard?project=${projectId}` : '/api/leaderboard'
    fetch(url)
      .then(r => r.json())
      .then(res => setRows(res.items ?? []))
      .finally(() => setLoading(false))
  }, [projectId])

  return (
    <main>
      <Hero
        title="Rangliste"
        subtitle={projectId ? 'Projekt-Rangliste' : 'Gesamtrangliste (alle Runs)'}
        image="/leaderboard.jpg"          // <-- wichtig
      />
      <section className="p-5 max-w-5xl mx-auto">
        <div className="card mb-4 grid gap-3 md:flex md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Ansicht</div>
            <div className="font-medium">{projectId ? 'Projekt-Rangliste' : 'Gesamtrangliste'}</div>
          </div>
          <select className="input md:w-64" value={projectId} onChange={e=>setProjectId(e.target.value)}>
            <option value="">Alle Projekte</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Verein</th>
                <th className="text-left p-2">Pos</th>
                {!projectId && <th className="text-left p-2">Projekt</th>}
                <th className="text-right p-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td className="p-4 text-gray-500" colSpan={6}>Lade…</td></tr>}
              {!loading && rows.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={6}>Noch keine Einträge.</td></tr>}
              {!loading && rows.map(r => (
                <tr key={r.playerId} className="border-b">
                  <td className="p-2">{r.rank}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.club ?? '–'}</td>
                  <td className="p-2">{r.pos ?? '–'}</td>
                  {!projectId && <td className="p-2">{r.projectName}</td>}
                  <td className="p-2 text-right font-semibold">{r.totalScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
