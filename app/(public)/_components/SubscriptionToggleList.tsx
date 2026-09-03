"use client";

import { useState, useTransition } from "react";
import type { Newsletter } from "@/lib/domains/newsletters";

// Shared by /manage and /subscribe's logged-in branch — an AJAX toggle list
// backed by /saveajax, port of the checkbox behavior in
// page_newsletter-administration.html.twig.
export function SubscriptionToggleList({
  newsletters,
  subscribedIds,
}: {
  newsletters: Newsletter[];
  subscribedIds: string[];
}) {
  const [subscribed, setSubscribed] = useState(new Set(subscribedIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(newsletter: Newsletter, checked: boolean) {
    const previous = new Set(subscribed);
    const next = new Set(subscribed);
    if (checked) {
      next.add(newsletter.id);
    } else {
      next.delete(newsletter.id);
    }
    setSubscribed(next);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/saveajax", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clicked_id: newsletter.id,
            clicked_title: newsletter.title,
            type: checked ? "true" : "false",
          }),
        });
        const data = await response.json();
        if (!data.result) throw new Error("saveajax returned result: false");
      } catch {
        setSubscribed(previous);
        setError("Kunne ikke gemme ændringen — prøv igen.");
      }
    });
  }

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {newsletters.map((newsletter) => (
          <li key={newsletter.id}>
            <label>
              <input
                type="checkbox"
                checked={subscribed.has(newsletter.id)}
                disabled={isPending}
                onChange={(event) => toggle(newsletter, event.target.checked)}
              />
              {newsletter.title}
            </label>
            <p>{newsletter.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
