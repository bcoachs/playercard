import { supabase } from '@/lib/supabaseClient'

const PLAYER_PHOTO_BUCKET =
  process.env.NEXT_PUBLIC_PLAYER_PHOTO_BUCKET ||
  process.env.PLAYER_PHOTO_BUCKET ||
  ''

export async function resolvePlayerPhotoUrl(photoPath: string): Promise<string | null> {
  const trimmed = photoPath.trim()
  if (!trimmed) {
    return null
  }

  if (/^data:/i.test(trimmed)) {
    return trimmed
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (!PLAYER_PHOTO_BUCKET) {
    console.warn('PLAYER_PHOTO_BUCKET environment variable is not configured. Unable to resolve player photo URL.')
    return null
  }

  const { data } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(trimmed)
  const publicUrl = data?.publicUrl
  if (!publicUrl) {
    console.warn('Supabase public URL lookup failed for player photo.')
    return null
  }

  return publicUrl
}
