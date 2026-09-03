// Port of NotifierApiClient.php (vendor/kd/api-clients) — internal
// HTTP dispatch service. Only the mail-sending path is ported; the Slack
// capability is unused here (see PLAN.md).
const ENDPOINT_URL = "https://notifier-dot-kristeligt-dagblad.appspot.com/api/v1/notifications";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Sends an actual email to a real recipient — this has a real-world side
// effect and must never be called speculatively/for testing against a real
// address without the user's explicit go-ahead.
export async function sendOptInEmail(params: {
  email: string;
  html: string;
  subject: string;
  source: string;
}): Promise<boolean> {
  const user = requireEnv("NOTIFIER_USER");
  const password = requireEnv("NOTIFIER_PASSWORD");

  const response = await fetch(ENDPOINT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    },
    body: JSON.stringify({
      notifications: [
        {
          send_at: "now",
          customer: { email: params.email },
          subject: params.subject.slice(0, 256),
          source: params.source.slice(0, 32),
          channel: "email",
          html: Buffer.from(params.html, "utf8").toString("base64"),
        },
      ],
    }),
  });

  // Batches over 100 notifications get 202 Accepted instead of 201 Created.
  return response.status === 201 || response.status === 202;
}
