"use server";

import { auth } from "@/lib/server/auth-admin";
import {
  invalidateNewsletterCache,
  updateNewsletter,
} from "@/lib/domains/newsletters";
import { savePromoGrid, type PromoGrid } from "@/lib/domains/promotions";
import { uploadNewsletterImage, uploadPromoImage } from "@/lib/integrations/s3";

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

export type SavePromoGridResult = { ok: true; grid: PromoGrid } | { ok: false; error: string };

// Saves the whole promo grid in one go: the JSON layout plus any newly-chosen
// image files (keyed "image-{slotId}-primary" / "image-{slotId}-fallback"
// in the same FormData) get uploaded to S3 first, and their resulting URLs
// override whatever customImageUrl was already in the layout.
export async function savePromoGridAction(formData: FormData): Promise<SavePromoGridResult> {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, error: "Unauthorized" };
  }

  const rawLayout = formData.get("layout");
  if (typeof rawLayout !== "string") {
    return { ok: false, error: "Missing layout" };
  }

  let grid: PromoGrid;
  try {
    grid = JSON.parse(rawLayout);
  } catch {
    return { ok: false, error: "Invalid layout JSON" };
  }

  for (const row of grid.rows) {
    for (const slot of row.slots) {
      const primaryFile = formData.get(`image-${slot.id}-primary`);
      if (primaryFile instanceof File && primaryFile.size > 0) {
        slot.primary.customImageUrl = await uploadPromoImage(`${slot.id}-primary`, primaryFile);
      }

      const fallbackFile = formData.get(`image-${slot.id}-fallback`);
      if (fallbackFile instanceof File && fallbackFile.size > 0 && slot.fallback) {
        slot.fallback.customImageUrl = await uploadPromoImage(`${slot.id}-fallback`, fallbackFile);
      }
    }
  }

  await savePromoGrid(grid);
  return { ok: true, grid };
}
