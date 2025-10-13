import React from 'react'

type PlayerHeaderProps = {
  projectName: string
  players: { id: string; display_name: string }[]
  player: {
    display_name: string
    fav_position: string | null
    club: string | null
    nationality: string | null
    fav_number: number | null
  } | null
  selectedPlayerId: string
  onSelectPlayer: (id: string) => void
  age: number | null
  nationalityCode: string | null
  nationalityLabel: string | null
  totalScore: number | null
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '–'
  if (typeof value === 'number') return value.toString()
  return value
}

export default function PlayerHeader({
  projectName,
  players,
  player,
  selectedPlayerId,
  onSelectPlayer,
  age,
  nationalityCode,
  nationalityLabel,
  totalScore,
}: PlayerHeaderProps) {
  const rawNationality = nationalityLabel ?? player?.nationality ?? null
  const nationalityText =
    typeof rawNationality === 'string' ? (rawNationality.trim().length ? rawNationality.trim() : null) : rawNationality
  const nationalityCodeLower = nationalityCode ? nationalityCode.toLowerCase() : null
  const nationalityFlagUrl = nationalityCodeLower ? `https://flagcdn.com/h40/${nationalityCodeLower}.png` : null
  const nationalityFlagSrcSet = nationalityCodeLower
    ? `https://flagcdn.com/h40/${nationalityCodeLower}.png 1x, https://flagcdn.com/h80/${nationalityCodeLower}.png 2x`
    : null

  return (
    <header className="playercard-header">
      <div className="playercard-header__title-group">
        <div className="playercard-header__eyebrow">{projectName}</div>
        <h1 className="playercard-header__title">{player?.display_name || 'Spieler auswählen'}</h1>
        <p className="playercard-header__subtitle">
          Steckbrief und Leistungsprofil auf einen Blick – ideal für Scouting, Social Media und personalisierte
          Highlights.
        </p>
      </div>
      <div className="playercard-header__meta">
        <label className="playercard-header__select-label" htmlFor="player-select">
          Spieler wählen
        </label>
        <select
          id="player-select"
          className="playercard-header__select"
          value={selectedPlayerId}
          onChange={event => onSelectPlayer(event.target.value)}
          disabled={!players.length}
        >
          {players.length === 0 ? (
            <option value="">Keine Spieler vorhanden</option>
          ) : (
            players.map(option => (
              <option key={option.id} value={option.id}>
                {option.display_name}
              </option>
            ))
          )}
        </select>
        <div className="playercard-header__details">
          <div className="playercard-detail">
            <span className="playercard-detail__label">Position</span>
            <span className="playercard-detail__value">{formatValue(player?.fav_position)}</span>
          </div>
          <div className="playercard-detail">
            <span className="playercard-detail__label">Verein</span>
            <span className="playercard-detail__value">{formatValue(player?.club)}</span>
          </div>
          <div className="playercard-detail">
            <span className="playercard-detail__label">Nationalität</span>
            <span className="playercard-detail__value">
              {nationalityFlagUrl && (
                <img
                  src={nationalityFlagUrl}
                  srcSet={nationalityFlagSrcSet ?? undefined}
                  alt=""
                  width={36}
                  height={24}
                  className="playercard-detail__flag"
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              )}
              {nationalityText ? (
                <span>{nationalityText}</span>
              ) : !nationalityFlagUrl ? (
                <span>–</span>
              ) : null}
            </span>
          </div>
          <div className="playercard-detail">
            <span className="playercard-detail__label">Nummer</span>
            <span className="playercard-detail__value">
              {player?.fav_number ? `#${player.fav_number}` : '–'}
            </span>
          </div>
          <div className="playercard-detail">
            <span className="playercard-detail__label">Alter</span>
            <span className="playercard-detail__value">{age ? `${age} Jahre` : '–'}</span>
          </div>
        </div>
      </div>
      {typeof totalScore === 'number' && (
        <div className="playercard-header__badge" aria-label="Durchschnittlicher Gesamtscore">
          <span className="playercard-header__badge-label">Gesamtscore</span>
          <span className="playercard-header__badge-value">{totalScore}</span>
        </div>
      )}
    </header>
  )
}
