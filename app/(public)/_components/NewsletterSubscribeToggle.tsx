"use client";

import { useState, useTransition } from "react";

// Shared single-item toggle backed by /saveajax — used by both the full
// /manage list and anywhere else a logged-in viewer needs an inline
// subscribe/unsubscribe switch instead of a plain "Tilmeld" link (e.g. the
// frontpage promo grid).
export function NewsletterSubscribeToggle({
  newsletterId,
  newsletterTitle,
  initialSubscribed,
}: {
  newsletterId: string;
  newsletterTitle: string;
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function toggle(checked: boolean) {
    const previous = subscribed;
    setSubscribed(checked);
    setError(false);

    startTransition(async () => {
      try {
        const response = await fetch("/saveajax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clicked_id: newsletterId,
            clicked_title: newsletterTitle,
            type: checked ? "true" : "false",
          }),
        });
        const data = await response.json();
        if (!data.result) throw new Error("saveajax returned result: false");
      } catch {
        setSubscribed(previous);
        setError(true);
      }
    });
  }

  return (
    <div className="newsletter-toggle">
      <label className="toggle-switch">
        <span className="visually-hidden">{newsletterTitle}</span>
        <input
          type="checkbox"
          checked={subscribed}
          disabled={isPending}
          onChange={(event) => toggle(event.target.checked)}
        />
        <span className="toggle-switch__track" aria-hidden="true" />
      </label>
      {error && (
        <span className="notice notice--error newsletter-toggle__error">
          Kunne ikke gemme. Prøv igen.
        </span>
      )}
    </div>
  );
}
