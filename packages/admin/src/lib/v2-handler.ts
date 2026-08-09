import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError } from "@lightning-tiger/server";
import type { ApiResult } from "@lightning-tiger/shared";

export async function toHttpResponse<T>(
  handler: () => Promise<T>,
  requestId: string = randomUUID(),
): Promise<NextResponse<ApiResult<T>>> {
  try {
    const data = await handler();
    return NextResponse.json({ ok: true, data, requestId });
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError("INTERNAL_ERROR", 500, "Internal server error");

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: appError.code,
          message: appError.message,
          requestId,
        },
      },
      { status: appError.status },
    );
  }
}
