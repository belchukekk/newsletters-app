"use server";

import { auth } from "@/lib/server/auth-admin";
import {
  invalidateNewsletterCache,
  updateNewsletter,
} from "@/lib/domains/newsletters";
import { uploadNewsletterImage } from "@/lib/integrations/s3";

export type SaveNewsletterResult = { ok: true } | { ok: false; error: string };

// One call per newsletter card — see PLAN.md: each card is its own
// independently-saved unit, which structurally fixes the old app's
// lost-update race (concurrent admin edits to different rows can no longer
// clobber each other, since they're never in the same request).
export async function saveNewsletterAction(
  formData: FormData
): Promise<SaveNewsletterResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Ikke logget ind." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Mangler nyhedsbrev-id." };
  }

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const published = formData.get("published") === "on";
  let imageUrl = String(formData.get("imageUrl") ?? "");

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await uploadNewsletterImage(id, file);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Billedupload fejlede.",
      };
    }
  }

  await updateNewsletter({ id, title, description, imageUrl, published });
  await invalidateNewsletterCache();

  return { ok: true };
}
