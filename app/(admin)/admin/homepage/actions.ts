"use server";

import type { Data } from "@puckeditor/core";
import { auth } from "@/lib/server/auth-admin";
import { saveHomepageContent } from "@/lib/domains/homepage";
import { uploadHeroImage, uploadPromoImage } from "@/lib/integrations/s3";

export type SaveHomepageContentResult = { ok: true } | { ok: false; error: string };

export async function saveHomepageContentAction(data: Data): Promise<SaveHomepageContentResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Ikke logget ind." };
  }

  await saveHomepageContent(data);
  return { ok: true };
}

export type UploadImageResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadHeroImageAction(blockId: string, file: File): Promise<UploadImageResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Ikke logget ind." };
  }

  try {
    const url = await uploadHeroImage(blockId, file);
    return { ok: true, url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Billedupload fejlede." };
  }
}

export async function uploadGridSlotImageAction(entryId: string, file: File): Promise<UploadImageResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Ikke logget ind." };
  }

  try {
    const url = await uploadPromoImage(entryId, file);
    return { ok: true, url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Billedupload fejlede." };
  }
}
