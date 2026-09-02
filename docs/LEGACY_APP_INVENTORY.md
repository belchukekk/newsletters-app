# Legacy PHP app inventory (`/private/var/www/newsletters`)

Reference material gathered while planning the rewrite. The old repo is untouched and still on disk at `/private/var/www/newsletters` if deeper source-level detail is ever needed — this doc is the condensed version so the rewrite doesn't need to re-explore it from scratch.

Entry point: `web/index.php` → `src/app.php` (Pimple DI container) → `src/routing.php` (a plain `switch` on `getBaseUrl().getPathInfo()`, no router framework). Session starts at top of `routing.php`. Every request ends with closing the DB connection.

## Routes / screens

| Route | Auth gate | What it does |
|---|---|---|
| `/` | none (redirects if logged in) | Admin session → redirect `/admin`; user session → redirect `/manage`. Otherwise fetches published newsletters and renders the frontpage list. |
| `/subscribe` | none | Reads `id` (newsletter id) and `csid` GET params; if logged in, loads current subscriptions; if `csid` present, resolves an email via a DB lookup (`kd_customer.cv_email`). |
| `/unsubscribe` | requires session email | GET `id` required. Unsubscribes from that newsletter (updates cache), renders confirmation. |
| `/unsubscribe-feedback` | requires session email | Reads `newsletter_id`, `reason[]`, optional `pause_period`. Logs an `unsubscribe_reasons` (or future-dated `permission` if "pause") event to BBL. |
| `/newsletter-unsubscribe` | token-validated (`md5(email+salt) === auth`) | One-click unsubscribe link from campaign emails. Sets session email, redirects to `/unsubscribe?id=…`. |
| `/auth` | md5-signed key | Magic-link SSO entry point: validates `check=md5(email+time+key)` (or `md5(admin+time+email+key)` for admin). Sets session email/admin email, redirects to `/admin`, `/subscribe?id=`, or `/manage`. This is how the KD Drupal site hands off a logged-in user. No `time` expiry check exists today. |
| `/save` | none (public form POST) | POST `email`, `newsletter_id`. Validates email, logs a `permission` event to BBL, fetches an opt-in email template from Mailchimp (campaign HTML), sends it via the internal "Notifier" service, logs `optin_sent`. |
| `/saveajax` | requires session email | AJAX subscribe/unsubscribe toggle for already-logged-in users (used by `/manage` and `/subscribe`). POST `clicked_id`, `clicked_title`, `type`. Returns `{"result":true/false}`. |
| `/save-blacklist` | requires admin session | POST `type` (true/false). Logs a `blacklist` event to BBL, sets/clears a blacklist cache entry. |
| `/manage` | requires session email | Logged-in user's own subscription management page. |
| `/admin` | requires admin session | Admin dashboard: all newsletters + this admin's subscription state + blacklist status + optional BigQuery event history (`?events=1`). |
| `/gdpr` | requires admin session | GDPR event overview for the session email, from BigQuery (`permission.gdpr_overview`). |
| `/gdpr/delete` | requires admin session | Checks BBL for an existing `gdpr_delete` event; if requested and not already logged, logs one. |
| `/logout` | none (no auth guard in routing) | Clears session, redirects `/`. |
| `/admin/newsletter-editor` | requires admin session | **The key screen.** Per-newsletter form: title, description, image (S3 upload or manual URL), published toggle, drag-and-drop reorder. |
| `/admin/save-newsletter` | requires admin session | POST handler: uploads image to S3, `UPDATE config_newsletter SET title/description/thumbnail/published` per newsletter row, invalidates cache. |
| `/admin/reorder-newsletters` | requires admin session | JSON body `{"order":[ids]}` → `UPDATE ... SET priority` per id, invalidates cache. |
| `/e-avis` | none | Decrypts an AES-256-CBC encrypted subscriber id ("Infosoft" id) from a URL param, detects mobile OS, shows deep-link/app-store/web links to the e-paper app. |
| `/send-sms` | AJAX only | Looks up a subscriber by phone (DB), sends an SMS via InMobile's custom XML-over-HTTP API with an app deep-link. |
| `/confirm-subscription` | none | GET renders a POST-only confirmation form (anti-prefetch pattern). POST validates a checksum against a pending BBL `permission` event, confirms it, sets session. |
| `/pushbeskeder` | none | GET shows push notification preferences (DB + Redis cache). POST updates state, logs event to BBL. |
| `/clear-newsletter-cache` | none | Deletes one Redis cache key (`newsletter_data` — notably NOT `newsletter_data_admin`, an existing inconsistency). |

