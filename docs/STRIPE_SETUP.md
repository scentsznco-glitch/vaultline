# Stripe Setup

Do not share your Stripe password, browser session, or unrestricted live secret key in chat. If someone else needs to help, invite them through Stripe team access with the smallest permissions that work.

## Environment Values

```text
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLATFORM_FEE_PERCENT=10
STRIPE_CONNECT_REFRESH_URL=https://vaultd.me/stripe/refresh
STRIPE_CONNECT_RETURN_URL=https://vaultd.me/stripe/return
```

## Test Mode First

1. Open the Stripe Dashboard in test mode.
2. Copy the publishable key and secret key into `.env`.
3. Enable Connect.
4. Configure Connect branding, business profile, payout statement descriptor, and payout settings.
5. Run the backend locally and confirm `/api/health` has no Stripe missing values.

## Webhooks

Add an endpoint after the backend is deployed:

```text
https://your-domain.com/api/webhooks/stripe
```

Listen for:

```text
checkout.session.completed
account.updated
charge.refunded
charge.dispute.created
```

Copy that webhook endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

## What The Server Does

- `POST /api/creator/connect/onboarding` creates a Stripe Express connected account and returns an onboarding URL.
- `POST /api/checkout/session` creates a Checkout Session for a permanent unlock.
- `POST /api/webhooks/stripe` verifies the webhook signature, creates entitlements, updates payout readiness, and revokes access on refunds/disputes.

## Live Mode Checklist

- Test Checkout completes.
- Webhook creates a purchase and entitlement.
- Fan download fails before payment and works after payment.
- Refund or dispute revokes access.
- Creator Connect account shows charges and payouts enabled.
- Your platform fee is correct.
- Refund/dispute/support policies are published.

Official references:

- Stripe API keys: https://docs.stripe.com/keys
- Stripe Connect webhooks: https://docs.stripe.com/connect/webhooks
