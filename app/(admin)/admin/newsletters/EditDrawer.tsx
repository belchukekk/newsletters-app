"use client";

import type { Newsletter } from "@/lib/domains/newsletters";
import type { PromoSlot } from "@/lib/domains/promotions";
import { NewsletterCatalogFields, type NewsletterPatch } from "./NewsletterCatalogFields";
import { NewsletterPicker } from "./NewsletterPicker";

type Which = "primary" | "fallback";

export type EditDrawerProps =
  | {
      mode: "catalog";
      newsletter: Newsletter;
      onClose: () => void;
      onNewsletterSaved: (id: string, patch: NewsletterPatch) => void;
    }
  | {
      mode: "slot";
      slot: PromoSlot;
      newsletters: Newsletter[];
      pendingFiles: Record<Which, File | undefined>;
      onClose: () => void;
      onNewsletterSaved: (id: string, patch: NewsletterPatch) => void;
      onSlotChange: (updater: (slot: PromoSlot) => PromoSlot) => void;
      onSetPendingFile: (which: Which, file: File | null) => void;
    };

// The single editing surface for both contexts: a plain catalog newsletter
// (title/description/image/published — its own resource, own save) and a
// promo slot (which newsletter, an optional campaign-specific image
// override, and an optional fallback promotion) — this is the actual "mix
// the two together" the redesign asked for: editing a promoted newsletter's
// details and its promotion settings no longer means two different pages.
export function EditDrawer(props: EditDrawerProps) {
  return (
    <>
      <div className="drawer-overlay" onClick={props.onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__header">
          <h2 className="drawer__title">
            {props.mode === "catalog" ? "Rediger nyhedsbrev" : "Rediger placering"}
          </h2>
          <button className="drawer__close" type="button" onClick={props.onClose} aria-label="Luk">
            ×
          </button>
        </div>
        <div className="drawer__body">
          {props.mode === "catalog" ? (
            <NewsletterCatalogFields
              newsletter={props.newsletter}
              onSaved={(patch) => props.onNewsletterSaved(props.newsletter.id, patch)}
            />
          ) : (
            <SlotFields {...props} />
          )}
        </div>
      </div>
    </>
  );
}

function SlotFields({
  slot,
  newsletters,
  pendingFiles,
  onNewsletterSaved,
  onSlotChange,
  onSetPendingFile,
}: Extract<EditDrawerProps, { mode: "slot" }>) {
  const primaryNewsletter = newsletters.find((n) => n.id === slot.primary.newsletterId);
  const fallbackNewsletter = slot.fallback
    ? newsletters.find((n) => n.id === slot.fallback!.newsletterId)
    : undefined;

  return (
    <div>
      <div className="drawer-section">
        <p className="drawer-section__title">Promoveret nyhedsbrev</p>
        <NewsletterPicker
          newsletters={newsletters}
          selectedId={slot.primary.newsletterId}
          onSelect={(id) =>
            id &&
            onSlotChange((current) => ({
              ...current,
              primary: { newsletterId: id, customImageUrl: undefined },
            }))
          }
        />

        {primaryNewsletter && (
          <div className="drawer-section__nested">
            <NewsletterCatalogFields
              newsletter={primaryNewsletter}
              onSaved={(patch) => onNewsletterSaved(primaryNewsletter.id, patch)}
            />
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Eget kampagnebillede (valgfrit)</label>
          <input
            className="form-field__input"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(event) => onSetPendingFile("primary", event.target.files?.[0] ?? null)}
          />
          {pendingFiles.primary && (
            <p className="form-field__help">Nyt billede valgt — gemmes når du klikker Gem.</p>
          )}
        </div>
      </div>

      <label className="form-field--checkbox drawer-section__toggle">
        <input
          type="checkbox"
          checked={!!slot.fallback}
          onChange={(event) =>
            onSlotChange((current) => ({
              ...current,
              fallback: event.target.checked
                ? { newsletterId: newsletters[0]?.id ?? "" }
                : undefined,
            }))
          }
        />
        <span>Vis alternativ hvis brugeren allerede er tilmeldt</span>
      </label>

      {slot.fallback && (
        <div className="drawer-section">
          <p className="drawer-section__title">Alternativt nyhedsbrev</p>
          <NewsletterPicker
            newsletters={newsletters}
            selectedId={slot.fallback.newsletterId}
            onSelect={(id) =>
              id &&
              onSlotChange((current) => ({
                ...current,
                fallback: { newsletterId: id, customImageUrl: undefined },
              }))
            }
          />

          {fallbackNewsletter && (
            <div className="drawer-section__nested">
              <NewsletterCatalogFields
                newsletter={fallbackNewsletter}
                onSaved={(patch) => onNewsletterSaved(fallbackNewsletter.id, patch)}
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-field__label">Eget kampagnebillede (valgfrit)</label>
            <input
              className="form-field__input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(event) => onSetPendingFile("fallback", event.target.files?.[0] ?? null)}
            />
            {pendingFiles.fallback && (
              <p className="form-field__help">Nyt billede valgt — gemmes når du klikker Gem.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
