# B 端管理后台实现计划

## Summary

基于闪电虎 C 端（Taro 4 小程序）的全部功能，在 `packages/admin` 中构建 Next.js 15 管理后台，实现风格配色一致（Neo-brutalism 紫桃色系）且所有 C 端功能在管理端形成闭环。技术栈：Next.js 15 App Router + Tailwind CSS v4 + TanStack Table + Recharts + react-hook-form，共享 `@lightning-tiger/shared` 的类型与数据。

---

## Current State Analysis

### C 端功能盘点（需在管理端闭环的功能）

| C 端功能 | 数据来源 | 管理端对应 |
|----------|----------|------------|
| 老师卡片匹配（滑卡） | `shared/data/teachers.ts` 8 位 mock 老师 | 老师管理 CRUD + 审核 |
| 筛选（学段/科目/预算） | `shared/constants/index.ts` 5 科 3 学段 3 预算 | 内容管理（科目/学段/预算配置） |
| MBTI 测评 | `shared/constants/index.ts` 12 题 4 维度 | 题库管理 + 结果查看 |
| 免费试听预约 | `BookSheet` → store.booked | 预约/订单管理 |
| 消息聊天 | `chat/index.tsx` 纯本地 state | 会话管理（查看/记录） |
| 家长收藏老师 | store.liked | 家长管理（收藏关系） |
| 老师核验 | Teacher.checks[] 4 项 | 老师审核管理 |
| 老师评价 | Teacher.reviews[] | 评价管理 |
| 老师可约时段 | Teacher.slots[] | 排课管理 |
| 老师收益 | me 页面硬编码（¥12,680 等） | 财务管理 |
| 角色切换 | RoleModal parent/teacher | — |
| 会员订阅 | SubscribeModal ¥19.9/月 | 会员管理 |
| 老师名片海报 | PosterModal | — |
| 平台统计 | "856 位老师入驻" 硬编码 | 数据看板 |

### 设计系统（C 端生效值）

```
--ink: #151617          /* 主文字/描边 */
--ink-muted: #756E69    /* 次级文字 */
--growth: #967AE9       /* 品牌紫 */
--growth-soft: #E8E4F8  /* 紫色软背景 */
--action: #FFBE98       /* 行动桃色 */
--action-soft: #FFF1E8  /* 桃色软背景 */
--surface-base: #F5F2F0 /* 页面底色 */
--surface-paper: #FFFCF9 /* 卡片面 */
--surface-soft: #F8F5F1 /* 次级面 */
--success: #4ECB71
--notice: #D7A820
```

Neo-brutalism 特征：`border-2 border-ink` + `box-shadow: Npx Npx 0 0 ink`（硬阴影无模糊）。

### Monorepo 现状

- `pnpm-workspace.yaml` 已配置 `packages: ['packages/*']`
- `packages/shared` 包名 `@lightning-tiger/shared`，导出 types/constants/data/utils
- `packages/mobile` 已编译通过
- `packages/admin` 目录尚未创建
- 根 `package.json` 使用 npm workspace（非 pnpm）

---

## Proposed Changes

### 1. 初始化 packages/admin Next.js 15 项目

**文件**: `packages/admin/package.json`, `packages/admin/tsconfig.json`, `packages/admin/next.config.ts`, `packages/admin/postcss.config.mjs`

**What**: 创建 Next.js 15 App Router 项目，集成 Tailwind CSS v4，引用 `@lightning-tiger/shared`。

**Why**: 管理后台需要独立运行，同时共享 monorepo 的类型和数据。

**How**:
- `package.json` 依赖：next@15, react@19, react-dom@19, tailwindcss@4, @tailwindcss/postcss, @tanstack/react-table, recharts, react-hook-form, @hookform/resolvers, zod
- `tsconfig.json` 继承 `../../tsconfig.base.json`，配置 `@/*` → `./src/*` 别名
- `postcss.config.mjs` 使用 `@tailwindcss/postcss` 插件
- `next.config.ts` 配置 `transpilePackages: ['@lightning-tiger/shared']`

