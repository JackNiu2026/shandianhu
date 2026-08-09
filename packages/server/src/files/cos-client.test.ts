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

  it("binds the upload content type and length into the signed request", async () => {
    const signer = new CosFileSigner({
      bucket: "bucket-123",
      region: "ap-shanghai",
      secretId: "secret-id",
      secretKey: "secret-key",
    });
    const getObjectUrl = vi.fn().mockResolvedValue("https://cos.example/upload");
    (signer as unknown as { client: { getObjectUrl: typeof getObjectUrl } }).client = { getObjectUrl };

    await signer.signPut({
      objectKey: "families/parent/children/child/ASSESSMENT_UPLOAD/file",
      contentType: "image/jpeg",
      contentLength: 100,
      expiresInSeconds: 600,
    });

    expect(getObjectUrl).toHaveBeenCalledWith(expect.objectContaining({
      Headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": "100",
      },
    }));
  });
});
