// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Soccer Club Playercard',
  description: 'Projekt anlegen, Spieler erfassen, Stationen messen & Playercards generieren.',
  themeColor: '#ec0347',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
