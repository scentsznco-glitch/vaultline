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
  createAuditLog,
  deleteDropById,
  adminUpdateDropStatus,
  getCreatorProfile,
  getEntitledDrop,
  getEntitledMedia,
  getPublicDrop,
  getReportById,
  getUserById,
  getUserByEmail,
  getStorefrontByHandle,
  listDiscoverStorefronts,
  listAuditLogs,
  listCreatorDrops,
  listLibrary,
  listReports,
  listSupportTickets,
  markUserAgeConfirmed,
  markPurchaseStatusBySession,
  revokeEntitlement,
  suspendUser,
  touchLogin,
  unsuspendUser,
  updateCreatorPayoutStatus,
  updateDropStatus,
  updateReportStatus,
  updateSupportTicketStatus,
  upsertCreatorProfile,
  verifyEmailToken,
} from "./data.js";
import { sendNewDropNotification, sendReceiptEmail, sendSupportNotice, sendVerificationEmail } from "./services/email.js";
import { createDownloadUrl, createUploadUrl, mediaPath } from "./services/storage.js";
import { constructWebhookEvent, createCheckoutSession, createConnectedAccount, createConnectOnboardingLink, stripe } from "./services/stripe.js";
import { hashToken, id, rateLimit, requireAdmin, requireUser, signSession } from "./services/security.js";
import { sendPhoneCode, checkPhoneCode } from "./services/twilio.js";

const app = express();
if (config.env === "production") app.set("trust proxy", 1);

const apiLimiter = rateLimit({ name: "api", windowMs: 60_000, max: 240 });
const authLimiter = rateLimit({ name: "auth", windowMs: 15 * 60_000, max: 12 });
const writeLimiter = rateLimit({ name: "write", windowMs: 60_000, max: 45 });
const checkoutLimiter = rateLimit({ name: "checkout", windowMs: 60_000, max: 15 });
const supportLimiter = rateLimit({ name: "support", windowMs: 60 * 60_000, max: 20 });
const adminLimiter = rateLimit({ name: "admin", windowMs: 60_000, max: 120 });

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
app.use("/api", apiLimiter);
const blockedStaticPaths = [
  "/.env",
  "/.git",
  "/db/",
  "/docs/",
  "/node_modules/",
  "/reference_media/",
  "/server/",
  "/_video_review/",
  "/file_manifest",
  "/handoff",
  "/openclaw",
  "/package-lock.json",
  "/package.json",
];

app.use((request, response, next) => {
  const pathname = decodeURIComponent(request.path || "/").replaceAll("\\", "/").toLowerCase();
  if (blockedStaticPaths.some((blockedPath) => pathname === blockedPath || pathname.startsWith(blockedPath))) {
    response.status(404).send("Not found");
    return;
  }
  next();
});

app.use((request, response, next) => {
  if (config.env === "production" && request.path.endsWith("/app.html") && request.query.preview) {
    const params = new URLSearchParams(request.query);
    params.delete("preview");
    const query = params.toString();
    response.redirect(302, `${request.path}${query ? `?${query}` : ""}`);
    return;
  }
  next();
});

app.use(express.static(".", { dotfiles: "deny" }));

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

async function requireActiveUser(request, response, next) {
  try {
    const user = await getUserById(request.user.id);
    if (!user) {
      response.status(401).json({ ok: false, error: "Sign in required" });
      return;
    }
    if (user.suspended_at) {
      response.status(403).json({ ok: false, error: "This account is suspended. Contact support@vaultd.me." });
      return;
    }
    request.dbUser = user;
    next();
  } catch (error) {
    console.error("[active user error]", error?.message || error);
    response.status(400).json({ ok: false, error: config.env === "production" ? "Request failed" : error.message });
  }
}

