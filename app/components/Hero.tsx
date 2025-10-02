'use client'

import { useEffect } from 'react'

export default function Hero({
  title,
  subtitle,
  image = '/hero.jpg',
  topRightLogoUrl,
  children,
}: {
  title: string
  subtitle?: string
  image?: string
  topRightLogoUrl?: string | null
  children?: React.ReactNode
}) {
  // robuste Viewport-Höhe (Mobile/iOS)
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
      // volle Höhe, Hintergrundbild
      className="relative"
      style={{
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
        // <<< HARTE Mitte-Mitte der gesamten Inhaltssäule:
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {/* Logo oben rechts (optional) */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      {/* Inhalt: eine vertikale Säule, zentriert, mit definierter Breite */}
      <div className="w-full max-w-6xl px-5">
        <div className="grid justify-items-center gap-6 text-center">
          {/* Titel 1.5× größer */}
          <h1 className="hero-text text-7xl md:text-8xl font-extrabold uppercase">
            {title}
          </h1>

          {subtitle && (
            <p className="hero-sub text-lg md:text-xl">{subtitle}</p>
          )}

          {/* Buttons: Gruppe zentriert */}
          {children && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
