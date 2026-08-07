/**
 * 认证工具 — JWT 实现
 * 使用 jsonwebtoken 生成和验证 token
 */
import jwt from "jsonwebtoken";
import type { NextResponse } from "next/server";

/** JWT 密钥，从环境变量读取，必须设置 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET 环境变量未设置。请在 .env 文件或环境变量中配置 JWT_SECRET。",
    );
  }
  return secret;
}

/** Cookie 名称 */
export const AUTH_COOKIE_NAME = "admin-token";

/** Token 有效期（7 天） */
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 天，单位秒

/** 需要保护的路由前缀（页面路由） */
export const PROTECTED_PATHS = [
  "/dashboard",
  "/teachers",
  "/parents",
  "/bookings",
  "/assessments",
  "/reviews",
  "/finance",
  "/memberships",
  "/content",
  "/settings",
];

/**
 * 生成 JWT Token
 * @param subject 用户标识（管理员用户名或家长 ID）
 * @param role 角色：superadmin 或 parent
 * @returns 签名后的 JWT 字符串
 */
export function generateToken(subject: string, role: "superadmin" | "parent" = "superadmin"): string {
  return jwt.sign(
    { username: subject, role },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

/**
 * 验证 JWT Token
 * @param token 待验证的 JWT 字符串
 * @returns 解码后的 payload 或 null
 */
export function verifyToken(
  token: string,
): { username: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      username: string;
      role: string;
    };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 在响应中设置认证 Cookie
 * @param response NextResponse 对象
 * @param token JWT token
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  });
}

/**
 * 清除认证 Cookie
 * @param response NextResponse 对象
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
