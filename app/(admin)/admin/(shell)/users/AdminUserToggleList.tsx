"use client";

import { useState, useTransition } from "react";
import type { Newsletter } from "@/lib/domains/newsletters";

type Row = { subscribed: boolean; source: string; cacheEvent: string | null };

// Admin-facing equivalent of SubscriptionToggleList, but for an arbitrary
// looked-up email instead of the caller's own session — posts to
// /api/admin/users/subscriptions with that email attached.
export function AdminUserToggleList({
  email,
  newsletters,
  initialRows,
}: {
  email: string;
  newsletters: Newsletter[];
  initialRows: Record<string, Row>;
}) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(newsletter: Newsletter, checked: boolean) {
    const previous = rows[newsletter.id];
    setRows((current) => ({
      ...current,
      [newsletter.id]: { subscribed: checked, source: previous?.source ?? "", cacheEvent: null },
    }));
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            newsletterId: newsletter.id,
            newsletterTitle: newsletter.title,
            subscribe: checked,
          }),
        });
        const data = await response.json();
        if (!data.result) throw new Error("subscriptions toggle returned result: false");
      } catch {
        setRows((current) => ({ ...current, [newsletter.id]: previous }));
        setError("Kunne ikke gemme ændringen. Prøv igen.");
      }
    });
  }

  return (
    <div>
      {error && <p className="notice notice--error">{error}</p>}
      <ul>
        {newsletters.map((newsletter) => {
          const row = rows[newsletter.id];
          return (
            <li key={newsletter.id} className="toggle-row">
              <div className="toggle-row__text">
                <p className="toggle-row__title">{newsletter.title}</p>
                <p className="toggle-row__description">
                  {row?.source ? `Kilde: ${row.source}` : "Ingen persistent tilmelding fundet"}
                  {row?.cacheEvent ? ` · cache: ${row.cacheEvent}` : ""}
                </p>
              </div>
              <label className="toggle-switch">
                <span className="visually-hidden">{newsletter.title}</span>
                <input
                  type="checkbox"
                  checked={!!row?.subscribed}
                  disabled={isPending}
                  onChange={(event) => toggle(newsletter, event.target.checked)}
                />
                <span className="toggle-switch__track" aria-hidden="true" />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
