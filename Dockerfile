FROM node:20-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create uploads directory
RUN mkdir -p uploads && chown nextjs:nodejs uploads

# Uploads must not live in the container's writable layer. Without this, every
# redeploy — every `docker compose up` that recreates the container — silently
# discards every file a clinic has uploaded: patient documents, scans, consent
# forms. Declaring the volume means a bare `docker run` at least gets an
# anonymous volume rather than throwaway storage; deployments should mount a
# named volume or bind mount over it. See the deployment section of the README.
#
# This is a mitigation, not the fix. Object storage (Phase 3 of
# docs/INFRASTRUCTURE.md) removes the problem properly by getting uploads off
# the container filesystem entirely.
VOLUME ["/app/uploads"]

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Liveness only — hits /api/health, which deliberately does not touch the
# database. start-period covers Next.js boot so a slow start is not counted as
# a failure.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
