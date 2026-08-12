# 闪电虎 Worker — 异步任务消费者镜像
# 多阶段构建：deps -> builder(含 prisma client) -> runner

# ============ deps: 安装依赖 ============
FROM node:24.19.0-bookworm-slim AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/worker/package.json packages/worker/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ============ builder: 生成 Prisma client ============
FROM node:24.19.0-bookworm-slim AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @lightning-tiger/server prisma:generate
RUN pnpm --filter @lightning-tiger/worker typecheck

# ============ runner: 生产运行时 ============
FROM node:24.19.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# tsx 用于直接运行 TypeScript 源码（worker 未做 tsc 编译输出）
COPY --from=builder /app ./app
WORKDIR /app
CMD ["node", "--import", "tsx", "packages/worker/src/main.ts"]
