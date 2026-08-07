# Neo-brutalism UI 组件库修复计划

## 概述

`packages/admin` 项目中存在两类问题：(1) 导致 TypeScript 编译失败的组件 API 不匹配；(2) 组件样式与用户规格的偏差。本计划统一修复所有问题，确保 `npx tsc --noEmit` 通过且组件符合 Neo-brutalism 设计规格。

## 当前状态分析

### 文件结构
- UI 组件：`src/components/ui/` 下 12 个组件 + 1 个 index.ts
- 布局组件：`src/components/dashboard/` 下 3 个组件
- 页面：`src/app/(dashboard)/` 下 10 个页面路由
- 认证：`src/middleware.ts` + `src/app/(auth)/` 下登录页

### 问题清单

#### A. 编译错误（CRITICAL）

| # | 问题 | 影响范围 |
|---|------|----------|
| A1 | 存在两个不兼容的 DataTable：`data-table.tsx`（@tanstack/react-table，接收 `ColumnDef[]`）和 `data_table.tsx`（简单版，接收 `Column<T>[]`） | 所有使用表格的页面（7个） |
| A2 | 页面传 `Column<T>[]` + `rowKey` + `empty` + `onRowClick` 给 DataTable，但 `data-table.tsx` 的 `DataTableProps` 只接受 `ColumnDef[]` + `searchPlaceholder` + `pageSize` | finance, bookings, assessments, memberships, parents, parents/[id], reviews |
| A3 | `teachers/page.tsx` 从 `data_table`（下划线）导入，其余页面从 `data-table`（连字符）导入 | teachers |
| A4 | StatCard 被调用时传 `title`/`hint`（无 `icon`），但组件定义要求 `label`/`icon`/`trend` | finance, memberships（共6处调用） |
| A5 | Pagination 被调用时传 `page`/`pageSize`/`total`，但组件定义要求 `currentPage`/`totalPages` | bookings, parents, memberships, reviews（共4处） |
| A6 | Modal 被调用时传 `open`/`footer`/`description`，但组件定义只有 `isOpen`/`title`/`children` | assessments, reviews（共2处） |
| A7 | Tabs 的 `TabItem` 无 `count` 属性，但 assessments 页面在 tabs 数组中传了 `count` | assessments |

#### B. 规格偏差（MEDIUM）

| # | 组件 | 偏差 |
|---|------|------|
| B1 | Button | 基础阴影用 `shadow-nb-sm`（应为 `shadow-nb`）；hover/active 位移 1px（应为 2px/4px）；default 变体 `bg-surface-paper`（应为 `bg-white`）；size 尺寸不符 |
| B2 | Badge | default 变体 `text-ink-muted border-ink-muted/30`（应为 `text-ink` + 无透明度边框）；各变体边框带 `/40` 透明度（应无） |
| B3 | Card | body 内边距 `p-5`（应为 `p-6`） |

## 实施方案

### 策略：扩展组件 API 兼容现有页面 + 修复规格偏差

核心思路：重写 DataTable 使其接受所有页面已在使用的 `Column<T>[]` API；其余组件通过添加可选别名属性兼容页面调用，同时保持规格定义的主 API 可用。

---

### 步骤 1：重写 `data-table.tsx`

**文件**：`d:\闪电虎\packages\admin\src\components\ui\data-table.tsx`

**改动要点**：
- 保留 `'use client'` 指令
- 保留 `@tanstack/react-table` 依赖（用于排序、全局搜索、分页）
- 定义 `Column<T>` 接口（从现有 `data-table.tsx` 保留，含 `key`/`header`/`render`/`align`/`className`/`headerClassName`）
- 定义新的 `DataTableProps<T>`：
  ```
  columns: Column<T>[]
  data: T[]
  rowKey?: (row: T, index: number) => string  // 兼容 assessments 的 (_q, i) => String(i)
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  searchPlaceholder?: string  // 默认 "搜索..."
  pageSize?: number  // 默认 10
  className?: string
  ```
