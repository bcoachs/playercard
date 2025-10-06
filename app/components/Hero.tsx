'use client'

import React, { useEffect } from 'react'

type Align = 'center' | 'top'

export default function Hero({
  title,
  subtitle,
  image = '/hero.jpg',
  topRightLogoUrl,
  align = 'center',     // <— NEU: center | top
  tileY = false,        // <— NEU: Hintergrund vertikal kacheln
  children,
}: {
  title: string
  subtitle?: string
  image?: string
  topRightLogoUrl?: string | null
  align?: Align
  tileY?: boolean
  children?: React.ReactNode
}) {
  // robuste Viewport-Höhe für Mobile
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    setVh()
    window.addEventListener('resize', setVh)
    window.addEventListener('orientationchange', setVh)
    return () => {
      window.removeEventListener('resize', setVh)
      window.removeEventListener('orientationchange', setVh)
    }
  }, [])

  return (
    <section
      className={`relative grid text-center ${align === 'center' ? 'place-content-center' : 'place-content-start'}`}
      style={{
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        backgroundImage: `url('${image}')`,
        backgroundRepeat: tileY ? 'repeat-y' : 'no-repeat',
        backgroundSize: tileY ? '100% auto' : 'cover',
        backgroundPosition: 'center top',
        color: '#fff',
        paddingTop: align === 'top' ? 24 : 0, // kleines Top-Padding im Top-Layout
      }}
    >
      {/* Optional: Logo oben rechts */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      {/* Inhalt */}
      <div className={`w-full max-w-6xl px-5 mx-auto ${align === 'top' ? 'pt-8' : ''}`}>
        <h1 className="hero-text text-7xl md:text-8xl font-extrabold uppercase">{title}</h1>
        {subtitle && <p className="hero-sub text-lg md:text-xl mt-2">{subtitle}</p>}
        {/*
          Wenn Children vorhanden sind, werden sie in einem flexiblen Container dargestellt.
          Dabei fügen wir jeder Schaltfläche automatisch die Klasse btn-lg hinzu. So bleiben
          alle Buttons im Hero konsistent groß, ohne dass jede Seite dies manuell setzen muss.
        */}
        {children && (
          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center items-center">
            {React.Children.map(children, child => {
              if (React.isValidElement(child)) {
                const existing = (child.props as any).className || ''
                // btn-lg nur einmal anfügen, falls noch nicht gesetzt
                const classes = existing.split(' ').includes('btn-lg')
                  ? existing
                  : `${existing} btn-lg`.trim()
                return React.cloneElement(child as React.ReactElement<any>, { className: classes })
              }
              return child
            })}
          </div>
        )}
      </div>
    </section>
  )
}
