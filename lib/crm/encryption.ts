import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.CRM_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("CRM_TOKEN_ENCRYPTION_KEY is not set");
  return Buffer.from(key, "hex");
}

/**
 * AES-256-GCM encrypt with an explicit key. Format: iv:tag:ciphertext (base64).
 * Exported so other domains (e.g. contact PII) can reuse the primitive with a
 * different key without duplicating the cipher logic.
 */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (256-bit)");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/** AES-256-GCM decrypt with an explicit key. Throws on tampering/format error. */
export function decryptWithKey(encoded: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  if (tag.length !== TAG_LENGTH) throw new Error("Invalid auth tag length");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encrypt(plaintext: string): string {
  return encryptWithKey(plaintext, getKey());
}

export function decrypt(encoded: string): string {
  return decryptWithKey(encoded, getKey());
}
