import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Matches the old app's accepted upload mime types exactly (EAvis.php's
// sibling in AdminController::saveNewsletterAction) — anything else is
// rejected before we ever call S3.
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

let client: S3Client | undefined;

function getClient(): S3Client {
  // Credentials come from the default provider chain (AWS_ACCESS_KEY_ID /
  // AWS_SECRET_ACCESS_KEY env vars) — no need to pass them explicitly.
  if (!client) client = new S3Client({ region: requireEnv("AWS_REGION") });
  return client;
}

async function uploadImage(key: string, file: File): Promise<string> {
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  const bucket = requireEnv("S3_BUCKET");
  const region = requireEnv("AWS_REGION");
  const fullKey = `${key}.${extension}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fullKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );

  return `https://${bucket}.s3.${region}.amazonaws.com/${fullKey}`;
}

// Port of AdminController::saveNewsletterAction's S3 upload — key pattern
// "{prefix}{newsletterId}.{ext}", overwriting any previous image for that id,
// no resizing (uploaded as-is, matching the old app).
export async function uploadNewsletterImage(
  newsletterId: string,
  file: File
): Promise<string> {
  const prefix = process.env.S3_IMAGE_PREFIX ?? "";
  return uploadImage(`${prefix}${newsletterId}`, file);
}

// New (not a legacy port): custom promotional image for a frontpage promo
// grid slot — a distinct key namespace so it never collides with or
// overwrites a newsletter's own canonical thumbnail.
export async function uploadPromoImage(entryId: string, file: File): Promise<string> {
  const prefix = process.env.S3_IMAGE_PREFIX ?? "";
  return uploadImage(`${prefix}promo/${entryId}`, file);
}

// New: an image uploaded into a homepage hero block (ImageBlock component) —
// keyed by the Puck component instance's own id, in its own namespace.
export async function uploadHeroImage(blockId: string, file: File): Promise<string> {
  const prefix = process.env.S3_IMAGE_PREFIX ?? "";
  return uploadImage(`${prefix}hero/${blockId}`, file);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
