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
- Creator sell screen has a cleaner Unlockt-style Add Media flow with a softer plus action, centered price pill, quieter spacing, and a shorter no-scroll mobile layout.
- Creator sell price pill is now smaller, less clunky, and keeps cents/last digits visible while typing.
- Creator price entry now behaves like a mobile money keypad: typing `5` shows `$0.05`, `50` shows `$0.50`, and `500` shows `$5.00`.
- Creator price entry now auto-sizes the white price pill from compact to wider as the typed amount grows and shows `You will receive $X.XX` under the field using the 90% creator payout.
- Stripe Checkout now creates invoice lines for the content price plus a separate 15% `Privacy & security fees` buyer fee, while keeping the creator-side platform commission at 10%.
- Stripe Checkout now accepts multiple drops from the same creator in one session, applies the same 10%/20%/30% bundle discount tiers shown in the checkout UI, and records each purchased drop into the fan library.
- Creator profile launch checklist is now collapsible and uses a softer completed check badge instead of a filled green circle.
- Profile settings FAQ now opens in-place inside the modal instead of navigating users away from the creator dashboard.
- Generated storefront, fan discover, and paid drop links now use `https://vaultd.me` even when the site is previewed on localhost.
- Local preview Generate Link now publishes a local drop instead of failing against protected upload routes; real signed-in sessions still use the backend upload API.
- Fan discover no longer shows a redundant `Refresh feed` button.
- Logged-out fan brand/icon clicks now return to the public landing page.
- Stripe payout modal now clarifies that creators connect their own Stripe payout account and Stripe keeps bank/identity details.
- Creator profile now uses a cleaner mobile-first layout with a large `My profile` heading, compact settings button, rounded avatar, softer bundle card, collapsed launch checklist, and polished empty links state.
- Creator profile received a more premium reference-style pass: balanced title size, true circular avatar, camera badge on the avatar edge, visible creator bio, no stats row in the hero, pill action buttons, and creator setup ordered as bundle discounts, launch checklist, then links.
- Existing logged-in creators who have not confirmed age now get a clear `Confirm age` modal, launch checklist item, and Profile settings row before publishing; backend exposes `POST /api/auth/confirm-age`.
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

## Latest Fix Notes
- Creator email sign-in now validates on the client and in `api.js`; blank or malformed emails should show `Enter a valid email to sign in.` and must not create a demo-looking account.
- `?preview=upload` is not enough to create the local demo session anymore. Use `?preview=upload&demo=1` only when intentionally testing the creator upload screen with demo data.
- Localhost Generate Link now falls back to a local preview link when the backend returns a generic storage/server failure. On `vaultd.me`, a Generate Link failure still means the host needs the real backend/storage issue fixed instead of hidden.
- Buyer links now use the short public format `https://vaultd.me/l/<code>`. The server redirects `/l/:dropRef` to the fan storefront and resolves short refs in `/api/drops/:dropId`.
- Checkout and Stripe invoice content rows now read `Purchase Link #<code>` and omit the content item subtitle/description. The separate `Privacy & security fees` row keeps its buyer-protection description.
- Shared single-drop links now render as focused purchase pages modeled after Unlockt-style shared links: media preview first, creator/message context, purchase trust cues, no top promo/icon-menu, and a sticky bottom purchase bar with `Unlock now`. The `Apple Pay` action is conditional and only appears when the browser reports Apple Pay support; normal storefront cards now use one `Unlock now` action instead of a separate Preview button.
- Shared creator profile pages now open as polished public storefront profiles with a centered avatar, bio, big green `Message` button, and locked drops below.
- Fan-to-creator messaging is backed by `POST /api/storefront/:handle/messages`, the new `creator_messages` table, and a creator email notification when Resend is configured.
- Creator Sell price UI now includes the live creator payout line below the amount and no longer relies on shrinking text to avoid clipping.

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

The latest schema also adds `creator_messages`; rerun `db/schema.sql` or apply that table/index before deploying the Message button live.

## Safety
Do not deploy:

```text
.env
node_modules/
.git/
reference_media/
_video_review/
```
