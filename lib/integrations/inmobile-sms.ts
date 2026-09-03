// Port of src/mm_apiclient.class.php (MM_Connector/MM_Message) — InMobile's
// custom XML-over-HTTP SMS protocol. No SDK exists for this; the auth key
// lives inside the XML body (an <authentication> element), not an HTTP header.

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatSendTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Port of MM_Connector::send — phone is a bare Danish number (no country
// code); the "45" prefix and CDATA-wrapped text match the old client exactly.
export async function sendSms(params: {
  phone: string;
  text: string;
  senderName: string;
}): Promise<boolean> {
  const apiKey = requireEnv("INMOBILE_API_KEY");
  const serverUrl = requireEnv("INMOBILE_SERVER_URL");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<request source="MM_PHP_client_2_1_0_0">` +
    `<authentication apikey="${escapeXml(apiKey)}"/>` +
    `<data><message>` +
    `<sendername>${escapeXml(params.senderName)}</sendername>` +
    `<text><![CDATA[${params.text}]]></text>` +
    `<sendtime>${formatSendTime(new Date())}</sendtime>` +
    `<recipients><msisdn>45${params.phone}</msisdn></recipients>` +
    `</message></data></request>`;

  const response = await fetch(`${serverUrl}/Api/V2/SendMessages`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ xml }).toString(),
  });

  if (!response.ok) return false;

  // The old client's "success" check is just "did the response parse as
  // XML at all" (simplexml_load_string succeeding), not inspecting its
  // content — no documented error-response schema to check against instead,
  // so this is preserved as a well-formedness check rather than guessed at.
  const replyText = await response.text();
  return replyText.trimStart().startsWith("<");
}
