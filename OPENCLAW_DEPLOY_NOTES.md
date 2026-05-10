# Vault'd OpenClaw Deploy Notes

## Goal
Deploy the latest Vault'd local changes from this folder to the live site at:

https://vaultd.me

## What Changed Since The Earlier Live Build
- Landing page polish, stronger copy, creator/fan flow section, and FAQ.
- Public landing logo restored to the clean `Vault'd` wordmark only.
- Creator and fan dashboards use a local custom vault-door brand mark.
- Fan discover page has a clearer logged-out browse/sign-up flow.
- Creator sell screen has guidance cards for permanent unlocks, public/unlisted drops, and wallet tracking.
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

## Safety
Do not deploy:

```text
.env
node_modules/
.git/
reference_media/
_video_review/
```
