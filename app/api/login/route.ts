import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const data = await req.formData()
  const pw = data.get('password')
  if (pw === process.env.APP_PASSWORD) {
    const res = NextResponse.redirect(new URL('/', req.url))
    res.cookies.set('app_auth', 'ok', { httpOnly: true, sameSite: 'lax', path: '/' })
    return res
  }
  return new NextResponse('Unauthorized', { status: 401 })
}
