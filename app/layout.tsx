// app/layout.tsx
import './globals.css'
import type { Metadata, Viewport } from 'next/document'

export const metadata: Metadata = {
  title: 'Soccer Club Playercard',
  description: 'Playercard Datenaufnahme & Auswertung für Fußball-Events',
  icons: {
    icon: '/favicon.ico',
  },
}

// 🔧 NEU: Viewport (ersetzt themeColor-Warnungen)
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        {/* Google Fonts – Inter */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          backgroundColor: '#ffffff',
          margin: 0,
          padding: 0,
        }}
      >
        {children}
      </body>
    </html>
  )
}
