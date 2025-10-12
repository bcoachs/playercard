import React from 'react'

export type PlayerStat = {
  id: string
  label: string
  score: number | null
  raw: number | null
  unit: string | null | undefined
}

type PlayerStatsProps = {
  stats: PlayerStat[]
  totalScore: number | null
  isLoading?: boolean
  loadError?: string | null
}

export default function PlayerStats({ stats, totalScore, isLoading, loadError }: PlayerStatsProps) {
  return (
    <section className="playercard-stats">
      <div className="playercard-stats__header">
        <h2 className="playercard-stats__title">Performance-Fokus</h2>
        {typeof totalScore === 'number' && (
          <span className="playercard-stats__overall" aria-label="Gesamtscore">
            Ø {totalScore}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="playercard-stats__state">Spielerdaten werden geladen …</div>
      ) : loadError ? (
        <div className="playercard-stats__state playercard-stats__state--error">{loadError}</div>
      ) : stats.length === 0 ? (
        <div className="playercard-stats__state">Noch keine Messwerte vorhanden.</div>
      ) : (
        <ul className="playercard-stats__list">
          {stats.map(stat => (
            <li key={stat.id} className="playercard-stat">
              <div className="playercard-stat__header">
                <span className="playercard-stat__label">{stat.label}</span>
                <span className="playercard-stat__value">{stat.score !== null ? stat.score : '–'}</span>
              </div>
              <div className="playercard-stat__bar" role="presentation">
                <div
                  className="playercard-stat__bar-fill"
                  style={{ width: `${stat.score !== null ? stat.score : 0}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="playercard-stat__meta">
                {stat.raw !== null ? `${stat.raw}${stat.unit ? ` ${stat.unit}` : ''}` : 'Keine Messung'}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="playercard-stats__hint">
        Passe Werte und Hintergründe an, um individuelle Highlight-Cards für dein Team zu erstellen.
      </p>
    </section>
  )
}
