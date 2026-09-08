"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Newsletter } from "@/lib/domains/newsletters";
import type { PromoEntry, PromoGrid, PromoRow, PromoSlot } from "@/lib/domains/promotions";
import { savePromoGridAction } from "./actions";

type Columns = 1 | 2 | 3 | 4;
type Which = "primary" | "fallback";

function newId(): string {
  return crypto.randomUUID();
}

function emptyEntry(newsletters: Newsletter[]): PromoEntry {
  return { newsletterId: newsletters[0]?.id ?? "" };
}

function newSlot(newsletters: Newsletter[]): PromoSlot {
  return { id: newId(), primary: emptyEntry(newsletters) };
}

function newRow(newsletters: Newsletter[], columns: Columns = 1): PromoRow {
  return {
    id: newId(),
    columns,
    slots: Array.from({ length: columns }, () => newSlot(newsletters)),
  };
}

// New feature (not a legacy port): drag-and-drop editor for the frontpage
// promo grid — reuses the same @dnd-kit pattern as the newsletter editor.
export function PromoGridEditor({
  initialGrid,
  newsletters,
}: {
  initialGrid: PromoGrid;
  newsletters: Newsletter[];
}) {
  const [rows, setRows] = useState(initialGrid.rows);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function updateRow(rowId: string, updater: (row: PromoRow) => PromoRow) {
    setStatus("idle");
    setRows((current) => current.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function addRow() {
    setStatus("idle");
    setRows((current) => [...current, newRow(newsletters)]);
  }

  function removeRow(rowId: string) {
    setStatus("idle");
    setRows((current) => current.filter((row) => row.id !== rowId));
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

  function setEntryNewsletter(rowId: string, slotId: string, which: Which, newsletterId: string) {
    updateSlot(rowId, slotId, (slot) => ({
      ...slot,
      [which]: { newsletterId, customImageUrl: undefined },
    }));
    setPendingFiles((current) => {
      const next = { ...current };
      delete next[`${slotId}-${which}`];
      return next;
    });
  }

  function toggleFallback(rowId: string, slotId: string, enabled: boolean) {
    updateSlot(rowId, slotId, (slot) => ({
      ...slot,
      fallback: enabled ? emptyEntry(newsletters) : undefined,
    }));
  }

  function setPendingFile(slotId: string, which: Which, file: File | null) {
    setStatus("idle");
    setPendingFiles((current) => {
      const next = { ...current };
      const key = `${slotId}-${which}`;
      if (file) next[key] = file;
      else delete next[key];
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStatus("idle");
    setRows((current) => {
      const oldIndex = current.findIndex((row) => row.id === active.id);
      const newIndex = current.findIndex((row) => row.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function handleSave() {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("layout", JSON.stringify({ rows }));
      for (const [key, file] of Object.entries(pendingFiles)) {
        formData.set(`image-${key}`, file);
      }

      const result = await savePromoGridAction(formData);
      if (result.ok) {
        setRows(result.grid.rows);
        setPendingFiles({});
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {status === "saved" && <p className="notice notice--success">Gemt.</p>}
      {status === "error" && <p className="notice notice--error">{error}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          <div className="promo-editor-rows">
            {rows.map((row) => (
              <PromoRowEditor
                key={row.id}
                row={row}
                newsletters={newsletters}
                pendingFiles={pendingFiles}
                onSetColumns={(columns) => setColumns(row.id, columns)}
                onRemoveRow={() => removeRow(row.id)}
                onSetEntryNewsletter={(slotId, which, newsletterId) =>
                  setEntryNewsletter(row.id, slotId, which, newsletterId)
                }
                onToggleFallback={(slotId, enabled) => toggleFallback(row.id, slotId, enabled)}
                onSetPendingFile={setPendingFile}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="button-row">
        <button className="button button--secondary" type="button" onClick={addRow}>
          Tilføj række
        </button>
        <button className="button" type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Gemmer…" : "Gem"}
        </button>
      </div>
    </div>
  );
}

function PromoRowEditor({
  row,
  newsletters,
  pendingFiles,
  onSetColumns,
  onRemoveRow,
  onSetEntryNewsletter,
  onToggleFallback,
  onSetPendingFile,
}: {
  row: PromoRow;
  newsletters: Newsletter[];
  pendingFiles: Record<string, File>;
  onSetColumns: (columns: Columns) => void;
  onRemoveRow: () => void;
  onSetEntryNewsletter: (slotId: string, which: Which, newsletterId: string) => void;
  onToggleFallback: (slotId: string, enabled: boolean) => void;
  onSetPendingFile: (slotId: string, which: Which, file: File | null) => void;
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
    <div ref={setNodeRef} style={style} className="promo-editor-row">
      <div className="promo-editor-row__header">
        <button
          type="button"
          className="editor-card__handle"
          aria-label="Flyt række"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <label className="promo-editor-row__columns">
          Antal kolonner
          <select
            className="form-field__select"
            value={row.columns}
            onChange={(event) => onSetColumns(Number(event.target.value) as Columns)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <button className="button button--secondary" type="button" onClick={onRemoveRow}>
          Fjern række
        </button>
      </div>

      <div className={`promo-row promo-row--cols-${row.columns}`}>
        {row.slots.map((slot) => (
          <PromoSlotEditor
            key={slot.id}
            slot={slot}
            newsletters={newsletters}
            pendingFiles={pendingFiles}
            onSetEntryNewsletter={onSetEntryNewsletter}
            onToggleFallback={onToggleFallback}
            onSetPendingFile={onSetPendingFile}
          />
        ))}
      </div>
    </div>
  );
}

function PromoSlotEditor({
  slot,
  newsletters,
  pendingFiles,
  onSetEntryNewsletter,
  onToggleFallback,
  onSetPendingFile,
}: {
  slot: PromoSlot;
  newsletters: Newsletter[];
  pendingFiles: Record<string, File>;
  onSetEntryNewsletter: (slotId: string, which: Which, newsletterId: string) => void;
  onToggleFallback: (slotId: string, enabled: boolean) => void;
  onSetPendingFile: (slotId: string, which: Which, file: File | null) => void;
}) {
  return (
    <div className="promo-slot">
      <PromoEntryFields
        label="Promoveret nyhedsbrev"
        slotId={slot.id}
        which="primary"
        entry={slot.primary}
        newsletters={newsletters}
        pendingFile={pendingFiles[`${slot.id}-primary`]}
        onSetNewsletter={(newsletterId) => onSetEntryNewsletter(slot.id, "primary", newsletterId)}
        onSetPendingFile={(file) => onSetPendingFile(slot.id, "primary", file)}
      />

      <label className="form-field--checkbox promo-slot__fallback-toggle">
        <input
          type="checkbox"
          checked={!!slot.fallback}
          onChange={(event) => onToggleFallback(slot.id, event.target.checked)}
        />
        <span>Vis alternativ hvis brugeren allerede er tilmeldt</span>
      </label>

      {slot.fallback && (
        <PromoEntryFields
          label="Alternativ nyhedsbrev"
          slotId={slot.id}
          which="fallback"
          entry={slot.fallback}
          newsletters={newsletters}
          pendingFile={pendingFiles[`${slot.id}-fallback`]}
          onSetNewsletter={(newsletterId) => onSetEntryNewsletter(slot.id, "fallback", newsletterId)}
          onSetPendingFile={(file) => onSetPendingFile(slot.id, "fallback", file)}
        />
      )}
    </div>
  );
}

function PromoEntryFields({
  label,
  slotId,
  which,
  entry,
  newsletters,
  pendingFile,
  onSetNewsletter,
  onSetPendingFile,
}: {
  label: string;
  slotId: string;
  which: Which;
  entry: PromoEntry;
  newsletters: Newsletter[];
  pendingFile: File | undefined;
  onSetNewsletter: (newsletterId: string) => void;
  onSetPendingFile: (file: File | null) => void;
}) {
  const newsletter = newsletters.find((n) => n.id === entry.newsletterId);
  const fallbackImageUrl = entry.customImageUrl || newsletter?.imageUrl;

  // A newly-chosen file needs a blob: URL for preview — created as a pure
  // derivation of `pendingFile` (useMemo), with the effect doing only the
  // cleanup (revoking), not driving any state itself.
  const blobUrl = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile]
  );
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const previewUrl = blobUrl ?? fallbackImageUrl;

  return (
    <div className="promo-entry">
      <div className="form-field">
        <label className="form-field__label" htmlFor={`${slotId}-${which}-newsletter`}>
          {label}
        </label>
        <select
          className="form-field__select"
          id={`${slotId}-${which}-newsletter`}
          value={entry.newsletterId}
          onChange={(event) => onSetNewsletter(event.target.value)}
        >
          {newsletters.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- preview of a chosen file (blob: URL) or an S3/local thumbnail, not a Next-optimizable static asset
        <img className="promo-entry__preview" src={previewUrl} alt="" width={64} height={64} />
      )}

      <div className="form-field">
        <label className="form-field__label" htmlFor={`${slotId}-${which}-image`}>
          Eget billede (valgfrit, ellers nyhedsbrevets eget)
        </label>
        <input
          className="form-field__input"
          id={`${slotId}-${which}-image`}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event) => onSetPendingFile(event.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
