# 闪电虎 Taro 4 微信小程序迁移计划（Monorepo 架构）

## 概述

将现有 React 19 + Vite + Figma Make 项目迁移为 pnpm Monorepo 架构，当前阶段先实现 `packages/shared`（跨端共享层）和 `packages/mobile`（Taro 4 C 端微信小程序）。保留全部 4 个 Tab 页面的布局、样式、颜色不变，外部图片用占位图/CSS 背景色替代。

## 目标架构

```
d:\闪电虎\
├── packages/
│   ├── shared/              # 跨端共享层（核心复用）
│   │   ├── types/           # Teacher / Prefs / MBTI 等类型定义
│   │   ├── api/             # API 请求封装（适配多端 fetch）
│   │   ├── utils/           # 工具函数（MBTI 计分、筛选逻辑等）
│   │   ├── constants/       # 科目、学段、预算等常量
│   │   ├── hooks/           # 跨端通用 hooks
│   │   ├── data/            # 教师数据
│   │   └── index.ts         # 统一导出
│   │
│   ├── mobile/              # C 端：Taro 4 项目
│   │   ├── src/
│   │   │   ├── pages/       # 小程序页面（对应 Tab）
│   │   │   │   ├── match/   # 发现-滑卡匹配
│   │   │   │   ├── test/    # 测评-MBTI
│   │   │   │   ├── chat/    # 消息
│   │   │   │   └── me/      # 我的
│   │   │   ├── components/  # 跨端 UI 组件
│   │   │   ├── store/       # 全局状态（Context + useReducer）
│   │   │   ├── custom-tab-bar/ # 自定义浮动导航
│   │   │   ├── assets/      # 图标 PNG、Logo
│   │   │   ├── app.ts       # Taro 应用入口
│   │   │   ├── app.config.ts # 全局配置（pages, tabBar custom:true）
│   │   │   └── app.scss     # 全局样式
│   │   ├── config/
│   │   │   ├── index.ts     # Taro 编译配置（pxtransform designWidth:430）
│   │   │   ├── dev.ts
│   │   │   ├── prod.ts
│   │   │   ├── weapp.json   # 微信小程序配置
│   │   │   └── rn.json      # React Native 配置
│   │   ├── project.config.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── admin/               # B 端：Next.js 管理后台（后续阶段，暂不实现）
│       ├── src/
│       │   ├── app/         # Next.js App Router
│       │   │   ├── (auth)/  # 登录
│       │   │   ├── teachers/ # 老师管理
│       │   │   ├── parents/  # 家长管理
│       │   │   ├── orders/   # 订单/预约
│       │   │   └── dashboard/# 数据看板
│       │   └── components/  # Ant Design 组件
│       └── package.json
│
├── figma/                   # 原 Figma Make 项目（保留作为参考，不修改）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── imports/
│   ├── .figma/
│   ├── vite.config.ts
│   ├── package.json
│   └── ...
├── pnpm-workspace.yaml
├── tsconfig.base.json       # 共享 TS 配置
└── package.json             # 根 package.json
```

## 现状分析

### 源文件（已整理到 `figma/` 目录，保留作为参考）
- `figma/src/App.tsx`（859 行）：全部业务逻辑，4 个 Tab，8 个弹窗，MBTI 测评，滑卡匹配，双角色工作台
- `figma/src/index.css`（1543 行）：新粗野主义设计系统，三代配色，7 个 @keyframes 动画
- `figma/src/imports/`：2 张 Logo PNG（`_____5.png`, `_____11.png`），2 张老师头像

