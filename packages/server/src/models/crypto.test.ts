import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey, modelKeyEncryptionKey } from "./crypto";

describe("model API key encryption", () => {
  it("requires an exactly 32-byte base64 key and round-trips an AES-GCM envelope", () => {
    const key = modelKeyEncryptionKey(Buffer.alloc(32, 7).toString("base64"));
    const encrypted = encryptApiKey("admin-only-secret", key);

    expect(encrypted.ciphertext).not.toContain("admin-only-secret");
    expect(encrypted.iv).not.toBe("");
    expect(encrypted.tag).not.toBe("");
    expect(decryptApiKey(encrypted, key)).toBe("admin-only-secret");
    expect(() => modelKeyEncryptionKey(Buffer.alloc(31).toString("base64"))).toThrow("Model key encryption is not configured");
  });
});