- 内部将 `Column<T>[]` 转换为 `ColumnDef<T, unknown>[]`：
  - `accessorKey` = `col.key`
  - `header` = `col.header`
  - `cell` = 调用 `col.render(row, index)` 或回退到 `String(row[col.key])`
  - 启用排序（除非 `render` 存在时也允许排序，通过 `enableSorting` 控制）
- `getRowId` 使用 `rowKey` 回调（默认 `(row) => String(index)`）
- 搜索框：表格上方左侧，使用 Input 组件样式
- 分页按钮：使用 Button sm 样式
- 表格样式：`border-2 border-ink rounded-xl shadow-nb overflow-hidden`
- 表头：`bg-surface-soft border-b-2 border-ink font-bold px-4 py-3`
- 行：`border-b border-ink-muted/20 px-4 py-3`，奇偶交替 `bg-surface-paper`/`bg-surface-soft`
- `align` 支持：`left`/`center`/`right` 映射到 `text-align`
- 空数据：显示 `empty` 或默认 `<EmptyState title="暂无数据" />`
- 默认导出 + 命名导出 `{ DataTable }` + 类型导出 `{ Column }`

### 步骤 2：删除 `data_table.tsx`

**文件**：`d:\闪电虎\packages\admin\src\components\ui\data_table.tsx`

- 使用 DeleteFile 工具删除

### 步骤 3：更新 `teachers/page.tsx` 导入路径

**文件**：`d:\闪电虎\packages\admin\src\app\(dashboard)\teachers\page.tsx`

- 将 `import DataTable, { type Column } from "@/components/ui/data_table"` 改为 `import DataTable, { type Column } from "@/components/ui/data-table"`
- 将 `<DataTable ... getRowId={(t) => t.id} />` 改为 `<DataTable ... rowKey={(t) => t.id} />`

### 步骤 4：扩展 StatCard 兼容页面调用

**文件**：`d:\闪电虎\packages\admin\src\components\ui\stat_card.tsx`

- `icon` 改为可选（默认 `""`）
- 新增 `title?: string`（`label` 的别名）
- 新增 `hint?: string`（`trend` 的别名）
- 内部逻辑：`const labelText = label ?? title;` `const trendText = trend ?? hint;`
- 保持规格 API（`label`/`value`/`icon`/`trend`）为主 API

### 步骤 5：扩展 Pagination 兼容页面调用

**文件**：`d:\闪电虎\packages\admin\src\components\ui\pagination.tsx`

- `currentPage` 改为可选，新增 `page?: number` 别名
- `totalPages` 改为可选，新增 `pageSize?: number` 和 `total?: number`
- 内部计算：
  ```
  const cp = currentPage ?? page ?? 1;
  const tp = totalPages ?? Math.max(1, Math.ceil((total ?? 0) / (pageSize ?? 10)));
  ```
- 保持规格 API（`currentPage`/`totalPages`/`onPageChange`）为主 API

### 步骤 6：扩展 Modal 兼容页面调用

**文件**：`d:\闪电虎\packages\admin\src\components\ui\modal.tsx`

- `isOpen` 改为可选，新增 `open?: boolean` 别名
- 新增 `description?: string`（标题下方副文本）
- 新增 `footer?: React.ReactNode`（底部操作区）
- 内部逻辑：`const show = isOpen ?? open;`
- 布局调整：标题区 → 描述 → children → footer（footer 上方加 `border-t-2 border-ink mt-4 pt-4`）

### 步骤 7：扩展 Tabs 的 TabItem

**文件**：`d:\闪电虎\packages\admin\src\components\ui\tabs.tsx`

- `TabItem` 新增 `count?: number`
- 渲染：若 `count` 存在，在 label 后显示 `<span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{count}</span>`（选中态）或 `<span className="ml-1.5 rounded-full bg-surface-base px-1.5 text-xs">{count}</span>`（未选中态）

### 步骤 8：修复 Button 规格偏差

**文件**：`d:\闪电虎\packages\admin\src\components\ui\button.tsx`

