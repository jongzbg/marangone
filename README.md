# Nexus Social Network

> **Full-stack social platform demonstrating production-grade NestJS + Next.js
> architecture**: real-time chat via Socket.io, video upload + multi-resolution
> encoding (BullMQ + FFmpeg.wasm), JWT authentication, Prisma schema with
> 12+ relations, and a Docker-first local dev experience.

Built as a portfolio showcase — clean separation between server (NestJS) and
client (Next.js), strict TypeScript across both, infrastructure-as-code via
Docker Compose, and zero secrets in git.

## ✨ Features

- **Posts & Feed** — text/image/video posts, likes, reposts, comments, hashtags
- **Social Graph** — follow/unfollow, follower/following counts, profile pages
- **Real-time Chat** — Socket.io gateway with conversation list and unread badges
- **Notifications** — in-app notification feed with read state
- **Video Pipeline** — upload via Multer → BullMQ job → FFmpeg.wasm encode to multiple resolutions → CDN-ready static serve
- **Image Pipeline** — Sharp-based image optimization on upload
- **Background Jobs** — BullMQ workers + scheduled tasks (chat cleanup, video cleanup, count reconciliation)

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js 14 (client)                       │
│     standalone build · TanStack Query · Zustand · Socket.io    │
│                         :3000                                   │
└──────────────────┬──────────────────────────────────────────────┘
                   │ REST + Socket.io
┌──────────────────▼──────────────────────────────────────────────┐
│                  NestJS 10 (server)                              │
│   Auth · Users · Posts · Chat · Hashtags · Notifications ·      │
│   Upload (image+video) · Maintenance · WebSocket Gateway       │
│                         :3001                                   │
└──────┬──────────────────────────────────┬──────────────────────┘
       │ Prisma                           │ BullMQ
┌──────▼──────────┐              ┌────────▼─────────┐
│ PostgreSQL 15   │              │    Redis 7       │
│  :5432 (5433)   │              │ :6379 (6380)     │
└─────────────────┘              └──────────────────┘
```

### Repository layout

| Path | Purpose |
|---|---|
| `server/` | NestJS API + Prisma + BullMQ workers |
| `client/` | Next.js 14 app (standalone output for Docker) |
| `ai-system/` | Internal docs for AI-assisted workflows (System Architect / UI Conversion / UI Pixel Polish agents) — kept for transparency on the build process |
| `vault/` | Obsidian knowledge base — architecture decisions, SSOT plan, schema notes, bug-fix history |
| `docker-compose.yml` | Local dev stack (db + redis + server + client) |

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Compose v2
- Optional: Node 20+ for running services outside Docker

### Run the full stack (recommended)

1. **Create your environment files** from the templates:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env.local
   ```

2. **Generate a JWT secret** and paste it into `server/.env`:

   ```bash
   openssl rand -hex 32
   ```

3. **Start the stack** (first run builds images, ~3-5 min):

   ```bash
   docker compose up -d --build
   ```

4. **Seed the database** (creates demo users):

   ```bash
   docker compose exec server npm run db:seed
   ```

5. **Open the app** at <http://localhost:3000> and sign in with one of the seed accounts:

   | Email | Password |
   |---|---|
   | `demouser@marangone.local` | (check seed output) |
   | `alice@example.com` | `password123` |
   | `bob@example.com` | `password123` |
   | `charlie@example.com` | `password123` |

### Run locally without Docker

Useful if you want hot-reload without container rebuilds.

**Server:**

```bash
cd server
npm install
npm run db:generate
DATABASE_URL=postgresql://nexus:***@localhost:5433/nexus npm run start:dev
```

**Client:**

```bash
cd client
npm install
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

You still need local PostgreSQL (or run only `db`/`redis` services via `docker compose up -d db redis`).

### Tear down

```bash
docker compose down -v   # -v removes the postgres volume
```

## 🛠 Tech Stack

**Backend**
- [NestJS 10](https://nestjs.com/) — modular HTTP + WebSocket framework
- [Prisma 5](https://www.prisma.io/) — typed ORM with migrations
- [BullMQ](https://docs.bullmq.io/) — Redis-backed job queue
- [Socket.io](https://socket.io/) — real-time bidirectional events
- [Passport JWT](https://www.passportjs.org/packages/passport-jwt/) — stateless auth
- [Sharp](https://sharp.pixelplumbing.com/) — server-side image optimization
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) — in-browser + server-side video encoding
- class-validator + class-transformer — DTO validation

**Frontend**
- [Next.js 14](https://nextjs.org/) (standalone output) — React 18 + App Router
- [TanStack Query v5](https://tanstack.com/query) — server-state cache
- [Zustand](https://github.com/pmndrs/zustand) — client-state store
- [Socket.io-client](https://socket.io/) — real-time client
- [Axios](https://axios-http.com/) — HTTP client
- [yet-another-react-lightbox](https://yet-another-react-lightbox.netlify.app/) — image gallery
- [emoji-mart](https://github.com/missive/emoji-mart) — emoji picker
- [Tailwind CSS 3](https://tailwindcss.com/) — styling

**Infrastructure**
- PostgreSQL 15 (alpine) — primary database
- Redis 7 (alpine) — cache + queue + socket adapter
- Docker Compose v2 — local dev stack
- Multi-stage Dockerfiles — production-ready images

## 🗄 Database Schema

12 tables (see [`server/prisma/schema.prisma`](server/prisma/schema.prisma)):

| Model | Purpose |
|---|---|
| `User` | Identity, profile, credentials (bcrypt) |
| `Post` | Top-level content (text/image/video) |
| `Comment` | Replies on posts |
| `Like` | Post likes |
| `Repost` | Quote / repost graph |
| `Follow` | Follower / following edges |
| `Hashtag` | Post tags |
| `Conversation` + `ConversationParticipant` | DM threads |
| `Message` | Chat messages |
| `Notification` | In-app notifications |
| `Video` | Video metadata (linked to Post, tracked through encoding pipeline) |

Migrations live under [`server/prisma/migrations`](server/prisma/migrations).

## 📡 API Surface

Base URL: `http://localhost:3001`

