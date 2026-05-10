import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { z } from "zod";
import { config, assertLaunchConfig } from "./config.js";
import {
  addDropMedia,
  createEmailVerification,
  createDrop,
  createPurchase,
  createReport,
  createSupportTicket,
  createUser,
  deleteDropById,
  getCreatorProfile,
  getEntitledDrop,
  getEntitledMedia,
  getPublicDrop,
  getUserByEmail,
  getStorefrontByHandle,
  listDiscoverStorefronts,
  listCreatorDrops,
  listLibrary,
  listReports,
  listSupportTickets,
  markPurchaseStatusBySession,
  touchLogin,
  updateCreatorPayoutStatus,
  updateDropStatus,
  updateReportStatus,
  updateSupportTicketStatus,
  upsertCreatorProfile,
  verifyEmailToken,
} from "./data.js";
import { sendReceiptEmail, sendSupportNotice, sendVerificationEmail } from "./services/email.js";
import { createDownloadUrl, createUploadUrl, mediaPath } from "./services/storage.js";
import { constructWebhookEvent, createCheckoutSession, createConnectedAccount, createConnectOnboardingLink, stripe } from "./services/stripe.js";
import { hashToken, id, requireAdmin, requireUser, signSession } from "./services/security.js";
import { sendPhoneCode, checkPhoneCode } from "./services/twilio.js";

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://*.supabase.co", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      },
    },
  }),
);
const allowedOrigins = new Set([config.publicBaseUrl, ...config.allowedOrigins]);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed"));
    },
    credentials: true,
  }),
);
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static("."));

function ok(response, data = {}) {
  response.json({ ok: true, ...data });
}

function route(handler) {
  return async (request, response) => {
    try {
      await handler(request, response);
    } catch (error) {
      console.error('[route error]', error?.message || error);
      const message = config.env === "production" ? "Request failed" : error.message;
      response.status(400).json({ ok: false, error: message });
    }
  };
}

const emailSchema = z.string().email().max(120).transform((value) => value.toLowerCase());
const dropAccessSchema = z.preprocess((value) => {
  const normalized = String(value || "everyone").toLowerCase();
  return normalized === "svip" ? "svip" : normalized === "unlisted" ? "unlisted" : "everyone";
}, z.enum(["everyone", "unlisted", "svip"]));
const dropDownloadSchema = z.preprocess((value) => {
  const normalized = String(value || "allowed").toLowerCase();
  if (normalized.includes("charge") || normalized === "extra") return "extra";
  if (normalized.includes("not") || normalized === "blocked") return "blocked";
  return "allowed";
}, z.enum(["allowed", "extra", "blocked"]));

app.get("/api/health", (request, response) => {
  ok(response, {
    service: "vaultd",
    launchConfigMissing: assertLaunchConfig(),
  });
});

