# Prisma ORM

## What is Prisma?

An open-source next-generation ORM. Provides type-safe database access with auto-completion.

## Setup

```bash
npm install prisma @prisma/client
npx prisma init
```

## Schema Definition

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  posts     Post[]   // One-to-many
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
}
```

## Common Operations

### Create

```typescript
// Create user
const user = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    name: 'Alice',
  },
})

// Create with relation
const post = await prisma.post.create({
  data: {
    title: 'Hello',
    author: {
      connect: { id: userId },
    },
  },
})

// Create many
const users = await prisma.user.createMany({
  data: [
    { email: 'a@test.com', name: 'A' },
    { email: 'b@test.com', name: 'B' },
  ],
})
```

### Read

```typescript
// Find unique
const user = await prisma.user.findUnique({
  where: { id: '123' },
})

// Find first
const user = await prisma.user.findFirst({
  where: { email: { startsWith: 'admin' } },
})

// Find many
const posts = await prisma.post.findMany({
  where: { published: true },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 5,
})

// Include relations
const user = await prisma.user.findUnique({
  where: { id: '123' },
  include: { posts: true },
})
```

### Update

```typescript
// Update single
const user = await prisma.user.update({
  where: { id: '123' },
  data: { name: 'New Name' },
})

// Update many
await prisma.post.updateMany({
  where: { published: false },
  data: { published: true },
})
```

### Delete

```typescript
// Delete single
await prisma.user.delete({
  where: { id: '123' },
})

// Delete many
await prisma.user.deleteMany({
  where: { email: { endsWith: '@temp.com' } },
})
```

## Query Conditions

```typescript
// AND
where: { AND: [{ published: true }, { title: 'Hello' }] }

// OR
where: { OR: [{ title: 'A' }, { title: 'B' }] }

// NOT
where: { NOT: { published: false } }

// Comparisons
where: {
  age: { gt: 18 },
  email: { contains: '@gmail.com' },
  name: { in: ['Alice', 'Bob'] },
}
```

## Relations

### One-to-One

```prisma
model User {
  id     String @id
  profile Profile?
}

model Profile {
  id     String @id
  userId String @unique  // Foreign key
  user   User   @relation(fields: [userId], references: [id])
}
```

### One-to-Many

```prisma
model User {
  id    String @id
  posts Post[]
}

model Post {
  id     String @id
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

### Many-to-Many

```prisma
model Post {
  id     String   @id
  tags   Tag[]
}

model Tag {
  id    String   @id
  posts Post[]
}
```

## Aggregation

```typescript
const count = await prisma.post.count({
  where: { published: true },
})

const _count = await prisma.user.findMany({
  include: {
    _count: { select: { posts: true } },
  },
})
```

## Pagination

```typescript
// Offset pagination
const posts = await prisma.post.findMany({
  take: 10,
  skip: 20,
})

// Cursor pagination (better for large datasets)
const posts = await prisma.post.findMany({
  take: 10,
  skip: 1,
  cursor: { id: 'last-id' },
})
```

## Migrations

```bash
# Create migration
npx prisma migrate dev --name add_posts

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset
```

## Generate Client

```bash
npx prisma generate
```

After generating, import in code:
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
```