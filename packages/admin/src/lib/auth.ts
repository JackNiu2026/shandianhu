/**
 * 认证工具 — Mock 实现，预留真实 API 对接
 */
export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};

export const AUTH_COOKIE_NAME = "admin-token";

/**
 * 验证登录凭据
 */
export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}

/**
 * 生成 mock token
 */
export function generateToken(): string {
  return `admin-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 需要保护的路由前缀
 */
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
