import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * V2.3 无支付负向约束测试
 *
 * 扫描所有源文件，确保不存在 finance/membership/withdrawal/payment 相关的目录、
 * schema 模型或导航项。V2.3 交付真人家教闭环但不包含任何支付/佣金/订单/提现功能。
 * 共享老师（shared teacher fallback）也不应存在——每个老师都是独立审核入驻的。
 */
const serverSrcDir = path.resolve(__dirname, "../../../server/src");
const schemaPath = path.resolve(__dirname, "../../../server/prisma/schema.prisma");
const sidebarPath = path.resolve(__dirname, "../components/dashboard/sidebar.tsx");

describe("no payment surface", () => {
  it("has no finance, membership, or withdrawal directories in server src", () => {
    const forbiddenDirs = ["finance", "membership", "withdrawal", "payments", "orders", "commissions"];
    const existingDirs = fs.existsSync(serverSrcDir)
      ? fs.readdirSync(serverSrcDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name.toLowerCase())
      : [];
    for (const forbidden of forbiddenDirs) {
      expect(existingDirs).not.toContain(forbidden);
    }
  });

  it("schema.prisma has no Order, Membership, Withdrawal, Payment, or Commission models", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const forbiddenModels = [
      "Order", "Membership", "Withdrawal", "Payment", "Commission",
      "Transaction", "Wallet", "Invoice", "Refund", "Subscription",
    ];
    for (const model of forbiddenModels) {
      const pattern = new RegExp(`^model\\s+${model}\\s*\\{`, "m");
      expect(schema).not.toMatch(pattern);
    }
  });

  it("schema.prisma has no payment-related enums or fields", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const forbiddenPatterns = [
      /enum\s+(PaymentStatus|OrderStatus|MembershipType|CommissionType)\s*\{/,
      /\bpricePerHour\b.*Int.*@default/ // pricePerHour 存在但不应有默认值
    ];
    for (const pattern of forbiddenPatterns) {
      expect(schema).not.toMatch(pattern);
    }
  });

  it("sidebar has no finance, membership, withdrawal, or shared teacher navigation items", () => {
    const sidebar = fs.readFileSync(sidebarPath, "utf8");
    const labels = [...sidebar.matchAll(/label:\s*"([^"]+)"/g)].map((match) => match[1]);
    const forbiddenLabels = ["财务管理", "会员管理", "提现管理", "订单管理", "佣金管理", "共享老师"];
    for (const forbidden of forbiddenLabels) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("server index does not export payment or finance services", () => {
    const indexSrc = fs.readFileSync(
      path.resolve(serverSrcDir, "index.ts"),
      "utf8",
    );
    const forbiddenExports = [
      "PaymentService", "FinanceService", "OrderService", "MembershipService",
      "WithdrawalService", "CommissionService",
    ];
    for (const name of forbiddenExports) {
      expect(indexSrc).not.toContain(name);
    }
  });

  it("has no shared teacher fallback — every teacher is individually verified", () => {
    // 不应存在 "shared" 或 "fallback" 老师相关代码
    const teachersDir = path.resolve(serverSrcDir, "teachers");
    if (fs.existsSync(teachersDir)) {
      const files = fs.readdirSync(teachersDir);
      for (const file of files) {
        const content = fs.readFileSync(path.join(teachersDir, file), "utf8");
        expect(content).not.toMatch(/shared[_-]?teacher|fallback[_-]?teacher/i);
      }
    }
  });
});
