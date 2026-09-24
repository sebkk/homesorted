// Client-side encryption for sensitive finance data (amounts, hours,
// descriptions). Uses only the browser's built-in Web Crypto API — nothing
// here ever leaves the device, and the server only ever stores ciphertext.
//
// Design: each user has one random AES-256 "data key" (DEK) that encrypts
// every sensitive field. The DEK itself is never sent to Supabase in the
// clear — it's "wrapped" (encrypted) twice: once under a key derived from the
// user's encryption password, and once under a key derived from a one-time
// recovery code. Both wrapped copies live in `user_encryption`, so either the
// password or the recovery code can unlock the same DEK on any device.

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 minimum for PBKDF2-HMAC-SHA256
const AES_LENGTH = 256;
/** Prefix identifying an encrypted blob, so plaintext (pre-encryption rows,
 * or when the user hasn't enabled encryption) can be told apart from ciphertext. */
const VERSION = "v1";

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** A one-time recovery code: 128 bits of randomness as grouped hex, e.g.
 * "A1B2-C3D4-E5F6-...". Unwraps the data key when the password is lost. */
export function generateRecoveryCode(): string {
  const hex = Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return hex.match(/.{1,4}/g)!.join("-");
}

/** Recovery codes are compared as bare uppercase hex, so dashes, spaces and
 * letter case don't matter when the user types one back in. */
function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^0-9a-f]/gi, "").toUpperCase();
}

async function deriveWrappingKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: AES_LENGTH },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

/** A fresh, random per-user data key. Generate once at setup; every
 * sensitive field is encrypted with it. Stored only in wrapped form. */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: AES_LENGTH }, true, ["encrypt", "decrypt"]);
}

/** Self-contained blob: "salt:iv:wrapped", each base64 — safe to store as text. */
export type WrappedKeyBlob = string;

async function wrapWith(dek: CryptoKey, secret: string): Promise<WrappedKeyBlob> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveWrappingKey(secret, salt);
  const wrapped = await crypto.subtle.wrapKey("raw", dek, wrappingKey, { name: "AES-GCM", iv: iv as BufferSource });
  return [toB64(salt), toB64(iv), toB64(wrapped)].join(":");
}

async function unwrapWith(blob: WrappedKeyBlob, secret: string): Promise<CryptoKey> {
  const [saltB64, ivB64, wrappedB64] = blob.split(":");
  if (!saltB64 || !ivB64 || !wrappedB64) throw new Error("malformed wrapped key");
  const wrappingKey = await deriveWrappingKey(secret, fromB64(saltB64));
  return crypto.subtle.unwrapKey(
    "raw",
    fromB64(wrappedB64) as BufferSource,
    wrappingKey,
    { name: "AES-GCM", iv: fromB64(ivB64) as BufferSource },
    { name: "AES-GCM", length: AES_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

export const wrapWithPassword = (dek: CryptoKey, password: string) => wrapWith(dek, password);
export const wrapWithRecoveryCode = (dek: CryptoKey, code: string) => wrapWith(dek, normalizeRecoveryCode(code));
export const unwrapWithPassword = (blob: WrappedKeyBlob, password: string) => unwrapWith(blob, password);
export const unwrapWithRecoveryCode = (blob: WrappedKeyBlob, code: string) => unwrapWith(blob, normalizeRecoveryCode(code));

/** Whether a stored value is ciphertext produced by encryptText/encryptNumber,
 * as opposed to a plain value from before encryption was enabled. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}:`);
}

/** Encrypts one string with the data key into a self-contained, versioned
 * blob (safe to store in a plain text column alongside unencrypted rows). */
export async function encryptText(dek: CryptoKey, plaintext: string): Promise<string> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, dek, new TextEncoder().encode(plaintext));
  return [VERSION, toB64(iv), toB64(ciphertext)].join(":");
}

export async function decryptText(dek: CryptoKey, blob: string): Promise<string> {
  const [version, ivB64, ctB64] = blob.split(":");
  if (version !== VERSION || !ivB64 || !ctB64) throw new Error("not a v1 ciphertext blob");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(ivB64) as BufferSource }, dek, fromB64(ctB64) as BufferSource);
  return new TextDecoder().decode(plaintext);
}

export const encryptNumber = (dek: CryptoKey, n: number) => encryptText(dek, String(n));
export const decryptNumber = async (dek: CryptoKey, blob: string) => Number(await decryptText(dek, blob));
