'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Project = { id: string; name: string; date: string }
type Station = { id: string; name: string; unit: string | null }

export default function BasePage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [projectId, setProjectId] = useState<string>('')   // Auswahl 1
  const [stationId, setStationId] = useState<string>('')   // Auswahl 2

  // Projekte laden
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(res => setProjects(res.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  // Stationen laden, wenn Projekt gewählt
  useEffect(() => {
    setStations([]); setStationId('')
    if (!projectId) return
    fetch(`/api/projects/${projectId}/stations`)
      .then(r => r.json())
      .then(res => setStations(res.items ?? []))
  }, [projectId])

  const captureHref = projectId && stationId
    ? `/projects/${projectId}/capture?station=${stationId}`
    : '#'

  return (
    <main>
      <section className="brand-hero hero-with-bg">
        <div className="container px-5 py-12 md:py-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center text-white">Stations-Erfassung</h1>
          <p className="text-center text-white/90 mt-2">Projekt wählen → Station wählen → los geht’s.</p>

          <div className="max-w-2xl mx-auto mt-8 grid gap-4">
            <div className="card">
              <label className="block text-sm font-semibold mb-2">Projekt</label>
              <select
                className="w-full border border-gray-200 rounded-xl p-3 bg-white"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">{loading ? 'Lade…' : 'Bitte wählen'}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} – {p.date}</option>
                ))}
              </select>
            </div>

            <div className="card">
              <label className="block text-sm font-semibold mb-2">Station</label>
              <select
                className="w-full border border-gray-200 rounded-xl p-3 bg-white"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                disabled={!projectId}
              >
                <option value="">{projectId ? 'Bitte wählen' : 'Zuerst Projekt wählen'}</option>
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.unit ? ` (${s.unit})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="text-center">
              <Link
                href={captureHref}
                className={`btn pill ${projectId && stationId ? '' : 'pointer-events-none opacity-50'}`}
              >
                Zur Eingabemaske
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
