import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { id } from "./services/security.js";

export const db =
  config.supabase.url && config.supabase.serviceRoleKey
    ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

function requireDb() {
  if (!db) throw new Error("Supabase database is not configured");
  return db;
}

export async function getUserByEmail(email) {
  const client = requireDb();
  const { data, error } = await client.from("users").select("*").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserById(userId) {
  const client = requireDb();
  const { data, error } = await client.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createUser({ email, role = "fan", ageConfirmedAt = null }) {
  const client = requireDb();
  const user = {
    id: id("usr"),
    email: email.toLowerCase(),
    role,
    email_verified: false,
    age_confirmed_at: ageConfirmedAt,
  };
  const { data, error } = await client.from("users").insert(user).select("*").single();
  if (error) throw error;
  return data;
}

export async function markUserAgeConfirmed({ userId, ageConfirmedAt = new Date().toISOString() }) {
  const client = requireDb();
  const { data, error } = await client
    .from("users")
    .update({ age_confirmed_at: ageConfirmedAt })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function suspendUser({ userId, reason = "" }) {
  const client = requireDb();
  const { data, error } = await client
    .from("users")
    .update({ suspended_at: new Date().toISOString(), suspension_reason: reason || "Admin action" })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function unsuspendUser({ userId }) {
  const client = requireDb();
  const { data, error } = await client
    .from("users")
    .update({ suspended_at: null, suspension_reason: null })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function touchLogin(userId) {
  const client = requireDb();
  await client.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
}

export async function createEmailVerification({ userId, tokenHash, expiresAt }) {
  const client = requireDb();
  const verification = { id: id("ev"), user_id: userId, token_hash: tokenHash, expires_at: expiresAt };
  const { data, error } = await client.from("email_verifications").insert(verification).select("*").single();
  if (error) throw error;
  return data;
}

export async function verifyEmailToken(tokenHash) {
  const client = requireDb();
  const { data: verification, error } = await client
    .from("email_verifications")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!verification) return null;

  const now = new Date().toISOString();
  const { data: user, error: userError } = await client
    .from("users")
    .update({ email_verified: true })
    .eq("id", verification.user_id)
    .select("*")
    .single();
  if (userError) throw userError;

  await client.from("email_verifications").update({ used_at: now }).eq("id", verification.id);
  return user;
}

export async function upsertCreatorProfile({ userId, handle, bio, stripeAccountId }) {
  const client = requireDb();
  const profile = {
    user_id: userId,
    handle,
    bio,
    updated_at: new Date().toISOString(),
  };
  if (stripeAccountId) profile.stripe_account_id = stripeAccountId;
  const { data, error } = await client.from("creator_profiles").upsert(profile, { onConflict: "user_id" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateCreatorPayoutStatus({ stripeAccountId, chargesEnabled, payoutsEnabled, identityStatus }) {
  const client = requireDb();
  const update = {
    charges_enabled: Boolean(chargesEnabled),
    payouts_enabled: Boolean(payoutsEnabled),
    identity_status: identityStatus || "pending",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("creator_profiles")
    .update(update)
    .eq("stripe_account_id", stripeAccountId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createDrop({ creatorId, title, description, price, access = "everyone", download = "allowed", downloadExtraPercent = 0 }) {
  const client = requireDb();
  const drop = {
    id: id("drop"),
    creator_id: creatorId,
    title,
    description,
    price,
    access,
    download,
    download_extra_percent: downloadExtraPercent,
    status: "active",
  };
  const { data, error } = await client.from("drops").insert(drop).select("*").single();
  if (error) throw error;
  return data;
}

export async function addDropMedia({ dropId, path, fileType, fileName, sortOrder = 0 }) {
  const client = requireDb();
  const media = { id: id("media"), drop_id: dropId, storage_path: path, file_type: fileType, file_name: fileName, sort_order: sortOrder };
  const { data, error } = await client.from("drop_media").insert(media).select("*").single();
  if (error) throw error;
  return data;
}

export async function getCreatorProfile({ userId }) {
  const client = requireDb();
  const { data, error } = await client
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDropStatus({ dropId, creatorId, status }) {
  const client = requireDb();
  const { data, error } = await client
    .from("drops")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", dropId)
    .eq("creator_id", creatorId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function adminUpdateDropStatus({ dropId, status }) {
  const client = requireDb();
  const { data, error } = await client
    .from("drops")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", dropId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDropById({ dropId, creatorId }) {
  const client = requireDb();
  // Delete media records first to keep storage_path refs for cleanup
  await client.from("drop_media").delete().eq("drop_id", dropId);
  const { error } = await client
    .from("drops")
    .delete()
    .eq("id", dropId)
    .eq("creator_id", creatorId);
  if (error) throw error;
}

export async function getPublicDrop(dropId) {
  const client = requireDb();
  const { data, error } = await client
    .from("drops")
    .select("*, creator_profiles(handle, stripe_account_id), drop_media(id, file_type, file_name)")
    .eq("id", dropId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (data?.creator_id) {
    const creator = await getUserById(data.creator_id);
    if (creator?.suspended_at) return null;
  }
  return data;
}

export async function createPurchase({ buyerId, dropId, stripeSessionId, stripePaymentIntentId, amount, applicationFeeAmount = 0 }) {
  const client = requireDb();
  const purchase = {
    id: id("pur"),
    buyer_id: buyerId,
    drop_id: dropId,
    stripe_session_id: stripeSessionId,
    stripe_payment_intent_id: stripePaymentIntentId || null,
    amount,
    application_fee_amount: applicationFeeAmount,
    status: "paid",
  };
  const { data, error } = await client.from("purchases").insert(purchase).select("*").single();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await client
      .from("purchases")
      .select("*")
      .eq("stripe_session_id", stripeSessionId)
      .eq("drop_id", dropId)
      .single();
    if (existingError) throw existingError;
    return existing;
  }
  if (error) throw error;
  await client
    .from("entitlements")
    .upsert({ id: id("ent"), buyer_id: buyerId, drop_id: dropId, purchase_id: data.id, revoked_at: null, revoked_reason: null }, { onConflict: "buyer_id,drop_id" });
  await createOperation({ userId: buyerId, purchaseId: data.id, type: "sale", amount, externalId: `${stripeSessionId}_${dropId}` });
  return data;
}

export async function markPurchaseStatusBySession({ stripeSessionId, status, reason }) {
  const client = requireDb();
  const timestampColumn = status === "refunded" ? "refunded_at" : "disputed_at";
  const { data: purchases, error } = await client
    .from("purchases")
    .update({ status, [timestampColumn]: new Date().toISOString() })
    .eq("stripe_session_id", stripeSessionId)
    .select("*");
  if (error) throw error;
  if (!purchases?.length) return null;

  for (const purchase of purchases) {
    await client
      .from("entitlements")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: reason || status })
      .eq("purchase_id", purchase.id);
    await createOperation({
      userId: purchase.buyer_id,
      purchaseId: purchase.id,
      type: status === "refunded" ? "refund" : "dispute",
      amount: purchase.amount,
      externalId: `${status}_${stripeSessionId}_${purchase.drop_id}`,
    });
  }
  return purchases[0];
}

export async function createOperation({ userId, purchaseId, type, amount = 0, status = "complete", externalId, metadata = {} }) {
  const client = requireDb();
  const operation = {
    id: id("op"),
    user_id: userId || null,
    purchase_id: purchaseId || null,
    type,
    amount,
    status,
    external_id: externalId || null,
    metadata,
  };
  const { data, error } = await client.from("operations").insert(operation).select("*").single();
  if (error && error.code !== "23505") throw error;
  return data;
}

export async function listLibrary({ buyerId }) {
  const client = requireDb();
  const { data, error } = await client
    .from("purchases")
    .select("*, entitlements!inner(revoked_at), drops(id, title, description, price, creator_profiles(handle), drop_media(id, file_type, file_name))")
    .eq("buyer_id", buyerId)
    .eq("status", "paid")
    .is("entitlements.revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listCreatorDrops({ creatorId }) {
  const client = requireDb();
  const { data, error } = await client
    .from("drops")
    .select("*, drop_media(id, file_type, file_name), purchases(id, amount, status)")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getEntitledMedia({ buyerId, purchaseId }) {
  const client = requireDb();
  const { data: purchase, error: purchaseError } = await client
    .from("purchases")
    .select("*, entitlements!inner(revoked_at), drops(drop_media(*))")
    .eq("id", purchaseId)
    .eq("buyer_id", buyerId)
    .eq("status", "paid")
    .is("entitlements.revoked_at", null)
    .maybeSingle();
  if (purchaseError) throw purchaseError;
  return purchase?.drops?.drop_media || [];
}

export async function getEntitledDrop({ buyerId, purchaseId }) {
  const client = requireDb();
  const { data: purchase, error } = await client
    .from("purchases")
    .select("*, entitlements!inner(revoked_at), drops(download, drop_media(*))")
    .eq("id", purchaseId)
    .eq("buyer_id", buyerId)
    .eq("status", "paid")
    .is("entitlements.revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return purchase?.drops || null;
}

export async function revokeEntitlement({ purchaseId, reason = "Admin action" }) {
  const client = requireDb();
  const { data, error } = await client
    .from("entitlements")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("purchase_id", purchaseId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getStorefrontByHandle(handle) {
  const client = requireDb();
  const { data: profile, error } = await client
    .from("creator_profiles")
    .select("handle, bio, user_id")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const creator = await getUserById(profile.user_id);
  if (creator?.suspended_at) return null;

  const { data: drops, error: dropsError } = await client
    .from("drops")
    .select("id, title, description, price, access, download, download_extra_percent, created_at, drop_media(id, file_type, file_name)")
    .eq("creator_id", profile.user_id)
    .eq("status", "active")
    .eq("access", "everyone")
    .order("created_at", { ascending: false });
  if (dropsError) throw dropsError;

  return { profile, drops: drops || [] };
}

export async function listDiscoverStorefronts({ limit = 60 } = {}) {
  const client = requireDb();
  const { data, error } = await client
    .from("drops")
    .select("id, title, description, price, access, download, download_extra_percent, created_at, views, creator_profiles(handle, bio, user_id), drop_media(id, file_type, file_name), purchases(id, status)")
    .eq("status", "active")
    .eq("access", "everyone")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const creatorIds = [...new Set((data || []).map((drop) => drop.creator_profiles?.user_id).filter(Boolean))];
  const activeCreators = new Set();
  if (creatorIds.length) {
    const { data: users, error: userError } = await client
      .from("users")
      .select("id")
      .in("id", creatorIds)
      .is("suspended_at", null);
    if (userError) throw userError;
    for (const user of users || []) activeCreators.add(user.id);
  }

  const creators = new Map();
  for (const drop of data || []) {
    const profile = drop.creator_profiles;
    if (!profile?.handle) continue;
    if (!activeCreators.has(profile.user_id)) continue;
    if (!creators.has(profile.handle)) {
      creators.set(profile.handle, {
        handle: profile.handle,
        bio: profile.bio || "",
        dropCount: 0,
        unlockCount: 0,
        drops: [],
      });
    }
    const creator = creators.get(profile.handle);
    const paidPurchases = (drop.purchases || []).filter((purchase) => purchase.status === "paid").length;
    creator.dropCount += 1;
    creator.unlockCount += paidPurchases;
    creator.drops.push({
      id: drop.id,
      title: drop.title,
      description: drop.description || "",
      price: Number(drop.price) || 0,
      download: drop.download || "allowed",
      downloadExtraPercent: Number(drop.download_extra_percent) || 0,
      createdAt: drop.created_at,
      mediaCount: drop.drop_media?.length || 0,
      fileType: drop.drop_media?.[0]?.file_type || "",
      fileName: drop.drop_media?.[0]?.file_name || "",
      unlockCount: paidPurchases,
      views: drop.views || 0,
    });
  }

  return [...creators.values()];
}

export async function createReport({ reporterId, dropId, reason, details }) {
  const client = requireDb();
  const report = { id: id("rep"), reporter_id: reporterId, drop_id: dropId, reason, details, status: "open" };
  const { data, error } = await client.from("reports").insert(report).select("*").single();
  if (error) throw error;
  return data;
}

export async function listReports({ status }) {
  const client = requireDb();
  let query = client
    .from("reports")
    .select("*, drops(id, title, creator_id, creator_profiles(handle)), users(email)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getReportById(reportId) {
  const client = requireDb();
  const { data, error } = await client
    .from("reports")
    .select("*, drops(id, title, creator_id, creator_profiles(handle)), users(email)")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateReportStatus({ reportId, status }) {
  const client = requireDb();
  const update = { status };
  if (["resolved", "dismissed"].includes(status)) update.resolved_at = new Date().toISOString();
  const { data, error } = await client.from("reports").update(update).eq("id", reportId).select("*").single();
  if (error) throw error;
  return data;
}

export async function createSupportTicket({ userId, email, subject, message }) {
  const client = requireDb();
  const ticket = { id: id("tic"), user_id: userId || null, email, subject, message, status: "open" };
  const { data, error } = await client.from("support_tickets").insert(ticket).select("*").single();
  if (error) throw error;
  return data;
}

export async function listSupportTickets({ status }) {
  const client = requireDb();
  let query = client.from("support_tickets").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateSupportTicketStatus({ ticketId, status }) {
  const client = requireDb();
  const { data, error } = await client.from("support_tickets").update({ status }).eq("id", ticketId).select("*").single();
  if (error) throw error;
  return data;
}

export async function createAuditLog({ actorId, action, targetType, targetId, metadata = {} }) {
  const client = requireDb();
  const { data, error } = await client
    .from("audit_logs")
    .insert({
      actor_id: actorId || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listAuditLogs({ limit = 25 } = {}) {
  const client = requireDb();
  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