### 2. 全局样式与设计系统

**文件**: `packages/admin/src/app/globals.css`, `packages/admin/src/lib/utils.ts`

**What**: 将 C 端设计系统迁移为 Tailwind v4 `@theme` 变量，定义 Neo-brutalism 工具类。

**Why**: 确保管理后台与 C 端风格配色完全一致。

**How**:
```css
@import "tailwindcss";

@theme {
  /* 色彩令牌 — 与 C 端 app.scss 语义色系一致 */
  --color-ink: #151617;
  --color-ink-muted: #756E69;
  --color-growth: #967AE9;
  --color-growth-soft: #E8E4F8;
  --color-action: #FFBE98;
  --color-action-soft: #FFF1E8;
  --color-surface-base: #F5F2F0;
  --color-surface-paper: #FFFCF9;
  --color-surface-soft: #F8F5F1;
  --color-success: #4ECB71;
  --color-success-soft: #E6F7EC;
  --color-notice: #D7A820;
  --color-notice-soft: #FFF7D9;
  --color-danger: #EF4444;

  /* Neo-brutalism 硬阴影 */
  --shadow-nb-sm: 2px 2px 0px 0px #151617;
  --shadow-nb: 4px 4px 0px 0px #151617;
  --shadow-nb-lg: 6px 6px 0px 0px #151617;

  /* 字体 */
  --font-sans: "Noto Sans SC", system-ui, sans-serif;
  --font-mono: monospace;
}

/* Neo-brutalism 交互态工具类 */
@utility nb-press {
  transition: transform 0.15s, box-shadow 0.15s;
}
@utility nb-press-hover {
  hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-nb-sm;
}
@utility nb-press-active {
  active:translate-x-[4px] active:translate-y-[4px] active:shadow-none;
}
```

`lib/utils.ts` 导出 `cn()` 类名合并工具。

### 3. 基础 UI 组件库

**文件**: `packages/admin/src/components/ui/` 下多个文件

**What**: 构建 Neo-brutalism 风格的基础组件，全部使用 Tailwind 工具类。

**Why**: 管理后台所有页面复用，确保风格统一。

**组件清单**:

| 组件 | 文件 | 说明 |
|------|------|------|
| `Button` | `button.tsx` | variant: default/primary/danger/success，size: sm/md/lg，硬阴影+按压交互 |
| `Card` | `card.tsx` | border-2 + shadow-nb，可选 title/header |
| `Badge` | `badge.tsx` | 状态标签（待审核/已通过/已拒绝等） |
| `Input` | `input.tsx` | border-2 + focus 态阴影变化 |
| `Select` | `select.tsx` | 原生 select + Neo-brutalism 样式 |
| `Modal` | `modal.tsx` | 遮罩 + 居中弹窗 + dialog-pop 动画 |
| `Table` | `data-table.tsx` | 基于 TanStack Table v8，含搜索/排序/分页 |
| `Pagination` | `pagination.tsx` | 独立分页组件 |
| `StatCard` | `stat-card.tsx` | 数据看板统计卡片（数字+标签+图标） |
| `EmptyState` | `empty-state.tsx` | 空状态占位 |
| `Tabs` | `tabs.tsx` | 标签页切换 |
| `Checkbox` | `checkbox.tsx` | 复选框 |

### 4. 后台布局框架

**文件**: `packages/admin/src/components/dashboard/sidebar.tsx`, `topbar.tsx`, `breadcrumb.tsx`, `packages/admin/src/app/(dashboard)/layout.tsx`

**What**: 侧边栏 + 顶栏 + 面包屑 + 主内容区的标准后台布局。

**Why**: 所有后台页面共享同一布局，通过 Next.js Route Groups `(dashboard)` 实现。

