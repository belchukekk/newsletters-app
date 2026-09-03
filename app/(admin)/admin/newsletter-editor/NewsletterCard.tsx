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
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: newsletter.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
    <li ref={setNodeRef} style={style}>
      <button type="button" aria-label="Flyt kort" {...attributes} {...listeners}>
        ⠿
      </button>

      <form onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={newsletter.id} />
        <input type="hidden" name="imageUrl" value={imageUrl} />

        <label>
          Titel
          <input
            type="text"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label>
          Beskrivelse
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label>
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />
          Udgivet
        </label>

        {/* eslint-disable-next-line @next/next/no-img-element -- preview of whatever URL/upload the admin has picked, not a Next-optimizable static asset */}
        {imageUrl && <img src={imageUrl} alt="" width={88} height={88} />}

        <label>
          Billede-URL
          <input
            type="text"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
        </label>

        <label>
          Upload billede (overskriver URL ovenfor)
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/gif,image/webp"
          />
        </label>

        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Gemmer…" : "Gem"}
        </button>
        {status === "saved" && <span>Gemt ✓</span>}
        {status === "error" && <span role="alert">{error}</span>}
      </form>
    </li>
  );
}
