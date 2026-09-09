"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Newsletter } from "@/lib/domains/newsletters";
import { saveNewsletterAction } from "./actions";

export type NewsletterPatch = {
  title: string;
  description: string;
  imageUrl: string;
  published: boolean;
};

// One newsletter's own catalog fields (title/description/image/published),
// with its own independent save — a genuinely separate resource from the
// promo arrangement (same DB table/columns as before), just no longer
// requiring a whole separate admin page to reach.
export function NewsletterCatalogFields({
  newsletter,
  onSaved,
}: {
  newsletter: Newsletter;
  onSaved: (patch: NewsletterPatch) => void;
}) {
  const [title, setTitle] = useState(newsletter.title);
  const [description, setDescription] = useState(newsletter.description);
  const [published, setPublished] = useState(Boolean(newsletter.published));
  const [imageUrl, setImageUrl] = useState(newsletter.imageUrl);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blobUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);
  const previewUrl = blobUrl ?? imageUrl;

  function handleSave() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", newsletter.id);
      formData.set("title", title);
      formData.set("description", description);
      formData.set("imageUrl", imageUrl);
      if (published) formData.set("published", "on");
      if (file) formData.set("image", file);

      const result = await saveNewsletterAction(formData);
      if (result.ok) {
        const savedImageUrl = previewUrl;
        setImageUrl(savedImageUrl);
        setFile(null);
        setStatus("saved");
        onSaved({ title, description, imageUrl: savedImageUrl, published });
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="form-field">
        <label className="form-field__label" htmlFor={`title-${newsletter.id}`}>
          Titel
        </label>
        <input
          className="form-field__input"
          id={`title-${newsletter.id}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label className="form-field__label" htmlFor={`description-${newsletter.id}`}>
          Beskrivelse
        </label>
        <textarea
          className="form-field__textarea"
          id={`description-${newsletter.id}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label className="form-field__label">Billede</label>
        {/* eslint-disable-next-line @next/next/no-img-element -- preview of whatever URL/upload is chosen, not a Next-optimizable static asset */}
        <img className="promo-entry__preview" src={previewUrl} alt="" width={64} height={64} />
        <input
          className="form-field__input"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="form-field--checkbox">
        <input
          type="checkbox"
          id={`published-${newsletter.id}`}
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
        />
        <label htmlFor={`published-${newsletter.id}`}>Udgivet</label>
      </div>

      <div className="button-row">
        <button
          className="button button--secondary"
          type="button"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Gemmer…" : "Gem nyhedsbrev"}
        </button>
        {status === "saved" && <span className="badge badge--positive">Gemt</span>}
        {status === "error" && <span className="notice notice--error">{error}</span>}
      </div>
    </div>
  );
}
