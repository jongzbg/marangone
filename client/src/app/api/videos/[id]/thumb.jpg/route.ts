import { NextResponse } from 'next/server'

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// GET /api/videos/[id]/thumb.jpg
// Proxies to backend: http://localhost:3001/videos/[id]/thumb.jpg
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Try .jpg first, then fall back to .jpeg/.png if needed
  const res = await fetch(`${SERVER_URL}/videos/${id}/thumb.jpg`)
  if (!res.ok) {
    return new NextResponse('Not found', { status: 404 })
  }
  const blob = await res.blob()
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}