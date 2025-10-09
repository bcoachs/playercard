// Diese Layout-Datei bildet den äußeren Rahmen für alle Seiten.
// Sie bindet die globale CSS-Datei ein und sorgt für eine einheitliche
// Schrift (Inter). Außerdem definiert sie Meta-Informationen und
// Viewport-Konfiguration.

import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, League_Gothic, Oswald } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const leagueGothic = League_Gothic({ subsets: ['latin'], variable: '--font-league-gothic', weight: '400' })
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: 'Soccer Club Playercard',
  description: 'Erfassung, Auswertung und Playercards für Fußball-Events.',
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  // Wichtig: themeColor gehört in viewport (nicht in metadata)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${inter.variable} ${leagueGothic.variable} ${oswald.variable}`}>{children}</body>
    </html>
  )
}
