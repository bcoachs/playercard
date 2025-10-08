'use client'

import React, { useEffect } from 'react'

type Align = 'center' | 'top'

type HeroProps = {
  title: string
  subtitle?: string
  image?: string
  topRightLogoUrl?: string | null
  align?: Align
  tileY?: boolean
  children?: React.ReactNode
}

export default function Hero({
  title,
  subtitle,
  image = '/hero.jpg',
  topRightLogoUrl,
  align = 'center',
  tileY = false,
  children,
}: HeroProps) {
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
      className={`hero-shell ${align === 'top' ? 'hero-shell--top' : ''}`}
      style={{
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        backgroundImage: `url('${image}')`,
        backgroundRepeat: tileY ? 'repeat-y' : 'no-repeat',
        backgroundSize: tileY ? '100% auto' : 'cover',
        backgroundPosition: 'center top',
        color: '#fff',
      }}
    >
      {/* Optional: Logo oben rechts */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="hero-logo"
        />
      )}

      {/* Inhalt */}
      <div
        className={`hero-inner ${align === 'top' ? 'hero-inner--top' : ''}`}
      >
        <h1 className="hero-text hero-title font-league">{title}</h1>
        {subtitle && (
          <p className={`hero-sub hero-subtitle ${align === 'top' ? 'hero-subtitle--left' : ''}`}>
            {subtitle}
          </p>
        )}
        {children && (
          <div className={`hero-children ${align === 'top' ? 'hero-children--left' : ''}`}>
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
