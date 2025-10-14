import React, { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import ReactCountryFlag from 'react-country-flag'

const PLACEHOLDER_IMAGE = '/public/placeholder.png'

export type PlayerCardStationValue = {
  label: string
  value: number | null
}

type PlayerCardPreviewProps = {
  imageSrc: string | null
  isProcessing: boolean
  onTriggerUpload: () => void
  onReset?: () => void
  onReapply?: () => void
  errorMessage: string | null
  hasImage: boolean
  cardRef: RefObject<HTMLDivElement>
  onDownloadCard: () => void
  isDownloading: boolean
  playerName: string | null
  position: string | null
  totalScore: number | null
  nationalityCode: string | null
  nationalityLabel: string | null
  clubLogoUrl: string | null
  kitNumber: number | null
  stationValues: PlayerCardStationValue[]
}

export default function PlayerCardPreview({
  imageSrc,
  isProcessing,
  onTriggerUpload,
  onReset,
  onReapply,
  errorMessage,
  hasImage,
  cardRef,
  onDownloadCard,
  isDownloading,
  playerName,
  position,
  totalScore,
  nationalityCode,
  nationalityLabel,
  clubLogoUrl,
  kitNumber,
  stationValues,
}: PlayerCardPreviewProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragStateRef = useRef<{
    pointerType: 'mouse' | 'touch'
    initialPointerX: number
    initialPointerY: number
    initialOffsetX: number
    initialOffsetY: number
    touchId?: number
  } | null>(null)
  const offsetRef = useRef(offset)

  const displayName = (playerName || 'Spieler auswählen').toUpperCase()
  const displayScore = typeof totalScore === 'number' ? String(totalScore) : '–'
  const displayPosition = position ? position.toUpperCase() : '–'
  const displayNumber = typeof kitNumber === 'number' && Number.isFinite(kitNumber) ? `#${kitNumber}` : '#–'
  const resolvedImageSrc = imageSrc ?? PLACEHOLDER_IMAGE
  const isPlaceholderImage = !imageSrc

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    setOffset({ x: 0, y: 0 })
  }, [imageSrc])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const state = dragStateRef.current
    if (!state || state.pointerType !== 'mouse') return
    setOffset({
      x: state.initialOffsetX + (event.clientX - state.initialPointerX),
      y: state.initialOffsetY + (event.clientY - state.initialPointerY),
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    const state = dragStateRef.current
    if (!state || state.pointerType !== 'mouse') return
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    dragStateRef.current = null
  }, [handleMouseMove])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    const state = dragStateRef.current
    if (!state || state.pointerType !== 'touch') return
    const touch = Array.from(event.touches).find(item => item.identifier === state.touchId)
    if (!touch) return
    event.preventDefault()
    setOffset({
      x: state.initialOffsetX + (touch.clientX - state.initialPointerX),
      y: state.initialOffsetY + (touch.clientY - state.initialPointerY),
    })
  }, [])

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const state = dragStateRef.current
      if (!state || state.pointerType !== 'touch') return
      const ended = Array.from(event.changedTouches).some(item => item.identifier === state.touchId)
      if (!ended) return
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
      dragStateRef.current = null
    },
    [handleTouchMove],
  )

  const startDrag = useCallback(
    (clientX: number, clientY: number, pointerType: 'mouse' | 'touch', touchId?: number) => {
      dragStateRef.current = {
        pointerType,
        initialPointerX: clientX,
        initialPointerY: clientY,
        initialOffsetX: offsetRef.current.x,
        initialOffsetY: offsetRef.current.y,
        touchId,
      }
      if (pointerType === 'mouse') {
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
      } else {
        window.addEventListener('touchmove', handleTouchMove, { passive: false })
        window.addEventListener('touchend', handleTouchEnd)
        window.addEventListener('touchcancel', handleTouchEnd)
      }
    },
    [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd],
  )

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      event.preventDefault()
      startDrag(event.clientX, event.clientY, 'mouse')
    },
    [startDrag],
  )

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLImageElement>) => {
      if (event.touches.length === 0) return
      const touch = event.touches[0]
      event.preventDefault()
      startDrag(touch.clientX, touch.clientY, 'touch', touch.identifier)
    },
    [startDrag],
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  const photoAlt = playerName
    ? `Spielerfoto von ${playerName}`
    : isPlaceholderImage
      ? 'Platzhalterfoto'
      : 'Spielerfoto'

  const resolvedNationalityLabel = nationalityLabel ?? null

  const getProgressWidth = useCallback((value: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0
    return Math.min(100, Math.max(0, value))
  }, [])

  return (
    <div className="playercard-photo-card">
      <div className="playercard-photo-frame">
        <div className="playercard" ref={cardRef}>
          <div className="playercard__photo-area">
            <img
              src={resolvedImageSrc}
              alt={photoAlt}
              className={`playercard__photo${isPlaceholderImage ? ' playercard__photo--placeholder' : ''}`}
              style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, cursor: 'move', userSelect: 'none' }}
              draggable={false}
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
              onDragStart={event => event.preventDefault()}
            />
            <div className="playercard__info-rail">
              <div className="playercard-info playercard-info--score">
                <span className="playercard-info__value">{displayScore}</span>
                <span className="playercard-info__label">Score</span>
              </div>
              <div className="playercard-info">
                <span className="playercard-info__value">{displayPosition}</span>
                <span className="playercard-info__label">Position</span>
              </div>
              <div className="playercard-info playercard-info--flag">
                {nationalityCode ? (
                  <span className="playercard-info__flag" title={resolvedNationalityLabel ?? undefined}>
                    <ReactCountryFlag countryCode={nationalityCode} svg style={{ width: '100%', height: '100%' }} />
                  </span>
                ) : resolvedNationalityLabel ? (
                  <span className="playercard-info__value">{resolvedNationalityLabel}</span>
                ) : (
                  <span className="playercard-info__placeholder">–</span>
                )}
                <span className="playercard-info__label">Nation</span>
              </div>
              <div className="playercard-info playercard-info--logo">
                {clubLogoUrl ? (
                  <img src={clubLogoUrl} alt="Vereinslogo" className="playercard-info__logo" />
                ) : (
                  <span className="playercard-info__placeholder">&nbsp;</span>
                )}
                <span className="playercard-info__label">Verein</span>
              </div>
              <div className="playercard-info playercard-info--number">
                <span className="playercard-info__value">{displayNumber}</span>
                <span className="playercard-info__label">Nummer</span>
              </div>
            </div>
            <div className="playercard__name-banner">
              <span>{displayName}</span>
            </div>
          </div>
          <div className="playercard__stations-panel">
            {stationValues.map(station => (
              <div key={station.label} className="playercard-station">
                <div className="playercard-station__header">
                  <span className="playercard-station__label">{station.label}</span>
                  <span className="playercard-station__value">
                    {typeof station.value === 'number' ? station.value : '–'}
                  </span>
                </div>
                <div className="playercard-station__bar" role="presentation">
                  <div
                    className="playercard-station__bar-fill"
                    style={{ width: `${getProgressWidth(station.value)}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="playercard-photo-actions">
        <button type="button" className="btn" onClick={onTriggerUpload} disabled={isProcessing}>
          {hasImage ? 'Neues Bild hochladen' : 'Bild hochladen'}
        </button>
        {onReapply && (
          <button type="button" className="btn" onClick={onReapply} disabled={isProcessing}>
            Hintergrund freistellen
          </button>
        )}
        {onReset && (
          <button type="button" className="btn-secondary" onClick={onReset} disabled={isProcessing}>
            Original verwenden
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={onDownloadCard}
          disabled={isProcessing || isDownloading}
        >
          {isDownloading ? 'Exportiere …' : 'Download Karte'}
        </button>
      </div>
      <div className="playercard-photo-status">
        {isProcessing && <span className="playercard-photo-status__loading">Modell lädt – bitte warten …</span>}
        {errorMessage && <p className="playercard-photo-status__error">{errorMessage}</p>}
        {!isProcessing && !errorMessage && (
          <span className="playercard-photo-status__hint">1080 × 1920 px • Transparentes PNG empfohlen</span>
        )}
      </div>
    </div>
  )
}
