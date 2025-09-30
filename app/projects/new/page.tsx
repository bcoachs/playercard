'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewProject() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function onSubmit(formData: FormData) {
    setLoading(true)
    const res = await fetch('/api/projects', { method: 'POST', body: formData })
    if (!res.ok) {
      alert('Fehler beim Anlegen: ' + (await res.text()))
      setLoading(false)
      return
    }
    const { projectId } = await res.json()
    router.push(`/leaderboard?project=${projectId}`)
  }

  const today = new Date().toISOString().slice(0,10)

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Projekt anlegen</h1>
      <form action={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm">Projektname</label>
          <input name="name" required defaultValue="SV Nufringen – 30.09.2025" className="border p-2 w-full" />
        </div>
        <div>
          <label className="block text-sm">Datum</label>
          <input type="date" name="date" required defaultValue={today} className="border p-2 w-full" />
        </div>
        <div>
          <label className="block text-sm">Vereinswappen (Logo)</label>
          <input type="file" name="logo" accept="image/*" required className="border p-2 w-full" />
        </div>
        <button disabled={loading} className="bg-[var(--brand)] text-white px-4 py-2 rounded">{loading ? 'Anlegen…' : 'Projekt anlegen'}</button>
      </form>
    </main>
  )
}
