System Architecture:

Frontend:
- Next.js (App Router)
- Component-based structure

Backend:
- NestJS (modular architecture)
- Services:
  - Auth          (JWT authentication)
  - Users         (profiles, follow/unfollow, follow list)
  - Posts         (create, delete, feed, thread, like, repost, quote)
  - Hashtags      (trending, posts by tag)
  - Notifications (bell, badge count)
  - Chat          (WebSocket gateway, conversations, messages, cleanup cron)
  - Upload        (Sharp image processing → WebP)

Database:
- PostgreSQL (via Prisma ORM)

Supporting Services (FUTURE — not yet implemented):
- Redis       → for caching + queue
- Cloudflare R2 → for image storage

Current (DEV):
- Files stored locally in /uploads (served by NestJS on :3001)
- JWT only (no refresh token yet — planned with Redis)
- No Redis caching yet

Principles:
- Separation of concerns
- Scalable design
- API-first approach