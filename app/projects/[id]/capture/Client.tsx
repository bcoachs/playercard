'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Player = { id: string; display_name: string; fav_position: string|null; club: string|null }
type Station = { id: string; name: string; unit: string|null }

export default function CaptureHubClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const focusPlayer = sp.get('focusPlayer') ?? ''

  const [players, setPlayers] = useState<Player[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [playerId, setPlayerId] = useState(focusPlayer)
  const [stationId, setStationId] = useState('')
  const [value, setValue] = useState<string>('')

  useEffect(() => {
    fetch(`/api/capture-hub?project=${projectId}`)
      .then(r => r.json())
      .then(res => { setPlayers(res.players || []); setStations(res.stations || []) })
  }, [projectId])

  const canSave = playerId && stationId && value !== ''

  async function saveMeasurement() {
    const res = await fetch('/api/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, player_id: playerId, station_id: stationId, value: Number(value) })
    })
    if (!res.ok) { alert('Fehler: ' + await res.text()); return }
    setValue('')
    // optional: zur Rangliste oder Bestätigung
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Stationseingabe</h1>

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Spieler*in</label>
          <select className="border p-2 w-full rounded" value={playerId} onChange={e => setPlayerId(e.target.value)}>
            {!playerId && <option value="">– auswählen –</option>}
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}{p.fav_position ? ` (${p.fav_position})` : ''}{p.club ? ` – ${p.club}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Station</label>
          <select className="border p-2 w-full rounded" value={stationId} onChange={e => setStationId(e.target.value)}>
            <option value="">– auswählen –</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Messwert</label>
          <input className="border p-2 w-full rounded" value={value} onChange={e => setValue(e.target.value)} placeholder="z. B. 5.2 / 110 / 7 …" />
        </div>
      </div>

      <div className="flex gap-3">
        <button disabled={!canSave} onClick={saveMeasurement} className="bg-black text-white px-4 py-2 rounded disabled:opacity-50">
          Speichern
        </button>
        <button onClick={() => router.push(`/leaderboard?project=${projectId}`)} className="border px-4 py-2 rounded">
          Zur Rangliste
        </button>
      </div>

      <div className="text-sm text-neutral-600">
        Tipp: Alternativ kannst du direkt per QR auf <code>/capture?project={projectId}&station=&lt;stationId&gt;</code> gehen – die Eingabe nutzt dann hier dieselbe Logik.
      </div>
    </main>
  )
}
