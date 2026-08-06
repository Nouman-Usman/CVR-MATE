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

/**
 * Normalize a phone number to a canonical digit string for blind indexing so
 * that "+45 12 34 56 78", "0045 12345678", and "12345678" all hash the same.
 * Strips formatting; a leading "+"/"00" marks an international number, and a
 * bare 8-digit number is treated as Danish (prefixed 45). Returns null when
 * there aren't enough digits to be a real number.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // An extension is not part of the subscriber number. Left in, "+45 12345678
  // ext 2" hashed differently from the same number without it, so the two never
  // matched in a lookup or deduplicated.
  const withoutExtension = trimmed.split(
    /\s*(?:\bext\.?|\bx\.?|\blokal\.?|,|;)\s*\d+\s*$/i
  )[0];

  const intl = withoutExtension.startsWith("+") || withoutExtension.startsWith("00");
  // Loop, not a single replace: "00045..." only had one pair stripped, leaving a
  // leading zero that produced a different hash than "+45...".
  let digits = withoutExtension.replace(/\D/g, "");
  while (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length < 6) return null;
  // E.164 caps a full international number at 15 digits; anything longer is a
  // pasted reference or a run-together pair, not a phone number.
  if (digits.length > 15) return null;

  if (!intl && digits.length === 8) return `45${digits}`; // bare Danish local number
  return digits;
}

/**
 * Deterministic blind index of a phone number — the phone equivalent of
 * `blindIndex`, but normalized via `normalizePhone` instead of lowercase/trim so
 * formatting variants collapse to one hash. Same key as `blindIndex`.
 */
export function blindIndexPhone(value: string | null | undefined): string | null {
  const normalized = normalizePhone(value);
  if (!normalized) return null;
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
