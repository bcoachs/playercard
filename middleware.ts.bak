import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const cookie = req.cookies.get('app_auth')
  const hasCookie = cookie?.value === 'ok'
  const pass = process.env.APP_PASSWORD

  if (!pass) return NextResponse.next()

  if (!hasCookie && url.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api/health).*)'],
}