function requireAgeConfirmed(request, response, next) {
  if (!request.dbUser?.age_confirmed_at) {
    response.status(403).json({ ok: false, error: "Confirm you are 18+ before continuing." });
    return;
  }
  next();
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
  authLimiter,
  route(async (request, response) => {
    const body = z
      .object({
        email: emailSchema,
        role: z.enum(["creator", "fan"]).default("fan"),
        ageConfirmed: z.boolean().optional().default(false),
      })
      .parse(request.body);
    if (!body.ageConfirmed) {
      response.status(400).json({ ok: false, error: "You must confirm you are 18+ to use Vault'd." });
      return;
    }
    let user = await getUserByEmail(body.email);
    if (!user) {
      user = await createUser({ email: body.email, role: body.role, ageConfirmedAt: new Date().toISOString() });
    } else if (!user.age_confirmed_at) {
      user = await markUserAgeConfirmed({ userId: user.id });
    }
    if (user.suspended_at) {
      response.status(403).json({ ok: false, error: "This account is suspended. Contact support@vaultd.me." });
      return;
    }
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
  requireActiveUser,
  route(async (request, response) => {
    ok(response, {
      user: {
        id: request.dbUser.id,
        email: request.dbUser.email,
        role: request.dbUser.role,
        ageConfirmed: Boolean(request.dbUser.age_confirmed_at),
      },
    });
  }),
);

// ── Phone OTP auth ───────────────────────────────────────────────────────────
const phoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, "Must be E.164 format, e.g. +12125551234");

app.post(
  "/api/auth/phone/start",
  authLimiter,
  route(async (request, response) => {
    const body = z.object({
      phone: phoneSchema,
      role: z.enum(["creator", "fan"]).default("fan"),
      ageConfirmed: z.boolean().optional().default(false),
    }).parse(request.body);
    if (!body.ageConfirmed) {
      response.status(400).json({ ok: false, error: "You must confirm you are 18+ to use Vault'd." });
      return;
    }

    await sendPhoneCode(body.phone);

    // Look up or create the user now so they get a session after verify
    let user = await getUserByEmail(`${body.phone}@phone.vaultline`);
    if (!user) {
      user = await createUser({ email: `${body.phone}@phone.vaultline`, role: body.role, ageConfirmedAt: new Date().toISOString() });
    } else if (!user.age_confirmed_at) {
      user = await markUserAgeConfirmed({ userId: user.id });
    }
    if (user.suspended_at) {
      response.status(403).json({ ok: false, error: "This account is suspended. Contact support@vaultd.me." });
      return;
    }
    await touchLogin(user.id);

    ok(response, { status: "pending" });
  }),
);

app.post(
  "/api/auth/phone/verify",
  authLimiter,
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
    if (user.suspended_at) {
      response.status(403).json({ ok: false, error: "This account is suspended. Contact support@vaultd.me." });
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
  requireActiveUser,
  requireAgeConfirmed,
  writeLimiter,
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
  requireActiveUser,
  route(async (request, response) => {
    const profile = await getCreatorProfile({ userId: request.user.id });
    ok(response, { profile: profile || null });
  }),
);

app.post(
  "/api/creator/connect/onboarding",
  requireUser,
  requireActiveUser,
  requireAgeConfirmed,
  writeLimiter,
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
  requireActiveUser,
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
  requireActiveUser,
  requireAgeConfirmed,
  writeLimiter,
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

    // Fire-and-forget: notify creator their drop is live
    const creatorProfile = await getCreatorProfile({ userId: request.user.id }).catch(() => null);
    if (creatorProfile?.handle) {
      sendNewDropNotification({
        to: request.user.email,
        creatorHandle: creatorProfile.handle,
        dropTitle: body.title,
        storefrontUrl: `${config.publicBaseUrl}/fan.html?handle=${encodeURIComponent(creatorProfile.handle)}`,
      }).catch((err) => console.warn('[email] sendNewDropNotification failed:', err?.message));
    }

    ok(response, { drop, uploads });
  }),
);

app.get(
  "/api/creator/drops",
  requireUser,
  requireActiveUser,
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
  requireActiveUser,
  writeLimiter,
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
  requireActiveUser,
  writeLimiter,
  route(async (request, response) => {
    await deleteDropById({ dropId: request.params.dropId, creatorId: request.user.id });
    ok(response, { deleted: true });
  }),
);

