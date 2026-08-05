# 闪电虎管理后台 Dockerfile
# 多阶段构建：依赖安装 → 构建 → 运行

# ============ Stage 1: Dependencies ============
FROM node:20-alpine AS deps
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 workspace 配置
COPY package.json pnpm-workspace.yaml ./
COPY packages/admin/package.json ./packages/admin/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖（仅生产依赖 + Prisma）
RUN pnpm install --frozen-lockfile

# ============ Stage 2: Build ============
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/admin/node_modules ./packages/admin/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY package.json pnpm-worksuite.yaml ./
COPY packages/shared/ ./packages/shared/
COPY packages/admin/ ./packages/admin/

# 生成 Prisma 客户端
RUN cd packages/admin && npx prisma generate

# 构建 admin
RUN pnpm --filter admin build

# ============ Stage 3: Runner ============
FROM node:20-alpine AS runner
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
COPY --from=builder /app/packages/admin/prisma ./packages/admin/prisma
COPY --from=builder /app/packages/admin/node_modules/.prisma ./packages/admin/node_modules/.prisma

# 复制启动脚本
COPY --from=builder /app/packages/admin/package.json ./packages/admin/package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动命令：先运行数据库迁移，再启动应用
CMD ["node", "packages/admin/server.js"]
