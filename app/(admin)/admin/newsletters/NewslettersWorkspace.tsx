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
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { PromoGrid, PromoRow, PromoSlot } from "@/lib/domains/promotions";
import type { NewsletterPatch } from "./NewsletterCatalogFields";
import { EditDrawer } from "./EditDrawer";
import { savePromoGridAction } from "./actions";

type Columns = 1 | 2 | 3 | 4;
type Which = "primary" | "fallback";
type Tab = "grid" | "catalog";
type OpenDrawer =
  | { mode: "slot"; rowId: string; slotId: string }
  | { mode: "catalog"; newsletterId: string }
  | null;

function newId(): string {
  return crypto.randomUUID();
}

function newSlot(newsletters: Newsletter[]): PromoSlot {
  return { id: newId(), primary: { newsletterId: newsletters[0]?.id ?? "" } };
}

function newRow(newsletters: Newsletter[]): PromoRow {
  return { id: newId(), columns: 1, slots: [newSlot(newsletters)] };
}

// One page for both "what newsletters exist" and "how they're promoted on
// the frontpage" — previously two separate admin pages. Editing a promoted
// slot's underlying newsletter (title/description/image/published) and its
// promotion settings (custom image, fallback) now happens in one place (see
// EditDrawer), instead of jumping between a catalog editor and a layout
// editor.
export function NewslettersWorkspace({
  initialNewsletters,
  initialGrid,
}: {
  initialNewsletters: Newsletter[];
  initialGrid: PromoGrid;
}) {
  const [newsletters, setNewsletters] = useState(initialNewsletters);
  const [rows, setRows] = useState(initialGrid.rows);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [tab, setTab] = useState<Tab>("grid");
  const [openDrawer, setOpenDrawer] = useState<OpenDrawer>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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

  function updateRow(rowId: string, updater: (row: PromoRow) => PromoRow) {
    setSaveStatus("idle");
    setRows((current) => current.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function setColumns(rowId: string, columns: Columns) {
    updateRow(rowId, (row) => {
      const slots = row.slots.slice(0, columns);
      while (slots.length < columns) slots.push(newSlot(newsletters));
      return { ...row, columns, slots };
    });
  }

  function updateSlot(rowId: string, slotId: string, updater: (slot: PromoSlot) => PromoSlot) {
    updateRow(rowId, (row) => ({
      ...row,
      slots: row.slots.map((slot) => (slot.id === slotId ? updater(slot) : slot)),
    }));
  }

  function setPendingFile(slotId: string, which: Which, file: File | null) {
    setSaveStatus("idle");
    setPendingFiles((current) => {
      const next = { ...current };
      const key = `${slotId}-${which}`;
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
  }

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSaveStatus("idle");
    setRows((current) => {
      const oldIndex = current.findIndex((row) => row.id === active.id);
      const newIndex = current.findIndex((row) => row.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function handleSaveGrid() {
    setSaveStatus("idle");
    setSaveError(null);
    startSaveTransition(async () => {
      const formData = new FormData();
      formData.set("layout", JSON.stringify({ rows }));
      for (const [key, file] of Object.entries(pendingFiles)) {
        formData.set(`image-${key}`, file);
      }

      const result = await savePromoGridAction(formData);
      if (result.ok) {
        setRows(result.grid.rows);
        setPendingFiles({});
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
        setSaveError(result.error);
      }
    });
  }

  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <div>
      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "grid"}
          className="admin-tabs__tab"
          onClick={() => setTab("grid")}
        >
          Forsiden
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "catalog"}
          className="admin-tabs__tab"
          onClick={() => setTab("catalog")}
        >
          Alle nyhedsbreve
        </button>
      </div>

      {tab === "grid" ? (
        <div>
          {saveStatus === "saved" && <p className="notice notice--success">Gemt.</p>}
          {saveStatus === "error" && <p className="notice notice--error">{saveError}</p>}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleRowDragEnd}
          >
            <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
              {rows.map((row) => (
                <GridRowEditor
                  key={row.id}
                  row={row}
                  newsletters={newsletters}
                  onSetColumns={(columns) => setColumns(row.id, columns)}
                  onRemoveRow={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                  onEditSlot={(slotId) => setOpenDrawer({ mode: "slot", rowId: row.id, slotId })}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="button-row">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setRows((current) => [...current, newRow(newsletters)])}
            >
              Tilføj række
            </button>
            <button className="button" type="button" onClick={handleSaveGrid} disabled={isSaving}>
              {isSaving ? "Gemmer…" : "Gem"}
            </button>
          </div>
        </div>
      ) : (
        <CatalogTab
          newsletters={newsletters}
          onReordered={setNewsletters}
          onEdit={(newsletterId) => setOpenDrawer({ mode: "catalog", newsletterId })}
        />
      )}

      {openDrawer?.mode === "catalog" &&
        (() => {
          const newsletter = newsletters.find((n) => n.id === openDrawer.newsletterId);
          if (!newsletter) return null;
          return (
            <EditDrawer
              mode="catalog"
              newsletter={newsletter}
              onClose={() => setOpenDrawer(null)}
              onNewsletterSaved={applyNewsletterPatch}
            />
          );
        })()}

      {openDrawer?.mode === "slot" &&
        (() => {
          const row = rows.find((r) => r.id === openDrawer.rowId);
          const slot = row?.slots.find((s) => s.id === openDrawer.slotId);
          if (!row || !slot) return null;
          return (
            <EditDrawer
              mode="slot"
              slot={slot}
              newsletters={newsletters}
              pendingFiles={{
                primary: pendingFiles[`${slot.id}-primary`],
                fallback: pendingFiles[`${slot.id}-fallback`],
              }}
              onClose={() => setOpenDrawer(null)}
              onNewsletterSaved={applyNewsletterPatch}
              onSlotChange={(updater) => updateSlot(row.id, slot.id, updater)}
              onSetPendingFile={(which, file) => setPendingFile(slot.id, which, file)}
            />
          );
        })()}
    </div>
  );
}

function GridRowEditor({
  row,
  newsletters,
  onSetColumns,
  onRemoveRow,
  onEditSlot,
}: {
  row: PromoRow;
  newsletters: Newsletter[];
  onSetColumns: (columns: Columns) => void;
  onRemoveRow: () => void;
  onEditSlot: (slotId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid-row">
      <div className="grid-row__header">
        <button
          type="button"
          className="editor-card__handle"
          aria-label="Flyt række"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="segmented" role="group" aria-label="Antal kolonner">
          {([1, 2, 3, 4] as const).map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={row.columns === count}
              onClick={() => onSetColumns(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <div className="grid-row__header-spacer" />
        <button className="slot-card__icon-button" type="button" onClick={onRemoveRow}>
          Fjern række
        </button>
      </div>

      <div className={`grid-row__slots grid-row__slots--cols-${row.columns}`}>
        {row.slots.map((slot) => (
          <SlotCardCompact
            key={slot.id}
            slot={slot}
            newsletters={newsletters}
            onEdit={() => onEditSlot(slot.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SlotCardCompact({
  slot,
  newsletters,
  onEdit,
}: {
  slot: PromoSlot;
  newsletters: Newsletter[];
  onEdit: () => void;
}) {
  const newsletter = newsletters.find((n) => n.id === slot.primary.newsletterId);

  return (
    <div className="slot-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs S3), not worth a remotePatterns config */}
      <img
        className="slot-card__media"
        src={slot.primary.customImageUrl || newsletter?.imageUrl || "/assets/img/newsletter/default.jpg"}
        alt=""
        width={44}
        height={44}
      />
      <div className="slot-card__body">
        <p className="slot-card__title">{newsletter?.title ?? "Ukendt nyhedsbrev"}</p>
        <div className="slot-card__meta">
          {slot.primary.customImageUrl && <span className="badge badge--neutral">eget billede</span>}
          {slot.fallback && <span className="badge badge--neutral">har alternativ</span>}
          {newsletter && !newsletter.published && <span className="badge">ikke udgivet</span>}
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
