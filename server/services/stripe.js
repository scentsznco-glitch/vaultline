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

export async function createCheckoutSession({ drop, buyerEmail, successUrl, cancelUrl }) {
  const client = requireStripe();
  const feePercent = Math.max(0, Math.min(80, config.stripe.platformFeePercent));
  const unitAmount = Math.round(Number(drop.price) * 100);
  const applicationFeeAmount = Math.round(unitAmount * (feePercent / 100));
  const paymentIntentData = drop.stripe_account_id
    ? {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: drop.stripe_account_id,
        },
      }
    : undefined;

  return client.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      drop_id: drop.id,
      creator_id: drop.creator_id,
      buyer_id: drop.buyer_id || "",
    },
    payment_intent_data: paymentIntentData,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: drop.title,
            description: "Permanent Vaultline unlock",
          },
        },
      },
    ],
  });
}

export function constructWebhookEvent(rawBody, signature) {
  const client = requireStripe();
  return client.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}
