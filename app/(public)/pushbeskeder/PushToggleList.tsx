"use client";

import { useState, useTransition } from "react";
import type { PushList } from "@/lib/domains/push";

// Port of the push-preferences toggle list in
// page_newsletter-push-permissions.html.twig — identified by device
// push_token, not a user session.
export function PushToggleList({
  lists,
  settings,
  pushToken,
  sys,
}: {
  lists: PushList[];
  settings: Record<string, number>;
  pushToken: string;
  sys: boolean;
}) {
  const [state, setState] = useState(settings);
  const [isPending, startTransition] = useTransition();

  function toggle(list: PushList, checked: boolean) {
    const previous = state[list.id];
    setState((current) => ({ ...current, [list.id]: checked ? 1 : 0 }));

    startTransition(async () => {
      const response = await fetch("/api/pushbeskeder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushtoken: pushToken, sys, list: list.id, state: checked }),
      });
      if (!response.ok) {
        setState((current) => ({ ...current, [list.id]: previous }));
      }
    });
  }

  return (
    <ul>
      {lists.map((list) => (
        <li key={list.id} className="toggle-row">
          <div className="toggle-row__text">
            <p className="toggle-row__title">{list.title}</p>
            <p className="toggle-row__description">{list.description}</p>
          </div>
          <label className="toggle-switch">
            <span className="visually-hidden">{list.title}</span>
            <input
              type="checkbox"
              checked={!!state[list.id]}
              disabled={isPending}
              onChange={(event) => toggle(list, event.target.checked)}
            />
            <span className="toggle-switch__track" aria-hidden="true" />
          </label>
        </li>
      ))}
    </ul>
  );
}
