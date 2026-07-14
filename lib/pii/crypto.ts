import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { encryptWithKey, decryptWithKey } from "@/lib/crm/encryption";

/**
 * Field-level encryption + blind indexing for CRM personal data (GDPR).
 *
 * - `encryptField`/`decryptField` protect directly-identifying contact data
 *   (email, phone, LinkedIn) and freeform note content at rest using
 *   AES-256-GCM, keyed by CRM_PII_ENCRYPTION_KEY (separate from the CRM OAuth
 *   token key so the two blast radii are independent).
 * - `blindIndex` produces a deterministic, non-reversible HMAC of a normalized
 *   value so we can dedup / exact-match (e.g. contact email) WITHOUT decrypting
 *   or storing plaintext. Keyed by CRM_BLIND_INDEX_KEY.
 */

function getPiiKey(): Buffer {
  const key = process.env.CRM_PII_ENCRYPTION_KEY;
  if (!key) throw new Error("CRM_PII_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("CRM_PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return buf;
}

function getBlindIndexKey(): Buffer {
  const key = process.env.CRM_BLIND_INDEX_KEY;
  if (!key) throw new Error("CRM_BLIND_INDEX_KEY is not set");
  return Buffer.from(key, "hex");
}

/** Encrypt a nullable field. Returns null for empty/absent input. */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const trimmed = plaintext.trim();
  if (trimmed.length === 0) return null;
  return encryptWithKey(trimmed, getPiiKey());
}

/**
 * Decrypt a nullable field. Returns null for null input. On decryption failure
 * (tampering, key rotation, corrupt data) returns null rather than throwing, so
 * a single bad row never breaks a whole list response.
 */
export function decryptField(encoded: string | null | undefined): string | null {
  if (encoded == null) return null;
  try {
    return decryptWithKey(encoded, getPiiKey());
  } catch (err) {
    console.error("Failed to decrypt PII field:", err);
    return null;
  }
}

/** Normalize a value for blind-index hashing (lowercase + trim). */
export function normalizeForIndex(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Deterministic HMAC-SHA256 blind index of a normalized value, hex-encoded.
 * Same input → same output (enables an equality/unique index) but the plaintext
 * cannot be recovered from it. Returns null for empty/absent input.
 */
export function blindIndex(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = normalizeForIndex(value);
  if (normalized.length === 0) return null;
  return createHmac("sha256", getBlindIndexKey()).update(normalized).digest("hex");
}

/** Constant-time comparison of two blind-index hashes. */
export function blindIndexEquals(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a === b;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