- 基础类：`shadow-nb-sm` → `shadow-nb`
- hover：`translate-x-[1px] translate-y-[1px]` → `translate-x-[2px] translate-y-[2px]`，`hover:shadow-nb-sm`
- active：`translate-x-[1px] translate-y-[1px]` → `translate-x-[4px] translate-y-[4px]`，`active:shadow-none`
- default 变体：`bg-surface-paper text-ink` → `bg-white text-ink`
- size：
  - sm：`text-xs px-3 py-1 rounded-md` → `px-3 py-1.5 text-sm rounded-lg`
  - md：`text-sm px-4 py-2 rounded-lg` → `px-4 py-2 rounded-lg`
  - lg：`text-base px-5 py-2.5 rounded-lg` → `px-6 py-3 text-lg rounded-lg`
- disabled 样式中 `shadow-nb-sm` → `shadow-nb`

### 步骤 9：修复 Badge 规格偏差

**文件**：`d:\闪电虎\packages\admin\src\components\ui\badge.tsx`

- default：`bg-surface-soft text-ink-muted border-ink-muted/30` → `bg-surface-soft text-ink border-ink-muted/30`
  - 规格说 `bg-surface-soft text-ink`，边框未指定颜色，保留 `border-ink-muted/30` 或改为 `border-ink`。按规格只说 `border`，但 Neo-brutalism 风格需要 `border-ink`。然而 default 是中性变体，用 `border-ink-muted/30` 更合理。**决定**：default 用 `text-ink border-ink-muted/30`（仅修复 text 颜色）
- success：`border-success/40` → `border-success`
- notice：`border-notice/40` → `border-notice`
- danger：`border-danger/40` → `border-danger`
- primary：`border-growth/40` → `border-growth`

### 步骤 10：修复 Card 规格偏差

**文件**：`d:\闪电虎\packages\admin\src\components\ui\card.tsx`

- body 内边距：`p-5` → `p-6`
- 保持现有的 `title`/`description`/`action`/`bodyClassName` 扩展属性（有用且被页面使用）

### 步骤 11：更新 `index.ts` 导出

**文件**：`d:\闪电虎\packages\admin\src\components\ui\index.ts`

- 确认 `DataTable` 和 `Column` 从 `./data-table` 导出（已正确）
- 无需修改

### 步骤 12：运行 TypeScript 类型检查

- 在 `d:\闪电虎\packages\admin` 目录运行 `npx tsc --noEmit`
- 修复所有剩余错误
- 预期可能的问题：`@lightning-tiger/shared` 的类型导出、Next.js 类型生成等

## 假设与决策

1. **DataTable API 选择**：规格说"接收 `ColumnDef[]`"，但所有 7 个页面已使用 `Column<T>[]` API（含 `key`/`header`/`render`/`align`/`rowKey`/`empty`）。决策：重写 DataTable 接受 `Column<T>[]` 并内部转换为 `ColumnDef[]`，满足"基于 @tanstack/react-table"和功能要求，同时不破坏现有页面。

2. **组件 API 别名策略**：StatCard/Pagination/Modal 通过添加可选别名属性兼容页面调用，而非修改所有页面。决策理由：减少改动面、降低风险、保持页面逻辑不变。

3. **Button hover/active 位移值**：规格说 hover 位移 2px、active 位移 4px。但现有页面中其他内联样式按钮（如 topbar 登出、data-table 分页）使用 1px/2px。决策：仅修复 Button 组件本身为 2px/4px，内联样式不强制统一（不在本次范围内）。

4. **Badge default 变体边框颜色**：规格说 `bg-surface-soft text-ink` + `border`，未指定边框颜色。决策：保留 `border-ink-muted/30` 使中性变体视觉柔和，仅修复 `text-ink-muted` → `text-ink`。

5. **Card 扩展属性**：规格只说 `title` + `p-6`，但现有 `description`/`action`/`bodyClassName` 被多个页面使用。决策：保留扩展属性，仅修复 `p-5` → `p-6`。

## 验证步骤

1. 运行 `npx tsc --noEmit` — 零错误
2. 检查所有组件默认导出和命名导出完整
3. 确认 `data_table.tsx` 已删除
4. 确认 `teachers/page.tsx` 导入路径已更新
5. 确认 Button/Badge/Card 样式符合规格
6. 运行 `npm run build`（可选）验证 Next.js 构建
