import type { HTMLAttributes } from 'react'

type ReactCountryFlagProps = HTMLAttributes<HTMLSpanElement> & {
  countryCode: string
}

function countryCodeToEmoji(code: string): string | null {
  if (code.length !== 2) return null
  const first = code.codePointAt(0)
  const second = code.codePointAt(1)
  if (!first || !second) return null
  if (first < 65 || first > 90 || second < 65 || second > 90) return null
  const base = 0x1f1e6
  return String.fromCodePoint(base + first - 65, base + second - 65)
}

export default function ReactCountryFlag({ countryCode, title, ...rest }: ReactCountryFlagProps) {
  const normalized = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null
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
    >
      {emoji}
    </span>
  )
}
