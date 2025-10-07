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

function enhanceChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) {
      return child
    }

    const existingClassName = (child.props as any).className ?? ''
    const classList = typeof existingClassName === 'string'
      ? existingClassName.split(/\s+/).filter(Boolean)
      : []

    const hasBtn = classList.includes('btn')
    const needsSize = hasBtn && !classList.includes('btn-lg')

    const nextProps: Record<string, any> = {}

    if (needsSize) {
      nextProps.className = `${existingClassName} btn-lg`.trim()
    }

    if (child.props && child.props.children) {
      nextProps.children = enhanceChildren(child.props.children)
    }

    return Object.keys(nextProps).length > 0
      ? React.cloneElement(child, nextProps)
      : child
  })
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
      className={`relative grid ${align === 'center' ? 'place-items-center' : 'place-content-start'}`}
      style={{
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        backgroundImage: `url('${image}')`,
        backgroundRepeat: tileY ? 'repeat-y' : 'no-repeat',
        backgroundSize: tileY ? '100% auto' : 'cover',
        backgroundPosition: 'center top',
        color: '#fff',
        paddingTop: align === 'top' ? 24 : 0,
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
      <div
        className={`px-6 md:px-8 flex flex-col ${align === 'center'
          ? 'items-center text-center gap-12'
          : 'items-start text-left gap-6 pt-8'
        }`}
        style={{
          width: align === 'center' ? 'min(100%, 880px)' : 'min(100%, 1100px)',
          margin: align === 'center' ? '0 auto' : undefined,
        }}
      >
        <h1 className="hero-text hero-title font-league">{title}</h1>
        {subtitle && <p className={`hero-sub text-lg md:text-xl ${align === 'center' ? '' : 'text-left'}`}>{subtitle}</p>}
        {children && (
          <div className={`w-full ${align === 'center' ? 'flex justify-center' : ''}`}>
            {enhanceChildren(children)}
          </div>
        )}
      </div>
    </section>
  )
}
