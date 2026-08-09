import { describe, expect, it } from "vitest";
import { AppError } from "@lightning-tiger/server/src/errors/app-error";
import { toHttpResponse } from "../lib/v2-handler";

describe("toHttpResponse", () => {
  it("serializes stable AppError codes", async () => {
    const response = await toHttpResponse(async () => {
      throw new AppError("FORBIDDEN", 403, "You cannot access this child");
    }, "request-1");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "You cannot access this child",
        requestId: "request-1",
      },
    });
  });

  it("wraps successful handler data with a request id", async () => {
    const response = await toHttpResponse(async () => ({ childId: "child-1" }), "request-2");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { childId: "child-1" },
      requestId: "request-2",
    });
  });

  it("does not expose unknown errors", async () => {
    const response = await toHttpResponse(async () => {
      throw new Error("database connection details");
    }, "request-3");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: "request-3",
      },
    });
  });
});
