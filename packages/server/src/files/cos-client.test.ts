import { afterEach, describe, expect, it, vi } from "vitest";
import { CosFileSigner } from "./cos-client";

describe("CosFileSigner", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defers COS configuration validation until a URL is requested", async () => {
    vi.stubEnv("COS_BUCKET", "");
    vi.stubEnv("COS_REGION", "");
    vi.stubEnv("COS_SECRET_ID", "");
    vi.stubEnv("COS_SECRET_KEY", "");

    const signer = new CosFileSigner();

    await expect(signer.signGet({ objectKey: "families/parent/children/child/ASSESSMENT_UPLOAD/file", expiresInSeconds: 600 }))
      .rejects.toThrow("COS configuration is incomplete");
  });
});
