import React, { RefObject, useMemo } from 'react'

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

function countryCodeToEmoji(code: string | null): string | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  if (normalized.length !== 2) return null
  const base = 0x1f1e6
  const first = normalized.codePointAt(0)
  const second = normalized.codePointAt(1)
  if (!first || !second) return null
  if (first < 65 || first > 90 || second < 65 || second > 90) return null
  return String.fromCodePoint(base + first - 65, base + second - 65)
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
  const displayName = (playerName || 'Spieler auswählen').toUpperCase()
  const displayScore = typeof totalScore === 'number' ? String(totalScore) : '–'
  const displayPosition = position ? position.toUpperCase() : '–'
  const displayNumber = typeof kitNumber === 'number' && Number.isFinite(kitNumber) ? `#${kitNumber}` : '#–'
  const flagEmoji = useMemo(() => countryCodeToEmoji(nationalityCode), [nationalityCode])

  const nationDisplay = useMemo(() => {
    if (flagEmoji) {
      return { type: 'emoji' as const, value: flagEmoji, label: nationalityLabel || 'Nationalflagge' }
    }
    if (nationalityLabel) {
      return { type: 'text' as const, value: nationalityLabel }
    }
    return null
  }, [flagEmoji, nationalityLabel])

  return (
    <div className="playercard-photo-card">
      <div className="playercard-photo-frame">
        <div className="playercard" ref={cardRef}>
          <div className="playercard__photo-area">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={playerName ? `Spielerfoto von ${playerName}` : 'Spielerfoto'}
                className="playercard__photo"
              />
            ) : (
              <div className="playercard__photo playercard__photo--empty">Kein Spielerfoto</div>
            )}
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
                {nationDisplay ? (
                  nationDisplay.type === 'emoji' ? (
                    <span className="playercard-info__emoji" role="img" aria-label={nationDisplay.label}>
                      {nationDisplay.value}
                    </span>
                  ) : (
                    <span className="playercard-info__value">{nationDisplay.value}</span>
                  )
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
                <span className="playercard-station__label">{station.label}</span>
                <span className="playercard-station__value">
                  {typeof station.value === 'number' ? station.value : '–'}
                </span>
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
