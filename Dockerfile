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

# The Prisma CLI, so the image can migrate its own database. Next's standalone
# tracing pulls in @prisma/client because the app imports it, but not the CLI —
# that is a devDependency used only at build time. Without these three copies
# there is no way to run `prisma migrate deploy` against a deployment except by
# checking out the source and building a second toolchain next to it, which is
# not a self-hosting story.
#
# Kept to the CLI and the packages it actually resolves at runtime rather than
# the whole node_modules tree. @prisma/client is deliberately NOT among them:
# the standalone build above ships its own generated copy, and overwriting that
# with the ungenerated one would break the running application to make a
# migration command work.
#
# These land after the standalone copy on purpose. @prisma/engines from the
# deps stage is a superset of what standalone traced, and it is the one
# carrying the schema engine that `migrate deploy` needs.
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=deps /app/node_modules/@prisma/engines-version ./node_modules/@prisma/engines-version
COPY --from=deps /app/node_modules/@prisma/debug ./node_modules/@prisma/debug
COPY --from=deps /app/node_modules/@prisma/get-platform ./node_modules/@prisma/get-platform
COPY --from=deps /app/node_modules/@prisma/fetch-engine ./node_modules/@prisma/fetch-engine

# Create uploads directory
RUN mkdir -p uploads && chown nextjs:nodejs uploads

# Uploads must not live in the container's writable layer. Without this, every
# redeploy — every `docker compose up` that recreates the container — silently
# discards every file a clinic has uploaded: patient documents, scans, consent
# forms. Declaring the volume means a bare `docker run` at least gets an
# anonymous volume rather than throwaway storage; deployments should mount a
# named volume or bind mount over it. See the deployment section of the README.
#
# This is a mitigation, not the fix. The fix shipped in Phase 3: set
# STORAGE_DRIVER=s3 and the container filesystem stops being stateful at all,
# at which point this volume is inert rather than load-bearing. It stays
# declared because `local` is still the default and still the right choice for
# a single-instance clinic. See docs/STORAGE.md.
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
