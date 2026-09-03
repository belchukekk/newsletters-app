// Port of BblService.php (Guzzle-based) — "Big Bucket Log", an internal
// Elasticsearch-backed event log. Nearly every user action logs an event
// here; some flows also read a pending event back (opt-in confirmation).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// PHP's http_build_query default (numeric-indexed keys for arrays) — this is
// what Guzzle's `form_params` produces on the wire, and BBL's consumer
// expects that exact shape for array fields like `lists`.
function toPhpStyleFormBody(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, index) => params.append(`${key}[${index}]`, String(item)));
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

// Port of BblService::logToBBL — POSTs one tracking event. `index` defaults
// to "bigbucket"; callers pass e.g. "bigbucket/{id}" to update an existing
// doc (see /save's two-step permission log).
export async function logToBbl(
  trackingData: Record<string, unknown>,
  referer = "/",
  index = "bigbucket"
): Promise<string> {
  const response = await fetch(`${requireEnv("BBL_URL")}${index}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-Authorization": requireEnv("BBL_AUTH_TOKEN"),
      Referer: referer,
    },
    body: toPhpStyleFormBody(trackingData),
  });
  return response.text();
}

// Port of BblService::fetchByQuery — POSTs an Elasticsearch-style query,
// returns the hits array (or undefined if empty, matching the old app).
export async function fetchBblByQuery(
  query: Record<string, unknown>
): Promise<Array<Record<string, unknown>> | undefined> {
  const response = await fetch(`${requireEnv("BBL_URL")}api/v1/bigbucketpost`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Authorization": requireEnv("BBL_AUTH_TOKEN"),
      Referer: "https://databroker.k.dk/",
    },
    body: JSON.stringify(query),
  });
  const result = await response.json();
  return result?.hits?.hits;
}

// Port of BblService::fetchGet — a plain GET against the bigbucket index
// (not an ES query DSL POST), used by /gdpr/delete's existing-request check.
export async function fetchBblGet(
  query: Record<string, string>
): Promise<Array<Record<string, unknown>> | undefined> {
  const params = new URLSearchParams(query);
  const response = await fetch(`${requireEnv("BBL_URL")}api/v1/bigbucket?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Authorization": requireEnv("BBL_AUTH_TOKEN"),
    },
  });
  const result = await response.json();
  return result?.hits?.hits;
}
