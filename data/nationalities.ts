export type NationalityOption = {
  code: string
  name: string
  flag: string
}

export const NATIONALITIES: NationalityOption[] = [
  { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
  { code: 'AT', name: 'Österreich', flag: '🇦🇹' },
  { code: 'CH', name: 'Schweiz', flag: '🇨🇭' },
  { code: 'FR', name: 'Frankreich', flag: '🇫🇷' },
  { code: 'IT', name: 'Italien', flag: '🇮🇹' },
  { code: 'ES', name: 'Spanien', flag: '🇪🇸' },
  { code: 'NL', name: 'Niederlande', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgien', flag: '🇧🇪' },
  { code: 'GB', name: 'England', flag: '🏴' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'BR', name: 'Brasilien', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentinien', flag: '🇦🇷' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'PL', name: 'Polen', flag: '🇵🇱' },
  { code: 'HR', name: 'Kroatien', flag: '🇭🇷' },
]

export function findNationality(code: string | null | undefined) {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  return NATIONALITIES.find(option => option.code === normalized) || null
}
