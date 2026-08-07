/**
 * GET  /api/content/config - 获取平台配置
 * PUT  /api/content/config - 更新平台配置
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/api-auth";
import { platformConfigSchemaV2 } from "@/lib/validation";

// Prevent static prerendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const config = await prisma.platformConfig.findFirst();
    if (!config) {
      // 创建默认配置
      const created = await prisma.platformConfig.create({
        data: { platformName: "闪电虎", contact: "contact@lightning-tiger.com" },
      });
      return NextResponse.json(created);
    }
    return NextResponse.json(config);
  } catch (error) {
    console.error("[Platform Config Get Error]", error);
    return NextResponse.json({ error: "获取平台配置失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = authenticateAdmin(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    // zod 输入验证
    const result = platformConfigSchemaV2.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "输入参数无效" },
        { status: 400 },
      );
    }

    const { platformName, contact, profitSharingRatio } = result.data;

    const data: Record<string, unknown> = { platformName, contact };
    if (profitSharingRatio !== undefined) {
      data.profitSharingRatio = profitSharingRatio;
    }

    const existing = await prisma.platformConfig.findFirst();
    let config;
    if (existing) {
      config = await prisma.platformConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      config = await prisma.platformConfig.create({
        data,
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[Platform Config Update Error]", error);
    return NextResponse.json({ error: "更新平台配置失败" }, { status: 500 });
  }
}
