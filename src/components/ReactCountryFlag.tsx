import React from 'react'

type ReactCountryFlagProps = React.HTMLAttributes<HTMLSpanElement> & {
  countryCode: string
  svg?: boolean
}

const FLAG_CDN_BASE_URL = 'https://flagcdn.com'

function countryCodeToEmoji(code: string): string | null {
  if (code.length !== 2) return null
  const first = code.codePointAt(0)
  const second = code.codePointAt(1)
  if (!first || !second) return null
  if (first < 65 || first > 90 || second < 65 || second > 90) return null
  const base = 0x1f1e6
  return String.fromCodePoint(base + first - 65, base + second - 65)
}

export default function ReactCountryFlag({
  countryCode,
  svg = false,
  style,
  className,
  title,
  ...rest
}: ReactCountryFlagProps) {
  const normalized = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null
  }

  if (svg) {
    const lower = normalized.toLowerCase()
    const imgProps = rest as React.ImgHTMLAttributes<HTMLImageElement>
    const alt = imgProps.alt ?? title ?? normalized
    const loading = imgProps.loading ?? 'lazy'
    return (
      <img
        {...imgProps}
        src={`${FLAG_CDN_BASE_URL}/${lower}.svg`}
        alt={alt}
        title={title ?? imgProps.title}
        loading={loading}
        style={style}
        className={className}
        decoding={imgProps.decoding ?? 'async'}
      />
    )
  }

  const emoji = countryCodeToEmoji(normalized)
  if (!emoji) return null

  const ariaLabel = (rest as { 'aria-label'?: string })['aria-label']

  return (
    <span
      {...rest}
      role="img"
      aria-label={ariaLabel ?? title ?? normalized}
      title={title}
      style={style}
      className={className}
    >
      {emoji}
    </span>
  )
}
