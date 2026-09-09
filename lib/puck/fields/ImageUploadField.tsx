"use client";

import { useState, useTransition } from "react";
import type { CustomFieldRender } from "@puckeditor/core";
import { uploadHeroImageAction } from "@/app/(admin)/admin/homepage/actions";

// Uploads immediately on file selection, unlike the older grid editor's
// batched-upload-on-publish pattern — Puck only has its own single Publish
// gesture, which a field can't hook into to defer an upload, so this is a
// deliberate (flagged in the plan) UX change: pick a file, it's live on S3
// a moment later, no separate save step.
export const ImageUploadField: CustomFieldRender<string | undefined> = ({ id, value, onChange }) => {
  const [isUploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    startUpload(async () => {
      const result = await uploadHeroImageAction(id, file);
      if (result.ok) {
        onChange(result.url);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- preview of whatever URL is currently uploaded, not a Next-optimizable static asset
        <img className="promo-entry__preview" src={value} alt="" width={64} height={64} />
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        disabled={isUploading}
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />
      {isUploading && <p className="form-field__help">Uploader…</p>}
      {error && <p className="notice notice--error">{error}</p>}
    </div>
  );
};