app.get(
  "/api/library",
  requireUser,
  requireActiveUser,
  route(async (request, response) => {
    const items = await listLibrary({ buyerId: request.user.id });
    ok(response, { items });
  }),
);

app.post(
  "/api/checkout/session",
  requireUser,
  requireActiveUser,
  requireAgeConfirmed,
  checkoutLimiter,
  route(async (request, response) => {
    const body = z
      .object({
        dropId: z.string().min(1).optional(),
        dropIds: z.array(z.string().min(1)).min(1).max(8).optional(),
      })
      .refine((value) => value.dropId || value.dropIds?.length, { message: "Drop required" })
      .parse(request.body);
    const dropIds = [...new Set(body.dropIds?.length ? body.dropIds : [body.dropId])].filter(Boolean);
    const drops = await Promise.all(dropIds.map((dropId) => getPublicDrop(dropId)));
    if (drops.some((drop) => !drop)) {
      response.status(404).json({ ok: false, error: "Drop not found" });
      return;
    }
    if (drops.some((drop) => drop.access === "svip")) {
      response.status(403).json({ ok: false, error: "VIP-only drops are not available yet" });
      return;
    }
    const creatorId = drops[0].creator_id;
    if (drops.some((drop) => drop.creator_id !== creatorId)) {
      response.status(400).json({ ok: false, error: "Bundle checkout is limited to one creator at a time" });
      return;
    }
    const creatorHandle = drops[0].creator_profiles?.handle;
    const creatorProfile = drops[0].creator_profiles;
    const stripeAccountId = creatorProfile?.charges_enabled ? creatorProfile?.stripe_account_id : null;
    const session = await createCheckoutSession({
      drops: drops.map((drop) => ({
        ...drop,
        buyer_id: request.user.id,
        stripe_account_id: stripeAccountId,
      })),
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
      let dropIds = [];
      let dropAmounts = {};
      try {
        dropIds = JSON.parse(session.metadata?.drop_ids || "[]");
        dropAmounts = JSON.parse(session.metadata?.drop_amounts || "{}");
      } catch {
        dropIds = [];
        dropAmounts = {};
      }
      if (!Array.isArray(dropIds) || !dropIds.length) dropIds = session.metadata?.drop_id ? [session.metadata.drop_id] : [];
      const contentTotalCents =
        Object.values(dropAmounts).reduce((total, amount) => total + (Number(amount) || 0), 0) ||
        Math.max(0, Number(session.metadata?.content_amount_cents) || 0);
      const privacyFeeCents = Math.max(0, Number(session.metadata?.privacy_security_fee_cents) || 0);
      const applicationFeeCents = Math.max(0, Number(session.metadata?.application_fee_cents) || 0);
      if (buyerId && dropIds.length) {
        for (const dropId of dropIds) {
          const itemContentCents = Number(dropAmounts[dropId]) || Math.round(contentTotalCents / dropIds.length);
          const itemShare = contentTotalCents ? itemContentCents / contentTotalCents : 1 / dropIds.length;
          const itemPrivacyFeeCents = Math.round(privacyFeeCents * itemShare);
          const itemApplicationFeeCents = Math.round(applicationFeeCents * itemShare);
          await createPurchase({
            buyerId,
            dropId,
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
            amount: (itemContentCents + itemPrivacyFeeCents) / 100,
            applicationFeeAmount: itemApplicationFeeCents / 100,
          });
        }
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
  requireActiveUser,
  supportLimiter,
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
  requireActiveUser,
  supportLimiter,
  route(async (request, response) => {
    const body = z.object({ dropId: z.string(), reason: z.string().min(3).max(80), details: z.string().max(1000).default("") }).parse(request.body);
    const report = await createReport({ reporterId: request.user.id, dropId: body.dropId, reason: body.reason, details: body.details });
    ok(response, { report });
  }),
);

app.post(
  "/api/support/tickets",
  supportLimiter,
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
  requireActiveUser,
  requireAdmin,
  adminLimiter,
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
        "age-gate",
        "rate-limits",
        "admin-moderation-actions",
      ],
    });
  }),
);