app.post(
  "/api/auth/start",
  route(async (request, response) => {
    const body = z.object({ email: emailSchema, role: z.enum(["creator", "fan"]).default("fan") }).parse(request.body);
    let user = await getUserByEmail(body.email);
    if (!user) user = await createUser({ email: body.email, role: body.role });
    await touchLogin(user.id);

    const token = signSession({ id: user.id, email: user.email, role: user.role });
    response.cookie("vaultline_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.env === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    const verifyToken = id("verify");
    await createEmailVerification({
      userId: user.id,
      tokenHash: hashToken(verifyToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    });
    const verifyUrl = `${config.publicBaseUrl}/api/auth/verify?token=${verifyToken}`;
    await sendVerificationEmail(user, verifyUrl);
    ok(response, { user: { id: user.id, email: user.email, role: user.role }, verifyUrl });
  }),
);

app.get(
  "/api/auth/me",
  requireUser,
  route(async (request, response) => {
    ok(response, { user: { id: request.user.id, email: request.user.email, role: request.user.role } });
  }),
);

// ── Phone OTP auth ───────────────────────────────────────────────────────────
const phoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, "Must be E.164 format, e.g. +12125551234");

app.post(
  "/api/auth/phone/start",
  route(async (request, response) => {
    const body = z.object({
      phone: phoneSchema,
      role: z.enum(["creator", "fan"]).default("fan"),
    }).parse(request.body);

    await sendPhoneCode(body.phone);

    // Look up or create the user now so they get a session after verify
    let user = await getUserByEmail(`${body.phone}@phone.vaultline`);
    if (!user) user = await createUser({ email: `${body.phone}@phone.vaultline`, role: body.role });
    await touchLogin(user.id);

    ok(response, { status: "pending" });
  }),
);

app.post(
  "/api/auth/phone/verify",
  route(async (request, response) => {
    const body = z.object({
      phone: phoneSchema,
      code: z.string().min(4).max(10),
    }).parse(request.body);

    const status = await checkPhoneCode(body.phone, body.code);
    if (status !== "approved") {
      response.status(400).json({ ok: false, error: "Incorrect or expired code" });
      return;
    }

    const user = await getUserByEmail(`${body.phone}@phone.vaultline`);
    if (!user) {
      response.status(400).json({ ok: false, error: "User not found — try signing up again" });
      return;
    }

    // Mark verified and issue session cookie
    const token = signSession({ id: user.id, email: user.email, role: user.role });
    response.cookie("vaultline_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.env === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    ok(response, { user: { id: user.id, role: user.role } });
  }),
);

app.post(
  "/api/auth/logout",
  route(async (request, response) => {
    response.clearCookie("vaultline_session");
    ok(response);
  }),
);

app.get(
  "/api/auth/verify",
  route(async (request, response) => {
    const token = z.string().min(10).parse(request.query.token);
    const user = await verifyEmailToken(hashToken(token));
    if (!user) {
      response.redirect(`${config.publicBaseUrl}/app.html?auth=invalid`);
      return;
    }
    // Redirect to app after successful verification
    response.redirect(`${config.publicBaseUrl}/app.html?auth=verified`);
  }),
);

app.post(
  "/api/creator/profile",
  requireUser,
  route(async (request, response) => {
    const body = z
      .object({
        handle: z.string().min(2).max(32).regex(/^[a-z0-9_]+$/),
        bio: z.string().max(160).default(""),
      })
      .parse(request.body);
    const profile = await upsertCreatorProfile({ userId: request.user.id, handle: body.handle, bio: body.bio });
    ok(response, { profile });
  }),
);

app.get(
  "/api/creator/profile",
  requireUser,
  route(async (request, response) => {
    const profile = await getCreatorProfile({ userId: request.user.id });
    ok(response, { profile: profile || null });
  }),
);

app.post(
  "/api/creator/connect/onboarding",
  requireUser,
  route(async (request, response) => {
    // Re-use existing stripe account if creator already has one
    let profile = await getCreatorProfile({ userId: request.user.id });
    let stripeAccountId = profile?.stripe_account_id;
    if (!stripeAccountId) {
      const account = await createConnectedAccount({ email: request.user.email });
      stripeAccountId = account.id;
      await upsertCreatorProfile({
        userId: request.user.id,
        handle: profile?.handle || request.user.email.split("@")[0],
        bio: profile?.bio || "",
        stripeAccountId,
      });
    }
    const link = await createConnectOnboardingLink(stripeAccountId);
    ok(response, { url: link.url, stripeAccountId });
  }),
);

app.get(
  "/api/creator/connect/status",
  requireUser,
  route(async (request, response) => {
    const profile = await getCreatorProfile({ userId: request.user.id });
    if (!profile?.stripe_account_id) {
      ok(response, { connected: false, chargesEnabled: false, payoutsEnabled: false });
      return;
    }
    ok(response, {
      connected: true,
      chargesEnabled: Boolean(profile.charges_enabled),
      payoutsEnabled: Boolean(profile.payouts_enabled),
      identityStatus: profile.identity_status || "pending",
      stripeAccountId: profile.stripe_account_id,
    });
  }),
);

// Stripe Connect return/refresh redirects
app.get("/stripe/return", (request, response) => {
  response.redirect("/app.html?stripe_return=true");
});

app.get("/stripe/refresh", (request, response) => {
  response.redirect("/app.html?stripe_refresh=true");
});

app.post(
  "/api/drops",
  requireUser,
  route(async (request, response) => {
    const body = z
      .object({
        title: z.string().min(1).max(80),
        description: z.string().max(500).default(""),
        price: z.number().min(5).max(5000),
        access: dropAccessSchema.default("everyone"),
        download: dropDownloadSchema.default("allowed"),
        downloadExtraPercent: z.number().int().min(0).max(100).default(0),
        media: z
          .array(
            z.object({
              fileName: z.string().max(160),
              fileType: z.string().max(80),
            }),
          )
          .min(1),
      })
      .parse(request.body);

    const drop = await createDrop({
      creatorId: request.user.id,
      title: body.title,
      description: body.description,
      price: body.price,
      access: body.access,
      download: body.download,
      downloadExtraPercent: body.downloadExtraPercent,
    });

    const uploads = [];
    for (const [index, file] of body.media.entries()) {
      const path = mediaPath({ creatorId: request.user.id, dropId: drop.id, fileName: file.fileName });
      const signed = await createUploadUrl({ path, contentType: file.fileType });
      await addDropMedia({ dropId: drop.id, path, fileType: file.fileType, fileName: file.fileName, sortOrder: index });
      uploads.push({ fileName: file.fileName, path, ...signed });
    }

    ok(response, { drop, uploads });
  }),
);

app.get(
  "/api/creator/drops",
  requireUser,
  route(async (request, response) => {
    const drops = await listCreatorDrops({ creatorId: request.user.id });
    ok(response, { drops });
  }),
);

app.get(
  "/api/discover",
  route(async (request, response) => {
    const limit = z.coerce.number().int().min(1).max(100).default(60).parse(request.query.limit ?? 60);
    const creators = await listDiscoverStorefronts({ limit });
    ok(response, { creators });
  }),
);

app.get(
  "/api/storefront/:handle",
  route(async (request, response) => {
    const handle = z.string().min(2).max(32).parse(request.params.handle);
    const data = await getStorefrontByHandle(handle);
    if (!data) {
      response.status(404).json({ ok: false, error: "Creator not found" });
      return;
    }
    ok(response, data);
  }),
);

app.get(
  "/api/drops/:dropId",
  route(async (request, response) => {
    const drop = await getPublicDrop(request.params.dropId);
    if (!drop) {
      response.status(404).json({ ok: false, error: "Drop not found" });
      return;
    }
    ok(response, { drop });
  }),
);

app.patch(
  "/api/drops/:dropId",
  requireUser,
  route(async (request, response) => {
    const body = z
      .object({ status: z.enum(["active", "expired"]) })
      .parse(request.body);
    const drop = await updateDropStatus({
      dropId: request.params.dropId,
      creatorId: request.user.id,
      status: body.status,
    });
    ok(response, { drop });
  }),
);

app.delete(
  "/api/drops/:dropId",
  requireUser,
  route(async (request, response) => {
    await deleteDropById({ dropId: request.params.dropId, creatorId: request.user.id });
    ok(response, { deleted: true });
  }),
);

app.get(
  "/api/library",
  requireUser,
  route(async (request, response) => {
    const items = await listLibrary({ buyerId: request.user.id });
    ok(response, { items });
  }),
);

app.post(
  "/api/checkout/session",
  requireUser,
  route(async (request, response) => {
    const body = z.object({ dropId: z.string().min(1) }).parse(request.body);
    const drop = await getPublicDrop(body.dropId);
    if (!drop) {
      response.status(404).json({ ok: false, error: "Drop not found" });
      return;
    }
    if (drop.access === "svip") {
      response.status(403).json({ ok: false, error: "VIP-only drops are not available yet" });
      return;
    }
    const creatorHandle = drop.creator_profiles?.handle;
    const session = await createCheckoutSession({
      drop: {
        ...drop,
        buyer_id: request.user.id,
        stripe_account_id: drop.creator_profiles?.stripe_account_id,
      },
      buyerEmail: request.user.email,
      successUrl: `${config.publicBaseUrl}/fan.html#library`,
      cancelUrl: creatorHandle
        ? `${config.publicBaseUrl}/fan.html?handle=${encodeURIComponent(creatorHandle)}#store`
        : `${config.publicBaseUrl}/fan.html?discover=1#discover`,
    });
    ok(response, { checkoutUrl: session.url, sessionId: session.id });
  }),
);

app.post(
  "/api/webhooks/stripe",
  route(async (request, response) => {
    const signature = request.headers["stripe-signature"];
    const event = constructWebhookEvent(request.body, signature);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const buyerId = session.metadata?.buyer_id;
      const dropId = session.metadata?.drop_id;
      if (buyerId && dropId) {
        await createPurchase({
          buyerId,
          dropId,
          stripeSessionId: session.id,
          amount: (session.amount_total || 0) / 100,
        });
        if (session.customer_email) {
          await sendReceiptEmail({
            to: session.customer_email,
            title: "Vault'd unlock",
            amount: `$${((session.amount_total || 0) / 100).toFixed(2)}`,
            libraryUrl: `${config.publicBaseUrl}/fan.html#library`,
          });
        }
      }
    }

    if (event.type === "account.updated") {
      const account = event.data.object;
      await updateCreatorPayoutStatus({
        stripeAccountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        identityStatus: account.requirements?.currently_due?.length ? "needs_information" : "verified",
      });
    }

    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge = event.data.object;
      const sessions = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
      const session = sessions.data[0];
      if (session?.id) {
        await markPurchaseStatusBySession({
          stripeSessionId: session.id,
          status: event.type === "charge.refunded" ? "refunded" : "disputed",
          reason: event.type,
        });
      }
    }

    ok(response);
  }),
);

