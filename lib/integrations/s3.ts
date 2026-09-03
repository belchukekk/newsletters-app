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

// Port of AdminController::saveNewsletterAction's S3 upload — key pattern
// "{prefix}{newsletterId}.{ext}", overwriting any previous image for that id,
// no resizing (uploaded as-is, matching the old app).
export async function uploadNewsletterImage(
  newsletterId: string,
  file: File
): Promise<string> {
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    throw new Error(`Unsupported image type: ${file.type}`);
  }

  const bucket = requireEnv("S3_BUCKET");
  const region = requireEnv("AWS_REGION");
  const prefix = process.env.S3_IMAGE_PREFIX ?? "";
  const key = `${prefix}${newsletterId}.${extension}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
    })
  );

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
