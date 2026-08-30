Backend Rules:

NestJS modular structure:
- Separate logic into services
- One module per domain (auth, users, posts, hashtags, notifications, chat, upload)

API:
- Use RESTful design
- Support cursor-based pagination

Security:
- Validate all inputs
- Hash passwords securely (bcrypt)
- JWT for auth (no refresh token yet)
- Refresh token → TODO: implement with Redis (planned)

Database:
- Use indexes on frequently queried columns
- Avoid N+1 queries (use Prisma include/select)

Image Processing:
- Use Sharp for image manipulation (local storage for now)
- Cloudflare R2 → TODO: migrate when scaling (planned)