### CSS 不兼容特性（需适配）
| 特性 | 适配策略 |
|------|---------|
| `@import url(google fonts)` | 移除，用系统字体 fallback |
| `@import 'tailwindcss'` | 移除 |
| `:has()` 选择器（2 处） | 样式直接写到目标组件上 |
| `backdrop-filter: blur()`（2 处） | 提高 rgba 不透明度模拟 |
| `:hover` 伪类（30+ 处） | 移除（不影响静态外观） |
| `conic-gradient`（1 处） | 简化为纯色背景 |
| `aspect-ratio`（1 处） | 用 padding-bottom 百分比替代 |
| `100vh`（4 处） | 保留（Taro 编译处理） |
| `scrollbar-*`（3 处） | 移除，用 ScrollView 组件 |
| `@media (max-width:520px)`（2 处） | 移除（小程序固定全屏） |
| 内联 SVG（17 个图标） | 转 PNG 或用 Unicode 替代 |

### JS 不兼容特性
| 特性 | 适配策略 |
|------|---------|
| `window.setTimeout` | 改为 `setTimeout`（Taro 全局可用） |
| `onKeyDown` (input Enter) | 改为 `onConfirm` |
| `e.target.value` (input) | 改为 `e.detail.value` |
| `e.stopPropagation()` | 改为 `catchTap` 事件 |

## 实施步骤

### 步骤 1：Monorepo 骨架搭建

创建根目录配置文件，不修改原 `figma/` 目录。

**创建 `pnpm-workspace.yaml`**：
```yaml
packages:
  - 'packages/*'
```

**创建根 `package.json`**：
```json
{
  "name": "lightning-tiger",
  "private": true,
  "scripts": {
    "dev:weapp": "pnpm --filter mobile dev:weapp",
    "build:weapp": "pnpm --filter mobile build:weapp"
  }
}
```

