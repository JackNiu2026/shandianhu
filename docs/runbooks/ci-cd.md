# CI/CD 运维规范

## 流水线职责

- `ci.yml`：PR 与分支质量门禁。并行执行四个工作区的 TypeScript、测试、数据库迁移契约、应用构建和生产容器 readiness 冒烟。
- `release.yml`：仅在 `main` 的 CI 成功后运行。一次构建 Admin、Worker、Migrator，并以 `sha-<40位提交>` 推送不可变镜像。
- `deploy.yml`：手工选择 staging 或 production，部署已发布的不可变镜像。GitHub Environment 控制密钥、审批和分支权限。
- `codeql.yml`：PR、main 和每周安全分析。

## GitHub 设置

`main` 分支保护至少要求：

- Pull request 合并
- `CI success` 必须通过
- `CodeQL / Analyze` 必须通过
- 禁止 force push 和删除分支
- 合并前分支必须与 main 同步

创建 `staging` 和 `production` Environments：

- `production` 设置 required reviewer，并开启 prevent self-review
- 仅允许 `main` 分支部署
- Environment variables：`APP_URL`、`DEPLOY_PATH`
- Environment secrets：`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_HOST_KEY`、`CONTAINER_REGISTRY`、`CONTAINER_REGISTRY_USER`、`CONTAINER_REGISTRY_TOKEN`

`DEPLOY_HOST_KEY` 必须是预先核验的服务器 SSH host key，禁止在工作流中使用 `ssh-keyscan` 动态信任。

## 服务器要求

部署目录包含生产 `.env`，其中保存应用运行密钥，但不提交到 Git。服务器需要 Docker Engine、Docker Compose v2、curl，以及镜像仓库访问权限。

首次部署前显式初始化数据：

```bash
docker compose run --rm migrate pnpm --filter @lightning-tiger/server db:seed
```

后续常规发布只执行 `prisma migrate deploy`，不得自动 seed。

## 发布和回滚

1. 合并到 `main`。
2. 等待 CI 与 Release Images 成功。
3. 从 Release 摘要复制 `sha-<commit>`。
4. 先通过 Deploy 工作流部署 staging 并验收。
5. 使用同一个 image tag 部署 production。
6. 部署脚本自动检查 Admin 和 Worker readiness；失败时恢复上一应用镜像。

数据库 migration 不自动回滚，因此 schema 变更必须遵循 expand-contract。涉及破坏性变更时，部署前完成数据库备份和恢复演练。
