# V2.1 Remediation Verification Runbook

## 前置条件
- Node.js >= 20, pnpm >= 11
- PostgreSQL >= 14, Redis >= 6
- 环境变量：DATABASE_URL, REDIS_URL, COS_*, MODEL_KEY_ENCRYPTION_KEY, WECHAT_APPID, WECHAT_SECRET

## 验证步骤

### 1. 依赖安装与类型检查
```bash
pnpm install --frozen-lockfile
pnpm typecheck
```

### 2. 数据库迁移与种子
```bash
pnpm db:migrate
pnpm db:seed
```

### 3. 全量测试
```bash
pnpm test
```
预期：所有 server/worker/admin/mobile 测试通过。

### 4. 构建验证
```bash
pnpm build:admin
pnpm build:worker
pnpm build:weapp
```

### 5. 错题诊断链路验证
1. 启动 admin (`pnpm dev:admin`) 和 worker (`pnpm --filter @lightning-tiger/worker dev`)
2. 通过 mobile 上传错题图片并提交诊断
3. 轮询 job 状态直到 SUCCEEDED
4. 验证 AssessmentResult、LearningEvidence 已创建

### 6. 画像→报告→PDF 链路验证
1. 提交学习风格测评或错题诊断
2. 等待 PROFILE_GENERATION job 完成
3. 验证 ProfileRebuildProcessor 自动创建了 LearningReport（DRAFT）
4. 验证 REPORT_GENERATION job 被入队并完成
5. 验证 LearningReport 状态变为 READY，fileObjectId 已填充
6. 通过分享链接下载 PDF 验证内容

### 7. 微信登录验证
1. 在微信开发者工具中打开小程序
2. 验证 app.tsx 自动调用 Taro.login 获取 code
3. 验证 /api/v2/auth/wechat 返回 token
4. 验证后续 API 请求携带 Bearer token

### 8. 通知与家长聚合验证
1. 完成一次测评，验证通知被创建
2. 调用 GET /api/v2/dashboard 验证返回 recentReports/pendingJobs/recentEvidence/unreadNotifications
3. 调用 GET /api/v2/notifications 验证通知列表
4. 调用 POST /api/v2/notifications/read 验证标记已读

### 9. 发布门禁验证
1. 验证 next.config.ts 不含 ignoreBuildErrors/ignoreDuringBuilds
2. 验证 CI 流水线构建 admin 和 worker 两个镜像
3. 验证 `pnpm typecheck` 和 `pnpm test` 全部通过

## 回滚步骤
1. 回退代码到上一个稳定版本
2. 数据库迁移兼容（V2.1 schema 向前兼容）
3. Worker 镜像可独立回滚（不影响 admin）

## 重要约束
- 所有文档注释用中文
- 先读取所有要修改的文件再修改
- next.config.ts 只删除 bypass 配置，不动其他
