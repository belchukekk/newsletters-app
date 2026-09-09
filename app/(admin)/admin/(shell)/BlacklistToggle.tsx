"use client";

import { useState, useTransition } from "react";

// Port of the blacklist toggle in block_newsletter-administration-events.html.twig
// (data-endpoint="save-blacklist") — toggles the admin's own email.
export function BlacklistToggle({ blacklistSource }: { blacklistSource: string | null }) {
  const [source, setSource] = useState(blacklistSource);
  const [isPending, startTransition] = useTransition();
  const blacklisted = source !== null;

  function toggle() {
    const next = !blacklisted;
    const previous = source;
    setSource(next ? "nl_admin" : null);

    startTransition(async () => {
      const response = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: next ? "true" : "false" }),
      });
      if (!response.ok) setSource(previous);
    });
  }

  return (
    <div className="toggle-row toggle-row--flush">
      <p className="toggle-row__title">
        {blacklisted ? `Blacklisted (${source})` : "Blacklist email"}
      </p>
      <label className="toggle-switch">
        <span className="visually-hidden">Blacklist email</span>
        <input type="checkbox" checked={blacklisted} disabled={isPending} onChange={toggle} />
        <span className="toggle-switch__track" aria-hidden="true" />
      </label>
    </div>
  );
}
