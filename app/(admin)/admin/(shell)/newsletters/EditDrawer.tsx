"use client";

import type { Newsletter } from "@/lib/domains/newsletters";
import { NewsletterCatalogFields, type NewsletterPatch } from "./NewsletterCatalogFields";

export type EditDrawerProps = {
  newsletter: Newsletter;
  onClose: () => void;
  onNewsletterSaved: (id: string, patch: NewsletterPatch) => void;
};

// Catalog-only now — promoting a newsletter (which one, custom image,
// fallback) moved to the Newsletter Puck component's own properties panel
// (see lib/puck/fields/NewsletterEntryField.tsx), which nests this same
// NewsletterCatalogFields form for inline title/description/image edits,
// same as here.
export function EditDrawer({ newsletter, onClose, onNewsletterSaved }: EditDrawerProps) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer__header">
          <h2 className="drawer__title">Rediger nyhedsbrev</h2>
          <button className="drawer__close" type="button" onClick={onClose} aria-label="Luk">
            ×
          </button>
        </div>
        <div className="drawer__body">
          <NewsletterCatalogFields
            newsletter={newsletter}
            onSaved={(patch) => onNewsletterSaved(newsletter.id, patch)}
          />
        </div>
      </div>
    </>
  );
}
