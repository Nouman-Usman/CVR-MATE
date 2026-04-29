// Independent super-admin auth — separate from Better Auth org system

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
export const COOKIE_NAME = "admin-session";

// Default session secret (can be overridden with ADMIN_SESSION_SECRET env var)
const DEFAULT_SESSION_SECRET = "admin-default-secret-change-in-production";

// ─── HMAC Key for cookie signing ──────────────────────────────────────────────

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// ─── Base64url encoding/decoding ──────────────────────────────────────────────

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  return Buffer.from(pad ? padded + "=".repeat(4 - pad) : padded, "base64");
}

// ─── Token signing and verification ───────────────────────────────────────────

export async function signAdminToken(email: string): Promise<string> {
  const key = await getHmacKey();
  const payload = JSON.stringify({ email, exp: Date.now() + EIGHT_HOURS_MS });
  const payloadB64 = base64urlEncode(new TextEncoder().encode(payload));
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const sigB64 = base64urlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminToken(
  cookie: string | undefined
): Promise<string | null> {
  if (!cookie) return null;
  try {
    const [payloadB64, sigB64] = cookie.split(".");
    if (!payloadB64 || !sigB64) return null;

    const key = await getHmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(base64urlDecode(sigB64)),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const { email, exp } = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64))
    );
    if (Date.now() > exp) return null;

    return email as string;
  } catch {
    return null;
  }
}

// ─── Password hashing (PBKDF2) and comparison ──────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plain),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const secret = process.env.ADMIN_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const salt = enc.encode(secret);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    keyMaterial,
    256
  );
  return base64urlEncode(bits);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  const derived = await hashPassword(plain);
  if (derived.length !== hash.length) return false;
  const enc = new TextEncoder();
  const a = enc.encode(derived);
  const b = enc.encode(hash);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
