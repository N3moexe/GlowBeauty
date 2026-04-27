# SenBonsPlans — Launch checklist

Follow this checklist before flipping DNS to production. Items are ordered by
failure-cost — a miss on step 1 breaks the whole store; a miss on step 6
degrades error monitoring but nothing ships broken.

## 1. Database migration (required)

Sprint 1 added columns to the `newsletter_subscribers` table and a new
`PENDING` value to its `status` enum. Run against the production DB:

```bash
pnpm db:push
```

This executes `drizzle-kit generate && drizzle-kit migrate`. The added
columns (`confirmationToken`, `confirmationTokenExpiresAt`, `confirmedAt`)
are all nullable — existing rows keep their current status (`SUBSCRIBED` /
`UNSUBSCRIBED`) and are unaffected.

Verify after:

```sql
DESCRIBE newsletter_subscribers;
-- expect: status ENUM('PENDING','SUBSCRIBED','UNSUBSCRIBED')
-- expect: confirmationToken, confirmationTokenExpiresAt, confirmedAt columns
```

## 2. Environment variables (required)

Set these on the production host before `pnpm start`:

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/senbonsplans` |
| `APP_URL` | Public origin — used in confirmation emails + order tracking links | `https://senbonsplans.com` |
| `JWT_SECRET` | Session signing key (32+ random chars) | generate with `openssl rand -hex 32` |
| `SMTP_HOST` | SMTP host for transactional email | `smtp.yourprovider.com` |
| `SMTP_PORT` | SMTP port | `587` (STARTTLS) or `465` (TLS) |
| `SMTP_USER` | SMTP username | `noreply@senbonsplans.com` |
| `SMTP_PASSWORD` | SMTP password / app password | (from provider) |
| `SMTP_FROM` | From address shown to recipients | `SenBonsPlans <noreply@senbonsplans.com>` |
| `ADMIN_EMAIL` | Recipient of new-order notifications | `orders@senbonsplans.com` |
| `NODE_ENV` | Must be `production` | `production` |

**Do NOT set** `ALLOW_DEV_ADMIN=true` in production. It is a dev-only bypass.

### Optional but recommended

| Variable | Purpose |
|---|---|
| `SENTRY_DSN` | Server-side error monitoring (no-op when unset) |
| `VITE_SENTRY_DSN` | Client-side error monitoring (build-time — rebuild after change) |
| `SENTRY_TRACES_SAMPLE_RATE` | Server APM sampling (default 0) |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Client APM sampling (default 0) |
| `APP_RELEASE` / `VITE_APP_RELEASE` | Release tag for Sentry (e.g. git SHA) |
| `SMTP_REPLY_TO` | Reply-To header for customer emails |

## 3. Admin account (required)

If no admin exists yet:

```bash
pnpm setup:admin
```

Follow the prompts. Enable 2FA immediately — the login flow supports TOTP +
backup codes.

## 4. Build & start

```bash
pnpm build
pnpm start
```

The server binds to `PORT` (default 3000). Put a reverse proxy (nginx /
Caddy) in front with HTTPS termination.

## 5. Smoke tests (browser, 10 min)

Go through these in order. Any failure = do not launch.

1. **Home** loads at `/` with products and hero banner.
2. **Admin login** at `/admin/login` — enter credentials, complete 2FA.
3. **Orders tab**: type a customer name or phone in the search box → 300ms
   pause → network tab shows `order.list?input=...query` → filtered results.
4. **Orders pagination**: if you have >50 orders, click "Suivant" — URL stays
   the same but a new page of data loads. "X–Y sur Z commandes" label
   matches.
5. **Customers tab**: `/admin/customers` — data-driven list (empty is fine
   on day 1, it populates from orders). Search + pagination work. Clicking
   a row opens the detail drawer.
6. **Email templates**: `/admin/email-templates` → tweak the confirmation
   subject line → Save → "Envoyer un aperçu" with your email → check inbox
   (or `.dev-emails/*.eml` in dev). Subject should reflect your edit.
7. **Newsletter double opt-in**:
   - Footer signup: submit an email you control.
   - Response UI shows "Vérifiez votre boîte mail..."
   - Inbox: confirmation email arrives with CTA button.
   - Click link → lands on `/api/newsletter/confirm?token=...` → green
     "Inscription confirmée" page.
   - DB check: `SELECT status, confirmationToken, confirmedAt FROM
     newsletter_subscribers WHERE email = 'your@email'` → `SUBSCRIBED`,
     token `NULL`, `confirmedAt` set.
8. **Unsubscribe**: POST `/api/newsletter/unsubscribe` with that email →
   DB row shows `status=UNSUBSCRIBED`, `ip=NULL`, `userAgent=NULL` (PII
   erasure per RGPD).
9. **CMS page edit**: `/admin/pages` → edit a page → try pasting
   `<script>alert(1)</script><p>hi</p>` in body → Save → visit
   `/page/<slug>` → no alert fires, script tag stripped, `hi` paragraph
   visible.
10. **RBAC**: log in as a non-admin account (MANAGER or EDITOR). Verify
    `/admin/navigation`, `/admin/media`, `/admin/theme`, `/admin/integrations`
    either load with write buttons disabled or show the "Not allowed" page,
    but never silently fail.
11. **Sentry** (if configured): trigger any error (e.g. navigate to a bogus
    tRPC route) and confirm it lands in the Sentry dashboard within
    ~30 seconds.

## 6. Post-launch monitoring

- Watch the Sentry project for the first hour — spike of errors = roll back.
- Check `newsletter_subscribers` daily for bounce/complaint patterns.
- Audit log (`/admin/settings/audit-logs`) should show every admin write —
  verify operators can see their own changes reflected there.

## Windows dev setup

The `dev` and `start` scripts now use `cross-env`, so:

```bash
pnpm dev
```

...works on Windows `cmd.exe` and PowerShell, not only bash/WSL. Bash shells
continue to work as well.

## Rollback

Sprint 1 introduced schema changes. If you need to roll back the app code
to before Sprint 1, the new columns/enum value remain in the DB but are
harmless — old code ignores them. You do NOT need to drop columns.
