FROM node:20-slim AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || (sleep 5 && npm ci)

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate || (sleep 5 && npx prisma generate) || (sleep 10 && npx prisma generate)
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    mkdir -p /app/storage/videos/temp /app/storage/videos/output && \
    chown -R nestjs:nodejs /app/storage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
USER nestjs
EXPOSE 3001
CMD ["node", "dist/src/main"]
