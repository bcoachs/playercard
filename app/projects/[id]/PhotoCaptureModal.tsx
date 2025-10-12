"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

const CARD_ASPECT = 53.98 / 85.6

type PhotoCaptureModalProps = {
  projectId: string
  playerId: string | null
  onClose: () => void
  onLocalCapture: (payload: { dataUrl: string; file: File }) => void
  onExistingPlayerCapture: (publicUrl: string) => void
}

export default function PhotoCaptureModal({
  projectId,
  playerId,
  onClose,
  onLocalCapture,
  onExistingPlayerCapture,
}: PhotoCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const stopStream = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera wird nicht unterstützt.')
      return () => {
        stopStream()
      }
    }

    let cancelled = false

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.autoplay = true
          video.muted = true
          video.playsInline = true
          try {
            await video.play()
          } catch (err) {
            console.warn('Video konnte nicht automatisch gestartet werden.', err)
          }
        }
        setCameraError(null)
      } catch (err) {
        console.error('Webcam-Zugriff verweigert:', err)
        setCameraError('Kamera konnte nicht gestartet werden. Bitte Berechtigungen prüfen.')
        alert('Kamera konnte nicht geladen werden. Berechtigung fehlt.')
        stopStream()
      }
    }

    void initCamera()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [stopStream])

  const handleClose = useCallback(() => {
    stopStream()
    onClose()
  }, [onClose, stopStream])

  const capturePhoto = useCallback(async () => {
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
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      setCameraError('Foto konnte nicht verarbeitet werden.')
      return
    }

    if (!playerId) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const file = new File([blob], `player-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onLocalCapture({ dataUrl, file })
      handleClose()
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('project_id', projectId)
      formData.append('player_id', playerId)
      formData.append('photo', blob)

      const response = await fetch(`/api/projects/${projectId}/players`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Foto-Upload fehlgeschlagen')
      }

      const payload = await response.json().catch(() => ({}))
      const publicUrl: string | null = payload?.publicUrl ?? null
      if (!publicUrl) {
        throw new Error('Foto-Upload fehlgeschlagen')
      }

      onExistingPlayerCapture(publicUrl)
      handleClose()
    } catch (err) {
      console.error('Spielerfoto konnte nicht gespeichert werden.', err)
      alert('Spielerfoto konnte nicht gespeichert werden.')
    } finally {
      setIsUploading(false)
    }
  }, [handleClose, onExistingPlayerCapture, onLocalCapture, playerId, projectId])

  return (
    <div className="matrix-modal">
      <div className="matrix-modal__card card-glass-dark matrix-modal__card--wide">
        <div className="matrix-modal__title">Spielerfoto aufnehmen</div>
        <div className="camera-shell">
          <video ref={videoRef} className="camera-preview" playsInline autoPlay muted />
          {cameraError && <div className="camera-error">{cameraError}</div>}
        </div>
        <div className="matrix-modal__actions">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={isUploading}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn"
            onClick={capturePhoto}
            disabled={!!cameraError || isUploading}
          >
            {isUploading ? 'Speichern…' : 'Foto speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

