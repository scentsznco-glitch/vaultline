# Security and Compliance Notes

## Never Store

- Stripe passwords or browser sessions
- Card numbers or bank logins
- Raw identity documents
- Social Security numbers
- Plaintext passwords
- Permanent public URLs for locked media

## Store Instead

- Stripe customer IDs
- Stripe connected account IDs
- Stripe session/payment IDs
- Age confirmation timestamp
- Account suspension timestamp/reason
- Purchase IDs
- Entitlement rows
- Private storage object paths
- Provider verification status
- Report/support ticket records

## Locked Media Rules

- Keep the Supabase bucket private.
- Store private object paths in `drop_media.storage_path`.
- Only the server should create signed upload or download URLs.
- Download URLs should expire quickly. The current server uses 5 minutes.
- A buyer must have a paid, non-revoked entitlement before any download URL is returned.

## Policies Needed Before Real Payments

- Terms of Service: starter page added at `/policies.html#terms`.
- Privacy Policy: starter page added at `/policies.html#privacy`.
- Content Policy: starter page added at `/policies.html#content`.
- Refund Policy: starter page added at `/policies.html#refunds`.
- DMCA/Takedown Policy: starter page added at `/policies.html#dmca`.
- Creator payout rules: starter page added at `/policies.html#payouts`.
- Buyer support/refund instructions: starter page added at `/policies.html#support`.

These policy pages need legal review and final business/entity details before real public launch.

## Moderation

The schema includes `reports`, `support_tickets`, `operations`, and `audit_logs`. The backend exposes admin routes for reports, support tickets, drop removal/restoration, creator suspension/unsuspension, entitlement revocation, and audit log review. A private admin UI is available at `/admin.html` for launch readiness, reports, support tickets, and audit activity.

Admin work before public launch:

- Test report and support moderation with an account listed in `ADMIN_EMAILS`.
- Test content removal, creator suspension, and entitlement revocation on test records.
- Watch disputes/refunds.
- Export audit logs if you need offline compliance records.
- Document prohibited content and enforcement.

## Age and Abuse Controls

- Creator email sign-in and fan phone sign-up now require a 18+ confirmation.
- The server records `users.age_confirmed_at`.
- Drop publishing, Stripe Connect onboarding, and checkout require an active, age-confirmed account.
- Suspended users are blocked from authenticated API actions.
- Public storefront/discover/drop reads hide suspended creators.
- Basic in-memory rate limits protect auth, write, checkout, support/report, and admin routes. Production hosting should still add edge/WAF rate limits.

Official references:

- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase signed downloads: https://supabase.com/docs/guides/storage/serving/downloads
