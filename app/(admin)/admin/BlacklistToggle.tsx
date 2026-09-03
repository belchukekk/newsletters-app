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
    <label>
      <input type="checkbox" checked={blacklisted} disabled={isPending} onChange={toggle} />
      {blacklisted ? `Blacklisted (${source})` : "Blacklist email"}
    </label>
  );
}