**侧边栏导航结构**:
```
⚡ 闪电虎管理后台
├── 数据看板      /dashboard
├── 老师管理      /teachers
├── 家长管理      /parents
├── 预约管理      /bookings
├── 测评题库      /assessments
├── 评价管理      /reviews
├── 财务管理      /finance
├── 会员管理      /memberships
├── 内容配置      /content
└── 系统设置      /settings
```

**设计细节**:
- 侧边栏：`bg-surface-paper`，`border-r-2 border-ink`，选中项 `bg-growth text-white shadow-nb`
- 顶栏：`bg-surface-paper`，`border-b-2 border-ink`，含管理员信息
- 品牌字标：⚡ 闪电虎 + "管理后台" 副标题
- 导航图标：使用 Unicode 字符（与 C 端一致）

### 5. 认证系统

**文件**: `packages/admin/src/app/middleware.ts`, `packages/admin/src/app/(auth)/login/page.tsx`, `packages/admin/src/app/(auth)/layout.tsx`, `packages/admin/src/lib/auth.ts`

**What**: 简单的 Cookie/JWT 认证，登录页 + 中间件守卫。

**Why**: 管理后台需要登录才能访问。

**How**:
- 登录页：账号密码表单，Neo-brutalism 风格，默认账号 admin/admin123
- `middleware.ts`：检查 `admin-token` Cookie，未登录重定向到 `/login`
- `lib/auth.ts`：验证逻辑（当前 mock，预留 API 对接）
- 受保护路由：`/dashboard`, `/teachers`, `/parents`, `/bookings`, `/assessments`, `/reviews`, `/finance`, `/memberships`, `/content`, `/settings`

### 6. 数据层（Mock API + 共享数据）

**文件**: `packages/admin/src/lib/data.ts`, `packages/admin/src/lib/types.ts`

**What**: 基于 `@lightning-tiger/shared` 的数据构建管理端数据层，扩展管理端所需字段。

**Why**: 当前无后端，管理端需要可 CRUD 的数据源；同时为未来对接真实 API 预留接口。

**How**:
- 从 `@lightning-tiger/shared` 导入 Teacher 类型、teachers 数据、subjects、grades、budgetOptions、questions
- 扩展管理端类型：`TeacherAdmin`（Teacher + status/createdAt/updatedAt）、`Parent`、`Booking`、`Review`、`Order`、`MemberSubscription`
- `lib/data.ts` 提供内存数据集（扩展 mock 数据）+ CRUD 函数（模拟异步）
- 所有函数返回 Promise，预留替换为真实 fetch 的接口

**扩展的 mock 数据**:
- 家长数据：10 条（含 prefs、liked、booked、mbtiResult）
- 预约数据：15 条（含 status: pending/confirmed/completed/cancelled）
- 评价数据：20 条
- 订单/收益数据：按月聚合
- 会员订阅：5 条

### 7. 数据看板页面

**文件**: `packages/admin/src/app/(dashboard)/dashboard/page.tsx`, `packages/admin/src/components/charts/` 下图表组件

**What**: 平台核心指标看板，含统计卡片 + 图表 + 近期活动。

**内容**:
- **4 个 StatCard**: 老师总数（8）、家长总数（10）、本月预约数（15）、平台总收入（¥18,240）
- **月度预约趋势图**: Recharts 折线图/柱状图
- **科目分布图**: 饼图（语数英物化占比）
- **老师评分分布**: 柱状图
- **近期活动列表**: 最新注册老师、最新预约、待审核项

### 8. 老师管理页面

**文件**: `packages/admin/src/app/(dashboard)/teachers/page.tsx`, `teachers/[id]/page.tsx`, `teachers/new/page.tsx`

**What**: 老师列表 + 详情 + 新建/编辑 + 审核流程。

**列表页**:
- DataTable: 姓名/科目/学段/评分/价格/状态/操作
- 筛选: 科目下拉、学段下拉、状态下拉、搜索框
- 操作: 查看、编辑、删除、审核
- 顶部"新建老师"按钮

