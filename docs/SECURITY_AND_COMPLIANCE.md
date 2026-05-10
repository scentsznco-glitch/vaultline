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

- Terms of Service
- Privacy Policy
- Content Policy
- Refund Policy
- DMCA/Takedown Policy
- Creator payout rules
- Buyer support/refund instructions

## Moderation

The schema includes `reports`, `support_tickets`, `operations`, and `audit_logs`. The backend exposes admin routes for reports and support tickets. Build an admin UI before scaling beyond trusted testers.

Admin work to add before public launch:

- Review reported drops.
- Remove content.
- Suspend creators.
- Handle support tickets.
- Watch disputes/refunds.
- Export audit logs.
- Document prohibited content and enforcement.

Official references:

- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase signed downloads: https://supabase.com/docs/guides/storage/serving/downloads