app.get(
  "/api/library/:purchaseId/download",
  requireUser,
  route(async (request, response) => {
    const drop = await getEntitledDrop({ buyerId: request.user.id, purchaseId: request.params.purchaseId });
    if (drop?.download === "blocked") {
      response.status(403).json({ ok: false, error: "Downloads are disabled for this drop" });
      return;
    }
    const media = drop?.drop_media || [];
    if (!media.length) {
      response.status(403).json({ ok: false, error: "No permanent unlock found" });
      return;
    }
    const files = await Promise.all(media.map(async (item) => ({ fileName: item.file_name, url: await createDownloadUrl(item.storage_path) })));
    ok(response, { files });
  }),
);

app.post(
  "/api/reports",
  requireUser,
  route(async (request, response) => {
    const body = z.object({ dropId: z.string(), reason: z.string().min(3).max(80), details: z.string().max(1000).default("") }).parse(request.body);
    const report = await createReport({ reporterId: request.user.id, dropId: body.dropId, reason: body.reason, details: body.details });
    ok(response, { report });
  }),
);

app.post(
  "/api/support/tickets",
  route(async (request, response) => {
    const body = z.object({ email: emailSchema, subject: z.string().min(3).max(120), message: z.string().min(5).max(2000) }).parse(request.body);
    const ticket = await createSupportTicket({ userId: request.user?.id, ...body });
    await sendSupportNotice(ticket);
    ok(response, { ticket });
  }),
);

