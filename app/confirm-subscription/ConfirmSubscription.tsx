"use client";

import { useEffect, useState } from "react";
import { confirmSubscriptionAction } from "./actions";

// Anti-prefetch by construction: confirming only happens once this component
// mounts and its effect runs, which requires actual JS execution — a plain
// crawler following the emailed link (GET only, no JS) never triggers it.
export function ConfirmSubscription({ id, chk }: { id: string; chk: string }) {
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [newsletterTitle, setNewsletterTitle] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    confirmSubscriptionAction(id, chk).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setNewsletterTitle(result.newsletterTitle);
        setState("ok");
      } else {
        setState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, chk]);

  if (state === "pending") return <p>Bekræfter…</p>;
  if (state === "error") {
    return <p className="notice notice--error">Linket er ugyldigt eller udløbet.</p>;
  }

  return (
    <div>
      <h1>Tilmelding bekræftet</h1>
      <p className="notice notice--success">
        {newsletterTitle
          ? `Du er nu tilmeldt ${newsletterTitle}.`
          : "Din tilmelding er bekræftet."}
      </p>
    </div>
  );
}
