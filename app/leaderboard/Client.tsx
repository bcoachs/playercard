'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Row = {
  rank: number
  name: string
  club: string | null
  pos: string | null
  totalScore: number
  perStation: Record<string, number>
}

export default function LeaderboardClient() {
  const sp = useSearchParams()
  const project = sp.get('project')
  const [data, setData] = useState<Row[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!project) return
    fetch(`/api/leaderboard?project=${project}`)
      .then(r => r.json())
      .then(res => setData(res.items || []))
      .catch(() => setData([]))
  }, [project])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data
    return data.filter(r =>
      (r.name?.toLowerCase().includes(needle)) ||
      (r.club?.toLowerCase().includes(needle)) ||
      (r.pos?.toLowerCase().includes(needle))
    )
  }, [data, q])

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-3">Rangliste</h1>

      {!project && (
        <div className="mb-4 text-sm text-red-700">
          Kein <code>?project=…</code> angegeben.
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Suche nach Name / Verein / Position…"
          className="border p-2 rounded w-full"
        />
        <span className="text-sm text-neutral-500">{filtered.length} Einträge</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-neutral-600">
          Noch keine Messungen gespeichert. Erfasse Werte in der Stationserfassung, dann erscheinen hier die Ergebnisse.
        </div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left p-2">Platz</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Verein</th>
                <th className="text-left p-2">Pos</th>
                <th className="text-right p-2">Gesamt (max 600)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.rank} className="border-t">
                  <td className="p-2">{r.rank}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.club ?? '–'}</td>
                  <td className="p-2">{r.pos ?? '–'}</td>
                  <td className="p-2 text-right font-semibold">{r.totalScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