app.get(
  "/api/admin/launch",
  requireUser,
  requireAdmin,
  route(async (request, response) => {
    ok(response, {
      missing: assertLaunchConfig(),
      stripeConfigured: Boolean(stripe),
      checks: [
        "database",
        "protected-storage",
        "stripe-checkout",
        "stripe-connect-payouts",
        "permanent-unlocks",
        "transactional-email",
        "reports",
        "support",
      ],
    });
  }),
);

app.get(
  "/api/admin/reports",
  requireUser,
  requireAdmin,
  route(async (request, response) => {
    const status = request.query.status ? z.enum(["open", "reviewing", "resolved", "dismissed"]).parse(request.query.status) : undefined;
    const reports = await listReports({ status });
    ok(response, { reports });
  }),
);

app.post(
  "/api/admin/reports/:reportId",
  requireUser,
  requireAdmin,
  route(async (request, response) => {
    const body = z.object({ status: z.enum(["open", "reviewing", "resolved", "dismissed"]) }).parse(request.body);
    const report = await updateReportStatus({ reportId: request.params.reportId, status: body.status });
    ok(response, { report });
  }),
);

app.get(
  "/api/admin/support/tickets",
  requireUser,
  requireAdmin,
  route(async (request, response) => {
    const status = request.query.status ? z.enum(["open", "waiting", "resolved"]).parse(request.query.status) : undefined;
    const tickets = await listSupportTickets({ status });
    ok(response, { tickets });
  }),
);

app.post(
  "/api/admin/support/tickets/:ticketId",
  requireUser,
  requireAdmin,
  route(async (request, response) => {
    const body = z.object({ status: z.enum(["open", "waiting", "resolved"]) }).parse(request.body);
    const ticket = await updateSupportTicketStatus({ ticketId: request.params.ticketId, status: body.status });
    ok(response, { ticket });
  }),
);

app.listen(config.port, () => {
  console.log(`Vault'd server listening on http://localhost:${config.port}`);
});
