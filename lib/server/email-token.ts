import { createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";

// AES-SIV (RFC 5297) encryption/decryption for the /auth-token email links —
// the secret the token-generating application actually uses is a Tink
// AesSivKey (Deterministic AEAD), not AES-GCM as first assumed from a
// mismatched reference snippet. Implemented from the RFC directly: neither
// the `miscreant` npm package (unmaintained since 2018, needs a WebCrypto
// polyfill) nor Google's own `tink-crypto` JS library (never implemented
// Deterministic AEAD/AES-SIV — only regular AEAD, MAC, signatures, hybrid
// encryption) cover this. The CMAC building block (cmac()) was verified
// byte-for-byte against the four official RFC 4493 test vectors; the S2V/SIV
// composition was confirmed end-to-end by successfully decrypting a real
// token from the actual token-issuing system.
//
// Key convention (RFC 5297 §2.2): a Tink AesSivKey is K1 || K2, split evenly
// — the first half is the CMAC/S2V key, the second half is the
// CTR-encryption key. RFC 5297 blesses three total sizes: 256 bits
// (DETERMINISTIC_AEAD_AES_SIV_CMAC_256, two AES-128 halves), 384 bits (two
// AES-192 halves), and 512 bits (two AES-256 halves, Tink's "AES256_SIV"
// template) — this file handles all three rather than assuming one.
//
// Associated data: Tink's DeterministicAead.decryptDeterministically always
// treats its associatedData argument as its own S2V component, even when
// it's a zero-length buffer — that's a *different* input to S2V than
// omitting the component entirely (confirmed empirically: only the former
// verifies against a real token). This app has nothing to pass as
// associated data, so it always supplies one empty component.

const TINK_PREFIX_LENGTH = 5;
const TINK_VERSION_BYTE = 0x01;

function aesEncryptBlock(key: Buffer, block: Buffer): Buffer {
  const cipher = createCipheriv(`aes-${key.length * 8}-ecb`, key, Buffer.alloc(0));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

function xor(a: Buffer, b: Buffer): Buffer {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

// GF(2^128) doubling with the standard 0x87 reduction polynomial — the same
// subkey-derivation step used by AES-CMAC (RFC 4493) and S2V (RFC 5297).
function dbl(block: Buffer): Buffer {
  const out = Buffer.alloc(16);
  let carry = 0;
  for (let i = 15; i >= 0; i--) {
    const v = (block[i] << 1) | carry;
    out[i] = v & 0xff;
    carry = (v >> 8) & 1;
  }
  if (carry) out[15] ^= 0x87;
  return out;
}

// AES-CMAC (RFC 4493) — verified against the RFC's official test vectors.
function cmac(key: Buffer, message: Buffer): Buffer {
  const L = aesEncryptBlock(key, Buffer.alloc(16));
  const K1 = dbl(L);
  const K2 = dbl(K1);

  const blockCount = message.length === 0 ? 1 : Math.ceil(message.length / 16);
  const isLastBlockComplete = message.length !== 0 && message.length % 16 === 0;
  const lastBlockStart = (blockCount - 1) * 16;

  let lastBlock: Buffer;
  if (isLastBlockComplete) {
    lastBlock = xor(message.subarray(lastBlockStart, lastBlockStart + 16), K1);
  } else {
    const remainder = message.subarray(lastBlockStart);
    const padded = Buffer.alloc(16);
    remainder.copy(padded);
    padded[remainder.length] = 0x80;
    lastBlock = xor(padded, K2);
  }

  let x: Buffer = Buffer.alloc(16);
  for (let i = 0; i < blockCount - 1; i++) {
    x = aesEncryptBlock(key, xor(x, message.subarray(i * 16, i * 16 + 16)));
  }
  return aesEncryptBlock(key, xor(x, lastBlock));
}

// S2V (RFC 5297 §2.4) — combines the CMAC of each component (associated
// data fields, then the plaintext last) via the doubling/XOR construction.
function s2v(key: Buffer, components: Buffer[]): Buffer {
  if (components.length === 0) return cmac(key, Buffer.alloc(16));

  let d = cmac(key, Buffer.alloc(16));
  for (let i = 0; i < components.length - 1; i++) {
    d = xor(dbl(d), cmac(key, components[i]));
  }

  const last = components[components.length - 1];
  if (last.length >= 16) {
    const t = Buffer.from(last);
    const tailStart = t.length - 16;
    xor(t.subarray(tailStart), d).copy(t, tailStart);
    return cmac(key, t);
  }
  const padded = Buffer.alloc(16);
  last.copy(padded);
  padded[last.length] = 0x80;
  return cmac(key, xor(dbl(d), padded));
}

// RFC 5297 §2.5: the two top bits (MSB of each 64-bit half) of the
// synthetic IV are cleared before it's used as the CTR counter.
function maskIv(v: Buffer): Buffer {
  const masked = Buffer.from(v);
  masked[0] &= 0x7f;
  masked[8] &= 0x7f;
  return masked;
}

function splitKey(key64: Buffer): { k1: Buffer; k2: Buffer } {
  return { k1: key64.subarray(0, key64.length / 2), k2: key64.subarray(key64.length / 2) };
}

function aesSivEncrypt(key64: Buffer, plaintext: Buffer, associatedData: Buffer[]): Buffer {
  const { k1, k2 } = splitKey(key64);
  const v = s2v(k1, [...associatedData, plaintext]);
  const cipher = createCipheriv(`aes-${k2.length * 8}-ctr`, k2, maskIv(v));
  const c = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([v, c]);
}

function aesSivDecrypt(key64: Buffer, ciphertext: Buffer, associatedData: Buffer[]): Buffer {
  const { k1, k2 } = splitKey(key64);

  const v = ciphertext.subarray(0, 16);
  const c = ciphertext.subarray(16);

  const decipher = createDecipheriv(`aes-${k2.length * 8}-ctr`, k2, maskIv(v));
  const plaintext = Buffer.concat([decipher.update(c), decipher.final()]);

  const expectedV = s2v(k1, [...associatedData, plaintext]);
  if (!timingSafeEqual(v, expectedV)) {
    throw new Error("SIV authentication failed");
  }
  return plaintext;
}

// RFC 5297's three blessed AEAD_AES_SIV_CMAC_* total key sizes: 256 bits
// (two AES-128 halves), 384 bits (two AES-192 halves), 512 bits (two AES-256
// halves, Tink's "AES256_SIV" template — the one first validated here).
// DETERMINISTIC_AEAD_AES_SIV_CMAC_256 is the 32-byte variant.
const VALID_SIV_KEY_LENGTHS = [32, 48, 64];

// Extracts the AesSivKey key material from a Tink keyset (base64-encoded
// protobuf). Unlike AesGcmKey (key_value is protobuf field 3), AesSivKey's
// key_value is field 2 — confirmed by parsing a real keyset byte by byte,
// not assumed by analogy. The marker's second byte is the field's length as
// a protobuf varint, which for all three valid SIV key sizes (32/48/64
// bytes) fits in a single byte (0x20/0x30/0x40), so each is checked directly
// rather than writing a general-purpose varint-length parser for it.
function extractKeyFromTinkKeyset(keyset: string): Buffer {
  const buf = Buffer.from(keyset, "base64");
  for (const length of VALID_SIV_KEY_LENGTHS) {
    const marker = Buffer.from([0x12, length]);
    const idx = buf.indexOf(marker);
    if (idx !== -1) {
      return buf.subarray(idx + 2, idx + 2 + length);
    }
  }
  throw new Error("Invalid Tink keyset: could not locate AES-SIV key material");
}

// Resolves the secret to an AES-SIV key — accepts either a hex string (64,
// 96, or 128 hex characters) or a base64-encoded Tink AesSivKey keyset.
function resolveKey(secret: string): Buffer {
  if (/^[0-9a-fA-F]+$/.test(secret) && VALID_SIV_KEY_LENGTHS.includes(secret.length / 2)) {
    return Buffer.from(secret, "hex");
  }

  const key = extractKeyFromTinkKeyset(secret);
  if (!VALID_SIV_KEY_LENGTHS.includes(key.length)) {
    throw new Error("Invalid secret: extracted key material is not a valid AES-SIV key size");
  }
  return key;
}

// Decrypts an AES-SIV email token: [5-byte Tink prefix (0x01 + 4-byte key
// ID), if present][16-byte synthetic IV][ciphertext]. Accepts both base64url
// and standard base64 encoding. The plaintext is the bare email address as
// UTF-8 text — not JSON — confirmed against a real token from the
// token-issuing system (an earlier, JSON-assuming version of this function
// decrypted correctly but then failed trying to JSON.parse the result).
export function decryptEmailToken(token: string, secret: string): string {
  const isBase64Url = /[-_]/.test(token) && !/[+/]/.test(token);
  const buf = isBase64Url
    ? Buffer.from(token, "base64url")
    : Buffer.from(token.replace(/ /g, "+"), "base64");

  if (buf.length < 17) {
    // 16 (synthetic IV) + 1 (min ciphertext)
    throw new Error("Invalid token: too short");
  }

  const payload =
    buf[0] === TINK_VERSION_BYTE && buf.length >= 17 + TINK_PREFIX_LENGTH
      ? buf.subarray(TINK_PREFIX_LENGTH)
      : buf;

  const key = resolveKey(secret);
  // Tink's DeterministicAead always feeds its associatedData argument to
  // S2V as its own component, even when empty — this app has none to pass,
  // so it supplies one empty component (see file header).
  const decrypted = aesSivDecrypt(key, payload, [Buffer.alloc(0)]);

  const email = decrypted.toString("utf-8");
  if (!email.includes("@")) {
    throw new Error("Invalid token payload: decrypted content is not an email address");
  }
  return email;
}

// The encrypt-side counterpart — not called from any route (tokens are
// generated by whichever external system sends the auth-token emails), kept
// for building test tokens. Produces a raw token with no Tink prefix (there
// being no key ID to embed for an arbitrary secret) — decryptEmailToken
// handles both prefixed and unprefixed tokens transparently.
export function encryptEmailToken(email: string, secret: string): string {
  const key = resolveKey(secret);
  const plaintext = Buffer.from(email, "utf-8");
  const token = aesSivEncrypt(key, plaintext, [Buffer.alloc(0)]);
  return token.toString("base64url");
}