app.get(
  "/api/admin/reports",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const status = request.query.status ? z.enum(["open", "reviewing", "resolved", "dismissed"]).parse(request.query.status) : undefined;
    const reports = await listReports({ status });
    ok(response, { reports });
  }),
);

app.post(
  "/api/admin/reports/:reportId",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const body = z.object({ status: z.enum(["open", "reviewing", "resolved", "dismissed"]) }).parse(request.body);
    const report = await updateReportStatus({ reportId: request.params.reportId, status: body.status });
    await createAuditLog({
      actorId: request.user.id,
      action: `report_${body.status}`,
      targetType: "report",
      targetId: request.params.reportId,
      metadata: { status: body.status },
    });
    ok(response, { report });
  }),
);

app.post(
  "/api/admin/reports/:reportId/moderation",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const body = z
      .object({
        action: z.enum(["remove_drop", "restore_drop", "suspend_creator", "unsuspend_creator"]),
      })
      .parse(request.body);
    const report = await getReportById(request.params.reportId);
    const drop = report?.drops;
    if (!report || !drop?.id) {
      response.status(404).json({ ok: false, error: "Report or drop not found" });
      return;
    }

    let result = null;
    if (body.action === "remove_drop") {
      result = await adminUpdateDropStatus({ dropId: drop.id, status: "removed" });
      await updateReportStatus({ reportId: report.id, status: "resolved" });
    }
    if (body.action === "restore_drop") {
      result = await adminUpdateDropStatus({ dropId: drop.id, status: "active" });
    }
    if (body.action === "suspend_creator") {
      result = await suspendUser({
        userId: drop.creator_id,
        reason: `Moderation action from report ${report.id}`,
      });
      await adminUpdateDropStatus({ dropId: drop.id, status: "removed" });
      await updateReportStatus({ reportId: report.id, status: "resolved" });
    }
    if (body.action === "unsuspend_creator") {
      result = await unsuspendUser({ userId: drop.creator_id });
    }

    await createAuditLog({
      actorId: request.user.id,
      action: body.action,
      targetType: body.action.includes("creator") ? "user" : "drop",
      targetId: body.action.includes("creator") ? drop.creator_id : drop.id,
      metadata: { reportId: report.id, dropTitle: drop.title || "" },
    });
    ok(response, { result });
  }),
);

app.get(
  "/api/admin/support/tickets",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const status = request.query.status ? z.enum(["open", "waiting", "resolved"]).parse(request.query.status) : undefined;
    const tickets = await listSupportTickets({ status });
    ok(response, { tickets });
  }),
);

app.post(
  "/api/admin/support/tickets/:ticketId",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const body = z.object({ status: z.enum(["open", "waiting", "resolved"]) }).parse(request.body);
    const ticket = await updateSupportTicketStatus({ ticketId: request.params.ticketId, status: body.status });
    await createAuditLog({
      actorId: request.user.id,
      action: `support_${body.status}`,
      targetType: "support_ticket",
      targetId: request.params.ticketId,
      metadata: { status: body.status },
    });
    ok(response, { ticket });
  }),
);

app.post(
  "/api/admin/purchases/:purchaseId/revoke",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const body = z.object({ reason: z.string().max(240).default("Admin action") }).parse(request.body || {});
    const entitlement = await revokeEntitlement({ purchaseId: request.params.purchaseId, reason: body.reason });
    await createAuditLog({
      actorId: request.user.id,
      action: "revoke_entitlement",
      targetType: "purchase",
      targetId: request.params.purchaseId,
      metadata: { reason: body.reason },
    });
    ok(response, { entitlement });
  }),
);

app.get(
  "/api/admin/audit-logs",
  requireUser,
  requireActiveUser,
  requireAdmin,
  adminLimiter,
  route(async (request, response) => {
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit ?? 25);
    const logs = await listAuditLogs({ limit });
    ok(response, { logs });
  }),
);

app.listen(config.port, () => {
  console.log(`Vault'd server listening on http://localhost:${config.port}`);
});