| Endpoint | Method | Notes |
|---|---|---|
| `/auth/register` | POST | Create account (email + username + password ≥ 6) |
| `/auth/login` | POST | Returns `{user, token}` (JWT) — **login uses email, not username** |
| `/auth/me` | GET | Current user (Bearer token required) |
| `/users/:id` | GET | Public profile |
| `/users/follow/:id` | POST/DELETE | Follow / unfollow |
| `/posts` | GET/POST | Feed / create post |
| `/posts/:id` | GET/DELETE | Single post |
| `/posts/:id/like` | POST/DELETE | Like / unlike |
| `/posts/:id/comments` | GET/POST | List / add comments |
| `/conversations` | GET/POST | DM threads |
| `/conversations/:id/messages` | GET/POST | Messages in thread |
| `/notifications` | GET | Notification feed |
| `/hashtags/:tag` | GET | Posts by hashtag |
| `/upload/image` | POST | Multipart image upload |
| `/upload/video` | POST | Multipart video upload → enqueue encode job |

Full reference: see [`vault/00 - Projects/Nexus/Backend/API-Reference.md`](vault/00%20-%20Projects/Nexus/Backend/API-Reference.md).

## 🔐 Security

- **No secrets in git.** All credentials live in `.env` files (gitignored). Use `.env.example` as the template.
- **JWT secret** is supplied at runtime via `docker-compose.yml`'s `env_file` — never hardcoded.
- **CORS allowlist** is restricted to the value of `FRONTEND_URL` env (defaults to `http://localhost:3000`). Dev-only origins are not hardcoded.
- **Passwords** are hashed with bcrypt (10 rounds).
- **Uploads** go through Multer + Sharp with size limits enforced at the controller layer.
- **Defense in depth**: validation pipe + global exception filter on every request.

## 🧪 Verification Checklist

After `docker compose up -d --build`:

```bash
# All four services should be Up + healthy
docker compose ps

# API health
curl -s -w "\nHTTP %{http_code}\n" http://localhost:3001/auth/me -H "Authorization: Bearer <token>"

# Frontend
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000  # → 307 (Next.js redirect)

# Database tables
docker compose exec db psql -U nexus -d nexus -c "\dt"

# Successful login
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"***"}'
# → 201 + { user, token }
```

## 📁 Project Structure

```
marangone/
├── docker-compose.yml        # Local stack
├── LICENSE                   # MIT
├── README.md                 # This file
├── server/                   # NestJS API
│   ├── Dockerfile            # Multi-stage build
│   ├── prisma/
│   │   ├── schema.prisma     # 12-table schema
│   │   ├── migrations/       # SQL migrations
│   │   └── seed.ts           # Demo users
│   ├── src/
│   │   ├── auth/             # JWT + Passport
│   │   ├── users/            # Profile + follow graph
│   │   ├── posts/            # Feed + likes + reposts
│   │   ├── chat/             # DM + Socket.io gateway
│   │   ├── notifications/    # In-app feed
│   │   ├── hashtags/         # Tag aggregation
│   │   ├── upload/           # Image + video
│   │   ├── video/            # BullMQ encoding pipeline
│   │   ├── maintenance/      # Background reconciliation
│   │   └── common/           # Filters, pipes, interceptors
│   └── .env.example
├── client/                   # Next.js app
│   ├── Dockerfile            # Multi-stage standalone build
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   ├── components/       # Reusable UI
│   │   ├── contexts/         # Auth + theme
│   │   ├── hooks/            # Data + lifecycle
│   │   ├── lib/              # API client + utilities
│   │   └── types/            # Shared TS types
│   └── .env.example
├── ai-system/                # AI agent personas + rules
└── vault/                    # Obsidian knowledge base
```

## 📝 License

[MIT](LICENSE) © 2026 Banjong Tongwandee

## 📬 Contact / Portfolio

Questions? Open an issue on GitHub.
