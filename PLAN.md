# Rebuild `newsletters` as `newsletters-app` (Next.js on Vercel)

> This is the approved implementation plan, carried over from the planning session that scoped this rewrite. See also `docs/LEGACY_APP_INVENTORY.md` for the full route/integration inventory of the PHP app being replaced.

## Context

The current `newsletters` PHP app (Silex/Pimple, `/private/var/www/newsletters`) controls whether a newsletter is "published" (`kd_customer.config_newsletter`), via `/admin/newsletter-editor`. It's old (raw `mysqli`, hand-rolled routing switch, no framework), has a recently-fixed checkbox bug and a still-open lost-update race condition in that editor, and has plaintext secrets committed to the repo.

Rather than keep patching it, the decision is to **fully replace it** with this Next.js app, hosted on Vercel, in its own fresh GitHub repo — and then decommission the PHP app entirely. Scope is full feature parity (every route below), but built lean: no speculative abstraction, no porting dead code, no building anything not actually used today.

**Decisions locked in for this plan:**
- Full feature parity — all 22 routes/screens, all 8 external integrations. Nothing deferred by default.
- **Auth: two separate mechanisms, split by audience.**
  - **Regular users**: unchanged. The `/auth` magic link (`md5(email+time+key)`) is the *only* way a logged-in Drupal user is handed off into `/manage`, `/subscribe`, `/unsubscribe` today — confirmed from the code (there's no other session-entry point in the app) and from the README's own test examples. Preserve this exactly, byte-for-byte, including no expiry check on the `time` param — no changes needed on the Drupal side.
  - **Admins**: replaced with company Google SSO for `/admin/*` only. The magic link's existing `admin` param variant (`md5(admin+time+email+key)`) is retired in favor of NextAuth + Google, restricted to an allowlist.
  - **Email unsubscribe links** (`/newsletter-unsubscribe`, the AC-salt token scheme) are unrelated to both of the above and stay exactly as-is — no Google account involved, just a one-click signed token in marketing emails.
- Database: connect directly to the existing Google Cloud SQL `kd_customer` instance from Vercel serverless functions, `mysql2/promise` pool with a small connection limit. No ORM, no data migration — same DB, same tables.
- New repo name: `newsletters-app`, hosted on GitHub, deployed via Vercel's GitHub integration.
- New local folder: `/var/www/newsletters-app` (separate from `/private/var/www/newsletters`, untouched).

## What's being replaced (full inventory)

**22 routes**, from `src/routing.php` in the old app, grouped by concern:

- **Public, anonymous**: `/` (frontpage list), `/subscribe`, `/e-avis`, `/confirm-subscription` (GET+POST), `/pushbeskeder` (GET+POST), `/save` (opt-in POST), `/send-sms`.
- **Public, magic-link/session**: `/auth`, `/newsletter-unsubscribe`, `/unsubscribe`, `/unsubscribe-feedback`, `/saveajax`, `/manage`, `/logout`.
- **Admin (Google SSO)**: `/admin`, `/admin/newsletter-editor`, `/admin/save-newsletter`, `/admin/reorder-newsletters`, `/save-blacklist`, `/gdpr`, `/gdpr/delete`, `/clear-newsletter-cache`.

**8 external integrations**: Google Cloud SQL (MySQL), Redis (cache), "BBL" internal event-log HTTP API, Mailchimp API (campaign HTML fetch only), AWS S3 (image upload), Google BigQuery (event history + GDPR audit, read-only), InMobile SMS (custom XML-over-HTTP), "Notifier" internal email-dispatch service. Plus AES-256-CBC encryption (e-avis subscriber-id decoding) via Node's built-in `crypto` — no package needed.

Full per-route and per-integration detail is in `docs/LEGACY_APP_INVENTORY.md` — it doesn't need to be re-derived from the old PHP repo, just implemented against.

## Target architecture

**Framework**: Next.js, App Router. Route Handlers for AJAX/webhook-style endpoints and magic-link/session routes; Server Actions for the newsletter editor's per-row save; NextAuth for admin Google SSO.

```
/app
  /(public)/
    page.tsx                      # "/"
    subscribe/page.tsx
    unsubscribe/page.tsx
    unsubscribe-feedback/page.tsx
    manage/page.tsx
    e-avis/page.tsx
    pushbeskeder/page.tsx
    confirm-subscription/page.tsx
  /auth/route.ts                  # magic-link entry (regular users only) — sets session cookie
  /newsletter-unsubscribe/route.ts
  /logout/route.ts
  /save/route.ts
  /saveajax/route.ts
  /send-sms/route.ts
  /(admin)/admin/
    layout.tsx                    # auth gate: NextAuth session + allowlist
    page.tsx                      # dashboard
    newsletter-editor/page.tsx
    gdpr/page.tsx
    gdpr/delete/page.tsx
  /api/admin/newsletters/route.ts
  /api/admin/newsletters/reorder/route.ts
  /api/admin/blacklist/route.ts
  /api/admin/cache/route.ts
  /api/auth/[...nextauth]/route.ts

/lib
  /server
    db.ts                # mysql2/promise pool (module-scope singleton, connectionLimit: 3-5)
    redis.ts              # Upstash Redis client (HTTP-based, serverless-friendly)
    session.ts            # signed JWT cookie (jose) replacing $_SESSION for regular users — { email, originLink?, originLabel? }
    auth-admin.ts          # NextAuth config + Google email allowlist check
    auth-magic-link.ts     # md5(email+time+key) validate/generate — exact parity with AuthRequest.php, regular-user sessions only (the `admin` param variant is retired)
  /domains                # one module per old Service class, no DI container needed
    newsletters.ts        # ← NewsletterCloudSQL.php
    subscriptions.ts       # ← UserList.php (highest-complexity port: cache/DB reconciliation)
    push.ts                # ← NotificationCloudSQL.php
  /integrations
    bbl.ts                 # fetch wrapper, replaces Guzzle-based BblService
    mailchimp.ts            # single fetch call (campaign HTML), no SDK needed
    notifier.ts             # basic-auth fetch POST
    s3.ts                   # @aws-sdk/client-s3
    bigquery.ts              # @google-cloud/bigquery
    inmobile-sms.ts          # hand-rolled XML body + fetch (no SDK exists for this protocol)
    e-avis-crypto.ts         # Node crypto AES-256-CBC
/middleware.ts             # gates /admin/* via NextAuth session check
```

**Session model**: two independent sessions. Regular users get one signed, httpOnly, `Secure`, `SameSite=Lax` JWT cookie (replaces PHP's `$_SESSION`) issued by the `/auth` magic-link handler — no server-side session store needed. Flash messages become a `?notice=` param or a Server Action's return value, not a one-shot session flag. Admins get NextAuth's own session (JWT strategy) issued via Google sign-in — the two are not merged into one cookie, since they now have genuinely different trust models (a Drupal-forwarded signed link vs. an interactive Google login).

**Auth model**:
- **Regular users**: unchanged. The KD Drupal site generates a signed URL (`/auth?email=...&time=...&check=md5(email+time+key)`) exactly as it does today, and this app validates the signature and issues the session cookie for `/manage`, `/subscribe`, `/unsubscribe`, `/saveajax`. No login form, no changes needed on the Drupal side.
- **Admins**: `next-auth` with `GoogleProvider`, `session: { strategy: "jwt" }`. `signIn` callback rejects unless the email matches `ADMIN_EMAIL_ALLOWLIST` (or an `@k.dk` domain check — confirm which policy with the user before building). `middleware.ts` gates `/admin/*` on this session existing and being allowlisted.
- **Email unsubscribe links**: `/newsletter-unsubscribe` keeps its own separate AC-salt token scheme (`md5(email+salt) === auth`), unrelated to either of the above — sets only the regular-user session cookie, redirects to `/unsubscribe?id=`.

**Data layer**: raw SQL via `mysql2/promise`, organized as one module per domain (matches the old `Service` class boundaries — the right granularity, don't split further). No ORM, no Pimple-style DI container (Next.js modules already solve that).

**Env vars**: every currently-hardcoded PHP config value becomes a Vercel env var — and gets **rotated at the source system**, not just copied, since the old repo's git history retains the plaintext values regardless of what happens to the PHP app. See `.env.example` for the full list.

## The newsletter editor, specifically (the highest-value piece)

- Each newsletter card is its own independently-saved unit (own Server Action call), **not** one giant form posting every row at once. This structurally fixes the lost-update race condition still open in the PHP version (two admins editing different rows can no longer clobber each other, since they're never in the same request) — no optimistic-locking/version column needed for that; only add one later if same-row concurrent edits become a real observed problem.
- Standard React controlled `<input type="checkbox" checked={published} onChange={...}>` — structurally can't reproduce the old duplicate-hidden-field bug, since there's exactly one value source per field, no paired hidden/checkbox trick at all.
- Reorder stays a dedicated JSON endpoint (`/api/admin/newsletters/reorder`) with optimistic UI (reorder locally on drop, roll back on failure), using `@dnd-kit/core` for drag-and-drop.

## Integration approach per system

| System | Approach |
|---|---|
| BBL | `fetch` wrapper, 1:1 port of the Guzzle client (preserve `Referer` + `X-Authorization` headers) |
| Mailchimp | Plain `fetch` for the single campaign-HTML-fetch call — skip the SDK, it's one read |
| S3 | `@aws-sdk/client-s3`, official SDK |
| BigQuery | `@google-cloud/bigquery`, official SDK |
| InMobile SMS | Hand-rolled XML body + `fetch` — no SDK exists for this custom protocol, the protocol itself is the complexity |
| Notifier | Plain `fetch` + Basic Auth header; skip the unused Slack-send capability |
| Redis | Upstash (`@upstash/redis`, HTTP-based) instead of Predis — persistent TCP connections don't fit serverless, this is a deliberate deviation from a literal port |
| AES (e-avis) | Node's built-in `crypto`, zero new dependencies |
| Mobile detection (e-avis) | Small `ua-parser-js` call or a plain regex — the old code only branches iOS/Android, don't pull in a heavy device-detection library for a 2-way check |

## Phased build order

1. **Foundations** — repo scaffold, env vars, DB pool, Upstash client, empty Vercel deploy pipeline proven end-to-end (GitHub → preview → prod). *(in progress)*
2. **Read-only public pages** — `/`, `/subscribe` (anonymous path), `/e-avis` (fully self-contained: AES decrypt + device detect + static links, zero session/DB writes) — good first real verification against production data, read-only.
3. **Admin editor** — `/admin/newsletter-editor`, save, reorder, S3 upload, cache invalidation, behind NextAuth (build Google SSO here since the editor needs the auth gate anyway). This is the most important screen — verify thoroughly against real `config_newsletter` rows.
4. **Regular-user magic-link flows** — build the `/auth` handler (regular-user session cookie only, no `admin` param support), `/manage`, `/saveajax`, `/unsubscribe`, `/unsubscribe-feedback`, `/newsletter-unsubscribe`, `/confirm-subscription`, `/save` (pulls in Mailchimp + Notifier). Confirm the existing Drupal-generated links work unchanged against the new `/auth` handler. Biggest chunk — `subscriptions.ts` (port of `UserList.php`) needs care.
5. **Admin dashboard + GDPR + blacklist** — `/admin` full dashboard incl. BigQuery event history, `/gdpr`, `/gdpr/delete`, `/save-blacklist` (pulls in BigQuery client).
6. **Remaining integrations** — `/send-sms` (InMobile), `/pushbeskeder`, `/clear-newsletter-cache`.
7. **Cutover** — verify every route against the inventory with real traffic before decommissioning the PHP app; cut over route groups incrementally at the DNS/CDN level if possible rather than a single big-bang switch.

## Reference material

- `docs/LEGACY_APP_INVENTORY.md` — full route → controller → behavior table, full external-integration table, full DB table list, full template list, gathered by reading the old app's `routing.php`, `Controller.php`, `AdminController.php`, all of `src/Service/`, `src/Utility/Service/`, `src/app.php`, `config/config_*.php`, `composer.json` in full.
- The old repo (`/private/var/www/newsletters`) is still on disk and untouched — `dump/kd_customer_temp.sql` there has the authoritative schema for `config_newsletter`, `email_list_current_mv`, `push_list_current`, etc.; `src/Service/AuthRequest.php` has the exact magic-link/unsubscribe-token signature schemes to preserve byte-for-byte.
- Do **not** port `NewsletterJSON.php`/`NewsletterInterface.php` from the old app — confirmed dead code (unused fixture abstraction), and porting it would reintroduce exactly the kind of speculative interface-for-one-implementation the "keep it lean" instruction rules out.

## Verification

- Each phase (2–6 above) should be checked against its old-app equivalent side-by-side before moving to the next: same input → same DB/cache effect, same redirect/response shape.
- The newsletter editor phase specifically needs a real save-and-reload check against the actual `config_newsletter` table (title/description/image/published/priority all persist correctly, per-row save doesn't touch other rows).
- Before decommissioning the PHP app, do one full pass through all 22 routes in the new app against production-equivalent data.
