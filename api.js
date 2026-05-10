// Vaultline shared API client — loaded before app.js and fan.js
const VaultlineAPI = (function () {
  const BASE = window.location.hostname === "localhost" ? "http://localhost:8787" : "";

  async function req(method, path, body) {
    const opts = { method, credentials: "include" };
    if (body !== undefined) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  function me() {
    return req("GET", "/api/auth/me");
  }

  function authStart(email, role) {
    return req("POST", "/api/auth/start", { email, role });
  }

  function phoneStart(phone, role) {
    return req("POST", "/api/auth/phone/start", { phone, role });
  }

  function phoneVerify(phone, code) {
    return req("POST", "/api/auth/phone/verify", { phone, code });
  }

  function authLogout() {
    return req("POST", "/api/auth/logout");
  }

  // ── Creator ───────────────────────────────────────────────────────────────
  async function createDrop(dropData, mediaItems) {
    const media = mediaItems.map((item) => ({
      fileName: item.name,
      fileType: item.file?.type || "application/octet-stream",
    }));
    const result = await req("POST", "/api/drops", { ...dropData, media });

    // Upload each file directly to Supabase via the signed URL
    await Promise.all(
      result.uploads.map(async (upload, i) => {
        const file = mediaItems[i]?.file;
        if (!file) return;
        const uploadRes = await fetch(upload.signedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!uploadRes.ok) throw new Error(`Upload failed for ${upload.fileName}`);
      }),
    );

    return result;
  }

  function listCreatorDrops() {
    return req("GET", "/api/creator/drops");
  }

  function getCreatorProfile() {
    return req("GET", "/api/creator/profile");
  }

  function updateCreatorProfile(data) {
    return req("POST", "/api/creator/profile", data);
  }

  function connectOnboarding() {
    return req("POST", "/api/creator/connect/onboarding");
  }

  function getConnectStatus() {
    return req("GET", "/api/creator/connect/status");
  }

  function updateDrop(dropId, updates) {
    return req("PATCH", `/api/drops/${encodeURIComponent(dropId)}`, updates);
  }

  function deleteDrop(dropId) {
    return req("DELETE", `/api/drops/${encodeURIComponent(dropId)}`);
  }

  // ── Fan storefront ────────────────────────────────────────────────────────
  function getStorefront(handle) {
    return req("GET", `/api/storefront/${encodeURIComponent(handle)}`);
  }

  function discover() {
    return req("GET", "/api/discover");
  }

  function getPublicDrop(dropId) {
    return req("GET", `/api/drops/${encodeURIComponent(dropId)}`);
  }

  // ── Fan library ───────────────────────────────────────────────────────────
  function getLibrary() {
    return req("GET", "/api/library");
  }

  function getDownloadUrls(purchaseId) {
    return req("GET", `/api/library/${encodeURIComponent(purchaseId)}/download`);
  }

  function startCheckout(dropId) {
    return req("POST", "/api/checkout/session", { dropId });
  }

  return {
    BASE,
    me,
    authStart,
    phoneStart,
    phoneVerify,
    authLogout,
    createDrop,
    listCreatorDrops,
    getCreatorProfile,
    updateCreatorProfile,
    connectOnboarding,
    getConnectStatus,
    updateDrop,
    deleteDrop,
    discover,
    getStorefront,
    getPublicDrop,
    getLibrary,
    getDownloadUrls,
    startCheckout,
  };
})();

window.VaultlineAPI = VaultlineAPI;
