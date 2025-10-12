"use client"

import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BackFab from '../../components/BackFab'
import { supabase } from '@/lib/supabaseClient'

type Station = {
  id: string
  name: string
  unit: string | null
  min_value: number | null
  max_value: number | null
  higher_is_better: boolean | null
}
type Player = {
  id: string
  display_name: string
  birth_year: number | null
  club: string | null
  fav_number: number | null
  fav_position: string | null
  nationality: string | null
  gender?: 'male' | 'female' | null
  photo_url?: string | null
}
type Project = { id: string; name: string; date: string | null; logo_url?: string | null }
type Measurement = { player_id: string; station_id: string; value: number }

type CsvStatus = 'ok' | 'fail' | 'off' | 'loading'

const ST_ORDER = [
  'Beweglichkeit',
  'Technik',
  'Passgenauigkeit',
  'Schusskraft',
  'Schusspräzision',
  'Schnelligkeit',
] as const
const ST_INDEX: Record<string, number> = ST_ORDER.reduce((acc, n, i) => {
  acc[n] = i
  return acc
}, {} as Record<string, number>)

const CARD_WIDTH_MM = 53.98
const CARD_HEIGHT_MM = 85.6
const CARD_ASPECT = CARD_WIDTH_MM / CARD_HEIGHT_MM
const PLAYER_PHOTO_BUCKET = 'player-photos'

/* S1 via CSV global (optional, default an) */
const USE_S1_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S1_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

/* S6 via CSV global (optional, default an) */
const USE_S6_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S6_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

/* S4 via CSV global (optional, default an) */
const USE_S4_CSV = (() => {
  const v = process.env.NEXT_PUBLIC_USE_S4_CSV
  if (v === '0' || v === 'false') return false
  return true
})()

async function loadS1Map(gender: 'male' | 'female'): Promise<Record<string, number[]> | null> {
  const candidates = gender === 'male'
    ? [
        '/config/s1_male.csv',
        '/config/S1_Beweglichkeit_m.csv',
        '/config/s1_female.csv',
        '/config/S1_Beweglichkeit_w.csv',
        '/config/s1.csv',
      ]
    : ['/config/s1_female.csv', '/config/S1_Beweglichkeit_w.csv', '/config/s1.csv']
  for (const file of candidates) {
    try {
      const res = await fetch(file, { cache: 'no-store' })
      if (!res.ok) continue
      const text = await res.text()
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) continue
      const header = lines[0].split(';').map(s => s.trim())
      const ageCols = header.slice(1)
      const out: Record<string, number[]> = {}
      for (const age of ageCols) out[age] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(s => s.trim())
        for (let c = 1; c < cols.length; c++) {
          const age = ageCols[c - 1]
          const sec = Number((cols[c] || '').replace(',', '.'))
          if (Number.isFinite(sec)) out[age].push(sec)
        }
      }
      if (Object.keys(out).length) return out
    } catch {
      // ignore and try next candidate
    }
  }
  return null
}

async function loadS6Map(gender: 'male' | 'female'): Promise<Record<string, number[]> | null> {
  try {
    const file = gender === 'male' ? '/config/s6_male.csv' : '/config/s6_female.csv'
    const res = await fetch(file, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return null
    const header = lines[0].split(';').map(s => s.trim())
    const ageCols = header.slice(1)
    const out: Record<string, number[]> = {}
    for (const age of ageCols) out[age] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';').map(s => s.trim())
      for (let c = 1; c < cols.length; c++) {
        const age = ageCols[c - 1]
        const sec = Number((cols[c] || '').replace(',', '.'))
        if (Number.isFinite(sec)) out[age].push(sec) // Index 0 = 100 Punkte … 100 = 0 Punkte
      }
    }
    return out
  } catch {
    return null
  }
}

function statusText(status: CsvStatus) {
  if (status === 'ok') return 'geladen ✅'
  if (status === 'loading') return 'lädt …'
  if (status === 'fail') return 'nicht gefunden – Fallback aktiv ⚠️'
  return 'deaktiviert'
}

