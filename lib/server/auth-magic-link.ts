import { createHash } from "crypto";

function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

// Port of AuthRequest.php's regular-user check: check = md5(email+time+key),
// straight concatenation, no separators. The admin variant
// (md5(admin+time+email+key)) is retired — admins use Google SSO now (see
// PLAN.md). No expiry check on `time` — confirmed the legacy app never
// compares it to the current time, only hashes it; preserved exactly here.
export function verifyMagicLinkCheck(
  email: string,
  time: string,
  check: string
): boolean {
  const key = process.env.NL_AUTH_KEY;
  if (!key) return false;
  return md5(`${email}${time}${key}`) === check;
}

// Port of AuthRequest.php's /newsletter-unsubscribe token: auth = md5(email+acSalt).
export function verifyUnsubscribeToken(email: string, auth: string): boolean {
  const salt = process.env.NL_AC_UNSUB_SALT;
  if (!salt) return false;
  return md5(`${email}${salt}`) === auth;
}

// Port of OptInService::confirmSubscription's checksum: chk = md5(id+mail),
// validated against the pending BBL event's own _id/mail fields — not the
// raw request params directly (the route handler fetches the event first).
export function verifyConfirmSubscriptionChecksum(
  eventId: string,
  mail: string,
  chk: string
): boolean {
  return md5(`${eventId}${mail}`) === chk;
}