**创建 `tsconfig.base.json`**：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "paths": { "@shared/*": ["../shared/*"] }
  }
}
```

### 步骤 2：packages/shared 共享层

将原 `App.tsx` 中的类型、常量、数据、工具逻辑提取到共享层，供 mobile 和未来的 admin 共用。

**创建文件**：

- `packages/shared/types/index.ts`：Teacher、Role、Grade、Prefs、Dim、Tab 等类型
- `packages/shared/constants/index.ts`：subjects、grades、budgetOptions、questions（MBTI 12 题）、typeNames、styleAdvice
- `packages/shared/data/teachers.ts`：8 位老师数据（Unsplash URL → 空字符串，video 字段用 color 值替代）
- `packages/shared/utils/mbti.ts`：MBTI 计分逻辑（pick 函数 + result 计算）
- `packages/shared/utils/match.ts`：老师筛选逻辑（matched 计算 + relaxed 判断）
- `packages/shared/api/index.ts`：API 请求封装（当前为空壳，预留后端对接）
- `packages/shared/hooks/index.ts`：跨端通用 hooks（当前为空壳，预留）
- `packages/shared/index.ts`：统一导出

### 步骤 3：packages/mobile Taro 项目初始化

**操作**：在 `packages/mobile` 目录创建 Taro 4 项目。

**Taro init 配置**：React + TypeScript + Sass + pnpm + Webpack5

**`packages/mobile/config/index.ts` 关键配置**：
- `designWidth: 430`（与现有 phone-frame 宽度一致）
- `deviceRatio` 添加 `430: 750/430`
- `pxtransform` 开启，px 自动转 rpx

**`packages/mobile/config/weapp.json`**：微信小程序编译专属配置

**`packages/mobile/config/rn.json`**：React Native 编译专属配置（预留）

**依赖**：
- `@tarojs/taro` / `@tarojs/components` / `@tarojs/cli`：4.x
- `react` / `react-dom`：^18.0.0（Taro 4 需降级 React 19→18）
- `typescript`：^5.7.0，`sass`：^1.69.0
- workspace 依赖：`"@shared": "workspace:*"` 引用 shared 包

### 步骤 4：CSS 迁移与适配

将原 `figma/src/index.css`（1543 行）迁移为 Taro 兼容的 SCSS（**不改变任何视觉效果**）：

1. **移除**：`@import url(google fonts)`、`@import 'tailwindcss'`
2. **字体替换**：`"Noto Sans SC"` 保留作 fallback；`"DM Mono"` → 系统 monospace；`"Ma Shan Zheng"` → `"STKaiti"`；`"Noto Serif SC"` → `serif`
3. **`:has()` 替换**：样式直接写到 `.match-screen` / `.chat-screen`
4. **`backdrop-filter` 替换**：提高 rgba 不透明度（0.17→0.35, 0.94→0.97）
5. **`:hover` 移除**：30+ 处
6. **`conic-gradient`** → 纯色背景
7. **`aspect-ratio`** → `padding-bottom` 百分比
8. **`scrollbar-*` 移除**：用 ScrollView 组件
9. **`@media (max-width:520px)` 移除**
10. **CSS 变量保留**：小程序支持自定义属性
11. **px 值**：pxtransform 自动转 rpx；`1px`/`2px` 边框用大写 `PX` 不转换

**样式拆分**：
- `packages/mobile/src/app.scss`：全局 reset、:root 变量、app-shell、phone-frame、topbar、bottom-nav、弹窗通用样式
- `packages/mobile/src/pages/match/index.scss`：match-screen、teacher-card、swipe 相关
- `packages/mobile/src/pages/test/index.scss`：test-screen、MBTI、question 相关
- `packages/mobile/src/pages/chat/index.scss`：chat-screen、conversation、bubble 相关
- `packages/mobile/src/pages/me/index.scss`：me-screen、profile、dashboard 相关

### 步骤 5：HTML 标签与事件映射

**标签替换**：
- `<div>` → `<View>`，`<span>/<p>/<h1>-<h3>/<b>/<em>/<small>/<strong>/<time>/<cite>` → `<Text>`
- `<section>/<header>/<nav>/<article>/<main>` → `<View>`
- `<button>` → `<View>`（保持 className，不用 Taro Button 避免默认样式）
- `<input>` → `<Input>`，`<img>` → `<Image>`，`<svg>` → `<Image>`（PNG）
- `<ul>/<li>` → `<View>`

**事件适配**：
- `onClick` 保持不变
- input `onChange` → `onInput`，`e.target.value` → `e.detail.value`
- input `onKeyDown` (Enter) → `onConfirm`
- `e.stopPropagation()` → 目标元素用 `catchTap` 替代 `onClick`

### 步骤 6：SVG 图标转换

微信小程序不支持内联 SVG，17 个图标转换：

| 组件 | 图标数 | 方案 |
|------|--------|------|
| ActionIcon（pass/like/undo/arrow） | 4 | 转 PNG 或 CSS 绘制 |
| WorkIcon（users/heart/chart/folder/calendar/edit/star/shield） | 8 | 转 PNG |
| GearIcon | 1 | 转 PNG 或 Unicode |
| NavIcon（discover/assessment/chat/profile） | 4+4 选中态 | 转 PNG |

放置 `packages/mobile/src/assets/icons/`，组件中用 `<Image>` 替代 `<svg>`。现有 Unicode 符号（✓ ‹ › ▶ × ☎ ✦）可直接使用。

### 步骤 7：全局状态管理

创建 `packages/mobile/src/store/index.ts`，使用 React Context + useReducer：

- `role`（家长/老师身份）
- `prefs`（筛选条件）
- `liked`（收藏老师列表）
- `booked`（预约信息）
- `parentName` / `parentAvatar` / `teacherName` / `teacherAvatar`

各页面局部状态（cursor、swipeDirection、answers 等）仍用 useState。

### 步骤 8：自定义 TabBar

保留浮动毛玻璃导航样式（border-radius:21px, 距底 12px, 四色选中态）。

- `app.config.ts` 中 tabBar 设置 `custom: true`
- 创建 `packages/mobile/src/custom-tab-bar/index.tsx` + `index.scss`
- 样式从原 `.bottom-nav` CSS 提取
- 导航切换用 `Taro.switchTab`

### 步骤 9：4 个页面拆分

将 App.tsx 拆分为 4 个独立页面：

**match（发现页）**：
- 局部状态：cursor, swipeDirection, showSwipeHint, needsOpen, trustFor, bookFor, playing
- 弹窗：NeedsSheet, TrustSheet, BookSheet, VideoPlayer
- 滑卡逻辑：moveCard, undoSwipe（setTimeout 替换 window.setTimeout）

**test（测评页）**：
- 局部状态：answers, assessmentStarted
- MBTI 计分逻辑：从 shared/utils/mbti 引入
- 结果展示 + 匹配老师推荐列表

**chat（消息页）**：
- 局部状态：inChat, message, messages
- 聊天列表 + 对话界面
- Input 事件：onInput + onConfirm

**me（我的页）**：
- 局部状态：roleOpen, settingsOpen, posterOpen, openConnected, openLiked
- 弹窗：RoleModal, SettingsModal, PosterModal, SubscribeModal
- ParentDashboard + TeacherDashboard 组件迁移

### 步骤 10：弹窗系统迁移

8 个弹窗用页面内条件渲染（不使用小程序原生弹窗 API）：

- 遮罩层：`<View className="modal-backdrop" onClick={close}>`
- 弹窗内容：`<View className="sheet" catchTap={() => {}}>` 阻止冒泡
- 动画 `@keyframes rise` 和 `@keyframes dialog-pop` 直接保留
- 弹窗内滚动用 `<ScrollView scrollY>` 替代 `overflow: auto`

### 步骤 11：滑卡动画迁移

小程序完全支持 CSS transition + transform：
- `transition: transform .25s ease` — 保留
- `transform: translateX(±110%) rotate(±9deg)` — 保留
- `window.setTimeout` → `setTimeout`
- 滑卡引导三重动画（nudge/pulse/overlay）— @keyframes 保留

### 步骤 12：图片资源处理

- 原 `figma/src/imports/` 的 2 张 Logo PNG 复制到 `packages/mobile/src/assets/`
- 缺失的 2 个老师头像 → `avatar` 字段设 `undefined`，使用姓名首字 fallback
- 8 个 Unsplash 视频封面 → 用 CSS 背景色（教师 `color` 字段）+ 渐变遮罩替代

### 步骤 13：编译测试与视觉校验

1. 根目录 `pnpm install` 安装所有 workspace 依赖
2. `pnpm dev:weapp` 编译微信小程序
3. 微信开发者工具导入 `packages/mobile/dist` 目录预览
4. 逐页对比原项目，确认布局/样式/颜色一致
5. 测试滑卡、弹窗、MBTI 测评、聊天等核心交互

## 假设与决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 架构 | pnpm Monorepo | 用户指定，shared 层供 mobile + admin 复用 |
| 原项目 | 保留在 `figma/` 不修改 | 作为迁移参考，不破坏 |
| React 版本 | 降级到 18 | Taro 4 对 React 19 支持不明确 |
| 底部导航 | 自定义 TabBar | 保留浮动毛玻璃样式 |
| 视频封面 | CSS 背景色替代 | 避免外部图片依赖 |
| 缺失头像 | 文字 fallback | 原代码已有此逻辑 |
| SVG 图标 | 转 PNG | 小程序不支持内联 SVG |
| 状态管理 | Context + useReducer | 轻量，无需额外库 |
| designWidth | 430px | 与现有 phone-frame 设计宽度一致 |
| shared/api | 预留空壳 | 当前无后端，后续对接时填充 |
| shared/hooks | 预留空壳 | 当前无跨端 hooks，后续按需添加 |

## 验证步骤

1. `pnpm install` 无报错，workspace 依赖正确链接
2. `pnpm dev:weapp` 编译无报错
3. 微信开发者工具打开 `packages/mobile/dist`，4 个 Tab 页面正常切换
4. 发现页：滑卡动画、筛选弹窗、保障详情弹窗、预约弹窗正常
5. 测评页：12 题问卷流程完整、MBTI 结果生成正确
6. 消息页：消息列表显示、对话界面输入发送正常
7. 我的页：角色切换、各弹窗、仪表盘正常
8. 视觉对比：与原项目逐页对比，布局/颜色/字号/间距无差异
