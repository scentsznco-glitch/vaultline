# Vaultline Mobile Site Launch Runbook

This folder now has the polished mobile web prototype plus a real Node/Express launch scaffold under `server/`. The goal is to make the site ready for your own provider keys, not to store any passwords or Stripe login sessions in the repo.

## The 8 Launch Tasks

1. Backend and API
   - Done: `server/index.js` exposes auth, creator profile, drop creation, checkout, library downloads, reports, support, and admin launch routes.
   - You still need: deploy the Node server somewhere with HTTPS.

2. Database
   - Done: `db/schema.sql` defines users, creator/fan profiles, drops, media, purchases, permanent entitlements, reports, support tickets, operations, and audit logs.
   - You still need: create a Supabase project and run the SQL file.

3. Protected Uploads and Storage
   - Done: creators get signed upload URLs; buyers only get signed download URLs after entitlement checks.
   - You still need: create a private Supabase Storage bucket named `locked-media`.

4. Payments and Payouts
   - Done: Stripe Checkout and Stripe Connect Express onboarding are wired in `server/services/stripe.js`.
   - You still need: add your Stripe keys and Connect settings. Do not give anyone your Stripe password.

5. Permanent Unlocks
   - Done: paid purchases create `entitlements`; unlocks do not expire. Refunds and disputes revoke the entitlement from webhook events.
   - You still need: test purchase, unlock, refund, and dispute flows in Stripe test mode.

6. Email and Receipts
   - Done: verification emails, purchase receipts, and support notices are scaffolded through Resend.
   - You still need: verify your sending domain and add `RESEND_API_KEY`.

7. Identity, Compliance, and Safety
   - Done: creator payout readiness is tracked from Stripe account updates; reports and support tickets are stored.
   - You still need: publish Terms, Privacy, Content Policy, Refund Policy, and DMCA/Takedown pages before accepting real payments.

8. Fan Library and Admin Operations
   - Done: fans can list library purchases and request protected downloads; admins can inspect launch readiness, reports, and support tickets.
   - You still need: build a private admin screen when you are ready to moderate from a UI instead of API calls.

## Local Setup

Use `npm.cmd` in PowerShell because Windows may block `npm.ps1`.

```powershell
copy .env.example .env
npm.cmd install
npm.cmd run check
npm.cmd run dev
```

Open the local site:

```text
http://localhost:8787/index.html
http://localhost:8787/fan.html
```

Health check:

```text
http://localhost:8787/api/health
```

## Environment Values

Fill these in `.env` after creating your provider accounts:

```text
PUBLIC_BASE_URL=https://vaultline.me
ALLOWED_ORIGINS=https://vaultline.me,http://localhost:8787,http://127.0.0.1:8787
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_STORAGE_BUCKET=locked-media
JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLATFORM_FEE_PERCENT=10
RESEND_API_KEY=
EMAIL_FROM=Vaultline <no-reply@vaultline.me>
SUPPORT_EMAIL=support@vaultline.me
ADMIN_EMAILS=you@example.com
```

## Provider Setup Order

1. Supabase: create project, run `db/schema.sql`, create private `locked-media` bucket.
2. Resend: verify your domain, create an API key, set `EMAIL_FROM`.
3. Stripe test mode: copy test keys, enable Connect, configure branding.
4. Stripe webhooks: point a webhook to `/api/webhooks/stripe`.
5. Local test: run `npm.cmd run dev`, create a test creator, create a drop, buy it as a fan.
6. Deploy: set all environment values in your host, then test again on HTTPS.
7. Live mode: switch Stripe keys only after the full test checklist passes.

## Stripe Webhook Events

Register these events:

```text
checkout.session.completed
account.updated
charge.refunded
charge.dispute.created
```

## Launch Test Checklist

- Email verification link works.
- Creator Connect onboarding opens.
- Creator payout readiness updates after Stripe completes onboarding.
- Creator can create a drop with at least one media item.
- Media uploads to the private bucket.
- Fan can pay with Stripe Checkout.
- Webhook creates purchase and permanent entitlement.
- Fan library shows the unlocked purchase.
- Fan download route returns a short-lived signed URL only after purchase.
- Refund or dispute revokes access.
- Report flow stores a report.
- Support flow stores a ticket and sends a notice.
- Admin email can view `/api/admin/launch`.

## Official Setup References

- Stripe API keys: https://docs.stripe.com/keys
- Stripe Connect webhooks: https://docs.stripe.com/connect/webhooks
- Supabase private storage buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase signed downloads: https://supabase.com/docs/guides/storage/serving/downloads
- Resend domain/API key setup: https://resend.com/docs/ai-onboarding
