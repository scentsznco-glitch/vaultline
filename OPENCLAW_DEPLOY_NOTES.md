# Vault'd OpenClaw Deploy Notes

## Goal
Deploy the latest Vault'd local changes from this folder to the live site at:

https://vaultd.me

## What Changed Since The Earlier Live Build
- Landing page polish, stronger copy, creator/fan flow section, and FAQ.
- Public landing logo restored to the clean `Vault'd` wordmark only.
- Creator and fan dashboards use a local custom vault-door brand mark.
- Fan discover page has a clearer logged-out browse/sign-up flow.
- Fan checkout is now a full-screen mobile flow with an order summary, 15% `Privacy & security fees`, related add-on drops, bundle discount progress, and a sticky `Proceed to pay` bar.
- Creator sell screen has a compact Unlockt-style price pill and a shorter no-scroll mobile layout.
- Stripe Checkout now creates invoice lines for the content price plus a separate 15% `Privacy & security fees` buyer fee, while keeping the creator-side platform commission at 10%.
- Stripe Checkout now accepts multiple drops from the same creator in one session, applies the same 10%/20%/30% bundle discount tiers shown in the checkout UI, and records each purchased drop into the fan library.
- Creator profile launch checklist is now collapsible and uses a softer completed check badge instead of a filled green circle.
- Profile settings FAQ now opens in-place inside the modal instead of navigating users away from the creator dashboard.
- Generated storefront, fan discover, and paid drop links now use `https://vaultd.me` even when the site is previewed on localhost.
- Local preview Generate Link now publishes a local drop instead of failing against protected upload routes; real signed-in sessions still use the backend upload API.
- Fan discover no longer shows a redundant `Refresh feed` button.
- Logged-out fan brand/icon clicks now return to the public landing page.
- Stripe payout modal now clarifies that creators connect their own Stripe payout account and Stripe keeps bank/identity details.
- Production preview mode is now guarded: `?preview=upload` only works on localhost/file previews, and the server strips it in production.
- Public policy center added at `/policies.html` with Terms, Privacy, Content Policy, Refunds, DMCA/Takedown, Payout Rules, and Buyer Support.
- Private admin console added at `/admin.html` for launch readiness, report review, and support ticket moderation.
- Age confirmation is now required during creator email sign-in and fan phone sign-up; publishing, Stripe onboarding, and checkout require an active age-confirmed account.
- Admin moderation now supports hiding/restoring reported drops, suspending/unsuspending creators, revoking purchase entitlements, and reviewing audit logs.
- API hardening added route-level rate limits, safer session parsing, suspended-user checks, and public filtering for suspended creators.
- `Fan sign up` is visible and readable in the mobile landing header.
- App and fan pages load Lucide from `assets/lucide.min.js` instead of an external CDN.
- `.env.example` now uses `vaultd.me` and includes Twilio placeholders.

## Must Include These Files
The deploy must include the entire `assets/` folder, especially:

```text
assets/lucide.min.js
assets/avatar-tile.svg
assets/profile-cover.svg
assets/thumb-course.svg
assets/thumb-download.svg
assets/thumb-gallery.svg
assets/thumb-video.svg
```

If `assets/lucide.min.js` is missing, nearly all UI icons in `app.html` and `fan.html` will be blank.

## Deploy Command
The app is a Node/Express app:

```bash
npm install
npm start
```

Start command:

```bash
node server/index.js
```

## Required Production Environment
Use the existing live secrets in the hosting dashboard. Do not copy `.env` into Git.

Public values should be:

```env
NODE_ENV=production
PUBLIC_BASE_URL=https://vaultd.me
ALLOWED_ORIGINS=https://vaultd.me
STRIPE_CONNECT_REFRESH_URL=https://vaultd.me/stripe/refresh
STRIPE_CONNECT_RETURN_URL=https://vaultd.me/stripe/return
STRIPE_PLATFORM_FEE_PERCENT=10
STRIPE_CUSTOMER_PRIVACY_SECURITY_FEE_PERCENT=15
EMAIL_FROM=Vault'd <no-reply@vaultd.me>
SUPPORT_EMAIL=support@vaultd.me
```

Secrets still need to exist on the host:

```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
SUPABASE_STORAGE_BUCKET
JWT_SECRET
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
ADMIN_EMAILS
```

## After Deploy
Check:

```text
https://vaultd.me/api/health
```

Expected:
- `service` is `vaultd`
- `launchConfigMissing` is empty or only lists intentionally disabled optional providers.

Also visually check:
- `https://vaultd.me/`
- `https://vaultd.me/fan.html?discover=1#discover`
- `https://vaultd.me/app.html#create`
- `https://vaultd.me/admin.html`

Before testing new accounts, rerun `db/schema.sql` or at least apply the latest `users` columns:

```sql
alter table users add column if not exists age_confirmed_at timestamptz;
alter table users add column if not exists suspended_at timestamptz;
alter table users add column if not exists suspension_reason text;
```

## Safety
Do not deploy:

```text
.env
node_modules/
.git/
reference_media/
_video_review/
```
