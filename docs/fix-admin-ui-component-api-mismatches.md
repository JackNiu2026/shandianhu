# 修复 Admin 后台 UI 组件 API 不匹配问题

## 摘要

8 个管理页面（含家长详情共 9 个文件）已全部创建完成，但 5 个 UI 组件的 API 与页面调用方式存在不匹配，导致 TypeScript 编译会失败。需要更新组件以匹配页面已使用的 API。

## 当前状态分析

### 已完成的页面（9 个文件，无需重写）
1. `parents/page.tsx` - 家长管理列表
2. `parents/[id]/page.tsx` - 家长详情（Server Component）
3. `bookings/page.tsx` - 预约管理
4. `assessments/page.tsx` - 测评题库
5. `reviews/page.tsx` - 评价管理
6. `finance/page.tsx` - 财务管理
7. `memberships/page.tsx` - 会员管理
8. `content/page.tsx` - 内容配置
9. `settings/page.tsx` - 系统设置

### 存在的 5 个 API 不匹配问题

#### 问题 1: DataTable（严重）
- **页面调用方式**: `import { DataTable, type Column } from "@/components/ui/data-table"`，使用 `Column<T>[]` 含 `render(row, index)` 和 `align` 字段，传 `rowKey` + `empty` props
- **原 teachers 页面**: `import DataTable, { type Column } from "@/components/ui/data_table"`（snake_case），传 `getRowId` prop
- **data-table.tsx（kebab-case）**: 基于 `@tanstack/react-table`，接受 `ColumnDef[]`，不接受 `Column[]` / `rowKey` / `empty`
- **data_table.tsx（snake_case）**: 简单实现，接受 `Column[]` / `getRowId` / `empty`，但 `render` 无 index 参数，Column 无 `align` 字段
- **结论**: 存在两个冲突的 DataTable 实现，需要统一为一个支持所有页面需求的版本

#### 问题 2: StatCard（严重）
- **页面调用**: `<StatCard title="总收入" value={...} hint="..." />`
- **组件提供**: `label`, `value`, `icon`(必填), `trend` — 无 `title` / `hint`

#### 问题 3: Pagination（严重）
- **页面调用**: `<Pagination page={1} pageSize={8} total={10} onPageChange={setPage} />`
- **组件提供**: `currentPage`, `totalPages`, `onPageChange` — 无 `page` / `pageSize` / `total`

#### 问题 4: Tabs（中等）
- **页面调用**: `<Tabs tabs={[{ value: "questions", label: "题目管理", count: 12 }]} ... />`
- **组件提供**: `TabItem` 仅含 `label` + `value` — 无 `count`

#### 问题 5: Modal（严重）
- **页面调用**: `<Modal open={...} onClose={...} title={...} description={...} footer={...}>`
- **组件提供**: `isOpen`, `onClose`, `title`, `children` — 无 `open` / `description` / `footer`

## 修复方案

统一策略：**更新组件以匹配页面 API**（而非修改 9 个页面），因为页面代码已完整且一致。

### 修改 1: 重写 `data-table.tsx`（kebab-case）

**文件**: `d:\闪电虎\packages\admin\src\components\ui\data-table.tsx`

**原因**: 当前版本基于 @tanstack/react-table，与所有页面的 Column API 不兼容

**修改内容**:
- 移除 `@tanstack/react-table` 依赖
- 添加 `"use client"` 指令
- `Column<T>` 接口增加 `align?: "left" | "center" | "right"` 字段
- `Column<T>` 的 `render` 签名改为 `(row: T, index: number) => React.ReactNode`
- `DataTableProps<T>` 接受 `columns: Column<T>[]`, `data: T[]`, `rowKey?: (row: T) => string`, `getRowId?: (row: T) => string`（向后兼容）, `empty?: React.ReactNode`, `onRowClick?: (row: T) => void`, `className?: string`
- 内部用 `rowKey || getRowId` 获取行 ID，默认用 index
- 根据 `align` 应用 `text-left` / `text-center` / `text-right` 到 td
- 保留默认导出 + 命名导出

### 修改 2: 删除 `data_table.tsx`（snake_case）

**文件**: `d:\闪电虎\packages\admin\src\components\ui\data_table.tsx`

**原因**: 与 `data-table.tsx` 重复，统一使用 kebab-case 版本

