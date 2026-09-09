"use client";

import "@puckeditor/core/puck.css";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Puck, type Data } from "@puckeditor/core";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { NewsletterPatch } from "@/app/(admin)/admin/(shell)/newsletters/NewsletterCatalogFields";
import { buildPuckConfig } from "@/lib/puck/config";
import { saveHomepageContentAction } from "./actions";

export function HomepageEditor({
  initialNewsletters,
  initialData,
}: {
  initialNewsletters: Newsletter[];
  initialData: Data;
}) {
  const [newsletters, setNewsletters] = useState(initialNewsletters);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startSaveTransition] = useTransition();

  function applyNewsletterPatch(id: string, patch: NewsletterPatch) {
    setNewsletters((current) =>
      current.map((n) =>
        n.id === id
          ? {
              ...n,
              title: patch.title,
              description: patch.description,
              imageUrl: patch.imageUrl,
              published: patch.published ? 1 : 0,
            }
          : n
      )
    );
  }

  // Rebuilt whenever newsletters changes (e.g. an inline catalog save inside
  // the grid field's drawer) so the picker/preview always show current
  // titles/thumbnails without a full page reload.
  const config = useMemo(
    () => buildPuckConfig({ newsletters, onNewsletterPatched: applyNewsletterPatch }),
    [newsletters]
  );

  return (
    <div className="homepage-editor">
      <div className="homepage-editor__topbar">
        <Link href="/admin" className="homepage-editor__back">
          ← Tilbage til admin
        </Link>
        {status === "saved" && <span className="badge badge--positive">Gemt</span>}
        {status === "error" && <span className="notice notice--error">{error}</span>}
      </div>
      <Puck
        config={config}
        data={initialData}
        onPublish={(data) => {
          setStatus("idle");
          startSaveTransition(async () => {
            const result = await saveHomepageContentAction(data);
            if (result.ok) {
              setStatus("saved");
            } else {
              setStatus("error");
              setError(result.error);
            }
          });
        }}
      />
    </div>
  );
}
