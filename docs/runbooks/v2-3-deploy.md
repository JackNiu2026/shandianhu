# V2.3 真人家教闭环 部署手册

## 概述

V2.3 在 V2.2 AI 智学基础上交付真人家教闭环：老师自主申请 → 管理员审核 → 确定性推荐 → 试听排期 → 课程反馈 → 家长评价 → 学习画像回流。

**重要约束：** V2.3 不包含任何支付/佣金/订单/提现功能。管理员不能代替老师伪造反馈或代替家长评价，不能绕过冲突强制确认。

---

## 1. 前置条件

### 1.1 基础设施

- PostgreSQL 16+（已有，V2.1 起使用）
- Redis 7+（已有，V2.2 起 BullMQ 队列使用）
- 腾讯云 COS（已有，V2.1 起文件存储使用；V2.3 新增 `TEACHER_QUALIFICATION` purpose）
- Docker / docker-compose（已有）

### 1.2 代码与依赖

- Node.js 20+
- pnpm 11+
- 所有 V2.1/V2.2 migration 已应用
- Prisma Client 已重新生成（包含 V2.3 新模型）

### 1.3 环境变量

V2.3 不引入新的环境变量。复用现有：

| 变量 | 用途 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/db?schema=public` |
| `JWT_SECRET` | 会话签名密钥 | （已有） |
| `REDIS_URL` | BullMQ 队列连接 | `redis://localhost:6379` |
| `COS_SECRET_ID` | 腾讯云 COS | （已有） |
| `COS_SECRET_KEY` | 腾讯云 COS | （已有） |
| `COS_BUCKET` | COS 存储桶 | （已有） |
| `COS_REGION` | COS 区域 | （已有） |

---

## 2. 迁移步骤

### 2.1 应用数据库 Migration

```bash
# 1. 确认当前 migration 状态
pnpm --filter @lightning-tiger/server exec prisma migrate status

# 2. 应用 V2.3 migration
pnpm --filter @lightning-tiger/server db:migrate

# 3. 重新生成 Prisma Client
pnpm --filter @lightning-tiger/server prisma:generate

# 4. 验证新模型已创建
pnpm --filter @lightning-tiger/server exec prisma db pull --print | grep -E "model (TeacherApplication|TrialBooking|Lesson|TeacherFeedback|ParentReview|DataGrant)"
```

### 2.2 构建镜像

```bash
# 构建 Admin 镜像
docker build --target app -f packages/admin/Dockerfile -t lightning-tiger-admin:sha-<commit> .

# 构建 Worker 镜像
docker build -f packages/worker/Dockerfile -t lightning-tiger-worker:sha-<commit> .

# 构建同一提交对应的迁移镜像
docker build --target migrator -f packages/admin/Dockerfile -t lightning-tiger-migrator:sha-<commit> .
```

### 2.3 部署

```bash
# GitHub Actions Deploy 工作流只接受 sha-<40位提交> 的不可变标签。
# 生产 GitHub Environment 应设置 required reviewer，并禁止 self-review。
# 部署脚本先运行独立 migrator，再替换 Admin/Worker；健康检查失败自动恢复上一应用镜像。
CONTAINER_REGISTRY=registry.example.com \
IMAGE_TAG=sha-<40位提交> \
bash scripts/deploy-compose.sh
```

### 2.4 运行冒烟测试

```bash
# 部署后立即运行 V2.3 冒烟脚本
node scripts/v2-3-smoke.mjs

# 预期输出：
# === V2.3 Smoke Summary: N passed, 0 failed ===
# All V2.3 smoke checks passed.
```

---

## 3. 回滚策略

### 3.1 回滚原则

- **V2.3 表保留但旧应用不读取**：回滚后 V2.2 镜像不会读取 V2.3 新增的表，数据保留但不影响 V2.2 功能
- **智学/学情/报告/家庭档案继续工作**：V2.2 核心功能不依赖 V2.3 的任何表或字段

### 3.2 回滚步骤

```bash
# deploy-compose.sh 自动记录 `.deploy/current-image-tag`。
# 手工回滚时指定上一不可变标签，数据库 migration 不回滚。
CONTAINER_REGISTRY=registry.example.com \
IMAGE_TAG=sha-<上一稳定提交> \
bash scripts/deploy-compose.sh

# 3. 验证 V2.2 功能正常
curl -f http://localhost:3000/login
# 检查智学对话、学情报告、家庭档案等核心功能
```

