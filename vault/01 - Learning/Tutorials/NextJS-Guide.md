# Next.js Quick Guide

## What is Next.js?

A React framework for building full-stack web applications. Features include:
- Server-side rendering (SSR)
- Static site generation (SSG)
- App Router (modern approach)
- API routes

## Project Setup

```bash
npx create-next-app@latest my-app
cd my-app
npm run dev
```

## App Router Structure

```
src/
├── app/
│   ├── page.tsx              # Home page (/)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── about/
│   │   └── page.tsx         # /about
│   ├── users/
│   │   └── [id]/
│   │       └── page.tsx      # /users/:id
│   └── api/                  # API routes
│       └── users/
│           └── route.ts
├── components/
│   └── ui/
│       └── Button.tsx
└── lib/
    └── utils.ts
```

## Page Component

```typescript
// app/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>Welcome</h1>
      <p>This is the home page</p>
    </main>
  )
}
```

## Dynamic Routes

```typescript
// app/users/[id]/page.tsx
import { useParams } from 'next/navigation'

export default function UserPage() {
  const params = useParams()
  const userId = params.id  // URL: /users/123 → userId = "123"

  return <div>User ID: {userId}</div>
}
```

## Client Components

Add `'use client'` for interactivity:

```typescript
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}
```

## Fetching Data

### Client-side (useEffect)

```typescript
'use client'
import { useEffect, useState } from 'react'

export default function Posts() {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(data => setPosts(data))
  }, [])

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Server Component (direct fetch)

```typescript
async function getPosts() {
  const res = await fetch('http://api/posts')
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

## API Routes

```typescript
// app/api/posts/route.ts
export async function GET() {
  const posts = await prisma.post.findMany()
  return Response.json(posts)
}

export async function POST(request: Request) {
  const body = await request.json()
  const post = await prisma.post.create({ data: body })
  return Response.json(post)
}
```

## Routing

### Link Component

```typescript
import Link from 'next/link'

export function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/users/123">User 123</Link>
    </nav>
  )
}
```

### useRouter (Client)

```typescript
'use client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return <button onClick={handleLogout}>Logout</button>
}
```

## Styling with Tailwind

```tsx
export default function Card({ title, content }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-2 text-gray-600">{content}</p>
    </div>
  )
}
```

## Layouts

### Root Layout

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <nav className="p-4 bg-white shadow">
          <a href="/">Logo</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

## Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Access in code:
```typescript
process.env.DATABASE_URL
process.env.NEXT_PUBLIC_API_URL  // Client-safe
```

## Common Patterns

### Form Submission

```typescript
'use client'
export function ContactForm() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Submit form...
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <button disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
```

### Optimistic Updates

```typescript
const [posts, setPosts] = useState([])

const addPost = async (content: string) => {
  // 1. Optimistic update
  const tempPost = { id: 'temp', content, likes: 0 }
  setPosts(prev => [tempPost, ...prev])

  // 2. Send to server
  try {
    const res = await api.createPost(content)
    // 3. Replace temp with real
    setPosts(prev => prev.map(p => p.id === 'temp' ? res.data : p))
  } catch {
    // 4. Rollback
    setPosts(prev => prev.filter(p => p.id !== 'temp'))
  }
}
```

## Useful Commands

```bash
npm run dev        # Development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```