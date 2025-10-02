'use client'
import { useRouter } from 'next/navigation'

export default function BackFab({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      // Feste Position, unabhängig vom restlichen Layout
      style={{ position: 'fixed', right: '16px', bottom: '16px', zIndex: 9999 }}
      className="btn pill"
      aria-label="Zurück"
      title="Zurück"
    >
      ← Zurück
    </button>
  )
}
