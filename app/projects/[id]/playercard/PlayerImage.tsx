import React from 'react'

type PlayerImageProps = {
  imageSrc: string | null
  isProcessing: boolean
  onTriggerUpload: () => void
  onReset?: () => void
  onReapply?: () => void
  errorMessage: string | null
  hasImage: boolean
}

export default function PlayerImage({
  imageSrc,
  isProcessing,
  onTriggerUpload,
  onReset,
  onReapply,
  errorMessage,
  hasImage,
}: PlayerImageProps) {
  return (
    <div className="playercard-photo-card">
      <div className="playercard-photo-frame" aria-live="polite">
        {imageSrc ? (
          <img src={imageSrc} alt="Freigestelltes Spielerfoto" className="playercard-photo-frame__image" />
        ) : (
          <div className="playercard-photo-placeholder">
            <span>Kein Bild vorhanden</span>
            <small>Lade ein Foto hoch oder verwende ein bestehendes Spielerbild.</small>
          </div>
        )}
        <div className="playercard-photo-frame__border" aria-hidden="true" />
      </div>
      <div className="playercard-photo-actions">
        <button type="button" className="btn" onClick={onTriggerUpload} disabled={isProcessing}>
          {hasImage ? 'Neues Bild hochladen' : 'Bild hochladen'}
        </button>
        {onReapply && (
          <button type="button" className="btn-secondary" onClick={onReapply} disabled={isProcessing}>
            Freistellung erneut anwenden
          </button>
        )}
        {onReset && (
          <button type="button" className="btn-secondary" onClick={onReset} disabled={isProcessing}>
            Original verwenden
          </button>
        )}
      </div>
      <div className="playercard-photo-status">
        {isProcessing && <span className="playercard-photo-status__loading">Modell lädt – bitte warten …</span>}
        {errorMessage && (
          <p className="playercard-photo-status__error">
            Hintergrundfreistellung fehlgeschlagen: {errorMessage}
          </p>
        )}
        {!isProcessing && !errorMessage && (
          <span className="playercard-photo-status__hint">1080 × 1920 px • Transparentes PNG empfohlen</span>
        )}
      </div>
    </div>
  )
}