**详情页**:
- 老师信息卡片（头像首字母、姓名、院校、tags）
- 核验项管理（4 项: 身份证/学历/教师资格证/无犯罪记录）→ 审核通过/拒绝按钮
- 可约时段管理（添加/删除 slot）
- 评价列表
- 试听视频管理（URL 输入）
- 收益统计

**新建/编辑表单**:
- 姓名、年龄、院校、科目（select）、学段（multi-select）、教学模式、价格、教龄
- tags（动态添加）、note、color（颜色选择器）
- 核验项（4 个 checkbox）

### 9. 家长管理页面

**文件**: `packages/admin/src/app/(dashboard)/parents/page.tsx`, `parents/[id]/page.tsx`

**What**: 家长列表 + 详情。

**列表页**:
- DataTable: 姓名/手机号/孩子学段/收藏老师数/预约数/MBTI 结果/状态
- 筛选: 学段、状态、搜索

**详情页**:
- 基本信息（姓名、头像、手机号、注册时间）
- 筛选偏好（prefs: grade/subject/budget）
- MBTI 测评结果（code + label + advice）
- 收藏老师列表（liked teachers）
- 预约记录
- 消息记录

### 10. 预约管理页面

**文件**: `packages/admin/src/app/(dashboard)/bookings/page.tsx`, `bookings/[id]/page.tsx`

**What**: 试听预约列表 + 详情 + 状态管理。

**列表页**:
- DataTable: 家长名/老师名/科目/预约时段/状态/创建时间/操作
- 筛选: 状态（待确认/已确认/已完成/已取消）、科目、日期范围
- 操作: 确认、取消、查看详情

**详情页**:
- 预约信息（家长、老师、时段、状态）
- 状态流转操作（确认/完成/取消）
- 关联老师信息卡片
- 关联家长信息卡片

### 11. 测评题库管理页面

**文件**: `packages/admin/src/app/(dashboard)/assessments/page.tsx`, `assessments/[id]/page.tsx`, `assessments/results/page.tsx`

**What**: MBTI 题目管理 + 结果统计。

**题库列表页**:
- DataTable: 题号/维度/题目/选项 A/选项 B/操作
- 新建/编辑/删除题目
- 维度筛选（EI/SN/TF/JP）

**题目编辑表单**:
- title、dim（select）、option A (text + letter)、option B (text + letter)

**结果统计页**:
- 各 MBTI 类型分布饼图
- 各维度倾向分布柱状图
- 最近测评记录列表

### 12. 评价管理页面

**文件**: `packages/admin/src/app/(dashboard)/reviews/page.tsx`

**What**: 评价列表 + 审核。

**列表页**:
- DataTable: 老师名/评价人/评价内容/评分/状态/操作
- 筛选: 状态（待审核/已通过/已拒绝）、老师
- 操作: 通过、拒绝、删除
- 顶部"添加评价"按钮（管理员代为添加）

### 13. 财务管理页面

**文件**: `packages/admin/src/app/(dashboard)/finance/page.tsx`

**What**: 平台收益 + 老师佣金 + 提现管理。

**内容**:
- 3 个 StatCard: 总收入、待入账、已结算
- 月度收入趋势图（Recharts 折线图）
- 老师收益排行表（DataTable: 老师名/总课时/总佣金/待入账/可提现/操作）
- 提现申请列表（待处理/已处理）

### 14. 会员管理页面

**文件**: `packages/admin/src/app/(dashboard)/memberships/page.tsx`

**What**: 会员订阅记录管理。

**列表页**:
- DataTable: 家长名/订阅时长/金额/开始日期/到期日期/状态/操作
- 筛选: 状态（有效/过期/已取消）
- 统计: 当前有效会员数、本月新增、续费率

### 15. 内容配置页面

**文件**: `packages/admin/src/app/(dashboard)/content/page.tsx`

**What**: 管理科目、学段、预算选项等全局配置。

