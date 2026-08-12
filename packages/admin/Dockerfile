# 闪电虎管理后台 Dockerfile
# 多阶段构建：依赖安装 → 构建 → 运行

# ============ Stage 1: Dependencies ============
FROM node:26.7.0-bookworm-slim AS deps
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

# 复制 workspace 配置和 lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/admin/package.json ./packages/admin/
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/mobile/package.json ./packages/mobile/

# 安装依赖（仅生产依赖 + Prisma）
RUN pnpm install --frozen-lockfile

# ============ Stage 2: Build ============
FROM node:26.7.0-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/admin/node_modules ./packages/admin/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY packages/admin/ ./packages/admin/

# Next standalone output expects this directory even when the app has no static public assets.
RUN mkdir -p packages/admin/public

# 生成 Prisma 客户端
RUN pnpm --filter @lightning-tiger/server prisma:generate

# 构建 admin
RUN pnpm --filter admin build

# Release job image. It contains the exact schema and migration set from the application commit.
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@lightning-tiger/server", "db:migrate"]

# ============ Stage 3: Runner ============
FROM node:26.7.0-bookworm-slim AS app
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/packages/admin/.next/standalone ./
COPY --from=builder /app/packages/admin/.next/static ./packages/admin/.next/static
COPY --from=builder /app/packages/admin/public ./packages/admin/public
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma ./node_modules/.prisma

# 复制启动脚本
COPY --from=builder /app/packages/admin/package.json ./packages/admin/package.json

# 复制 prisma CLI 和迁移文件
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Database migration and seeding run in the Compose `migrate` release gate.
CMD ["node", "packages/admin/server.js"]