### 3.3 回滚后注意事项

- V2.3 新增的数据库表（TeacherApplication, TrialBooking, Lesson 等）保留在数据库中，不影响 V2.2 运行
- 所有 migration 必须遵循 expand-contract：当前发布只新增兼容结构，删除旧结构必须延后到确认无旧应用运行的后续发布
- 生产部署不自动运行 seed；初始化或配置变更必须使用独立、可审计的运维操作
- 如果需要完全清理 V2.3 数据（可选，非必须）：
  ```sql
  -- 仅在确认不再需要 V2.3 数据时执行
  -- V2.2 不读取这些表，保留也不会造成问题
  DROP TABLE IF EXISTS "ParentReview", "TeacherFeedback", "Lesson",
    "BookingChange", "TrialBooking", "ScheduleReservation",
    "TeacherAvailabilityException", "TeacherAvailabilityRule",
    "DataGrant", "TeacherProfile", "TeacherAuditRecord",
    "TeacherQualification", "TeacherApplication" CASCADE;
  ```

---

## 4. 验收清单

### 4.1 基础功能

- [ ] Admin 后台可访问 `/academics` 教务管理首页
- [ ] Admin 后台可访问 `/academics/trials` 试听管理
- [ ] Admin 后台可访问 `/academics/lessons` 课程管理
- [ ] Admin 后台可访问 `/academics/feedback` 反馈管理
- [ ] Admin 后台可访问 `/teachers` 老师申请审核列表
- [ ] Admin 后台可访问 `/teachers/[id]` 申请详情页

### 4.2 老师闭环

- [ ] 纯老师（无孩子）可在小程序创建申请草稿
- [ ] 老师可上传身份证明和学历证明
- [ ] 老师提交申请时校验必填字段和必需资质
- [ ] 管理员可逐项审核资质（PASS/FAIL）
- [ ] 全部必需资质 PASS 后可批准申请
- [ ] 批准后创建公开 TeacherProfile（不含 legalName 和 fileObjectId）
- [ ] 管理员可暂停/封禁/恢复老师

### 4.3 推荐与试听

- [ ] 家长可获取老师推荐列表（确定性排序）
- [ ] 推荐结果不暴露 MBTI/心理诊断等敏感字段
- [ ] 家长可发起试听预约（幂等）
- [ ] 老师可接受/拒绝/建议改期
- [ ] 家长可确认/取消
- [ ] 老师可标记就绪/完成
- [ ] 状态机转换合法（终态不接受事件）

### 4.4 课程与反馈

- [ ] 老师可标记课程完成
- [ ] 老师可提交结构化反馈（版本化、幂等）
- [ ] privateTeacherNote 不进入学习画像
- [ ] 反馈提交后投递 PROFILE_GENERATION + REPORT_GENERATION job
- [ ] 家长可查看反馈公开字段（不含 privateTeacherNote）

### 4.5 评价与授权

- [ ] 家长可为已完成课程提交评价（绑定真实课程）
- [ ] 每个 lesson 只能有一个评价
- [ ] 评价 author 从会话推导（不接受 client input）
- [ ] 家长确认试听时创建 DataGrant
- [ ] DataGrant 撤销后立即失效

### 4.6 安全约束

- [ ] 无支付/佣金/订单/提现功能
- [ ] 管理员不能代替老师伪造反馈
- [ ] 管理员不能代替家长评价
- [ ] 管理员不能绕过冲突强制确认
- [ ] 资质文件使用私有 COS（5 分钟签名）
- [ ] 公开资料不返回 fileObjectId 或 legalName

### 4.7 冒烟与测试

- [ ] `node scripts/v2-3-smoke.mjs` 全部通过
- [ ] `pnpm --filter @lightning-tiger/server test -- v2-3-acceptance` 全部通过
- [ ] `pnpm --filter admin test -- no-payment-surface` 全部通过
- [ ] `pnpm typecheck` 无错误

---

## 5. 监控要点

- **Worker 队列**：关注 PROFILE_GENERATION 和 REPORT_GENERATION job 的积压
- **COS 签名**：资质文件签名请求量异常时检查权限配置
- **试听状态机**：监控非法转换错误率（RESOURCE_CONFLICT）
- **推荐评分**：相同输入应产生相同排序，如出现非确定性需排查
- **DataGrant**：监控撤销操作，确保撤销后无后续读取
