"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { logUnsubscribeFeedback } from "@/lib/domains/subscriptions";

const OTHER_REASON_VALUE = "Andet (udfyld)";

// Port of Controller::unsubscribeReasons (POST branch) — logs the feedback,
// plus a second future-dated "permission" event when the "pause" reason is
// picked with a real (non-permanent) pause period.
export async function submitUnsubscribeFeedback(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/");

  const newsletterId = String(formData.get("newsletter_id") ?? "");
  const reasons = formData.getAll("reason").map(String);
  const otherContent = String(formData.get("reason-other_content") ?? "").trim();
  const pausePeriodWeeks = Number(formData.get("pause_period") ?? 0);

  if (reasons.length === 0) {
    redirect(`/unsubscribe?id=${encodeURIComponent(newsletterId)}`);
  }

  const finalReasons = reasons.map((reason) =>
    reason === OTHER_REASON_VALUE && otherContent ? otherContent : reason
  );

  await logUnsubscribeFeedback({
    email: session.email,
    newsletterId,
    reasons: finalReasons,
    pausePeriodWeeks,
  });

  redirect(`/unsubscribe-feedback?id=${encodeURIComponent(newsletterId)}`);
}
