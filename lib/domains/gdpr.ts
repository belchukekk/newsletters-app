import { fetchBblGet, logToBbl } from "@/lib/integrations/bbl";

// Port of AdminController::gdprDeleteAction's existing-request check. The
// legacy PHP compared a raw BBL hit object to the email string with `==`,
// which in PHP is always false for array-vs-string — meaning the "already
// requested" check never actually matched, and a click could log duplicate
// gdpr_delete events. That's a real bug (not one of the ones PLAN.md calls
// out to preserve), and for a GDPR audit trail specifically, duplicate
// requests are a data-quality problem worth just fixing — this compares the
// hit's own `mail` field instead.
export async function isGdprDeleteRequested(email: string): Promise<boolean> {
  const hits = await fetchBblGet({ event: "gdpr_delete", mail: `"${email}"` });
  return (hits ?? []).some((hit) => hit.mail === email);
}

// Port of the new-request branch — logs the gdpr_delete event itself.
export async function requestGdprDelete(email: string): Promise<void> {
  await logToBbl(
    { mail: email, event: "gdpr_delete" },
    "https://nyhedsbreve.kristeligt-dagblad.dk"
  );
}
