import { createCipheriv, createDecipheriv } from "crypto";

// Decrypts the Iteras customer id shared with ActiveCampaign — port of
// EAvis.php's openssl_decrypt(..., AES-256-CBC, ..., 0, ...) call. (Formerly
// an Infosoft subscriber id — Infosoft has been fully replaced by Iteras as
// the subscription system; the mobile app now expects customer_iteras.customer_id
// in this same encrypted slot.)
//
// PHP's openssl_decrypt right-pads a too-short key with '\0' bytes up to the
// cipher's required length (32 bytes for AES-256) rather than erroring, so we
// replicate that exactly instead of requiring a full 32-byte env var. The
// $options=0 flag (no OPENSSL_RAW_DATA) means the ciphertext is base64-encoded.
function toAes256Key(rawKey: string): Buffer {
  const key = Buffer.alloc(32);
  Buffer.from(rawKey, "utf8").copy(key);
  return key;
}

export function decryptIterasId(hash: string): string | null {
  const rawKey = process.env.NL_AC_ENC_KEY;
  const rawIv = process.env.NL_AC_ENC_IV;
  if (!rawKey || !rawIv || !hash) return null;

  try {
    const key = toAes256Key(rawKey);
    const iv = Buffer.from(rawIv, "utf8");
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(hash, "base64")),
      decipher.final(),
    ]).toString("utf8");

    return /^\d+$/.test(decrypted) ? decrypted : null;
  } catch {
    return null;
  }
}

// Port of EAvis::getHashFromInfosoftId — the encrypt counterpart, used by
// /send-sms to regenerate a subscription hash when the request didn't
// already carry one. Legacy urlencode()s the result; that's a
// URL-construction concern, left to the caller (encodeURIComponent) rather
// than baked into this function.
export function encryptIterasId(customerId: string): string | null {
  const rawKey = process.env.NL_AC_ENC_KEY;
  const rawIv = process.env.NL_AC_ENC_IV;
  if (!rawKey || !rawIv) return null;

  try {
    const key = toAes256Key(rawKey);
    const iv = Buffer.from(rawIv, "utf8");
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([cipher.update(customerId, "utf8"), cipher.final()]).toString("base64");
  } catch {
    return null;
  }
}