### 修改 3: 更新 teachers 页面导入路径

**文件**: `d:\闪电虎\packages\admin\src\app\(dashboard)\teachers\page.tsx`

**修改**: `import DataTable, { type Column } from "@/components/ui/data_table"` → `import DataTable, { type Column } from "@/components/ui/data-table"`

**额外修改**: 将 `getRowId={(t) => t.id}` 改为 `rowKey={(t) => t.id}`（或保留 `getRowId` 因为新组件也支持）

### 修改 4: 更新 `stat_card.tsx`

**文件**: `d:\闪电虎\packages\admin\src\components\ui\stat_card.tsx`

**修改内容**:
- `StatCardProps` 中 `label` → `title`
- `icon` 改为可选（`icon?: string`，默认值 `""`）
- `trend` → `hint`
- 更新组件内部引用对应变量名

### 修改 5: 更新 `pagination.tsx`

**文件**: `d:\闪电虎\packages\admin\src\components\ui\pagination.tsx`

**修改内容**:
- `PaginationProps` 改为接受 `page: number`, `pageSize: number`, `total: number`, `onPageChange: (page: number) => void`, `className?: string`
- 内部计算 `totalPages = Math.max(1, Math.ceil(total / pageSize))`
- 使用 `page` 作为当前页
- 保留默认导出 + 命名导出

### 修改 6: 更新 `tabs.tsx`

**文件**: `d:\闪电虎\packages\admin\src\components\ui\tabs.tsx`

**修改内容**:
- `TabItem` 增加 `count?: number` 字段
- 渲染时若 `count` 存在，在 label 后显示 `<span className="ml-1.5 rounded-full bg-surface-paper px-1.5 py-0.5 text-xs font-mono">{count}</span>`

### 修改 7: 更新 `modal.tsx`

**文件**: `d:\闪电虎\packages\admin\src\components\ui\modal.tsx`

**修改内容**:
- `ModalProps` 增加 `open?: boolean`（作为 `isOpen` 的别名）, `description?: React.ReactNode`, `footer?: React.ReactNode`
- 内部用 `const isOpen = open ?? isOpenProp` 兼容两种写法（或直接将 `isOpen` 改名为 `open`）
- 若 `description` 存在，在 title 下方渲染 `<p className="mt-1 text-sm text-ink-muted">{description}</p>`
- 若 `footer` 存在，在 children 下方渲染 `<div className="mt-6 flex items-center justify-end gap-3">{footer}</div>`

### 修改 8: 更新 `index.ts`

**文件**: `d:\闪电虎\packages\admin\src\components\ui\index.ts`

**修改内容**:
- 确认 `DataTable` 和 `Column` 从 `./data-table` 导出（已正确）
- 移除对 `./data_table` 的任何引用（如果存在）

## 不需要修改的组件（已兼容）

| 组件 | 页面使用方式 | 组件提供 | 状态 |
|------|------------|---------|------|
| Button | `variant`, `size`, `onClick`, `disabled`, `href`, `asChild` | 全部支持 | OK |
| Card | `title`, `description`, `bodyClassName`, `action`, `className`, `children` | 全部支持 | OK |
| Badge | `variant`, `className`, `children` | 全部支持 | OK |
| Input | `value`, `onChange`, `placeholder`, `type`, `onKeyDown`, `readOnly`, `disabled` | 全部支持（`label`/`error` 可选） | OK |
| Select | `value`, `onChange`, `options` | 全部支持（`label`/`error` 可选） | OK |
| EmptyState | `title` | `title`, `description?`, `icon?` | OK |
| Checkbox | `label`, `checked`, `onChange` | 全部支持 | OK |

## 验证步骤

1. 运行 TypeScript 编译检查：`npx tsc --noEmit` 在 `packages/admin` 目录
2. 确认无编译错误
3. 检查所有 9 个页面的导入路径正确
4. 确认 teachers 原有页面未受影响

## 假设与决策

- **决策**: 更新组件而非页面 — 页面代码已完整且一致，修改组件风险更低
- **假设**: `@tanstack/react-table` 移除后不影响其他文件（已确认仅 `data-table.tsx` 使用）
- **假设**: teachers 页面的 `getRowId` prop 可被新 DataTable 的 `getRowId` 兼容支持
- **决策**: 保留 `index.ts` 的命名导出模式，同时保留各组件的默认导出