## External integrations

| System | Used for |
|---|---|
| **Google Cloud SQL (MySQL)** | `kd_customer` database — primary data store, raw SQL via `mysqli`, no ORM. |
| **Redis** | Cache: newsletter list (2h TTL, keys `newsletter_data`/`newsletter_data_admin`), per-email subscription list (2h TTL), blacklist flag (2h TTL), push subscription state (1h TTL). |
| **"BBL" (Big Bucket Log)** | Internal Elasticsearch-backed event-log HTTP API. Nearly every user action logs an event here (`permission`, `unsubscribe`, `unsubscribe_reasons`, `blacklist`, `gdpr_delete`, `permission_push`, `unsubscribe_push`). Some flows also *read* from it (opt-in confirmation checksum lookup, gdpr_delete existing-request check) via Elasticsearch-style query POSTs. |
| **Mailchimp API v3** | Only used to fetch a campaign's HTML content as an opt-in email template — not used for list/subscriber management or actual sending. |
| **AWS S3** | Newsletter thumbnail image upload (admin editor only). |
| **Google BigQuery** | Read-only: per-email send/open/bounce event history (`dbt_email.summary`), GDPR audit data (`permission.gdpr_overview`). |
| **InMobile SMS API** | Custom XML-over-HTTP protocol to send SMS text messages. No official Node SDK exists for this. |
| **"Notifier"** | Internal HTTP dispatch service (basic-auth) used to actually send the opt-in confirmation email. Also supports Slack send, unused here. |
| **ActiveCampaign** | Not called via API directly — only relevant as (a) source of signed unsubscribe links, (b) shared AES key/IV for the e-avis encryption scheme, (c) BigQuery data references AC click-tracking URLs for display only. |

## Database tables referenced (schema authoritative in old repo's `dump/kd_customer_temp.sql`)

- `kd_customer.config_newsletter` — newsletter list/config (read by frontend, written by admin editor)
- `email_blacklist_complete` — blacklist lookup
- `kd_customer.cv_email` — resolves anonymous "csid" to email
- `kd_customer.customer_infosoft` — phone→Infosoft subscriber id lookup for SMS
- `kd_customer.email_list_current_mv` — materialized view, user's current subscription state
- `kd_customer.config_push_list` — available push notification lists
- `push_list_current` — per-device push subscription state

## Auth signature schemes (preserve exactly — see `src/Service/AuthRequest.php` in old repo)

- `/auth`: `check = md5(email + time + authKey)` for regular users, `check = md5(admin + time + email + authKey)` for admin. No expiry check on `time` today.
- `/newsletter-unsubscribe`: `auth = md5(email + acSalt)`.
- `/confirm-subscription`: checksum `chk = md5(id + mail)`, validated against a pending BBL event, not a static secret.

## Known issues in the old app (do not carry forward)

1. `NewsletterJSON.php`/`NewsletterInterface.php` — dead code, unused fixture abstraction. Don't port.
2. Mailchimp `getUnsubUrl()` is a stub always returning `'#'` — the unsubscribe link in the opt-in email has never actually worked. Worth fixing properly in the rewrite, or asking whether it's still needed.
3. `/clear-newsletter-cache` only clears one of two related cache keys — an inconsistency, fix by always clearing both (or all relevant cache keys for whatever caching layer the rewrite uses).
4. The newsletter editor's checkbox bug (duplicate hidden-field + checkbox with the same name, collapsed inconsistently by some intermediary infra) — avoid entirely by using standard React controlled checkboxes (single field, no hidden-field pairing trick).
5. The newsletter editor's lost-update race (one form posts every newsletter row at once, so concurrent admin edits can clobber each other) — avoid by making each row its own independent save.
6. Secrets (DB password, AWS keys, BBL token, InMobile key, Notifier password, Mailchimp key, AC AES key/IV) are hardcoded in plaintext in the old repo's `config/config_*.php` — rotate every one of them at the source system when moving to Vercel env vars, don't just copy the values over.
