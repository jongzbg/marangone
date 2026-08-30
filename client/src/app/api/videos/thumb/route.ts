import { NextResponse } from 'next/server'

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// GET /api/videos/thumb?id=809fbeb4
// Proxies to backend: http://localhost:3001/videos/809fbeb4/thumb.jpg
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return new NextResponse('Missing id', { status: 400 })

  const res = await fetch(`${SERVER_URL}/videos/${id}/thumb.jpg`)
  if (!res.ok) return new NextResponse('Not found', { status: 404 })

  const blob = await res.blob()
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}