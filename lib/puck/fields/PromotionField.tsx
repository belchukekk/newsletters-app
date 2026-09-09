"use client";

import { useState, useTransition } from "react";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { NewsletterPatch } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterCatalogFields";
import { NewsletterCatalogFields } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterCatalogFields";
import { NewsletterPicker } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterPicker";
import { CampaignImageField } from "@/lib/puck/fields/NewsletterEntryField";
import { uploadGridSlotImageAction } from "@/app/(admin)/admin/homepage/actions";

export type PromotionEntryBase = {
  newsletterId: string;
  customImageUrl?: string;
  // Appearance — per entry, so a UTM variant can look different from the
  // default (not just its copy/newsletter).
  backgroundColor?: string;
  fullWidth?: boolean;
};

export type PromotionEntry = PromotionEntryBase & {
  // Shown instead of newsletterId when the viewer is already subscribed to
  // it — the "show another newsletter if subscribed" behavior lives only
  // here (on the Promotion component), not on plain grid Newsletter cards.
  // Bounded to one level: a fallback can't have its own fallback.
  fallback?: PromotionEntryBase;
};

export type PromotionVariant = {
  id: string;
  utmValue: string;
  entry: PromotionEntry;
};

export type PromotionValue = {
  default: PromotionEntry;
  variants: PromotionVariant[];
};

export const DEFAULT_PROMOTION_BACKGROUND = "#f4f1ec";

function newId(): string {
  return crypto.randomUUID();
}

function emptyEntry(newsletters: Newsletter[]): PromotionEntry {
  return { newsletterId: newsletters[0]?.id ?? "" };
}

