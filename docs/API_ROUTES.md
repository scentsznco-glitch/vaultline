# API Routes

Base URL locally:

```text
http://localhost:8787
```

## Public

- `GET /api/health` checks configuration readiness.
- `POST /api/auth/start` starts a creator or fan session and sends email verification. Body must include `ageConfirmed: true`.
- `POST /api/auth/phone/start` starts fan phone verification. Body must include `ageConfirmed: true`.
- `POST /api/auth/phone/verify` verifies the phone code.
- `GET /api/auth/verify?token=...` verifies email.
- `GET /api/drops/:dropId` reads a public drop preview.
- `POST /api/support/tickets` creates a support ticket.

## Creator

- `POST /api/creator/profile` saves handle and bio.
- `POST /api/creator/connect/onboarding` creates Stripe Connect onboarding.
- `POST /api/drops` creates a locked drop and returns signed upload URLs.
- `GET /api/creator/drops` lists creator drops.

## Fan

- `POST /api/checkout/session` starts Stripe Checkout. Checkout includes the content price plus a separate 15% `Privacy & security fees` line for the buyer.
- `GET /api/library` lists paid permanent unlocks.
- `GET /api/library/:purchaseId/download` returns signed download URLs after entitlement checks.
- `POST /api/reports` reports a drop.

## Stripe

- `POST /api/webhooks/stripe` receives verified Stripe webhook events.

## Admin

Set `ADMIN_EMAILS` in `.env`.

- `GET /admin.html` opens the private launch and moderation screen.
- `GET /api/admin/launch` shows launch readiness.
- `GET /api/admin/reports` lists reports.
- `POST /api/admin/reports/:reportId` updates report status.
- `POST /api/admin/reports/:reportId/moderation` supports `remove_drop`, `restore_drop`, `suspend_creator`, and `unsuspend_creator`.
- `GET /api/admin/support/tickets` lists support tickets.
- `POST /api/admin/support/tickets/:ticketId` updates support ticket status.
- `POST /api/admin/purchases/:purchaseId/revoke` revokes a fan entitlement.
- `GET /api/admin/audit-logs` lists recent moderation/audit activity.
