import Stripe from "stripe";
import { config } from "../config.js";

export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

function requireStripe() {
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe;
}

export async function createConnectedAccount({ email, country = "US" }) {
  const client = requireStripe();
  return client.accounts.create({
    type: "express",
    country,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

export async function createConnectOnboardingLink(accountId) {
  const client = requireStripe();
  return client.accountLinks.create({
    account: accountId,
    refresh_url: config.stripe.connectRefreshUrl,
    return_url: config.stripe.connectReturnUrl,
    type: "account_onboarding",
  });
}

function checkoutBundleDiscountRate(count) {
  if (count >= 4) return 0.3;
  if (count === 3) return 0.2;
  if (count === 2) return 0.1;
  return 0;
}

function dropContentAmountCents(drop, discountRate = 0) {
  const baseAmount = Math.round(Number(drop.price) * 100);
  const downloadExtraPercent =
    drop.download === "extra" ? Math.max(0, Math.min(100, Number(drop.download_extra_percent) || 0)) : 0;
  const contentAmount = Math.round(baseAmount * (1 + downloadExtraPercent / 100));
  return Math.max(50, Math.round(contentAmount * (1 - discountRate)));
}

function dropPublicRef(dropId) {
  const clean = String(dropId || "").trim().replace(/^drop[_-]?/i, "");
  return (clean || String(dropId || "link")).slice(0, 10).toLowerCase();
}

function checkoutItemName(drop) {
  return `Purchase Link #${dropPublicRef(drop.id)}`;
}

export async function createCheckoutSession({ drop, drops = [], buyerEmail, successUrl, cancelUrl }) {
  const client = requireStripe();
  const feePercent = Math.max(0, Math.min(80, config.stripe.platformFeePercent));
  const customerFeePercent = Math.max(0, Math.min(80, config.stripe.customerPrivacySecurityFeePercent));
  const checkoutDrops = drops.length ? drops : [drop];
  const discountRate = checkoutBundleDiscountRate(checkoutDrops.length);
  const dropAmounts = Object.fromEntries(
    checkoutDrops.map((item) => [item.id, dropContentAmountCents(item, discountRate)]),
  );
  const contentAmount = Object.values(dropAmounts).reduce((total, amount) => total + amount, 0);
  const privacySecurityFeeAmount = Math.round(contentAmount * (customerFeePercent / 100));
  const applicationFeeAmount = Math.round(contentAmount * (feePercent / 100)) + privacySecurityFeeAmount;
  const primaryDrop = checkoutDrops[0];
  const paymentIntentData = primaryDrop.stripe_account_id
    ? {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: primaryDrop.stripe_account_id,
        },
      }
    : undefined;

  return client.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      drop_id: primaryDrop.id,
      drop_ids: JSON.stringify(checkoutDrops.map((item) => item.id)),
      drop_amounts: JSON.stringify(dropAmounts),
      creator_id: primaryDrop.creator_id,
      buyer_id: primaryDrop.buyer_id || "",
      content_amount_cents: String(contentAmount),
      privacy_security_fee_cents: String(privacySecurityFeeAmount),
      customer_fee_percent: String(customerFeePercent),
      platform_fee_percent: String(feePercent),
      application_fee_cents: String(applicationFeeAmount),
      bundle_discount_percent: String(Math.round(discountRate * 100)),
    },
    payment_intent_data: paymentIntentData,
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: "Vault'd permanent unlock",
      },
    },
    line_items: [
      ...checkoutDrops.map((item) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: dropAmounts[item.id],
          product_data: {
            name: checkoutItemName(item),
          },
        },
      })),
      privacySecurityFeeAmount
        ? {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: privacySecurityFeeAmount,
              product_data: {
                name: "Privacy & security fees",
                description: "Buyer protection, private access, and secure delivery for this unlock.",
              },
            },
          }
        : null,
    ].filter(Boolean),
  });
}

export function constructWebhookEvent(rawBody, signature) {
  const client = requireStripe();
  return client.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}
