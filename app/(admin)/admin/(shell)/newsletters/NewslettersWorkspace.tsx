"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { NewsletterPatch } from "./NewsletterCatalogFields";
import { EditDrawer } from "./EditDrawer";

// The newsletter catalog (title/description/image/published, plus basic
// reordering) — what's promoted where on the frontpage now lives entirely
// in the Puck-powered /admin/homepage editor (see lib/puck/), which reuses
// this page's EditDrawer/NewsletterPicker/NewsletterCatalogFields for its
// own slot editing rather than duplicating them.
export function NewslettersWorkspace({ initialNewsletters }: { initialNewsletters: Newsletter[] }) {
  const [newsletters, setNewsletters] = useState(initialNewsletters);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const editingNewsletter = newsletters.find((n) => n.id === editingId);

  return (
    <div>
      <CatalogTab
        newsletters={newsletters}
        onReordered={setNewsletters}
        onEdit={(id) => setEditingId(id)}
      />

      {editingNewsletter && (
        <EditDrawer
          newsletter={editingNewsletter}
          onClose={() => setEditingId(null)}
          onNewsletterSaved={applyNewsletterPatch}
        />
      )}
    </div>
  );
}

function CatalogTab({
  newsletters,
  onReordered,
  onEdit,
}: {
  newsletters: Newsletter[];
  onReordered: (newsletters: Newsletter[]) => void;
  onEdit: (newsletterId: string) => void;
}) {
  const [isReordering, startReorderTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = newsletters.findIndex((n) => n.id === active.id);
    const newIndex = newsletters.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = newsletters;
    const reordered = arrayMove(newsletters, oldIndex, newIndex);
    onReordered(reordered);
    setError(null);

    startReorderTransition(async () => {
      try {
        const response = await fetch("/api/admin/newsletters/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: reordered.map((n) => n.id) }),
        });
        if (!response.ok) throw new Error("Reorder request failed");
      } catch {
        onReordered(previous);
        setError("Kunne ikke gemme den nye rækkefølge. Prøv igen.");
      }
    });
  }

  return (
    <div>
      <p className="page-intro">
        Træk for at ændre den grundlæggende rækkefølge. Klik Rediger for at ændre titel,
        beskrivelse, billede eller udgivelsesstatus.
      </p>
      {error && <p className="notice notice--error">{error}</p>}
      {isReordering && <p className="editor-list__status">Gemmer rækkefølge…</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={newsletters.map((n) => n.id)} strategy={rectSortingStrategy}>
          <div className="catalog-list">
            {newsletters.map((newsletter) => (
              <CatalogCardCompact
                key={newsletter.id}
                newsletter={newsletter}
                onEdit={() => onEdit(newsletter.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CatalogCardCompact({
  newsletter,
  onEdit,
}: {
  newsletter: Newsletter;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: newsletter.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="slot-card">
      <button
        type="button"
        className="editor-card__handle"
        aria-label="Flyt nyhedsbrev"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs S3), not worth a remotePatterns config */}
      <img className="slot-card__media" src={newsletter.imageUrl} alt="" width={44} height={44} />
      <div className="slot-card__body">
        <p className="slot-card__title">{newsletter.title}</p>
        <div className="slot-card__meta">
          <span className={`badge ${newsletter.published ? "badge--positive" : ""}`}>
            {newsletter.published ? "Udgivet" : "Ikke udgivet"}
          </span>
        </div>
      </div>
      <div className="slot-card__actions">
        <button className="slot-card__icon-button" type="button" onClick={onEdit}>
          Rediger
        </button>
      </div>
    </div>
  );
}
