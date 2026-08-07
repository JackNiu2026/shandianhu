/**
 * SVG 图标组件
 *
 * 方案 B：CSS mask 实现颜色继承
 *
 * 使用 View + CSS mask-image 替代 Image + dataURI，
 * 让图标通过 backgroundColor: currentColor 继承父级 CSS color 属性。
 * SVG 中的 currentColor 在 mask 上下文中解析为 #000（alpha=1.0），
 * 仅 alpha 通道参与遮罩，因此 mask 始终正确显示笔画区域。
 */

import { View } from "@tarojs/components";
import type { CSSProperties } from "react";

/* === SVG path 源码（从 Figma 原稿提取） === */

const SVG_ATTRS = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SVG_ATTRS_THIN = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const SVG_ATTRS_NAV = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

/** 将 SVG 字符串编码为 data URI */
function svgToDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/** 将 SVG 转为 mask 用的 data URI（currentColor → #000 确保 alpha 通道为 1.0） */
function svgToMaskUri(svg: string): string {
  return svgToDataUri(svg.replace(/currentColor/g, "#000"));
}

/* === ActionIcon SVG paths === */
const ACTION_SVG: Record<string, string> = {
  pass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  like: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/></svg>`,
  undo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="M9 7 5 11l4 4"/><path d="M5 11h8a6 6 0 1 1-5.2 9"/></svg>`,
  arrow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS}><path d="m9 18 6-6-6-6"/></svg>`,
};

/* === WorkIcon SVG paths === */
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

/* === NavIcon SVG paths === */
const NAV_SVG: Record<string, string> = {
  discover: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z"/></svg>`,
  assessment: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><path d="M5 19V9m7 10V5m7 14v-6"/><path d="M3.5 19.5h17"/></svg>`,
  chat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.1-.6L4 20l1.5-4.1A7.1 7.1 0 0 1 4 11.5a7.5 7.5 0 0 1 16 0Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>`,
  profile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${SVG_ATTRS_NAV}><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2"/></svg>`,
};

/* === GearIcon SVG === */
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

/* === 预生成 mask data URI === */
const ACTION_MASK = Object.fromEntries(
  Object.entries(ACTION_SVG).map(([k, v]) => [k, svgToMaskUri(v)]),
);
const WORK_MASK = Object.fromEntries(
  Object.entries(WORK_SVG).map(([k, v]) => [k, svgToMaskUri(v)]),
);
const NAV_MASK = Object.fromEntries(
  Object.entries(NAV_SVG).map(([k, v]) => [k, svgToMaskUri(v)]),
);
const GEAR_MASK = svgToMaskUri(GEAR_SVG);

/* === mask 内联样式生成器 === */
function maskStyle(uri: string, size: string): CSSProperties {
  return {
    width: size,
    height: size,
    backgroundColor: "currentColor",
    WebkitMaskImage: `url("${uri}")`,
    maskImage: `url("${uri}")`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as CSSProperties;
}

/* === 组件 === */

/* 尺寸对齐 Figma 最终层:pass/like 23px、undo 18px、arrow 24px */
const ACTION_SIZE: Record<string, string> = { pass: "23px", like: "23px", undo: "18px", arrow: "24px" };

export function ActionIcon({ name }: { name: "pass" | "like" | "undo" | "arrow" }) {
  return <View className="action-icon" style={maskStyle(ACTION_MASK[name], ACTION_SIZE[name] || "22px")} />;
}

export function WorkIcon({ name }: { name: "users" | "heart" | "chart" | "folder" | "calendar" | "edit" | "star" | "shield" }) {
  return <View className="work-icon-svg" style={maskStyle(WORK_MASK[name], "20px")} />;
}

export function GearIcon() {
  return <View className="gear-icon" style={maskStyle(GEAR_MASK, "15px")} />;
}

export function NavIcon({ name }: { name: "discover" | "assessment" | "chat" | "profile" }) {
  return <View className="nav-symbol" style={maskStyle(NAV_MASK[name], "20px")} />;
}

/* === 颜色控制工具函数 === */

/**
 * 生成指定颜色的 SVG data URI（用于需要固定颜色的场景）
 * @param svgTemplate SVG 模板字符串（含 "currentColor" 占位符）
 * @param color 目标颜色，如 "#151617" 或 "var(--ink)"
 */
export function coloredSvg(svgTemplate: string, color: string): string {
  const colored = svgTemplate.replace(/currentColor/g, color);
  return svgToDataUri(colored);
}

/** 导出 SVG 源码供外部使用 */
export { ACTION_SVG, WORK_SVG, NAV_SVG, GEAR_SVG };
