# 闪电虎

一对一家教匹配平台，包含微信小程序（家长端）和管理后台（PC 端）。

## 技术栈

| 端 | 框架 | 说明 |
|----|------|------|
| 移动端 | Taro 4 + React 18 | 微信小程序 / H5 |
| 管理端 | Next.js 15 + React 18 | SSR + API Routes |
| 数据库 | PostgreSQL + Prisma | |
| 部署 | Docker + Nginx | 多阶段构建 |

## 项目结构

```
packages/
├── admin/      # Next.js 管理后台 + API
├── mobile/     # Taro 微信小程序
└── shared/     # 共享类型、常量、工具函数
```

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 11
- PostgreSQL >= 14

### 安装

```bash
pnpm install
```

### 配置环境变量

```bash
cp packages/admin/.env.example packages/admin/.env
# 编辑 .env 填入数据库连接和 JWT 密钥
```

### 数据库

```bash
pnpm db:push     # 同步 schema
pnpm db:seed     # 填充种子数据
```

### 开发

```bash
pnpm dev:admin   # 启动管理端 (http://localhost:3000)
pnpm dev:weapp   # 启动小程序 (需微信开发者工具)
```

### 构建

```bash
pnpm build:admin   # 构建管理端
pnpm build:weapp   # 构建小程序
```

### 代码检查

```bash
pnpm typecheck     # TypeScript 类型检查
pnpm lint:admin    # ESLint 检查
```

## 部署

### Docker

```bash
cp .env.production.example .env.production
# 编辑填入生产环境配置

docker-compose up -d
```

### 微信小程序配置

构建小程序前**必须**设置 `WECHAT_APPID` 环境变量为真实微信小程序 AppID，否则构建会报错终止：

```bash
# Windows
set WECHAT_APPID=wx你的真实appid
pnpm build:weapp

# Linux/Mac
WECHAT_APPID=wx你的真实appid pnpm build:weapp
```

也可直接修改 `packages/mobile/project.config.json` 中的 `appid` 字段，构建脚本会跳过环境变量注入。

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| DATABASE_URL | 是 | PostgreSQL 连接字符串 |
| JWT_SECRET | 是 | JWT 签名密钥（openssl rand -hex 32） |
| CORS_ALLOWED_ORIGINS | 是 | 允许的前端源（逗号分隔） |
| WECHAT_APPID | 是 | 微信小程序 AppID |

## License

Private
