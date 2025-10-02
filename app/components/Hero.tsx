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
  // Robuste Viewport-Höhe für Mobile (iOS/Android)
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
      className="relative text-center"
      style={{
        // Vollbild-Höhe, robust per --vh
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        // >>> HARTES CENTERING:
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',

        // Hintergrund
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
      }}
    >
      {/* Optionales Vereinslogo oben rechts */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      {/* Inhalt: steht durch das Flex-Centering MITTE/MITTE */}
      <div className="w-full max-w-6xl px-5">
        <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase">
          {title}
        </h1>
        {subtitle && (
          <p className="hero-sub text-lg md:text-xl mt-2">{subtitle}</p>
        )}
        {children && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