**内容**:
- 科目管理（列表 + 添加/编辑/删除，当前 5 科）
- 学段管理（当前 3 学段）
- 预算档位管理（当前 3 档）
- 平台文案配置（如"已有 N 位老师入驻"的数字）

### 16. 系统设置页面

**文件**: `packages/admin/src/app/(dashboard)/settings/page.tsx`

**What**: 管理员账户 + 平台配置。

**内容**:
- 管理员信息（用户名、密码修改）
- 平台基本信息（名称、Logo、联系方式）
- 登出按钮

### 17. 根布局与元数据

**文件**: `packages/admin/src/app/layout.tsx`, `packages/admin/src/app/page.tsx`

**What**: Next.js 根布局，引入 globals.css，配置字体和元数据。根页面重定向到 `/dashboard`。

---

## Assumptions & Decisions

### 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| UI 框架 | Next.js 15 App Router | 用户原始架构要求，SSR/SSG + Route Groups 布局 |
| 样式方案 | Tailwind CSS v4（非 Ant Design） | Neo-brutalism 风格与 Ant Design 的 Material/Flat 风格冲突严重，纯 Tailwind 自建成本更低且风格完全可控 |
| 组件库 | 纯 Tailwind 自建（非 shadcn/ui） | Neo-brutalism 组件简单（border-2 + hard-shadow），自建避免依赖；shadcn/ui 需 Node CLI 初始化，环境复杂 |
| 数据表格 | TanStack Table v8 | 无头表格，逻辑完整（排序/筛选/分页），样式自由 |
| 图表 | Recharts | React 生态最成熟，可自定义 Tooltip 样式 |
| 表单 | react-hook-form + zod | 类型安全 + 性能优秀 |
| 认证 | middleware + Cookie | 当前 mock，预留真实 API 对接 |
| 数据层 | 内存 mock + Promise 封装 | 无后端，但所有函数返回 Promise，未来替换为 fetch |

### 设计对齐

- 所有颜色使用 C 端 `app.scss` 中的语义色系根变量值
- Neo-brutalism 硬阴影：`2px 2px 0 0 #151617` / `4px 4px 0 0 #151617` / `6px 6px 0 0 #151617`
- 边框统一 `border-2 border-[#151617]`
- 按钮交互：hover 位移 2px + 阴影缩小，active 位移 4px + 无阴影
- 字体：`"Noto Sans SC"` 主字体，`monospace` 用于数字/标签
- 图标：使用 Unicode 字符（与 C 端 Icons.tsx 一致）

### 功能闭环说明

C 端所有数据实体（老师、家长、预约、评价、题库、科目、学段、预算、会员）均可在管理端进行 CRUD 管理。C 端的每个交互（匹配、测评、预约、收藏、聊天）在管理端都有对应的数据查看和管理入口。

---

## Verification Steps

1. **编译验证**: `cd packages/admin && npm run build` 通过，无 TypeScript 错误
2. **运行验证**: `npm run dev` 启动，访问 `localhost:3000` 重定向到登录页
3. **登录验证**: 使用 admin/admin123 登录后跳转到数据看板
4. **页面全覆盖**: 侧边栏 10 个菜单均可正常访问
5. **风格一致性**: 对比 C 端截图，确认配色（紫 #967AE9 / 桃 #FFBE98 / 近黑 #151617）、硬阴影、圆角卡片一致
6. **CRUD 闭环**: 老师管理 → 新建老师 → 列表显示 → 编辑 → 详情页查看 → 删除
7. **审核流程**: 老师详情页 → 核验项审核 → 状态变更 → 列表更新
8. **数据表格**: 搜索/筛选/排序/分页功能正常
9. **图表渲染**: 数据看板的 Recharts 图表正确显示
10. **响应式**: 在 1280px 和 1920px 宽度下布局正常
11. **共享类型**: `import type { Teacher } from '@lightning-tiger/shared'` 正常工作
12. **表单验证**: zod 校验生效，错误提示正确显示
