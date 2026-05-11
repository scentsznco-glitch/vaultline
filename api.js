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

  function authStart(email, role, ageConfirmed = false) {
    return req("POST", "/api/auth/start", { email, role, ageConfirmed });
  }

  function phoneStart(phone, role, ageConfirmed = false) {
    return req("POST", "/api/auth/phone/start", { phone, role, ageConfirmed });
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

  function startCheckout(dropIds) {
    const ids = Array.isArray(dropIds) ? dropIds.filter(Boolean) : [dropIds].filter(Boolean);
    return req("POST", "/api/checkout/session", ids.length > 1 ? { dropIds: ids } : { dropId: ids[0] });
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  function adminLaunch() {
    return req("GET", "/api/admin/launch");
  }

  function adminReports(status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return req("GET", `/api/admin/reports${query}`);
  }

  function adminUpdateReport(reportId, status) {
    return req("POST", `/api/admin/reports/${encodeURIComponent(reportId)}`, { status });
  }

  function adminSupportTickets(status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return req("GET", `/api/admin/support/tickets${query}`);
  }

  function adminUpdateSupportTicket(ticketId, status) {
    return req("POST", `/api/admin/support/tickets/${encodeURIComponent(ticketId)}`, { status });
  }

  function adminModerateReport(reportId, action) {
    return req("POST", `/api/admin/reports/${encodeURIComponent(reportId)}/moderation`, { action });
  }

  function adminRevokePurchase(purchaseId, reason) {
    return req("POST", `/api/admin/purchases/${encodeURIComponent(purchaseId)}/revoke`, { reason });
  }

  function adminAuditLogs(limit = 25) {
    return req("GET", `/api/admin/audit-logs?limit=${encodeURIComponent(limit)}`);
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
    adminLaunch,
    adminReports,
    adminUpdateReport,
    adminModerateReport,
    adminSupportTickets,
    adminUpdateSupportTicket,
    adminRevokePurchase,
    adminAuditLogs,
  };
})();

window.VaultlineAPI = VaultlineAPI;
