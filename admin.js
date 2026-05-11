const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const state = {
  user: null,
  launch: null,
  reports: [],
  tickets: [],
  audits: [],
  activeTab: "reports",
  reportStatus: "open",
  ticketStatus: "open",
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function syncIcons() {
  window.lucide?.createIcons();
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function setAuthMessage(html) {
  const message = $("[data-auth-message]");
  if (message) message.innerHTML = html;
}

function renderShell({ authenticated, adminError = "" } = {}) {
  const authPanel = $("[data-auth-panel]");
  const adminPanel = $("[data-admin-panel]");
  const logoutButton = $("[data-admin-logout]");

  if (authPanel) authPanel.hidden = Boolean(authenticated);
  if (adminPanel) adminPanel.hidden = !authenticated;
  if (logoutButton) logoutButton.hidden = !state.user;

  if (authenticated) {
    const email = $("[data-admin-email]");
    if (email) email.textContent = state.user?.email || "Admin";
    setAuthMessage("");
  } else if (adminError) {
    setAuthMessage(`<span class="error">${escapeHtml(adminError)}</span>`);
  }
}

function renderLaunch() {
  const grid = $("#launch-grid");
  if (!grid) return;
  const missing = state.launch?.missing || [];
  const checks = state.launch?.checks || [];
  const stripeConfigured = Boolean(state.launch?.stripeConfigured);

  grid.innerHTML = `
    <article class="launch-card ${missing.length ? "is-alert" : "is-good"}">
      <span>Launch config</span>
      <strong>${missing.length ? `${missing.length} missing` : "Ready"}</strong>
      <span>${missing.length ? escapeHtml(missing.join(", ")) : "Required env values are present."}</span>
    </article>
    <article class="launch-card ${stripeConfigured ? "is-good" : "is-alert"}">
      <span>Stripe</span>
      <strong>${stripeConfigured ? "Connected" : "Missing"}</strong>
      <span>${stripeConfigured ? "Checkout and Connect can run." : "Add Stripe keys before payments."}</span>
    </article>
    <article class="launch-card is-good">
      <span>Server checks</span>
      <strong>${checks.length || 0}</strong>
      <span>${checks.length ? escapeHtml(checks.join(", ")) : "No checks reported."}</span>
    </article>
  `;
}

function reportTitle(report) {
  return report?.drops?.title || report?.drop_title || "Reported drop";
}

function reporterEmail(report) {
  return report?.users?.email || report?.reporter_email || "Unknown reporter";
}

function reportCreator(report) {
  const handle = report?.drops?.creator_profiles?.handle;
  return handle ? `@${handle}` : report?.drops?.creator_id || "Unknown creator";
}

function renderReports() {
  const list = $("#reports-list");
  if (!list) return;
  if (!state.reports.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No reports here</strong>
          <span>Reports with status "${escapeHtml(state.reportStatus || "all")}" will appear here.</span>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = state.reports.map((report) => `
    <article class="admin-item">
      <div class="item-head">
        <div>
          <h2>${escapeHtml(reportTitle(report))}</h2>
          <div class="item-meta">
            ${escapeHtml(report.reason || "Report")} - ${escapeHtml(reporterEmail(report))} - ${escapeHtml(formatDate(report.created_at))}
          </div>
        </div>
        <span class="status-pill ${escapeHtml(report.status || "open")}">${escapeHtml(report.status || "open")}</span>
      </div>
      <p class="item-body">${escapeHtml(report.details || "No extra details provided.")}</p>
      <div class="item-actions">
        ${["open", "reviewing", "resolved", "dismissed"].map((status) => `
          <button class="status-action" type="button" data-report-action="${status}" data-report-id="${escapeHtml(report.id)}" ${status === report.status ? "disabled" : ""}>
            ${escapeHtml(status)}
          </button>
        `).join("")}
      </div>
      ${report?.drops?.id ? `
        <div class="item-actions moderation-actions" aria-label="Moderation actions">
          <button class="status-action danger" type="button" data-moderation-action="remove_drop" data-report-id="${escapeHtml(report.id)}">
            Hide drop
          </button>
          <button class="status-action" type="button" data-moderation-action="restore_drop" data-report-id="${escapeHtml(report.id)}">
            Restore drop
          </button>
          <button class="status-action danger" type="button" data-moderation-action="suspend_creator" data-report-id="${escapeHtml(report.id)}">
            Suspend ${escapeHtml(reportCreator(report))}
          </button>
          <button class="status-action" type="button" data-moderation-action="unsuspend_creator" data-report-id="${escapeHtml(report.id)}">
            Unsuspend creator
          </button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderTickets() {
  const list = $("#tickets-list");
  if (!list) return;
  if (!state.tickets.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No support tickets here</strong>
          <span>Tickets with status "${escapeHtml(state.ticketStatus || "all")}" will appear here.</span>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = state.tickets.map((ticket) => `
    <article class="admin-item">
      <div class="item-head">
        <div>
          <h2>${escapeHtml(ticket.subject || "Support ticket")}</h2>
          <div class="item-meta">
            ${escapeHtml(ticket.email || "Unknown email")} - ${escapeHtml(formatDate(ticket.created_at))}
          </div>
        </div>
        <span class="status-pill ${escapeHtml(ticket.status || "open")}">${escapeHtml(ticket.status || "open")}</span>
      </div>
      <p class="item-body">${escapeHtml(ticket.message || "No message provided.")}</p>
      <div class="item-actions">
        ${["open", "waiting", "resolved"].map((status) => `
          <button class="status-action" type="button" data-ticket-action="${status}" data-ticket-id="${escapeHtml(ticket.id)}" ${status === ticket.status ? "disabled" : ""}>
            ${escapeHtml(status)}
          </button>
        `).join("")}
      </div>
      <div class="item-inline-form">
        <input type="text" placeholder="Purchase ID to revoke" data-revoke-input="${escapeHtml(ticket.id)}" />
        <button class="status-action danger" type="button" data-revoke-purchase="${escapeHtml(ticket.id)}">
          Revoke access
        </button>
      </div>
    </article>
  `).join("");
}

function renderAudits() {
  const list = $("#audit-list");
  if (!list) return;
  if (!state.audits.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No audit logs yet</strong>
          <span>Admin actions will appear here after reports or support items are updated.</span>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = state.audits.map((log) => `
    <article class="admin-item audit-item">
      <div class="item-head">
        <div>
          <h2>${escapeHtml(log.action || "admin_action")}</h2>
          <div class="item-meta">
            ${escapeHtml(log.target_type || "target")} ${escapeHtml(log.target_id || "")} - ${escapeHtml(formatDate(log.created_at))}
          </div>
        </div>
      </div>
      <p class="item-body">${escapeHtml(JSON.stringify(log.metadata || {}))}</p>
    </article>
  `).join("");
}

function renderTabs() {
  $$("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTab === state.activeTab);
  });
  const reportsVisible = state.activeTab === "reports";
  const supportVisible = state.activeTab === "support";
  const auditVisible = state.activeTab === "audit";
  $("#reports-list").hidden = !reportsVisible;
  $("#tickets-list").hidden = !supportVisible;
  $("#audit-list").hidden = !auditVisible;
  $("[data-report-toolbar]").hidden = !reportsVisible;
  $("[data-ticket-toolbar]").hidden = !supportVisible;
}

function renderAll() {
  renderLaunch();
  renderReports();
  renderTickets();
  renderAudits();
  renderTabs();
  syncIcons();
}

async function loadLaunch() {
  state.launch = await VaultlineAPI.adminLaunch();
  renderLaunch();
}

async function loadReports() {
  const data = await VaultlineAPI.adminReports(state.reportStatus);
  state.reports = data.reports || [];
  renderReports();
}

async function loadTickets() {
  const data = await VaultlineAPI.adminSupportTickets(state.ticketStatus);
  state.tickets = data.tickets || [];
  renderTickets();
}

async function loadAudits() {
  const data = await VaultlineAPI.adminAuditLogs(30);
  state.audits = data.logs || [];
  renderAudits();
}

async function loadAdminData() {
  try {
    renderShell({ authenticated: true });
    await Promise.all([loadLaunch(), loadReports(), loadTickets(), loadAudits()]);
    renderAll();
  } catch (err) {
    if (err.status === 403) {
      renderShell({ authenticated: false, adminError: "This account is signed in, but it is not listed in ADMIN_EMAILS." });
      return;
    }
    if (err.status === 401) {
      renderShell({ authenticated: false });
      return;
    }
    showToast(err.message || "Could not load admin data");
  }
}

async function checkAuth() {
  try {
    const data = await VaultlineAPI.me();
    state.user = data.user;
    await loadAdminData();
  } catch {
    state.user = null;
    renderShell({ authenticated: false });
  }
}

function bindEvents() {
  $("[data-admin-login]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") || "").trim();
    if (!email) return;
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    setAuthMessage("Sending magic link...");
    try {
      const data = await VaultlineAPI.authStart(email, "creator", true);
      const localLink = data.verifyUrl ? ` <a href="${escapeHtml(data.verifyUrl)}">Open local verification link</a>` : "";
      setAuthMessage(`Check your email to finish signing in.${localLink}`);
    } catch (err) {
      setAuthMessage(escapeHtml(err.message || "Could not start admin sign-in."));
    } finally {
      if (button) button.disabled = false;
    }
  });

  $("[data-refresh-admin]")?.addEventListener("click", () => {
    loadAdminData();
    showToast("Admin refreshed");
  });

  $("[data-admin-logout]")?.addEventListener("click", async () => {
    await VaultlineAPI.authLogout().catch(() => {});
    state.user = null;
    renderShell({ authenticated: false });
    showToast("Logged out");
  });

  document.addEventListener("click", async (event) => {
    const tabButton = event.target.closest("[data-admin-tab]");
    if (tabButton) {
      state.activeTab = tabButton.dataset.adminTab;
      if (state.activeTab === "audit" && !state.audits.length) loadAudits().catch(() => {});
      renderTabs();
      return;
    }

    const reportAction = event.target.closest("[data-report-action]");
    if (reportAction) {
      reportAction.disabled = true;
      try {
        await VaultlineAPI.adminUpdateReport(reportAction.dataset.reportId, reportAction.dataset.reportAction);
        await Promise.all([loadReports(), loadAudits()]);
        showToast("Report updated");
      } catch (err) {
        showToast(err.message || "Report update failed");
      }
      return;
    }

    const moderationAction = event.target.closest("[data-moderation-action]");
    if (moderationAction) {
      moderationAction.disabled = true;
      try {
        await VaultlineAPI.adminModerateReport(moderationAction.dataset.reportId, moderationAction.dataset.moderationAction);
        await Promise.all([loadReports(), loadAudits()]);
        showToast("Moderation action saved");
      } catch (err) {
        showToast(err.message || "Moderation action failed");
      }
      return;
    }

    const ticketAction = event.target.closest("[data-ticket-action]");
    if (ticketAction) {
      ticketAction.disabled = true;
      try {
        await VaultlineAPI.adminUpdateSupportTicket(ticketAction.dataset.ticketId, ticketAction.dataset.ticketAction);
        await Promise.all([loadTickets(), loadAudits()]);
        showToast("Ticket updated");
      } catch (err) {
        showToast(err.message || "Ticket update failed");
      }
      return;
    }

    const revokeAction = event.target.closest("[data-revoke-purchase]");
    if (revokeAction) {
      const ticketId = revokeAction.dataset.revokePurchase;
      const input = $$("[data-revoke-input]").find((item) => item.dataset.revokeInput === ticketId);
      const purchaseId = String(input?.value || "").trim();
      if (!purchaseId) {
        showToast("Enter a purchase ID first");
        return;
      }
      revokeAction.disabled = true;
      try {
        await VaultlineAPI.adminRevokePurchase(purchaseId, `Support ticket ${ticketId}`);
        if (input) input.value = "";
        await loadAudits();
        showToast("Access revoked");
      } catch (err) {
        showToast(err.message || "Could not revoke access");
      } finally {
        revokeAction.disabled = false;
      }
    }
  });

  $("[data-report-status]")?.addEventListener("change", async (event) => {
    state.reportStatus = event.target.value;
    await loadReports();
  });

  $("[data-ticket-status]")?.addEventListener("change", async (event) => {
    state.ticketStatus = event.target.value;
    await loadTickets();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  renderShell({ authenticated: false });
  syncIcons();
  checkAuth();
});