// The Promotion component's one custom field: a default promotion (shown
// when there's no matching UTM tag, or none of the configured ones match),
// plus any number of UTM-keyed variants that override it — see
// lib/puck/components/Promotion.tsx's resolveData for how a variant is
// picked based on the current request's ?utm_campaign value. Each variant
// starts collapsed (an accordion) since there can be many.
export function PromotionField({
  id,
  value,
  onChange,
  newsletters,
  onNewsletterPatched,
}: {
  id: string;
  value: PromotionValue;
  onChange: (value: PromotionValue) => void;
  newsletters: Newsletter[];
  onNewsletterPatched: (id: string, patch: NewsletterPatch) => void;
}) {
  const [openVariantIds, setOpenVariantIds] = useState<Set<string>>(new Set());

  function toggleVariant(variantId: string) {
    setOpenVariantIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  return (
    <div>
      <div className="drawer-section">
        <p className="drawer-section__title">Standard (ingen UTM-match)</p>
        <PromotionEntryFields
          uploadKeyPrefix={`${id}-default`}
          value={value.default}
          onChange={(entry) => onChange({ ...value, default: entry })}
          newsletters={newsletters}
          onNewsletterPatched={onNewsletterPatched}
          allowFallback
        />
      </div>

      <div className="drawer-section">
        <p className="drawer-section__title">UTM-varianter</p>
        {value.variants.length === 0 && (
          <p className="form-field__help">Ingen varianter endnu — tilføj en for at målrette efter ?utm_campaign=.</p>
        )}
        {value.variants.map((variant) => {
          const isOpen = openVariantIds.has(variant.id);
          const newsletter = newsletters.find((n) => n.id === variant.entry.newsletterId);
          return (
            <div key={variant.id} className="drawer-section__nested">
              <div className="accordion-header">
                <button
                  type="button"
                  className="accordion-header__toggle"
                  aria-expanded={isOpen}
                  onClick={() => toggleVariant(variant.id)}
                >
                  <span className="accordion-header__chevron" aria-hidden="true">
                    {isOpen ? "▾" : "▸"}
                  </span>
                  {variant.utmValue ? `utm_campaign=${variant.utmValue}` : "(ingen UTM-værdi endnu)"}
                  {newsletter && <span className="accordion-header__meta"> — {newsletter.title}</span>}
                </button>
                <button
                  className="slot-card__icon-button"
                  type="button"
                  onClick={() => onChange({ ...value, variants: value.variants.filter((v) => v.id !== variant.id) })}
                >
                  Fjern
                </button>
              </div>

              {isOpen && (
                <div className="accordion-body">
                  <div className="form-field">
                    <label className="form-field__label">UTM-værdi (utm_campaign)</label>
                    <input
                      className="form-field__input"
                      value={variant.utmValue}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          variants: value.variants.map((v) =>
                            v.id === variant.id ? { ...v, utmValue: event.target.value } : v
                          ),
                        })
                      }
                    />
                  </div>
                  <PromotionEntryFields
                    uploadKeyPrefix={`${id}-variant-${variant.id}`}
                    value={variant.entry}
                    onChange={(entry) =>
                      onChange({
                        ...value,
                        variants: value.variants.map((v) => (v.id === variant.id ? { ...v, entry } : v)),
                      })
                    }
                    newsletters={newsletters}
                    onNewsletterPatched={onNewsletterPatched}
                    allowFallback
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="button-row">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              const newVariantId = newId();
              onChange({
                ...value,
                variants: [...value.variants, { id: newVariantId, utmValue: "", entry: emptyEntry(newsletters) }],
              });
              // A freshly added variant opens right away — nothing to edit
              // otherwise. Existing variants still start closed.
              setOpenVariantIds((current) => new Set(current).add(newVariantId));
            }}
          >
            Tilføj variant
          </button>
        </div>
      </div>
    </div>
  );
}

function PromotionEntryFields({
  uploadKeyPrefix,
  value,
  onChange,
  newsletters,
  onNewsletterPatched,
  allowFallback = false,
}: {
  uploadKeyPrefix: string;
  value: PromotionEntry;
  onChange: (value: PromotionEntry) => void;
  newsletters: Newsletter[];
  onNewsletterPatched: (id: string, patch: NewsletterPatch) => void;
  allowFallback?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [, startUploadTransition] = useTransition();

  const newsletter = newsletters.find((n) => n.id === value.newsletterId);

  function handleUploadImage(file: File) {
    setUploadError(null);
    setIsUploading(true);
    startUploadTransition(async () => {
      const result = await uploadGridSlotImageAction(uploadKeyPrefix, file);
      if (result.ok) {
        onChange({ ...value, customImageUrl: result.url });
      } else {
        setUploadError(result.error);
      }
      setIsUploading(false);
    });
  }

  return (
    <div>
      <NewsletterPicker
        newsletters={newsletters}
        selectedId={value.newsletterId}
        onSelect={(newsletterId) => newsletterId && onChange({ ...value, newsletterId, customImageUrl: undefined })}
      />

      {newsletter && (
        <div className="drawer-section__nested">
          <NewsletterCatalogFields
            key={newsletter.id}
            newsletter={newsletter}
            onSaved={(patch) => onNewsletterPatched(newsletter.id, patch)}
          />
        </div>
      )}

      <CampaignImageField
        label="Eget kampagnebillede (valgfrit)"
        currentUrl={value.customImageUrl}
        isUploading={isUploading}
        onFile={handleUploadImage}
      />
      {uploadError && <p className="notice notice--error">{uploadError}</p>}

      <div className="form-field">
        <label className="form-field__label">Baggrundsfarve</label>
        <input
          type="color"
          value={value.backgroundColor ?? DEFAULT_PROMOTION_BACKGROUND}
          onChange={(event) => onChange({ ...value, backgroundColor: event.target.value })}
        />
      </div>
      <label className="form-field--checkbox">
        <input
          type="checkbox"
          checked={!!value.fullWidth}
          onChange={(event) => onChange({ ...value, fullWidth: event.target.checked })}
        />
        <span>Baggrundsfarven fylder hele skærmens bredde</span>
      </label>

      {allowFallback && (
        <>
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
            <span>Vis et andet nyhedsbrev hvis brugeren allerede er tilmeldt</span>
          </label>

          {value.fallback && (
            <div className="drawer-section__nested">
              <PromotionEntryFields
                uploadKeyPrefix={`${uploadKeyPrefix}-fallback`}
                value={value.fallback}
                onChange={(fallback) => onChange({ ...value, fallback })}
                newsletters={newsletters}
                onNewsletterPatched={onNewsletterPatched}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
