"use client";

import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Newsletter } from "@/lib/domains/newsletters";
import { saveNewsletterAction } from "./actions";

// A standard controlled checkbox with a single value source — structurally
// can't reproduce the old app's duplicate-hidden-field checkbox bug, since
// there's no paired hidden/checkbox trick at all (see PLAN.md).
export function NewsletterCard({ newsletter }: { newsletter: Newsletter }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: newsletter.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const [title, setTitle] = useState(newsletter.title);
  const [description, setDescription] = useState(newsletter.description);
  const [published, setPublished] = useState(Boolean(newsletter.published));
  const [imageUrl, setImageUrl] = useState(newsletter.imageUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    const result = await saveNewsletterAction(new FormData(event.currentTarget));

    if (result.ok) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  return (
    <li ref={setNodeRef} style={style} className="editor-card">
      <button
        type="button"
        className="editor-card__handle"
        aria-label="Flyt nyhedsbrev"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      <form className="editor-card__form" onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={newsletter.id} />
        <input type="hidden" name="imageUrl" value={imageUrl} />

        {/* eslint-disable-next-line @next/next/no-img-element -- preview of whatever URL/upload the admin has picked, not a Next-optimizable static asset */}
        <img className="editor-card__media" src={imageUrl} alt="" width={80} height={80} />

        <div className="editor-card__fields">
          <div className="form-field">
            <label className="form-field__label" htmlFor={`title-${newsletter.id}`}>
              Titel
            </label>
            <input
              className="form-field__input"
              id={`title-${newsletter.id}`}
              type="text"
              name="title"
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
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor={`image-url-${newsletter.id}`}>
              Billede-URL
            </label>
            <input
              className="form-field__input"
              id={`image-url-${newsletter.id}`}
              type="text"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <p className="form-field__help">
              Eller upload et billede (overskriver URL&apos;en ovenfor):
            </p>
            <input
              className="form-field__input"
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/gif,image/webp"
            />
          </div>

          <div className="editor-card__footer">
            <label className="toggle-switch">
              <span className="visually-hidden">Udgivet</span>
              <input
                type="checkbox"
                name="published"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
              />
              <span className="toggle-switch__track" aria-hidden="true" />
            </label>
            <span className="editor-card__published-label">Udgivet</span>

            <div className="editor-card__save">
              <button className="button" type="submit" disabled={status === "saving"}>
                {status === "saving" ? "Gemmer…" : "Gem"}
              </button>
              {status === "saved" && <span className="badge badge--positive">Gemt</span>}
              {status === "error" && <span className="notice notice--error">{error}</span>}
            </div>
          </div>
        </div>
      </form>
    </li>
  );
}
