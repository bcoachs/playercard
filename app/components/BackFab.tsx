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
      className="fixed bottom-4 right-4 btn pill z-50"
      aria-label="Zurück"
      title="Zurück"
    >
      ← Zurück
    </button>
  )
}