async function loadS4Map(): Promise<Record<string, number[]> | null> {
  try {
    const file = '/config/s4.csv'
    const res = await fetch(file, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length < 3) return null
    const header = lines[0].split(';').map(s => s.trim())
    const ageCols = header.slice(1)
    const out: Record<string, number[]> = {}
    for (const age of ageCols) out[age] = []
    // skip the second row (index 1) as it's empty or header-like
    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(';').map(s => s.trim())
      for (let c = 1; c < cols.length; c++) {
        const age = ageCols[c - 1]
        const kmh = Number((cols[c] || '').replace(',', '.'))
        if (Number.isFinite(kmh)) out[age].push(kmh)
      }
    }
    return out
  } catch {
    return null
  }
}

function nearestAgeBucket(age: number, keys: string[]): string {
  const parsed = keys.map(k => {
    const nums = k.match(/\d+/g)?.map(Number) || []
    const mid = nums.length === 2 ? (nums[0] + nums[1]) / 2 : (nums[0] || 0)
    return { key: k, mid }
  })
  parsed.sort((a, b) => Math.abs(a.mid - age) - Math.abs(b.mid - age))
  return parsed[0]?.key || keys[0]
}

/** Schrittlogik: schneller (t kleiner) → höherer Score. */
function scoreFromTimeStep(seconds: number, rows: number[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (seconds <= rows[i]) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}

/** Schrittlogik für S4: schneller (km/h größer) → höherer Score. */
function scoreFromSpeedStep(speed: number, rows: number[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (speed >= rows[i]) return Math.max(0, Math.min(100, 100 - i))
  }
  return 0
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normScore(st: Station, raw: number): number {
  const min = st.min_value ?? 0
  const max = st.max_value ?? 100
  if (max === min) return 0
  if (st.higher_is_better) return Math.round(clamp((raw - min) / (max - min), 0, 1) * 100)
  return Math.round(clamp((max - raw) / (max - min), 0, 1) * 100)
}

export default function ProjectDashboard() {
  const params = useParams<{ id: string }>()
  const projectId = params.id

  const [project, setProject] = useState<Project | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [meas, setMeas] = useState<Measurement[]>([])

  // Spieler-Form (Create/Update)
  const [editId, setEditId] = useState<string | ''>('')

  const [pName, setPName] = useState('')
  const [pYear, setPYear] = useState<number | ''>('')
  const [pClub, setPClub] = useState('')
  const [pNum, setPNum] = useState<number | ''>('')
  const [pPos, setPPos] = useState('')
  const [pNat, setPNat] = useState('')
  const [pGender, setPGender] = useState<'male' | 'female' | ''>('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoCleared, setPhotoCleared] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteId, setDeleteId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const refreshPlayers = useCallback(async (): Promise<Player[] | null> => {
    try {
      const res = await fetch(`/api/projects/${projectId}/players`, { cache: 'no-store' })
      if (!res.ok) {
        console.error('Spielerliste konnte nicht geladen werden.', await res.text())
        return null
      }
      const payload = await res.json().catch(() => ({}))
      const items: Player[] = payload.items || []
      setPlayers(items)
      return items
    } catch (err) {
      console.error('Spielerliste konnte nicht geladen werden.', err)
      return null
    }
  }, [projectId])

  const stopMediaStream = useCallback(() => {
    const stream = mediaStreamRef.current
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera wird nicht unterstützt.')
      return
    }

    try {
      setCameraError(null)
      // navigator.mediaDevices.getUserMedia({ video: true }) fragt beim ersten Zugriff automatisch nach
      // der Kamerafreigabe. Nutzer:innen müssen diese Bestätigung zulassen, damit der Stream startet.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      mediaStreamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
    } catch (err) {
      console.error('Webcam-Zugriff verweigert:', err)
      setCameraError('Kamera konnte nicht gestartet werden. Bitte Berechtigungen prüfen.')
      alert('Kamera konnte nicht geladen werden. Berechtigung fehlt.')
      stopMediaStream()
    }
  }, [stopMediaStream])

  useEffect(() => {
    return () => {
      stopMediaStream()
    }
  }, [stopMediaStream])

  useEffect(() => {
    if (!isPhotoDialogOpen) {
      stopMediaStream()
      return
    }
    startCamera()

    return () => {
      stopMediaStream()
    }
  }, [isPhotoDialogOpen, startCamera, stopMediaStream])

  useEffect(() => {
    if (!showDeleteDialog) return
    if (!players.length) {
      setDeleteId('')
      return
    }
    if (!players.some(p => p.id === deleteId)) {
      setDeleteId(players[0].id)
    }
  }, [deleteId, players, showDeleteDialog])

  function openPhotoCapture() {
    setCameraError(null)
    setIsPhotoDialogOpen(true)
  }

  function closePhotoCapture() {
    setIsPhotoDialogOpen(false)
    setIsUploadingPhoto(false)
    setCameraError(null)
    stopMediaStream()
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Kein Videosignal verfügbar.')
      return
    }

    let drawHeight = video.videoHeight
    let drawWidth = Math.round(drawHeight * CARD_ASPECT)
    if (drawWidth > video.videoWidth) {
      drawWidth = video.videoWidth
      drawHeight = Math.round(drawWidth / CARD_ASPECT)
    }

    const sx = Math.max(0, (video.videoWidth - drawWidth) / 2)
    const sy = Math.max(0, (video.videoHeight - drawHeight) / 2)
    const canvas = document.createElement('canvas')
    canvas.width = drawWidth
    canvas.height = drawHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setCameraError('Foto konnte nicht verarbeitet werden.')
      return
    }

    ctx.drawImage(video, sx, sy, drawWidth, drawHeight, 0, 0, drawWidth, drawHeight)
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )

    if (!blob) {
      setCameraError('Foto konnte nicht verarbeitet werden.')
      return
    }

    if (!editId) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setPhotoPreview(dataUrl)
      setPhotoBlob(blob)
      setPhotoCleared(false)
      setCameraError(null)
      closePhotoCapture()
      return
    }

    setIsUploadingPhoto(true)
    try {
      const filePath = `${projectId}/${editId}-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(PLAYER_PHOTO_BUCKET)
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(filePath)
      const publicUrl = data?.publicUrl
      if (!publicUrl) {
        throw new Error('Konnte keine Foto-URL ermitteln.')
      }

      const { error: updateError } = await supabase
        .from('players')
        .update({ photo_url: publicUrl })
        .eq('id', editId)
        .eq('project_id', projectId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setPhotoPreview(publicUrl)
      setPhotoBlob(null)
      setPhotoCleared(false)
      setCameraError(null)
      await refreshPlayers()
      closePhotoCapture()
    } catch (err) {
      console.error('Spielerfoto konnte nicht gespeichert werden.', err)
      alert('Spielerfoto konnte nicht gespeichert werden.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  function triggerPhotoUpload() {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Bitte eine Bilddatei auswählen.')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        setPhotoPreview(result)
      }
    }
    reader.readAsDataURL(file)
    setPhotoBlob(file)
    setPhotoCleared(false)
  }

  function clearPhoto() {
    setPhotoPreview(null)
    setPhotoBlob(null)
    setPhotoCleared(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function openDeleteDialog() {
    if (!players.length) return
    const initial = editId && players.some(p => p.id === editId) ? editId : players[0].id
    setDeleteId(initial)
    setShowDeleteDialog(true)
  }

  function closeDeleteDialog() {
    setShowDeleteDialog(false)
  }

  async function deletePlayerById(id: string, opts?: { skipConfirm?: boolean }) {
    if (!id) return false

    if (!opts?.skipConfirm) {
      const yes = confirm('Willst du wirklich diesen Spieler löschen?')
      if (!yes) return false
    }

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/players?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const text = await res.text()
        alert(text || 'Fehler beim Löschen')
        return false
      }

      const nextPlayers = (await refreshPlayers()) ?? []

      if (editId === id) {
        resetForm()
      }

      if (showDeleteDialog) {
        if (nextPlayers.length) {
          setDeleteId(nextPlayers[0].id)
        } else {
          setDeleteId('')
        }
      }

      return true
    } catch (err) {
      alert('Fehler beim Löschen')
      return false
    } finally {
      setIsDeleting(false)
    }
  }

  async function confirmDeleteFromDialog() {
    if (!deleteId) return
    const success = await deletePlayerById(deleteId, { skipConfirm: true })
    if (success) {
      closeDeleteDialog()
    }
  }

  // S1 CSV (global)
  const [s1Female, setS1Female] = useState<Record<string, number[]> | null>(null)
  const [s1Male, setS1Male] = useState<Record<string, number[]> | null>(null)
  const [s1Status, setS1Status] = useState<CsvStatus>(USE_S1_CSV ? 'loading' : 'off')

  // S6 CSV (global)
  const [s6Female, setS6Female] = useState<Record<string, number[]> | null>(null)
  const [s6Male, setS6Male] = useState<Record<string, number[]> | null>(null)
  const [s6Status, setS6Status] = useState<CsvStatus>(USE_S6_CSV ? 'loading' : 'off')

  // S4 CSV (global, no gender distinction)
  const [s4Map, setS4Map] = useState<Record<string, number[]> | null>(null)
  const [s4Status, setS4Status] = useState<CsvStatus>(USE_S4_CSV ? 'loading' : 'off')

  /* Laden */
  useEffect(() => {
    fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(res => setProject(res.item || null))
      .catch(() => setProject(null))

    fetch(`/api/projects/${projectId}/stations`, { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        const items: Station[] = res.items ?? []
        const st: Station[] = items.slice().sort((a: Station, b: Station) => {
          const ia = ST_ORDER.indexOf(a.name as typeof ST_ORDER[number])
          const ib = ST_ORDER.indexOf(b.name as typeof ST_ORDER[number])
          if (ia >= 0 && ib >= 0) return ia - ib
          if (ia >= 0) return -1
          if (ib >= 0) return 1
          return a.name.localeCompare(b.name, 'de')
        })
        setStations(st)
      })

    void refreshPlayers()

    fetch(`/api/projects/${projectId}/measurements`, { cache: 'no-store' })
      .then(r => r.json())
      .then(res => setMeas(res.items || []))
  }, [projectId, refreshPlayers])

  // S1 CSV global laden
  useEffect(() => {
    if (!USE_S1_CSV) {
      setS1Status('off')
      return
    }
    setS1Status('loading')
    Promise.allSettled([loadS1Map('female'), loadS1Map('male')]).then(([f, m]) => {
      const fOK = f.status === 'fulfilled' && f.value
      const mOK = m.status === 'fulfilled' && m.value
      if (fOK) setS1Female(f.value as Record<string, number[]>)
      if (mOK) setS1Male(m.value as Record<string, number[]>)
      setS1Status(fOK || mOK ? 'ok' : 'fail')
    })
  }, [])

  // S6 CSV global laden
  useEffect(() => {
    if (!USE_S6_CSV) {
      setS6Status('off')
      return
    }
    setS6Status('loading')
    Promise.allSettled([loadS6Map('female'), loadS6Map('male')]).then(([f, m]) => {
      const fOK = f.status === 'fulfilled' && f.value
      const mOK = m.status === 'fulfilled' && m.value
      if (fOK) setS6Female(f.value as any)
      if (mOK) setS6Male(m.value as any)
      setS6Status(fOK || mOK ? 'ok' : 'fail')
    })
  }, [])

  // S4 CSV global laden
  useEffect(() => {
    if (!USE_S4_CSV) {
      setS4Status('off')
      return
    }
    setS4Status('loading')
    loadS4Map().then(map => {
      if (map) {
        setS4Map(map)
        setS4Status('ok')
      } else {
        setS4Status('fail')
      }
    })
  }, [])

  const measByPlayerStation = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const m of meas) {
      if (!map[m.player_id]) map[m.player_id] = {}
      map[m.player_id][m.station_id] = Number(m.value || 0)
    }
    return map
  }, [meas])

  /* Alter/Scoring */
  const eventYear = useMemo(() => {
    return project?.date ? Number(String(project.date).slice(0, 4)) : new Date().getFullYear()
  }, [project?.date])

  function resolveAge(by: number | null): number {
    if (!by) return 16
    return Math.max(6, Math.min(49, eventYear - by))
  }

  function scoreFor(st: Station, p: Player, raw: number): number {
    const n = st.name.toLowerCase()
    if (n.includes('beweglichkeit')) {
      if (USE_S1_CSV) {
        const map = p.gender === 'male' ? s1Male : s1Female
        if (map) {
          const keys = Object.keys(map)
          if (keys.length) {
            const bucket = nearestAgeBucket(resolveAge(p.birth_year), keys)
            const rows = map[bucket] || []
            if (rows.length) return scoreFromTimeStep(Number(raw), rows)
          }
        }
      }
      return normScore({ ...st, min_value: 10, max_value: 40, higher_is_better: false }, Number(raw))
    }
    if (n.includes('schnelligkeit')) {
      // S6 via CSV (falls da), sonst Fallback
      if (USE_S6_CSV) {
        const map = p.gender === 'male' ? s6Male : s6Female
        if (map) {
          const keys = Object.keys(map)
          if (keys.length) {
            const bucket = nearestAgeBucket(resolveAge(p.birth_year), keys)
            const rows = map[bucket] || []
            if (rows.length) return scoreFromTimeStep(Number(raw), rows)
          }
        }
      }
      // Fallback: 4–20 s → 100–0 (weniger ist besser)
      return normScore({ ...st, min_value: 4, max_value: 20, higher_is_better: false }, Number(raw))
    }
    if (n.includes('schusskraft')) {
      // S4 via CSV (falls da), sonst Fallback
      if (USE_S4_CSV && s4Map) {
        const keys = Object.keys(s4Map)
        if (keys.length) {
          const bucket = nearestAgeBucket(resolveAge(p.birth_year), keys)
          const rows = s4Map[bucket] || []
          if (rows.length) return scoreFromSpeedStep(Number(raw), rows)
        }
      }
      // Fallback: 0–150 km/h → 0–100 (höher = besser)
      return normScore({ ...st, min_value: 0, max_value: 150, higher_is_better: true }, Number(raw))
    }
    if (n.includes('passgenauigkeit')) {
      // Rohwert kommt in Capture bereits 0–100 (11/17/33-Gewichtung) → direkt
      return Math.round(clamp(Number(raw), 0, 100))
    }
    if (n.includes('schusspräzision')) {
      // 24 Punkte Max (oben 3x, unten 1x) → 0–100
      const pct = clamp(Number(raw) / 24, 0, 1)
      return Math.round(pct * 100)
    }
    return Math.round(normScore(st, Number(raw)))
  }

  const sortedStations = useMemo<Station[]>(() => {
    return stations.slice().sort((a: Station, b: Station) => {
      const ia = (ST_INDEX as any)[a.name] ?? 99
      const ib = (ST_INDEX as any)[b.name] ?? 99
      return ia - ib
    })
  }, [stations])

  const rows = useMemo(() => {
    type Row = {
      player: Player
      perStation: { id: string; name: string; raw: number | null; score: number | null; unit?: string | null }[]
      avg: number
    }
    const out: Row[] = players.map((p: Player) => {
      const perStation: Row['perStation'] = []
      let sum = 0,
        count = 0
      for (const st of sortedStations) {
        const raw = measByPlayerStation[p.id]?.[st.id]
        let sc: number | null = null
        if (typeof raw === 'number') {
          sc = scoreFor(st, p, raw)
          sum += sc
          count++
        }
        perStation.push({ id: st.id, name: st.name, raw: typeof raw === 'number' ? raw : null, score: sc, unit: st.unit })
      }
      const avg = count ? Math.round(sum / count) : 0
      return { player: p, perStation, avg }
    })
    out.sort((a, b) => b.avg - a.avg)
    return out
  }, [players, sortedStations, measByPlayerStation, s6Female, s6Male, s4Map, project, eventYear])

  /* Helpers: Formular befüllen/Reset */
  function fillForm(p: Player) {
    setEditId(p.id)
    setPName(p.display_name || '')
    setPYear(p.birth_year || '')
    setPClub(p.club || '')
    setPNum(typeof p.fav_number === 'number' ? p.fav_number : '')
    setPPos(p.fav_position || '')
    setPNat(p.nationality || '')
    setPGender((p.gender as any) || '')
    const existingPhoto = p.photo_url ?? null
    if (typeof existingPhoto === 'string' && existingPhoto) {
      setPhotoPreview(existingPhoto)
      setPhotoCleared(false)
    } else {
      setPhotoPreview(null)
      setPhotoCleared(false)
    }
    setPhotoBlob(null)
  }
  function resetForm() {
    setEditId('')
    setPName('')
    setPYear('')
    setPClub('')
    setPNum('')
    setPPos('')
    setPNat('')
    setPGender('')
    setPhotoPreview(null)
    setPhotoBlob(null)
    setPhotoCleared(false)
  }

  /* Actions: Create/Update/Delete */
  async function addOrUpdatePlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!pName.trim()) {
      alert('Bitte Name eingeben')
      return
    }
    if (!pYear || String(pYear).length !== 4) {
      alert('Bitte Jahrgang (YYYY) eingeben')
      return
    }
    const body = new FormData()
    body.append('display_name', pName.trim())
    body.append('birth_year', String(pYear))
    if (pClub) body.append('club', pClub)
    if (pNum !== '') body.append('fav_number', String(pNum))
    if (pPos) body.append('fav_position', pPos)
    if (pNat) body.append('nationality', pNat)
    if (pGender) body.append('gender', pGender)
    if (photoBlob) {
      const fileName = photoBlob instanceof File && photoBlob.name ? photoBlob.name : `player-${Date.now()}.jpg`
      body.append('photo', photoBlob, fileName)
    } else if (photoCleared && editId) {
      body.append('remove_photo', '1')
    }
    const method = editId ? 'PUT' : 'POST'
    if (editId) body.append('id', editId)
    const res = await fetch(`/api/projects/${projectId}/players`, { method, body })
    const js = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(js?.error || 'Fehler beim Speichern')
      return
    }
    await refreshPlayers()
    if (!editId) resetForm()
  }

  // abgeleitetes Alter (unter dem Jahrgang anzeigen)
  const derivedAge = useMemo(() => {
    if (!pYear || String(pYear).length !== 4) return null
    const a = Math.max(6, Math.min(49, eventYear - Number(pYear)))
    return a
  }, [pYear, eventYear])

  const photoButtonLabel = photoPreview ? 'Foto neu aufnehmen' : 'Foto aufnehmen'
  const canRemovePhoto = Boolean(photoPreview)
  const canDeletePlayers = players.length > 0
  const playercardHref = `/projects/${projectId}/playercard`
  const projectName = project?.name?.trim() ?? ''
  const matrixHeading = projectName || 'Spielermatrix'

  useEffect(() => {
    if (projectName) {
      document.title = projectName
    }
  }, [projectName])

  /* Render */
  return (
    <main>
      {/* Sektion 1: Spieler-Eingabe über player.jpg */}
      <section className="hero-full safe-area bg-player">
        <div className="matrix-shell matrix-shell--hero">
          <div className="matrix-hero__header">
            <div className="matrix-hero__title-group">
              <h1 className="matrix-hero__title hero-text">{matrixHeading}</h1>
              {project?.date && (
                <div className="matrix-hero__subtitle hero-sub">{String(project.date)}</div>
              )}
            </div>
            {project?.logo_url && (
              <img src={project.logo_url} alt="Logo" className="matrix-hero__logo" />
            )}
          </div>

          <div className="card-glass-dark max-w-5xl w-full">
            <div className="matrix-form__title">{editId ? 'Spieler bearbeiten' : 'Spieler hinzufügen'}</div>

            <form onSubmit={addOrUpdatePlayer} className="matrix-form grid gap-4 md:grid-cols-4">
              <div className="matrix-form__photo md:col-span-1">
                <div className="playercard-photo-wrapper">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt={pName ? `${pName} – Spielerfoto` : 'Spielerfoto'}
                      className="playercard-photo"
                    />
                  ) : (
                    <div className="playercard-photo playercard-photo--empty">
                      <span>Foto folgt</span>
                    </div>
                  )}
                </div>
                <div className="playercard-photo-hint">53,98 mm × 85,6 mm</div>
                <div className="player-photo-actions">
                  <button type="button" className="btn-secondary" onClick={openPhotoCapture}>
                    {photoButtonLabel}
                  </button>
                  <button type="button" className="btn-secondary" onClick={triggerPhotoUpload}>
                    Bild laden
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--danger"
                    onClick={clearPhoto}
                    disabled={!canRemovePhoto}
                  >
                    Bild löschen
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
              </div>

              <div className="md:col-span-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold mb-1">Name *</label>
                    <input
                      className="input"
                      value={pName}
                      onChange={e => setPName(e.target.value)}
                      placeholder="Vorname Nachname"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Jahrgang *</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      pattern="\d{4}"
                      placeholder="YYYY"
                      value={pYear}
                      onChange={e => setPYear(e.target.value as any)}
                    />
                    {derivedAge !== null && (
                      <div className="matrix-form__hint">
                        Alter am Eventdatum: <strong>{derivedAge}</strong>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Verein</label>
                    <input className="input" value={pClub} onChange={e => setPClub(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Lieblingsnummer</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={pNum}
                      onChange={e => setPNum(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Position</label>
                    <select className="input" value={pPos} onChange={e => setPPos(e.target.value)}>
                      <option value="">–</option>
                      {['TS', 'IV', 'AV', 'ZM', 'OM', 'LOM', 'ROM', 'ST'].map(x => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Nationalität</label>
                    <input
                      className="input"
                      value={pNat}
                      onChange={e => setPNat(e.target.value)}
                      placeholder="DE, FR, ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Geschlecht</label>
                    <select className="input" value={pGender} onChange={e => setPGender(e.target.value as any)}>
                      <option value="">–</option>
                      <option value="male">männlich</option>
                      <option value="female">weiblich</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-wrap items-center gap-3 justify-end">
                <button className="btn" type="submit">
                  {editId ? 'Spieler speichern' : 'Spieler anlegen'}
                </button>
                <Link href={`/capture?project=${projectId}`} className="btn">
                  Capture
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Sektion 2: Matrix über matrix.jpg mit „Glass“-Rahmen + Abstand & Hover */}
      <section className="bg-matrix page-pad">
        <div className="matrix-shell matrix-shell--table">
          <div className="matrix-header">
            <div className="matrix-header__title">
              <div className="matrix-title">{matrixHeading}</div>
              <p className="matrix-subtitle">
                Spieler-Matrix – Ø = Durchschnitt über alle erfassten Stationen. Klick auf einen Spieler lädt die Daten
                oben ins Formular.
              </p>
            </div>
            <div className="matrix-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={openDeleteDialog}
                disabled={!canDeletePlayers || isDeleting}
              >
                Spieler löschen
              </button>
              <Link href={playercardHref} className="btn-secondary">
                Playercard
              </Link>
            </div>
          </div>

          <div className="card-glass-dark table-dark overflow-x-auto">
            <table className="w-full text-sm matrix-table">
              <thead>
                <tr className="text-left">
                  <th className="p-2 whitespace-nowrap">Spieler</th>
                  <th className="p-2 whitespace-nowrap">Ø</th>
                  {stations.length
                    ? ST_ORDER.map(n => {
                        const st = stations.find(s => s.name === n)
                        return st ? (
                          <th key={st.id} className="p-2 whitespace-nowrap">
                            {st.name}
                          </th>
                        ) : null
                      })
                    : null}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ player, perStation, avg }) => (
                  <tr key={player.id} className="align-top hoverable-row" onClick={() => fillForm(player)} style={{ cursor: 'pointer' }}>
                    <td className="p-2 whitespace-nowrap font-medium">
                      {player.display_name}
                      {Number.isFinite(player.fav_number as any) ? ` #${player.fav_number}` : ''}
                    </td>
                    <td className="p-2">
                      <span className="badge-green">{avg}</span>
                    </td>
                    {perStation.map(cell => {
                      const score = cell.score
                      const raw = cell.raw
                      return (
                        <td key={cell.id} className="p-2">
                          {typeof score === 'number' ? (
                            <div>
                              <span className="badge-green">{score}</span>
                              <div className="text-[11px]" style={{ color: 'rgba(255,255,255,.75)' }}>
                                {typeof raw === 'number' ? `${raw}${cell.unit ? ` ${cell.unit}` : ''}` : '—'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,.7)' }}>
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={2 + stations.length} className="p-3 text-center" style={{ color: 'rgba(255,255,255,.85)' }}>
                      Noch keine Spieler.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(USE_S1_CSV || USE_S4_CSV || USE_S6_CSV) && (
            <div className="csv-status-note text-sm">
              {USE_S1_CSV && s1Status !== 'off' && (
                <div className="csv-status-note__line">S1-Tabellen: {statusText(s1Status)}</div>
              )}
              {USE_S4_CSV && s4Status !== 'off' && (
                <div className="csv-status-note__line">S4-Tabellen: {statusText(s4Status)}</div>
              )}
              {USE_S6_CSV && s6Status !== 'off' && (
                <div className="csv-status-note__line">S6-Tabellen: {statusText(s6Status)}</div>
              )}
            </div>
          )}
        </div>
      </section>

      {showDeleteDialog && (
        <div className="matrix-modal">
          <div className="matrix-modal__card card-glass-dark">
            <div className="matrix-modal__title">Spieler löschen</div>
            <p className="matrix-modal__text">
              Wähle den Spieler, der aus der Matrix entfernt werden soll.
            </p>
            <select
              className="input"
              value={deleteId}
              onChange={e => setDeleteId(e.target.value)}
            >
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.display_name}
                </option>
              ))}
            </select>
            <div className="matrix-modal__actions">
              <button type="button" className="btn-secondary" onClick={closeDeleteDialog} disabled={isDeleting}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmDeleteFromDialog}
                disabled={!deleteId || isDeleting}
              >
                {isDeleting ? 'Löschen…' : 'Spieler löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPhotoDialogOpen && (
        <div className="matrix-modal">
          <div className="matrix-modal__card card-glass-dark matrix-modal__card--wide">
            <div className="matrix-modal__title">Spielerfoto aufnehmen</div>
            <div className="camera-shell">
              <video ref={videoRef} className="camera-preview" playsInline autoPlay muted />
              {cameraError && <div className="camera-error">{cameraError}</div>}
            </div>
            <div className="matrix-modal__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closePhotoCapture}
                disabled={isUploadingPhoto}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn"
                onClick={capturePhoto}
                disabled={!!cameraError || isUploadingPhoto}
              >
                {isUploadingPhoto ? 'Speichern…' : 'Foto speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BackFab />
    </main>
  )
}
