# Secopia web — production image (Next.js standalone, pnpm monorepo)
#
# Build from the REPOSITORY ROOT:
#   docker build -t secopia-web .
#
# The standalone bundle embeds only traced dependencies, so workspace
# packages (@secopia/types, @secopia/socrata-client) come along for free.

FROM node:22-alpine AS base
RUN corepack enable pnpm

# ── Install dependencies (manifests only → cacheable layer) ──
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY packages/types/package.json packages/types/
COPY packages/socrata-client/package.json packages/socrata-client/
COPY packages/mcp/package.json packages/mcp/
RUN pnpm install --frozen-lockfile

# ── Build ──
FROM deps AS build
COPY . .
RUN pnpm turbo build --filter=@secopia/web

# ── Runner: standalone server only ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# outputFileTracingRoot makes the standalone dir mirror the repo layout
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
