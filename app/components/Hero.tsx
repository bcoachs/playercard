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
  // 1% der aktuellen Viewport-Höhe als CSS-Variable --vh setzen
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
      // Grid: zentriert Tracks (vertikal + horizontal)
      className="relative grid place-content-center text-center"
      style={{
        // volle Höhe, robust auf allen Geräten
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
      }}
    >
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      <div className="w-full max-w-6xl px-5">
        <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase">
          {title}
        </h1>
        {subtitle && <p className="hero-sub text-lg md:text-xl mt-2">{subtitle}</p>}
        {children && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
