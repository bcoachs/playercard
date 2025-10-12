import React from 'react'

export type BackgroundOption = {
  id: string
  label: string
  type: 'gradient' | 'image'
  value: string
  thumbnail?: string
}

type BackgroundSelectorProps = {
  options: BackgroundOption[]
  selectedId: string
  onSelect: (id: string) => void
  manifestError?: boolean
}

export default function BackgroundSelector({ options, selectedId, onSelect, manifestError }: BackgroundSelectorProps) {
  return (
    <section className="playercard-background-selector">
      <div className="playercard-background-selector__header">
        <h3 className="playercard-background-selector__title">Hintergrund auswählen</h3>
        <p className="playercard-background-selector__subtitle">
          Wähle zwischen klaren Verläufen und atmosphärischen Stadion-Szenen.
        </p>
      </div>
      <div className="playercard-background-selector__grid" role="list">
        {options.map(option => {
          const isActive = option.id === selectedId
          const style =
            option.type === 'gradient'
              ? { backgroundImage: option.value }
              : { backgroundImage: `url(${option.thumbnail || option.value})` }
          return (
            <button
              key={option.id}
              type="button"
              className={`playercard-background-option${isActive ? ' playercard-background-option--active' : ''}`}
              style={style}
              onClick={() => onSelect(option.id)}
              aria-pressed={isActive}
            >
              <span className="playercard-background-option__label">{option.label}</span>
            </button>
          )
        })}
      </div>
      {manifestError && (
        <p className="playercard-background-selector__error">
          Zusätzliche Hintergründe konnten nicht geladen werden. Die Standard-Verläufe stehen weiterhin zur Verfügung.
        </p>
      )}
    </section>
  )
}
