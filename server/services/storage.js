import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const supabase =
  config.supabase.url && config.supabase.serviceRoleKey
    ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

function requireStorage() {
  if (!supabase) {
    throw new Error("Supabase storage is not configured");
  }
  return supabase.storage.from(config.supabase.storageBucket);
}

export async function createUploadUrl({ path, contentType }) {
  const bucket = requireStorage();
  const { data, error } = await bucket.createSignedUploadUrl(path, {
    upsert: false,
    contentType,
  });
  if (error) throw error;
  return data;
}

export async function createDownloadUrl(path, expiresIn = 60 * 5) {
  const bucket = requireStorage();
  const { data, error } = await bucket.createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export function mediaPath({ creatorId, dropId, fileName }) {
  const safeName = String(fileName || "media").replace(/[^a-zA-Z0-9._-]/g, "-");
  return `creators/${creatorId}/drops/${dropId}/${Date.now()}-${safeName}`;
}
