# 闪电虎小程序 Figma 还原度分析报告

> 生成时间：2026-08-07
> 对比基准：`D:\闪电虎\archive\figma`（Figma Make 导出的 React + Vite 设计原稿）
> 还原目标：`D:\闪电虎\packages\mobile`（Taro 4 + React 微信小程序）
> 目标：尽可能 100% 还原 Figma 视觉效果

---

## 一、整体结论

| 维度 | 评估 |
|---|---|
| **整体还原度** | **约 82%** |
| **结构性还原** | 优秀（页面/组件/弹窗结构 1:1 对齐，token 体系已建立） |
| **配色还原** | 良好（核心 token 对齐，但存在硬编码与多版本紫色变体） |
| **几何还原** | 优秀（圆角/间距/卡片尺寸高度一致） |
| **字体还原** | **薄弱（P0）**——四套 Google Fonts 全部降级为系统 fallback |
| **阴影美学还原** | **被削弱（P0）**——"墨水硬投影"被 `!important` 覆盖层改成软阴影 |

**核心判断**：小程序已经过一轮认真的设计稿对齐（Icons.tsx 注释明确"从 Figma 提取 SVG path"，scss 多处标注"Figma 收敛层"），结构层面几乎 1:1 还原。**剩余 18% 的差距集中在两个 P0 级全局问题上**：字体降级与阴影美学被覆盖。这两个问题不解决，谈"100% 还原"无从谈起。

---

## 二、项目背景对比

| 维度 | Figma 原稿 | 小程序 |
|---|---|---|
| 框架 | React 19 + Vite 8 | Taro 4 + React 18 |
| 样式 | 原生 CSS（1695 行单文件） | SCSS（扁平 BEM 变体） |
| 单位 | 纯 px，设计宽度 430px | rpx，designWidth=430，pxtransform 转 rpx |
| Token | `:root` 语义变量（`--surface-*` / `--growth` / `--action`） | 同名 token 已对齐 ✅ |
| 字体 | Google Fonts 四套：DM Mono / Noto Sans SC / Noto Serif SC / Ma Shan Zheng | **全部降级**为系统 fallback |
| 图标 | 内联 SVG | 内联 SVG → CSS mask（注释称从 Figma 提取） |
| 代码组织 | 单文件巨石（App.tsx 862 行） | 分页 + 组件拆分（工程化更优） |

**关键观察**：小程序的工程化反而比 figma 原稿更好（组件拆分、API 降级、平台适配），问题不在结构，而在**视觉细节的最后一公里**。

---

## 三、逐页还原度评分

| 页面 | 还原度 | 主要扣分项 |
|---|---|---|
| 发现 match | **88%** | DM Mono 数字降级、品牌字标裁切 |
| 测评 test | **88%** | result-card 渐变色值漂移、match-explainer 文字色变棕、衬线标题降级 |
| 消息 chat | **82%** | 头像降级为文字、列表结构与 figma 不一致（二选一 vs 并存） |
| 我的 me | **75%** | SettingsModal 功能裁剪、字体降级、颜色双轨残留 |
| 全局 | **78%** | 字体四套全降级、阴影覆盖层背离美学、底部导航四色色值不一致 |

---

## 四、P0 级问题（必须修复，影响整体还原度）

### P0-1：字体四套 Google Fonts 全部降级，无本地字体方案

**现状**：`app.scss` 注释明确"已移除 google fonts"，降级映射如下：

| Figma 字体 | 用途 | 小程序降级 | 影响 |
|---|---|---|---|
| DM Mono | 数字 / eyebrow / 评分 / 教龄 / 价格 / revenue / mbti-core | `monospace` | 数字观感偏 Courier，跨 iOS/Android 渲染差异巨大 |
| Noto Serif SC | 衬线大标题（welcome / result / role-modal h2） | `serif` | 标题气质丢失，降级为系统衬线 |
| Ma Shan Zheng | 老师首字母占位（毛笔体） | `"STKaiti", cursive` | 毛笔体变系统楷体，依赖用户设备 |
| Noto Sans SC | 正文 | 保留 | ✅ 无影响 |

**波及范围**：eyebrow、revenue、stats、mbti-core、所有数字、所有衬线标题、老师头像占位字——几乎覆盖每个页面。

**修复方案**（推荐方案 A）：
- **方案 A（推荐）**：引入 `@font-face` 加载字体子集
  - DM Mono：仅数字 + 字母子集（woff2 约 20-30KB）
  - Noto Serif SC：仅标题常用字子集（按页面文案截取，woff2 约 50-100KB）
  - Ma Shan Zheng：仅老师姓名常用字（按数据子集化）
  - 字体文件放 `src/assets/fonts/`，`app.scss` 顶部 `@font-face` 声明
