FROM node:24-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# The schema and prisma.config.ts are here because postinstall runs
# `prisma generate`.
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The generated client (lib/generated, excluded from the build context).
RUN npx prisma generate
RUN npm run build

# Stage 3: The Prisma CLI, for migrations in the runtime image (see below).
# Prisma 7's CLI loads these packages even for `migrate deploy`: the CLI
# itself, its config loader, the schema engine, and the top level of Studio and
# `prisma dev`, but not their UI or database dependencies, which only those
# commands use. Its full dependency tree is about 230 MB; this is about 170 MB.
# A package missing from the list fails the build below, not a deployment.
FROM deps AS prisma-cli
RUN mkdir -p /cli/node_modules && cd /app/node_modules && tar -cf - \
      prisma @prisma/config @prisma/debug @prisma/dev @prisma/engines \
      @prisma/engines-version @prisma/fetch-engine @prisma/studio-core \
      @standard-schema/spec c12 confbox deepmerge-ts defu destr dotenv empathic \
      exsolve fast-check get-port-please giget graceful-fs grammex graphmatch \
      jiti ohash pathe perfect-debounce pkg-types proper-lockfile pure-rand rc9 \
      remeda retry valibot zeptomatch \
    | tar -xf - -C /cli/node_modules

# Stage 4: Production runner
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

# The Prisma CLI, so the image can migrate its own database (the compose
# `migrate` service runs `node node_modules/prisma/build/index.js migrate
# deploy`). Next's standalone tracing pulls in what the app imports, but not
# the CLI — a devDependency used only at build time. Without it there is no way
# to run `prisma migrate deploy` against a deployment except by checking out the
# source and building a second toolchain next to it, which is not a
# self-hosting story.
#
# @prisma/client is deliberately NOT among the copied packages: the app runs
# on the client generated into the build, and its runtime is already traced
# into the standalone output.
#
# These land after the standalone copy on purpose: @prisma/engines from the
# deps stage is the one carrying the schema engine that `migrate deploy` needs.
# Any package both copies share is the same install, so overlaps are identical.
COPY --from=prisma-cli /cli/node_modules ./node_modules
# The CLI's settings: schema and migrations paths, and DATABASE_URL.
COPY --from=builder /app/prisma.config.ts ./
# Fail the build, not a deployment, if the CLI can't load.
RUN node node_modules/prisma/build/index.js migrate deploy --help > /dev/null

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
