"use client";

import { useState, useTransition } from "react";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { NewsletterPatch } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterCatalogFields";
import { NewsletterCatalogFields } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterCatalogFields";
import { NewsletterPicker } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterPicker";
import { uploadGridSlotImageAction } from "@/app/(admin)/admin/homepage/actions";

export type NewsletterEntryValue = {
  newsletterId: string;
  customImageUrl?: string;
  fallback?: {
    newsletterId: string;
    customImageUrl?: string;
  };
};

type Which = "primary" | "fallback";

// The Newsletter component's one custom field: which newsletter to promote,
// an optional campaign-specific image override, and an optional fallback
// promotion shown instead when this newsletter is being featured elsewhere
// on the page by a Promotion component (see Newsletter.tsx's
// promotedNewsletterIds) — never triggered by subscription status, that's
// Promotion-only (see Promotion.tsx's resolvePromotion). Otherwise the same
// picker/inline-catalog-edit/fallback UI the old EditDrawer's slot mode had,
// just as this component's own Puck properties panel instead of a separate
// slide-over drawer (Puck's canvas + properties panel now provide that
// chrome).
export function NewsletterEntryField({
  id,
  value,
  onChange,
  newsletters,
  onNewsletterPatched,
}: {
  id: string;
  value: NewsletterEntryValue;
  onChange: (value: NewsletterEntryValue) => void;
  newsletters: Newsletter[];
  onNewsletterPatched: (id: string, patch: NewsletterPatch) => void;
}) {
  const [uploadingWhich, setUploadingWhich] = useState<Which | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [, startUploadTransition] = useTransition();

  const primaryNewsletter = newsletters.find((n) => n.id === value.newsletterId);
  const fallbackNewsletter = value.fallback
    ? newsletters.find((n) => n.id === value.fallback!.newsletterId)
    : undefined;

  function handleUploadImage(which: Which, file: File) {
    setUploadError(null);
    setUploadingWhich(which);
    startUploadTransition(async () => {
      const result = await uploadGridSlotImageAction(`${id}-${which}`, file);
      if (result.ok) {
        onChange(
          which === "primary"
            ? { ...value, customImageUrl: result.url }
            : { ...value, fallback: { ...(value.fallback ?? { newsletterId: "" }), customImageUrl: result.url } }
        );
      } else {
        setUploadError(result.error);
      }
      setUploadingWhich(null);
    });
  }

  return (
    <div>
      <div className="drawer-section">
        <p className="drawer-section__title">Promoveret nyhedsbrev</p>
        <NewsletterPicker
          newsletters={newsletters}
          selectedId={value.newsletterId}
          onSelect={(newsletterId) => newsletterId && onChange({ ...value, newsletterId, customImageUrl: undefined })}
        />

        {primaryNewsletter && (
          <div className="drawer-section__nested">
            <NewsletterCatalogFields
              key={primaryNewsletter.id}
              newsletter={primaryNewsletter}
              onSaved={(patch) => onNewsletterPatched(primaryNewsletter.id, patch)}
            />
          </div>
        )}

        <CampaignImageField
          label="Eget kampagnebillede (valgfrit)"
          currentUrl={value.customImageUrl}
          isUploading={uploadingWhich === "primary"}
          onFile={(file) => handleUploadImage("primary", file)}
        />
      </div>

      <label className="form-field--checkbox drawer-section__toggle">
        <input
          type="checkbox"
          checked={!!value.fallback}
          onChange={(event) =>
            onChange({
              ...value,
              fallback: event.target.checked ? { newsletterId: newsletters[0]?.id ?? "" } : undefined,
            })
          }
        />
        <span>Vis alternativ hvis dette nyhedsbrev bliver fremhævet et andet sted på siden</span>
      </label>

      {value.fallback && (
        <div className="drawer-section">
          <p className="drawer-section__title">Alternativt nyhedsbrev</p>
          <NewsletterPicker
            newsletters={newsletters}
            selectedId={value.fallback.newsletterId}
            onSelect={(newsletterId) =>
              newsletterId && onChange({ ...value, fallback: { newsletterId, customImageUrl: undefined } })
            }
          />

          {fallbackNewsletter && (
            <div className="drawer-section__nested">
              <NewsletterCatalogFields
                key={fallbackNewsletter.id}
                newsletter={fallbackNewsletter}
                onSaved={(patch) => onNewsletterPatched(fallbackNewsletter.id, patch)}
              />
            </div>
          )}

          <CampaignImageField
            label="Eget kampagnebillede (valgfrit)"
            currentUrl={value.fallback.customImageUrl}
            isUploading={uploadingWhich === "fallback"}
            onFile={(file) => handleUploadImage("fallback", file)}
          />
        </div>
      )}

      {uploadError && <p className="notice notice--error">{uploadError}</p>}
    </div>
  );
}

// Uploads immediately on file selection (Puck only has its own single
// Publish gesture, not a place to hook a deferred batch upload into).
// Exported — also reused by PromotionField for its own image uploads.
export function CampaignImageField({
  label,
  currentUrl,
  isUploading,
  onFile,
}: {
  label: string;
  currentUrl?: string;
  isUploading: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <div className="form-field">
      <label className="form-field__label">{label}</label>
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- preview of whatever URL is currently uploaded (S3), not a Next-optimizable static asset
        <img className="promo-entry__preview" src={currentUrl} alt="" width={64} height={64} />
      )}
      <input
        className="form-field__input"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        disabled={isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {isUploading && <p className="form-field__help">Uploader…</p>}
    </div>
  );
}