- **方案 B（次选）**：优化字体栈优先级
  - `font-family: "DM Mono", "SFMono-Regular", Menlo, monospace`
  - `font-family: "Noto Serif SC", "Songti SC", "STSong", serif`
  - 不增加包体积，但 Android 端观感仍降级

**工作量**：方案 A 约 0.5-1 天（字体子集化 + 接入 + 全局替换 font-family）

---

### P0-2："墨水硬投影"美学被 `!important` 覆盖层削弱

**现状**：Figma 的核心视觉签名是"墨水硬投影"——`border: 2px solid var(--ink)` + `box-shadow: 3-5px 0 var(--ink)`（无模糊的偏移实阴影）。小程序主体卡片忠实还原了这套美学，但存在一处**"降低描边密度"覆盖层**，用 `!important` 把部分卡片改成了软阴影：

| 文件 | 行号 | 覆盖操作 | 影响 |
|---|---|---|---|
| `app.scss` | 222 | function-card / mini-teacher 改 `0 2px 8px rgba(...)` 软阴影 + 1PX 柔边 | 偏离墨水美学 |
| `me/index.scss` | 296, 301 | connected-teacher / teacher-expand-actions `box-shadow: none !important` | 完全丢阴影 |

**修复方案**：
- 删除上述"降低描边密度"覆盖层，恢复 figma 的 `2px solid var(--ink)` + 偏移硬投影
- 若担心视觉过重，可统一将硬投影偏移量从 `5px` 调整为 `3px`（与 figma 收敛层一致），但**不要改成软阴影**
- 全局搜索 `!important` 配合 `box-shadow` 的位置，逐一核对是否符合 figma

**工作量**：约 2-4 小时

---

## 五、P1 级问题（重要，影响页面级还原度）

### P1-1：result-card 渐变色值漂移（test 页）

| | Figma | 小程序 |
|---|---|---|
| result-card 渐变 | 2-stop `#C1B3FF → #A593F5` | 3-stop `#C8BAFF → #AE9EF8 → #9B8AEF` |

色值漂移导致结果卡紫色偏冷。修复：改为 figma 的 2-stop 值。**工作量：5 分钟。**

### P1-2：match-explainer 文字色由墨黑变棕色（test 页）

`app.scss` 400-402 行把 match-explainer 标题/正文改成棕色 `#884b38 / #8f6b5d`，figma 是继承 `var(--ink)` 墨黑。修复：改回 `var(--ink)`。**工作量：5 分钟。**

### P1-3：底部导航四色色值不一致（全局）

| Tab | Figma 选中色 | 小程序选中色 | 差异 |
|---|---|---|---|
| 发现 | `#7D62D3` 紫 | `#7056BD` 紫 | 色值不一致 |
| 测评 | `#D36D48` 橙 | `#C96542` 橙 | 色值不一致 |
| 消息 | `#D7A820` 黄 | `#348052` 绿 | **色相错位**（figma 黄→小程序绿） |
| 我的 | `#3E9B62` 绿 | `#4E70AD` 蓝 | **色相错位**（figma 绿→小程序蓝） |

第 3、4 项色相错位较明显。修复：按 figma 值统一。**工作量：10 分钟。**

> 注：小程序的浮动胶囊 + 毛玻璃浮岛设计比 figma 更激进，但落实了 figma 注释里的浮岛意图，属合理增强，保留。

### P1-4：chat 页头像降级为文字（chat 页）

Figma 用真实照片 `<img>`，小程序三处头像（列表、conversation-head、气泡）全部降级为首字母 Text。修复：接入真实头像字段（需后端配合）。**工作量：0.5 天（含后端字段）。**

### P1-5：SettingsModal 功能严重裁剪（me 页）

`app.scss` 有完整的 settings-profile / avatar / field / role-switcher / save 结构，但 `Modals.tsx` 只渲染了"切换身份"一项。修复：按 figma 补全设置项。**工作量：0.5-1 天。**

### P1-6：颜色硬编码与多版本紫色变体（全局）

小程序里出现 figma 不存在的多版本紫色：

| 硬编码色值 | 出现位置 | 应替换为 |
|---|---|---|
| `#7056BD` | tab-bar / login / guest-banner | `var(--growth)` 或 figma 收敛值 `#6049AD` |
| `#5E48A9` | test/scss 229 等 | `var(--growth)` 深色版（figma 更早版本值，收敛值是 `#6049AD`） |
| `#7057C4` / `#6249B4` | me/scss 211 vs 224 双轨 | 统一为一个值 |
| `#967AE9` / `#FFBE98` | 多处硬编码 | `var(--growth)` / `var(--action)` |

修复：全局搜索替换为 token。**工作量：2-3 小时。**

---

## 六、P2 级问题（次要，影响精致度）

