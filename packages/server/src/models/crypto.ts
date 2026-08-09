import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "../errors/app-error";

export type EncryptedApiKey = { ciphertext: string; iv: string; tag: string };

export function modelKeyEncryptionKey(encoded: string | undefined = process.env.MODEL_KEY_ENCRYPTION_KEY): Buffer {
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new AppError("INTERNAL_ERROR", 500, "Model key encryption is not configured");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new AppError("INTERNAL_ERROR", 500, "Model key encryption is not configured");
  return key;
}

export function encryptApiKey(apiKey: string, key: Buffer): EncryptedApiKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

export function decryptApiKey(envelope: EncryptedApiKey, key: Buffer): string {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError("INTERNAL_ERROR", 500, "Stored model key cannot be decrypted");
  }
}
