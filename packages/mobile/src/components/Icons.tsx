/**
 * SVG 图标组件 —— Image + SVG data URI 方案
 *
 * 微信小程序不支持 CSS mask-image，因此将 SVG 编码为 data URI
 * 通过 Taro <Image> 组件渲染。支持通过 color 属性动态指定图标颜色。
 */

import { Image } from "@tarojs/components";
import type { CSSProperties } from "react";

/* ============================================================
   工具函数
   ============================================================ */

/** 将 SVG 字符串编码为 data URI */
function svgToDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/** 将 SVG 中的 currentColor 替换为指定颜色 */
function coloredSvg(svg: string, color: string): string {
  return svg.replace(/currentColor/g, color);
}

/** 生成指定颜色的图标 src */
function makeSrc(svg: string, color: string): string {
  return svgToDataUri(coloredSvg(svg, color));
}

/** 共享图标样式 */
function iconStyle(size: string): CSSProperties {
  return { width: size, height: size, display: "block" };
}

/* ============================================================
   ActionIcon —— 发现页滑动操作（pass / like / undo / arrow）
   ============================================================ */

const SVG_ATTRS = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ACTION_SVG: Record<string, string> = {
  pass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  like: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/></svg>`,
  undo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="M9 7 5 11l4 4"/><path d="M5 11h8a6 6 0 1 1-5.2 9"/></svg>`,
  arrow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="m9 18 6-6-6-6"/></svg>`,
};

const ACTION_SIZE: Record<string, string> = { pass: "23px", like: "23px", undo: "18px", arrow: "24px" };

export function ActionIcon({ name, color = "#151617" }: { name: "pass" | "like" | "undo" | "arrow"; color?: string }) {
  const size = ACTION_SIZE[name] || "22px";
  return <Image className="action-icon" src={makeSrc(ACTION_SVG[name], color)} style={iconStyle(size)} mode="aspectFit" />;
}

/* ============================================================
   WorkIcon —— 我的工作台功能图标（users / heart / chart / folder 等）
   ============================================================ */

const SVG_ATTRS_THIN = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

const WORK_SVG: Record<string, string> = {
  users: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  chart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_THIN}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
};

export function WorkIcon({ name, color = "#151617" }: { name: "users" | "heart" | "chart" | "folder" | "calendar" | "edit" | "star" | "shield"; color?: string }) {
  return <Image className="work-icon-svg" src={makeSrc(WORK_SVG[name], color)} style={iconStyle("20px")} mode="aspectFit" />;
}

/* ============================================================
   NavIcon —— 底部导航栏图标（discover / assessment / diagnose / profile）
   ============================================================ */

const SVG_ATTRS_NAV = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

const NAV_SVG: Record<string, string> = {
  discover: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z"/></svg>`,
  assessment: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><path d="M5 19V9m7 10V5m7 14v-6"/><path d="M3.5 19.5h17"/></svg>`,
  diagnose: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><path d="M10 2h4"/><path d="M12 2v6"/><path d="M12 8a6 6 0 0 0-6 6c0 4.5 6 8 6 8s6-3.5 6-8a6 6 0 0 0-6-6Z"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>`,
  profile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2"/></svg>`,
};

export function NavIcon({ name, color = "#151617" }: { name: "discover" | "assessment" | "diagnose" | "profile"; color?: string }) {
  return <Image className="nav-symbol" src={makeSrc(NAV_SVG[name], color)} style={iconStyle("20px")} mode="aspectFit" />;
}

/* ============================================================
   GearIcon —— 设置齿轮图标
   ============================================================ */

const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

export function GearIcon({ color = "#151617" }: { color?: string }) {
  return <Image className="gear-icon" src={makeSrc(GEAR_SVG, color)} style={iconStyle("15px")} mode="aspectFit" />;
}

/* ============================================================
   FilterIcon —— 筛选漏斗图标
   ============================================================ */

const FILTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>`;

export function FilterIcon({ color = "#151617" }: { color?: string }) {
  return <Image className="filter-icon-svg" src={makeSrc(FILTER_SVG, color)} style={iconStyle("14px")} mode="aspectFit" />;
}

/* ============================================================
   颜色控制工具函数（供外部使用）
   ============================================================ */

/**
 * 生成指定颜色的 SVG data URI（用于需要固定颜色的场景）
 * @param svgTemplate SVG 模板字符串（含 "currentColor" 占位符）
 * @param color 目标颜色，如 "#151617" 或 "var(--ink)"
 */
export function coloredSvgUri(svgTemplate: string, color: string): string {
  return makeSrc(svgTemplate, color);
}

/** 导出 SVG 源码供外部使用 */
export { ACTION_SVG, WORK_SVG, NAV_SVG, GEAR_SVG, FILTER_SVG };
