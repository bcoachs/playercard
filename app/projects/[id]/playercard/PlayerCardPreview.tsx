import React, {
  CSSProperties,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const PLACEHOLDER_IMAGE = '/public/placeholder.png'
const MAX_ZOOM_MULTIPLIER = 4
const WHEEL_ZOOM_SENSITIVITY = 0.0022
const ZOOM_STEP_FACTOR = 1.18

export type PlayerCardStationValue = {
  label: string
  value: number | null
}

type PhotoOffset = { x: number; y: number }

type PlayerCardPreviewProps = {
  imageSrc: string | null
  onTriggerUpload: () => void
  onReset?: () => void
  errorMessage: string | null
  hasImage: boolean
  cardRef: RefObject<HTMLDivElement>
  playerName: string | null
  position: string | null
  totalScore: number | null
  nationalityCode: string | null
  nationalityLabel: string | null
  clubLogoUrl: string | null
  kitNumber: number | null
  stationValues: PlayerCardStationValue[]
  cardBackgroundStyle?: CSSProperties
  photoOffset: PhotoOffset
  onPhotoOffsetChange?: (offset: PhotoOffset) => void
  onImageLoad?: () => void
}

type TransformState = {
  offsetX: number
  offsetY: number
  scale: number
  minScale: number
  maxScale: number
}

type DragState = {
  pointerType: 'mouse' | 'touch'
  initialPointerX: number
  initialPointerY: number
  initialOffsetX: number
  initialOffsetY: number
  touchId?: number
}

type PinchState = {
  distance: number
  centerX: number
  centerY: number
}

type Size = { width: number; height: number }

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

export default function PlayerCardPreview({
  imageSrc,
  onTriggerUpload,
  onReset,
  errorMessage,
  hasImage,
  cardRef,
  playerName,
  position,
  totalScore,
  nationalityCode,
  nationalityLabel,
  clubLogoUrl,
  kitNumber,
  stationValues,
  cardBackgroundStyle,
  photoOffset,
  onPhotoOffsetChange,
  onImageLoad,
}: PlayerCardPreviewProps) {
  const [activeImageSrc, setActiveImageSrc] = useState<string>(imageSrc ?? PLACEHOLDER_IMAGE)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [transform, setTransform] = useState<TransformState>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    minScale: 1,
    maxScale: MAX_ZOOM_MULTIPLIER,
  })
  const [imageMetrics, setImageMetrics] = useState<Size>({ width: 0, height: 0 })
  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const transformRef = useRef(transform)
  const dragStateRef = useRef<DragState | null>(null)
  const pinchStateRef = useRef<PinchState | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const naturalSizeRef = useRef<Size>({ width: 0, height: 0 })
  const containerSizeRef = useRef<Size>({ width: 0, height: 0 })
  const onPhotoOffsetChangeRef = useRef<PlayerCardPreviewProps['onPhotoOffsetChange']>(onPhotoOffsetChange)
  const lastEmittedOffsetRef = useRef<PhotoOffset>({ x: photoOffset.x, y: photoOffset.y })

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  useEffect(() => {
    onPhotoOffsetChangeRef.current = onPhotoOffsetChange
  }, [onPhotoOffsetChange])

  useEffect(() => {
    const nextSrc = imageSrc ?? PLACEHOLDER_IMAGE
    setActiveImageSrc(nextSrc)
    setImageError(false)
    setImageLoaded(false)
    setTransform(prev => ({
      ...prev,
      offsetX: 0,
      offsetY: 0,
      scale: prev.minScale,
    }))
  }, [imageSrc])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const initialSize = { width: rect.width, height: rect.height }
    containerSizeRef.current = initialSize
    setContainerSize(initialSize)
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const size = { width, height }
        containerSizeRef.current = size
        setContainerSize(size)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const clampOffset = useCallback(
    (scale: number, offsetX: number, offsetY: number) => {
      const { width: containerWidth, height: containerHeight } = containerSizeRef.current
      const { width: imageWidth, height: imageHeight } = naturalSizeRef.current
      if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
        return { x: 0, y: 0 }
      }
      const scaledWidth = imageWidth * scale
      const scaledHeight = imageHeight * scale
      const halfContainerWidth = containerWidth / 2
      const halfContainerHeight = containerHeight / 2
      const horizontalReach = Math.max(halfContainerWidth, Math.abs((scaledWidth - containerWidth) / 2))
      const verticalReach = Math.max(halfContainerHeight, Math.abs((scaledHeight - containerHeight) / 2))
      return {
        x: clamp(offsetX, -horizontalReach, horizontalReach),
        y: clamp(offsetY, -verticalReach, verticalReach),
      }
    },
    [],
  )

  const updateTransform = useCallback(
    (updater: (prev: TransformState) => TransformState) => {
      setTransform(prev => {
        const next = updater(prev)
        const deltaScale = Math.abs(next.scale - prev.scale)
        const deltaX = Math.abs(next.offsetX - prev.offsetX)
        const deltaY = Math.abs(next.offsetY - prev.offsetY)
        const deltaMin = Math.abs(next.minScale - prev.minScale)
        const deltaMax = Math.abs(next.maxScale - prev.maxScale)
        if (deltaScale < 0.0001 && deltaX < 0.1 && deltaY < 0.1 && deltaMin < 0.0001 && deltaMax < 0.0001) {
          transformRef.current = prev
          return prev
        }
        transformRef.current = next
        const callback = onPhotoOffsetChangeRef.current
        if (callback) {
          const deltaEmitX = Math.abs(next.offsetX - lastEmittedOffsetRef.current.x)
          const deltaEmitY = Math.abs(next.offsetY - lastEmittedOffsetRef.current.y)
          if (deltaEmitX > 0.1 || deltaEmitY > 0.1) {
            lastEmittedOffsetRef.current = { x: next.offsetX, y: next.offsetY }
            callback({ x: next.offsetX, y: next.offsetY })
          }
        }
        return next
      })
    },
    [],
  )

  useEffect(() => {
    lastEmittedOffsetRef.current = { x: photoOffset.x, y: photoOffset.y }
    updateTransform(prev => {
      const clamped = clampOffset(prev.scale, photoOffset.x, photoOffset.y)
      if (Math.abs(clamped.x - prev.offsetX) < 0.1 && Math.abs(clamped.y - prev.offsetY) < 0.1) {
        return prev
      }
      return { ...prev, offsetX: clamped.x, offsetY: clamped.y }
    })
  }, [photoOffset.x, photoOffset.y, clampOffset, updateTransform])

  const recalcTransform = useCallback(
    (options?: { resetOffset?: boolean }) => {
      const { width: containerWidth, height: containerHeight } = containerSizeRef.current
      const { width: imageWidth, height: imageHeight } = naturalSizeRef.current
      if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
        updateTransform(prev => ({ ...prev, minScale: 1, maxScale: MAX_ZOOM_MULTIPLIER }))
        return
      }
      const rawMin = Math.min(containerWidth / imageWidth, containerHeight / imageHeight)
      const minScale = rawMin > 0 && Number.isFinite(rawMin) ? rawMin : 1
      const maxScale = Math.max(minScale * MAX_ZOOM_MULTIPLIER, minScale)
      updateTransform(prev => {
        const baseScale = options?.resetOffset ? minScale : clamp(prev.scale, minScale, maxScale)
        const baseOffsetX = options?.resetOffset ? 0 : prev.offsetX
        const baseOffsetY = options?.resetOffset ? 0 : prev.offsetY
        const clampedOffset = clampOffset(baseScale, baseOffsetX, baseOffsetY)
        return {
          offsetX: clampedOffset.x,
          offsetY: clampedOffset.y,
          scale: baseScale,
          minScale,
          maxScale,
        }
      })
    },
    [clampOffset, updateTransform],
  )

  useEffect(() => {
    recalcTransform({ resetOffset: true })
  }, [imageMetrics.width, imageMetrics.height, recalcTransform])

  useEffect(() => {
    recalcTransform()
  }, [containerSize.width, containerSize.height, recalcTransform])

  const zoomTo = useCallback(
    (nextScale: number, focalPoint?: { x: number; y: number }, deltaCenter?: { x: number; y: number }) => {
      const node = containerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const point = focalPoint ?? {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      updateTransform(prev => {
        const clampedScale = clamp(nextScale, prev.minScale, prev.maxScale)
        const originX = point.x - (rect.left + rect.width / 2)
        const originY = point.y - (rect.top + rect.height / 2)
        const translatedOffsetX = prev.offsetX + (deltaCenter?.x ?? 0)
        const translatedOffsetY = prev.offsetY + (deltaCenter?.y ?? 0)
        const pointerOffsetX = originX - translatedOffsetX
        const pointerOffsetY = originY - translatedOffsetY
        const scaleRatio = prev.scale === 0 ? 1 : clampedScale / prev.scale
        let nextOffsetX = originX - pointerOffsetX * scaleRatio
        let nextOffsetY = originY - pointerOffsetY * scaleRatio
        const clampedOffset = clampOffset(clampedScale, nextOffsetX, nextOffsetY)
        return {
          ...prev,
          scale: clampedScale,
          offsetX: clampedOffset.x,
          offsetY: clampedOffset.y,
        }
      })
    },
    [clampOffset, updateTransform],
  )

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const state = dragStateRef.current
      if (!state || state.pointerType !== 'mouse') return
      const nextX = state.initialOffsetX + (event.clientX - state.initialPointerX)
      const nextY = state.initialOffsetY + (event.clientY - state.initialPointerY)
      const currentScale = transformRef.current.scale
      const clamped = clampOffset(currentScale, nextX, nextY)
      updateTransform(prev => ({ ...prev, offsetX: clamped.x, offsetY: clamped.y }))
    },
    [clampOffset, updateTransform],
  )

  const handleMouseUp = useCallback(() => {
    const state = dragStateRef.current
    if (!state || state.pointerType !== 'mouse') return
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    dragStateRef.current = null
    setIsDragging(false)
  }, [handleMouseMove])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)
      const currentScale = transformRef.current.scale
      const targetScale = currentScale * factor
      zoomTo(targetScale, { x: event.clientX, y: event.clientY })
    },
    [zoomTo],
  )

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        const first = event.touches[0]
        const second = event.touches[1]
        const dx = second.clientX - first.clientX
        const dy = second.clientY - first.clientY
        const distance = Math.hypot(dx, dy)
        const centerX = (first.clientX + second.clientX) / 2
        const centerY = (first.clientY + second.clientY) / 2
        const previous = pinchStateRef.current
        if (distance > 0 && previous) {
          event.preventDefault()
          const deltaCenter = {
            x: centerX - previous.centerX,
            y: centerY - previous.centerY,
          }
          const ratio = distance / (previous.distance || distance)
          const currentScale = transformRef.current.scale
          const nextScale = currentScale * ratio
          zoomTo(nextScale, { x: centerX, y: centerY }, deltaCenter)
          pinchStateRef.current = {
            distance,
            centerX,
            centerY,
          }
        }
        return
      }
      const state = dragStateRef.current
      if (!state || state.pointerType !== 'touch') return
      const touch = Array.from(event.touches).find(item => item.identifier === state.touchId)
      if (!touch) return
      event.preventDefault()
      const nextX = state.initialOffsetX + (touch.clientX - state.initialPointerX)
      const nextY = state.initialOffsetY + (touch.clientY - state.initialPointerY)
      const currentScale = transformRef.current.scale
      const clamped = clampOffset(currentScale, nextX, nextY)
      updateTransform(prev => ({ ...prev, offsetX: clamped.x, offsetY: clamped.y }))
    },
    [clampOffset, updateTransform, zoomTo],
  )

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (pinchStateRef.current && event.touches.length < 2) {
        pinchStateRef.current = null
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
        window.removeEventListener('touchcancel', handleTouchEnd)
      }
      const state = dragStateRef.current
      if (!state || state.pointerType !== 'touch') return
      const ended = Array.from(event.changedTouches).some(item => item.identifier === state.touchId)
      if (!ended) return
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
      dragStateRef.current = null
      setIsDragging(false)
    },
    [handleTouchMove],
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

  const canZoomIn = transform.scale < transform.maxScale - 0.001
  const canZoomOut = transform.scale > transform.minScale + 0.001

  const scaledWidth = useMemo(() => imageMetrics.width * transform.scale, [imageMetrics.width, transform.scale])
  const scaledHeight = useMemo(
    () => imageMetrics.height * transform.scale,
    [imageMetrics.height, transform.scale],
  )

  const halfContainerWidth = containerSize.width / 2
  const halfContainerHeight = containerSize.height / 2
  const maxPanX = Math.max(halfContainerWidth, Math.abs((scaledWidth - containerSize.width) / 2))
  const maxPanY = Math.max(halfContainerHeight, Math.abs((scaledHeight - containerSize.height) / 2))
  const canPanX = maxPanX > 0.5
  const canPanY = maxPanY > 0.5
  const canPan = canPanX || canPanY

  const cursorStyle = isDragging ? 'grabbing' : canPan ? 'grab' : 'default'

  const startDrag = useCallback(
    (clientX: number, clientY: number, pointerType: 'mouse' | 'touch', touchId?: number) => {
      if (!canPan) return
      dragStateRef.current = {
        pointerType,
        initialPointerX: clientX,
        initialPointerY: clientY,
        initialOffsetX: transformRef.current.offsetX,
        initialOffsetY: transformRef.current.offsetY,
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
      setIsDragging(true)
    },
    [canPan, handleMouseMove, handleMouseUp, handleTouchEnd, handleTouchMove],
  )

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      startDrag(event.clientX, event.clientY, 'mouse')
    },
    [startDrag],
  )

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLImageElement>) => {
      if (event.touches.length >= 2) {
        event.preventDefault()
        const first = event.touches[0]
        const second = event.touches[1]
        const dx = second.clientX - first.clientX
        const dy = second.clientY - first.clientY
        dragStateRef.current = null
        setIsDragging(false)
        pinchStateRef.current = {
          distance: Math.hypot(dx, dy) || 1,
          centerX: (first.clientX + second.clientX) / 2,
          centerY: (first.clientY + second.clientY) / 2,
        }
        window.addEventListener('touchmove', handleTouchMove, { passive: false })
        window.addEventListener('touchend', handleTouchEnd)
        window.addEventListener('touchcancel', handleTouchEnd)
        return
      }
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      startDrag(touch.clientX, touch.clientY, 'touch', touch.identifier)
    },
    [handleTouchEnd, handleTouchMove, startDrag],
  )

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (naturalWidth > 0 && naturalHeight > 0) {
      const metrics = { width: naturalWidth, height: naturalHeight }
      naturalSizeRef.current = metrics
      setImageMetrics(metrics)
    }
    setImageLoaded(true)
    if (onImageLoad) {
      onImageLoad()
    }
  }, [onImageLoad])

  const handleImageError = useCallback(() => {
    if (!imageError) {
      console.warn('Spielerfoto konnte nicht geladen werden. Platzhalter wird genutzt.', {
        source: imageSrc ?? 'unbekannt',
      })
      setImageError(true)
      setActiveImageSrc(PLACEHOLDER_IMAGE)
    }
    setImageLoaded(false)
  }, [imageError, imageSrc])

  const zoomByStep = useCallback(
    (direction: 'in' | 'out') => {
      const factor = direction === 'in' ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR
      const targetScale = transformRef.current.scale * factor
      zoomTo(targetScale)
    },
    [zoomTo],
  )

  const isPlaceholderSource = !imageSrc || imageSrc === PLACEHOLDER_IMAGE

  const photoAlt = playerName
    ? `Spielerfoto von ${playerName}`
    : isPlaceholderSource || imageError
      ? 'Platzhalterfoto'
      : 'Spielerfoto'

  const resolvedNationalityLabel = nationalityLabel ?? null
  const flagUrl =
    nationalityCode && nationalityCode.length === 2
      ? `/flags/${nationalityCode.toLowerCase()}.png`
      : null

  const getProgressWidth = useCallback((value: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0
    return Math.min(100, Math.max(0, value))
  }, [])

  const combinedBackgroundStyle = useMemo(() => {
    if (!cardBackgroundStyle) return undefined
    const base: CSSProperties = {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
    return { ...base, ...cardBackgroundStyle }
  }, [cardBackgroundStyle])

  const isPlaceholderImage = isPlaceholderSource || imageError

  return (
    <div className="playercard-photo-card">
      <div
        className="playercard-photo-frame"
        data-image-loaded={imageLoaded ? 'true' : 'false'}
      >
        <div className="playercard-wrapper">
          <div className="playercard" id="playerCardRoot" ref={cardRef} style={combinedBackgroundStyle}>
            <div className="playercard__photo-area" ref={containerRef} onWheel={handleWheel}>
              <img
                src={activeImageSrc}
                alt={photoAlt}
                className={`playercard__photo${isPlaceholderImage ? ' playercard__photo--placeholder' : ''}`}
                style={{
                  transform: `translate3d(-50%, -50%, 0) translate3d(${transform.offsetX}px, ${transform.offsetY}px, 0) scale(${transform.scale})`,
                  cursor: cursorStyle,
                  userSelect: 'none',
                }}
                draggable={false}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onDragStart={event => event.preventDefault()}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              <div className="playercard__photo-controls">
                <div className="playercard__zoom-controls" data-export-ignore="true">
                  <button
                    type="button"
                    className="playercard__zoom-button"
                    onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      zoomByStep('out')
                    }}
                    disabled={!canZoomOut}
                    aria-label="Herauszoomen"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="playercard__zoom-button"
                    onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      zoomByStep('in')
                    }}
                    disabled={!canZoomIn}
                    aria-label="Hineinzoomen"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="playercard__info-rail">
              <div className="playercard-info playercard-info--score">
                <span className="playercard-info__value">{typeof totalScore === 'number' ? totalScore : '–'}</span>
                <span className="playercard-info__label">Score</span>
              </div>
              <div className="playercard-info">
                <span className="playercard-info__value">{position ? position.toUpperCase() : '–'}</span>
                <span className="playercard-info__label">Position</span>
              </div>
              <div className="playercard-info playercard-info--flag">
                {flagUrl ? (
                  <span
                    className="playercard-flag playercard-info__flag"
                    title={resolvedNationalityLabel ?? undefined}
                  >
                    <img
                      src={flagUrl}
                      alt={resolvedNationalityLabel ?? nationalityCode ?? ''}
                      className="playercard-flag-img"
                    />
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
                <span className="playercard-info__value">
                  {typeof kitNumber === 'number' && Number.isFinite(kitNumber) ? `#${kitNumber}` : '#–'}
                </span>
                <span className="playercard-info__label">Nummer</span>
              </div>
            </div>
            <div className="playercard__stations-panel playercard__stats-grid">
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
            <div className="playercard__name-banner">
              <span>{playerName || 'Spieler auswählen'}</span> 
            </div>
          </div>
        </div>
      </div>
      <div className="playercard-photo-actions">
        <button type="button" className="btn" onClick={onTriggerUpload}>
          {hasImage ? 'Neues Bild hochladen' : 'Bild hochladen'}
        </button>
        {onReset && (
          <button type="button" className="btn-secondary" onClick={onReset}>
            Original verwenden
          </button>
        )}
      </div>
      <div className="playercard-photo-status">
        {errorMessage ? (
          <p className="playercard-photo-status__error">{errorMessage}</p>
        ) : (
          <span className="playercard-photo-status__hint">1080 × 1920 px • PNG oder JPEG empfohlen</span>
        )}
      </div>
    </div>
  )
}
