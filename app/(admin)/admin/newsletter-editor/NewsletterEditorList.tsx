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
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Newsletter } from "@/lib/domains/newsletters";
import { NewsletterCard } from "./NewsletterCard";

// Reorder is a dedicated JSON endpoint with optimistic UI: reorder locally
// on drop, roll back on failure — see PLAN.md. Per-card saves (title,
// description, image, published) are handled independently by NewsletterCard.
export function NewsletterEditorList({
  initialNewsletters,
}: {
  initialNewsletters: Newsletter[];
}) {
  const [newsletters, setNewsletters] = useState(initialNewsletters);
  const [isReordering, startReorderTransition] = useTransition();
  const [reorderError, setReorderError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = newsletters.findIndex((n) => n.id === active.id);
    const newIndex = newsletters.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = newsletters;
    const reordered = arrayMove(newsletters, oldIndex, newIndex);
    setNewsletters(reordered);
    setReorderError(null);

    startReorderTransition(async () => {
      try {
        const response = await fetch("/api/admin/newsletters/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: reordered.map((n) => n.id) }),
        });
        if (!response.ok) throw new Error("Reorder request failed");
      } catch {
        setNewsletters(previous);
        setReorderError("Kunne ikke gemme den nye rækkefølge — prøv igen.");
      }
    });
  }

  return (
    <div>
      {reorderError && <p className="notice notice--error">{reorderError}</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={newsletters.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="editor-list">
            {newsletters.map((newsletter) => (
              <NewsletterCard key={newsletter.id} newsletter={newsletter} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {isReordering && <p className="editor-list__status">Gemmer rækkefølge…</p>}
    </div>
  );
}