| 编号 | 问题 | 修复 | 工作量 |
|---|---|---|---|
| P2-1 | 品牌 mark/type 裁切方式：figma 用"大图+overflow:hidden+contain"二次裁白边，小程序 `aspectFit` 直接撑满 | 改 `aspectFill` 或对齐 figma 裁切写法 | 30 分钟 |
| P2-2 | guest-banner 用了 figma 没有的 `#7056BD` 渐变 | 改用 figma 收敛值 | 10 分钟 |
| P2-3 | token 双轨制：`--creem-*` 旧值残留（与 `--surface-*` 同值但可读性差） | 清理 `--creem-*`，统一用新 token | 1-2 小时 |
| P2-4 | chat 列表结构差异：figma 联系人卡与空态并存，小程序二选一 | 改为并存逻辑 | 1-2 小时 |
| P2-5 | 老师头像占位字 Ma Shan Zheng→STKaiti（依赖 P0-1 字体方案） | 随 P0-1 解决 | — |
| P2-6 | profile-hero / revenue-card 残留旧版两色渐变（被收敛层覆盖，视觉无差但代码冗余） | 清理旧值 | 30 分钟 |
| P2-7 | TopBar 放弃字体字标改用 PNG 图片（适配合理，保留） | — | — |

---

## 七、P3 级问题（可选优化）

| 编号 | 问题 | 备注 |
|---|---|---|
| P3-1 | 未读徽章文案"暂无未读"用琥珀底观感违和 | 改中性色或仅未读时显示 |
| P3-2 | 学习天数显示 `—`（后端无字段） | 后端补字段 |
| P3-3 | login 独立页死代码（已被 LoginModal 取代） | 删除 `pages/login/` |

---

## 八、修复路线图（建议分三阶段）

### 阶段一：P0 突击（1-1.5 天）—— 拉高整体还原度天花板

1. **字体子集化接入**（P0-1）
   - 提取 DM Mono / Noto Serif SC / Ma Shan Zheng 子集
   - `app.scss` 顶部 `@font-face` 声明
   - 全局替换 font-family 栈
2. **删除阴影覆盖层**（P0-2）
   - 移除 `app.scss` 222 行、`me/index.scss` 296/301 行的 `!important` 软阴影
   - 恢复 figma 墨水硬投影

**预期效果**：整体还原度从 82% → 90%+

### 阶段二：P1 清扫（2-3 天）—— 逐页对齐

3. test 页：result-card 渐变 + match-explainer 文字色（10 分钟）
4. 全局：底部导航四色统一（10 分钟）
5. 全局：颜色硬编码替换为 token（2-3 小时）
6. chat 页：头像接入（0.5 天，含后端）
7. me 页：SettingsModal 补全（0.5-1 天）

**预期效果**：整体还原度 90% → 95%+

### 阶段三：P2/P3 精修（1-2 天）—— 追求 100%

8. 品牌字标裁切、token 双轨清理、chat 列表结构、旧渐变残留清理
9. 死代码清理、未读徽章优化

**预期效果**：整体还原度 95% → 98%+（剩余 2% 为平台差异，如微信胶囊按钮占位、env() 安全区等，属合理适配）

---

## 九、附录：关键文件清单

**Figma 原稿**：
- `D:\闪电虎\archive\figma\src\App.tsx`（862 行，全部页面+组件）
- `D:\闪电虎\archive\figma\src\index.css`（1695 行，全部样式，**以文件末尾"收敛层"为最终生效值**）

**小程序**：
- `D:\闪电虎\packages\mobile\src\app.scss`（413 行，全局 token + 共享样式）
- `D:\闪电虎\packages\mobile\src\pages\{match,test,chat,me}\index.tsx` + `index.scss`
- `D:\闪电虎\packages\mobile\src\components\{Icons,Modals,LoginModal,TopBar}.tsx`
- `D:\闪电虎\packages\mobile\src\custom-tab-bar\index.tsx`

**对比时的重要注意事项**：
1. Figma 的 `index.css` 经历多轮设计系统迭代（warm-bone → Creem lavender → 语义化 token），**最终生效值在文件末尾**，不能看中间层
2. 小程序 `app.scss` 同样存在 token 双轨（`--creem-*` 旧 + `--surface-*` 新），以末尾收敛层为准
3. Figma 设计宽度 430px，与小程序 designWidth=430 对应，px→rpx 按 1:1 换算（pxtransform 已处理）
4. 边框用大写 `PX` 跳过 pxtransform 是 Taro 最佳实践，保留

---

**总结**：这份报告的核心信号是——**结构已经做对了，剩下的是视觉最后一公里的精修**。两个 P0 问题（字体 + 阴影）是性价比最高的修复点，1-1.5 天能换来 8 个百分点的还原度提升。建议从阶段一开始。
