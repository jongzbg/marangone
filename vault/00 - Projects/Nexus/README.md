# Nexus Social Network

A full-stack social network application built with Next.js and NestJS.

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **State:** React hooks + API calls

### Backend
- **Framework:** NestJS
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT (Passport)

## Project Structure

```
workspace/
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/          # Pages (App Router)
│   │   ├── components/    # React components
│   │   └── lib/          # Utilities (API client)
│   └── ...
│
└── server/                # NestJS backend
    ├── src/
    │   ├── auth/         # Authentication
    │   ├── posts/        # Posts module
    │   ├── users/        # Users module
    │   └── prisma/      # Database service
    └── prisma/
        └── schema.prisma # Database schema
```

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL
- Docker (optional)

### Backend
```bash
cd server
npm install
npx prisma generate
# Create .env from .env.example
docker-compose up -d  # Start Postgres
npm run start:dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

## Features

- [x] User registration & login
- [x] Create/edit/delete posts
- [x] Like & repost posts
- [x] Comments & threads
- [x] Follow/unfollow users
- [x] User profiles
- [x] Search users
- [x] Feed (For You / Following)
- [x] Top creators leaderboard
- [x] Avatar upload with Sharp processing (3 WebP sizes)
- [x] Banner upload

## Database Schema

See [[Database/Schema]] for details.

## API Reference

See [[Backend/API-Reference]] for endpoint documentation.