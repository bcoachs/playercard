'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Hero from '../components/Hero'

type Project = { id: string; name: string; date: string }
type Station = { id: string; name: string; unit: string | null }

export default function BasePage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [projectId, setProjectId] = useState('')
  const [stationId, setStationId] = useState('')

  useEffect(() => {
    fetch('/api/projects').then(r=>r.json()).then(res => setProjects(res.items ?? [])).finally(()=>setLoading(false))
  }, [])
  useEffect(() => {
    setStations([]); setStationId('')
    if (!projectId) return
    fetch(`/api/projects/${projectId}/stations`).then(r=>r.json()).then(res => setStations(res.items ?? []))
  }, [projectId])

  const captureHref = projectId && stationId ? `/projects/${projectId}/capture?station=${stationId}` : '#'

  return (
    <main>
      <Hero title="Stations-Erfassung" subtitle="Projekt wählen → Station wählen → los geht’s." />
      <section className="p-5 max-w-2xl mx-auto grid gap-4">
        <div className="card">
          <label className="block text-sm font-semibold mb-2">Projekt</label>
          <select className="input" value={projectId} onChange={e=>setProjectId(e.target.value)}>
            <option value="">{loading ? 'Lade…' : 'Bitte wählen'}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} – {p.date}</option>)}
          </select>
        </div>
        <div className="card">
          <label className="block text-sm font-semibold mb-2">Station</label>
          <select className="input" value={stationId} onChange={e=>setStationId(e.target.value)} disabled={!projectId}>
            <option value="">{projectId ? 'Bitte wählen' : 'Zuerst Projekt wählen'}</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}{s.unit ? ` (${s.unit})` : ''}</option>)}
          </select>
        </div>
        <div className="text-center">
          <Link href={captureHref} className={`btn pill ${projectId && stationId ? '' : 'pointer-events-none opacity-50'}`}>
            Zur Eingabemaske
          </Link>
        </div>
      </section>
    </main>
  )
}
