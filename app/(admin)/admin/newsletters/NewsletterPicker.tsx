"use client";

import { useMemo, useRef, useState } from "react";
import type { Newsletter } from "@/lib/domains/newsletters";

// A searchable, thumbnail-aware picker in place of a plain <select> — the
// list can be long enough (and visually distinct enough by thumbnail) that
// typing to filter is faster than scanning a dropdown of plain text options.
export function NewsletterPicker({
  newsletters,
  selectedId,
  onSelect,
  placeholder = "Vælg nyhedsbrev…",
  allowNone = false,
}: {
  newsletters: Newsletter[];
  selectedId: string | null;
  onSelect: (newsletterId: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = newsletters.find((n) => n.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return newsletters;
    return newsletters.filter((n) => n.title.toLowerCase().includes(q));
  }, [newsletters, query]);

  function open() {
    setQuery("");
    setIsOpen(true);
  }

  function choose(newsletterId: string | null) {
    onSelect(newsletterId);
    setIsOpen(false);
  }

  if (!isOpen && selected) {
    return (
      <div className="picker__selected">
        {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs S3), not worth a remotePatterns config */}
        <img src={selected.imageUrl} alt="" width={32} height={32} />
        <span className="picker__selected-title">{selected.title}</span>
        <button type="button" className="picker__change" onClick={open}>
          Skift
        </button>
      </div>
    );
  }

  return (
    <div className="picker" ref={containerRef}>
      <input
        className="form-field__input"
        type="text"
        value={query}
        placeholder={selected ? selected.title : placeholder}
        onFocus={open}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          // Let a click on an option register before closing.
          window.setTimeout(() => setIsOpen(false), 150);
        }}
      />
      {isOpen && (
        <ul className="picker__list">
          {allowNone && (
            <li>
              <button type="button" className="picker__option" onClick={() => choose(null)}>
                <span>Ingen</span>
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="picker__empty">Ingen nyhedsbreve matcher.</li>
          ) : (
            filtered.map((newsletter) => (
              <li key={newsletter.id}>
                <button
                  type="button"
                  className="picker__option"
                  onClick={() => choose(newsletter.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs S3), not worth a remotePatterns config */}
                  <img src={newsletter.imageUrl} alt="" width={32} height={32} />
                  <span>{newsletter.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
