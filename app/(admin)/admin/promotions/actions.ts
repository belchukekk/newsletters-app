"use server";

import { auth } from "@/lib/server/auth-admin";
import { savePromoGrid, type PromoGrid } from "@/lib/domains/promotions";
import { uploadPromoImage } from "@/lib/integrations/s3";

export type SaveResult = { ok: true; grid: PromoGrid } | { ok: false; error: string };

// Saves the whole grid in one go: the JSON layout plus any newly-chosen
// image files (keyed "image-{slotId}-primary" / "image-{slotId}-fallback"
// in the same FormData) get uploaded to S3 first, and their resulting URLs
// override whatever customImageUrl was already in the layout.
export async function savePromoGridAction(formData: FormData): Promise<SaveResult> {
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
