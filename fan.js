const CREATOR_STORAGE_KEY = "vaultline-settings-v1";
const FAN_STORAGE_KEY = "vaultline-fan-v1";
const PUBLIC_BASE_URL = "http://localhost:8787";
const DEFAULT_THUMBNAIL = "assets/thumb-gallery.svg";
const DEFAULT_COVER = "assets/profile-cover.svg";
const DEFAULT_AVATAR = "assets/avatar-tile.svg";

const state = {
  view: "store",
  creator: {
    profile: {
      handle: "creator",
      bio: "Private drops, files, and creator packs in one clean storefront.",
    },
    coverImage: DEFAULT_COVER,
    avatarImage: DEFAULT_AVATAR,
    links: [],
    operations: [],
    bundle: {
      enabled: true,
      discount: 15,
      minItems: 2,
    },
    payout: {},
    withdrawn: 0,
  },
  fan: {
    purchases: [],
    viewedDrops: [],
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function id() {
  return Math.random().toString(36).slice(2, 9);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function syncIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function normalizeDrop(link) {
  return {
    id: String(link.id),
    title: String(link.title || "Untitled drop"),
    price: Math.max(1, Number(link.price) || 1),
    note: String(link.note || "Permanent unlock from this creator."),
    fileName: String(link.fileName || "locked-file"),
    thumbnail: String(link.thumbnail || DEFAULT_THUMBNAIL),
    status: link.status === "expired" ? "expired" : "active",
    views: Math.max(0, Number(link.views) || 0),
    sales: Math.max(0, Number(link.sales) || 0),
    revenue: Math.max(0, Number(link.revenue) || 0),
    url: String(link.url || `${PUBLIC_BASE_URL}/d/${link.id}`).replace("https://vaultline.app", PUBLIC_BASE_URL),
  };
}

function normalizeCreator(saved = {}) {
  const creator = {
    ...state.creator,
    ...saved,
    profile: { ...state.creator.profile, ...(saved.profile || {}) },
    bundle: { ...state.creator.bundle, ...(saved.bundle || {}) },
    payout: saved.payout || {},
    coverImage: saved.coverImage || DEFAULT_COVER,
    avatarImage: saved.avatarImage || DEFAULT_AVATAR,
    withdrawn: Math.max(0, Number(saved.withdrawn) || 0),
    operations: Array.isArray(saved.operations) ? saved.operations : [],
    links: Array.isArray(saved.links) ? saved.links.filter((link) => link && link.id).map(normalizeDrop) : [],
  };
  return creator;
}

function loadCreator() {
  try {
    const saved = JSON.parse(localStorage.getItem(CREATOR_STORAGE_KEY) || "{}");
    state.creator = normalizeCreator(saved);
  } catch {
    state.creator = normalizeCreator();
  }
}

// ── Fan auth state ───────────────────────────────────────────────────────────
let fanUser = null;

function showFanLoginOverlay(onSuccess) {
  // Remove any existing overlay so we always get a fresh one
  document.getElementById("vl-fan-login-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "vl-fan-login-overlay";
  overlay.style.cssText = [
    "position:fixed","inset:0","z-index:9999",
    "display:flex","align-items:flex-end","justify-content:center",
    "background:rgba(0,0,0,0.7)","padding:0",
  ].join(";");

  overlay.innerHTML = `
    <div id="vl-phone-sheet" style="
      background:#fff;border-radius:24px 24px 0 0;padding:32px 24px 40px;
      width:100%;max-width:480px;position:relative;
    ">
      <!-- Step 1: Phone entry -->
      <div id="vl-step-phone">
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111;">Start with Vaultline</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#888;">Enter your phone number to access content.</p>
        <form id="vl-phone-form">
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <div style="
              background:#f5f5f5;border:1.5px solid #e5e5e5;border-radius:12px;
              padding:14px 14px;font-size:15px;font-weight:600;color:#111;
              display:flex;align-items:center;gap:6px;flex-shrink:0;
            ">
              🇺🇸 +1
            </div>
            <input id="vl-phone-input" type="tel" inputmode="numeric" placeholder="Phone number"
              style="
                flex:1;background:#f5f5f5;border:1.5px solid #e5e5e5;border-radius:12px;
                font-size:15px;padding:14px 16px;color:#111;outline:none;
                font-family:inherit;
              " />
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px;color:#aaa;">
            <span style="font-size:16px;">&#x1F6E1;</span>
            Your number is safe. Anonymous and protected.
          </div>
          <button type="submit" id="vl-phone-btn"
            style="
              width:100%;background:#111;color:#fff;font-weight:700;font-size:16px;
              border:none;border-radius:14px;padding:16px;cursor:pointer;opacity:.4;
              transition:opacity .15s;font-family:inherit;
            ">
            Continue
          </button>
        </form>
        <p style="margin:16px 0 0;font-size:12px;color:#bbb;text-align:center;line-height:1.5;">
          By continuing, you agree to our
          <a href="#" style="color:#111;font-weight:600;">Terms of Use</a> and
          <a href="#" style="color:#111;font-weight:600;">Privacy Policy</a>.
        </p>
      </div>

      <!-- Step 2: OTP entry -->
      <div id="vl-step-otp" hidden>
        <button id="vl-otp-back" style="background:none;border:none;font-size:22px;cursor:pointer;padding:0;margin-bottom:16px;">&#8592;</button>
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111;">Enter the code</h2>
        <p id="vl-otp-hint" style="margin:0 0 24px;font-size:14px;color:#888;">We texted a 6-digit code to your number.</p>
        <form id="vl-otp-form">
          <input id="vl-otp-input" type="text" inputmode="numeric" maxlength="6" placeholder="••••••"
            style="
              width:100%;box-sizing:border-box;text-align:center;
              background:#f5f5f5;border:1.5px solid #e5e5e5;border-radius:12px;
              font-size:28px;font-weight:700;letter-spacing:10px;padding:16px;
              color:#111;outline:none;font-family:inherit;margin-bottom:12px;
            " />
          <p id="vl-otp-error" style="margin:0 0 12px;font-size:13px;color:#ef4444;text-align:center;min-height:18px;"></p>
          <button type="submit" id="vl-otp-btn"
            style="
              width:100%;background:#22c55e;color:#000;font-weight:700;font-size:16px;
              border:none;border-radius:14px;padding:16px;cursor:pointer;
              font-family:inherit;
            ">
            Verify &amp; unlock
          </button>
        </form>
        <div style="text-align:center;margin-top:16px;">
          <button id="vl-otp-resend" style="background:none;border:none;font-size:13px;color:#aaa;cursor:pointer;font-family:inherit;">Didn’t get it? Resend</button>
        </div>
      </div>

      <p id="vl-login-status" style="margin:12px 0 0;font-size:13px;text-align:center;color:#aaa;"></p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on backdrop tap
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  let currentPhone = "";

  // Enable Continue only when input has value
  const phoneInput = overlay.querySelector("#vl-phone-input");
  const phoneBtn = overlay.querySelector("#vl-phone-btn");
  const status = overlay.querySelector("#vl-login-status");

  phoneInput.addEventListener("input", () => {
    phoneBtn.style.opacity = phoneInput.value.trim() ? "1" : ".4";
  });

  // Step 1 submit
  overlay.querySelector("#vl-phone-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = phoneInput.value.replace(/\D/g, "");
    const phone = `+1${raw}`; // US only for now; extend with country picker later
    if (raw.length < 10) {
      status.style.color = "#ef4444";
      status.textContent = "Enter a valid 10-digit US phone number";
      return;
    }
    phoneBtn.disabled = true;
    phoneBtn.textContent = "Sending…";
    status.textContent = "";
    try {
      await VaultlineAPI.phoneStart(phone, "fan");
      currentPhone = phone;
      overlay.querySelector("#vl-step-phone").hidden = true;
      const otpStep = overlay.querySelector("#vl-step-otp");
      otpStep.hidden = false;
      overlay.querySelector("#vl-otp-hint").textContent = `We texted a 6-digit code to ${phone}.`;
      overlay.querySelector("#vl-otp-input").focus();
    } catch (err) {
      phoneBtn.disabled = false;
      phoneBtn.textContent = "Continue";
      status.style.color = "#ef4444";
      status.textContent = err.message || "Failed to send code";
    }
  });

  // Back button
  overlay.querySelector("#vl-otp-back").addEventListener("click", () => {
    overlay.querySelector("#vl-step-otp").hidden = true;
    overlay.querySelector("#vl-step-phone").hidden = false;
    phoneBtn.disabled = false;
    phoneBtn.textContent = "Continue";
  });

  // Resend
  overlay.querySelector("#vl-otp-resend").addEventListener("click", async () => {
    if (!currentPhone) return;
    const btn = overlay.querySelector("#vl-otp-resend");
    btn.textContent = "Sending…"; btn.disabled = true;
    try {
      await VaultlineAPI.phoneStart(currentPhone, "fan");
      btn.textContent = "Sent!";
      setTimeout(() => { btn.textContent = "Didn\u2019t get it? Resend"; btn.disabled = false; }, 3000);
    } catch { btn.textContent = "Didn\u2019t get it? Resend"; btn.disabled = false; }
  });

  // Step 2 submit (verify code)
  overlay.querySelector("#vl-otp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = overlay.querySelector("#vl-otp-input").value.trim();
    const errEl = overlay.querySelector("#vl-otp-error");
    const btn = overlay.querySelector("#vl-otp-btn");
    btn.disabled = true; btn.textContent = "Verifying…"; errEl.textContent = "";
    try {
      const data = await VaultlineAPI.phoneVerify(currentPhone, code);
      fanUser = data.user;
      overlay.remove();
      if (onSuccess) onSuccess();
    } catch (err) {
      btn.disabled = false; btn.textContent = "Verify & unlock";
      errEl.textContent = err.message || "Incorrect code. Try again.";
    }
  });
}

async function checkFanAuth() {
  try {
    const data = await VaultlineAPI.me();
    fanUser = data.user;
    return data.user;
  } catch {
    fanUser = null;
    return null;
  }
}

// ── API storefront loading ────────────────────────────────────────────────────
async function loadStorefrontFromApi() {
  // Get handle from ?handle= query param
  const params = new URLSearchParams(location.search);
  const handle = params.get("handle");
  if (!handle) return; // Fall through to localStorage

  try {
    const data = await VaultlineAPI.getStorefront(handle);
    if (!data || !data.profile) return;

    state.creator.profile.handle = data.profile.handle;
    state.creator.profile.bio = data.profile.bio || state.creator.profile.bio;
    state.creator.links = (data.drops || []).map((drop) => normalizeDrop({
      id: drop.id,
      title: drop.title,
      note: drop.description || "",
      price: drop.price,
      fileName: drop.drop_media?.length > 1
        ? `${drop.drop_media.length} media items`
        : drop.drop_media?.[0]?.file_name || drop.title,
      thumbnail: DEFAULT_THUMBNAIL,
      status: "active",
      url: `${PUBLIC_BASE_URL}/fan.html?handle=${encodeURIComponent(data.profile.handle)}`,
    }));
    renderAll();
  } catch (err) {
    console.warn("Could not load storefront from API:", err.message);
  }
}

async function loadLibraryFromApi() {
  try {
    const data = await VaultlineAPI.getLibrary();
    state.fan.purchases = (data.items || []).map((item) => normalizePurchase({
      id: item.id,
      dropId: item.drop_id,
      title: item.drops?.title || "Unlocked content",
      price: item.amount || 0,
      note: item.drops?.description || "",
      fileName: item.drops?.drop_media?.length > 1
        ? `${item.drops.drop_media.length} files`
        : item.drops?.drop_media?.[0]?.file_name || "unlocked-file",
      thumbnail: DEFAULT_THUMBNAIL,
      creatorHandle: item.drops?.creator_profiles?.handle || "creator",
      purchasedAt: item.created_at || new Date().toISOString(),
    }));
    renderLibrary();
    renderActivity();
    syncIcons();
  } catch (err) {
    console.warn("Could not load library from API:", err.message);
  }
}

async function openDownloadFromApi(purchaseId) {
  try {
    const data = await VaultlineAPI.getDownloadUrls(purchaseId);
    const files = data.files || [];
    if (!files.length) {
      showToast("No files found for this unlock");
      return;
    }
    // Open each file in a new tab
    files.forEach((file) => {
      const a = document.createElement("a");
      a.href = file.url;
      a.download = file.fileName || "download";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    showToast(`Downloading ${files.length} file${files.length !== 1 ? "s" : ""}…`);
  } catch (err) {
    showToast(err.message || "Download failed");
  }
}

function saveCreator() {
  localStorage.setItem(
    CREATOR_STORAGE_KEY,
    JSON.stringify({
      profile: state.creator.profile,
      bundle: state.creator.bundle,
      payout: state.creator.payout || {},
      coverImage: state.creator.coverImage,
      avatarImage: state.creator.avatarImage,
      withdrawn: state.creator.withdrawn || 0,
      operations: state.creator.operations || [],
      links: state.creator.links || [],
    }),
  );
}

function normalizePurchase(purchase) {
  return {
    id: String(purchase.id || id()),
    dropId: String(purchase.dropId || ""),
    title: String(purchase.title || "Unlocked content"),
    price: Math.max(0, Number(purchase.price) || 0),
    note: String(purchase.note || ""),
    fileName: String(purchase.fileName || "unlocked-file"),
    thumbnail: String(purchase.thumbnail || DEFAULT_THUMBNAIL),
    creatorHandle: String(purchase.creatorHandle || state.creator.profile.handle || "creator"),
    purchasedAt: String(purchase.purchasedAt || new Date().toISOString()),
  };
}

function loadFan() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAN_STORAGE_KEY) || "{}");
    state.fan.purchases = Array.isArray(saved.purchases) ? saved.purchases.map(normalizePurchase) : [];
    state.fan.viewedDrops = Array.isArray(saved.viewedDrops) ? saved.viewedDrops.map(String) : [];
  } catch {
    state.fan.purchases = [];
    state.fan.viewedDrops = [];
  }
}

function saveFan() {
  localStorage.setItem(
    FAN_STORAGE_KEY,
    JSON.stringify({
      purchases: state.fan.purchases,
      viewedDrops: state.fan.viewedDrops,
    }),
  );
}

function activeDrops() {
  return state.creator.links.filter((drop) => drop.status === "active");
}

function purchasedDropIds() {
  return new Set(state.fan.purchases.map((purchase) => purchase.dropId));
}

function ownedPurchase(dropId) {
  return state.fan.purchases.find((purchase) => purchase.dropId === dropId);
}

function creatorHandle() {
  return `@${state.creator.profile.handle || "creator"}`;
}

function storefrontUrl() {
  return `${PUBLIC_BASE_URL}/${state.creator.profile.handle || "creator"}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

function setAccountDropdown(open) {
  const dropdown = $("#account-dropdown");
  const button = $("[data-open-account-menu]");
  dropdown.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function toggleAccountDropdown() {
  setAccountDropdown($("#account-dropdown").hidden);
}

async function copyText(value, message = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    showToast(message);
  } catch {
    showToast(value);
  }
}

function setView(view, options = {}) {
  if (!["store", "library", "activity", "profile"].includes(view)) return;
  state.view = view;
  $$(".view").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
  $$("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  if (location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function markDropViewed(dropId) {
  if (state.fan.viewedDrops.includes(dropId)) return;
  const drop = state.creator.links.find((item) => item.id === dropId);
  if (!drop) return;
  drop.views += 1;
  state.fan.viewedDrops.push(dropId);
  saveCreator();
  saveFan();
}

function emptyState(icon, title, copy, action = "") {
  return `
    <div class="empty-state">
      <div class="empty-state-content">
        <span class="empty-icon"><i data-lucide="${icon}"></i></span>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(copy)}</span>
        ${action}
      </div>
    </div>
  `;
}

function renderCreator() {
  const handle = creatorHandle();
  $$("[data-creator-handle]").forEach((element) => {
    element.textContent = handle;
  });
  $$("[data-creator-bio]").forEach((element) => {
    element.textContent = state.creator.profile.bio;
  });
  $("#creator-cover").src = state.creator.coverImage || DEFAULT_COVER;
  $("#creator-avatar").src = state.creator.avatarImage || DEFAULT_AVATAR;

  const drops = activeDrops();
  const purchases = purchasedDropIds();
  $("#store-stat-drops").textContent = drops.length;
  $("#store-stat-unlocks").textContent = state.creator.links.reduce((total, drop) => total + drop.sales, 0);
  $("#store-stat-owned").textContent = drops.filter((drop) => purchases.has(drop.id)).length;
}

function renderStore() {
  const grid = $("#drop-grid");
  const drops = activeDrops();
  const owned = purchasedDropIds();

  if (!drops.length) {
    grid.innerHTML = emptyState(
      "lock-keyhole",
      "No drops available",
      "When this creator publishes a locked file, it will show up here for fans to unlock.",
      `<button class="primary-button" type="button" data-refresh-store>
        <i data-lucide="refresh-cw"></i>
        <span>Check again</span>
      </button>`,
    );
    return;
  }

  grid.innerHTML = drops
    .map((drop) => {
      const hasDrop = owned.has(drop.id);
      return `
        <article class="drop-card">
          <div class="drop-media">
            <img src="${escapeHtml(drop.thumbnail)}" alt="" />
            <span class="media-lock"><i data-lucide="${hasDrop ? "lock-open" : "lock-keyhole"}"></i>${hasDrop ? "Unlocked" : "Locked"}</span>
            ${hasDrop ? `<span class="owned-badge"><i data-lucide="check"></i>Owned</span>` : ""}
            <span class="price-pill">${money(drop.price)}</span>
          </div>
          <div class="drop-body">
            <h3>${escapeHtml(drop.title)}</h3>
            <p>${escapeHtml(drop.note || "Buy once and keep it in your library.")}</p>
            <div class="drop-actions">
              <button class="secondary-button" type="button" data-open-drop="${drop.id}">
                <i data-lucide="eye"></i>
                <span>Preview</span>
              </button>
              <button class="primary-button" type="button" data-buy-drop="${drop.id}">
                <i data-lucide="${hasDrop ? "folder-open" : "credit-card"}"></i>
                <span>${hasDrop ? "Open" : "Unlock"}</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLibrary() {
  const grid = $("#library-grid");
  $("#library-count").textContent = state.fan.purchases.length;

  if (!state.fan.purchases.length) {
    grid.innerHTML = emptyState(
      "folder-open",
      "Your library is empty",
      "Unlocked drops will appear here right after purchase.",
      `<button class="primary-button" type="button" data-view="store">
        <i data-lucide="store"></i>
        <span>Browse drops</span>
      </button>`,
    );
    return;
  }

  grid.innerHTML = state.fan.purchases
    .map(
      (purchase) => `
        <article class="library-card">
          <div class="library-media">
            <img src="${escapeHtml(purchase.thumbnail)}" alt="" />
            <span class="owned-badge"><i data-lucide="check"></i>Unlocked</span>
          </div>
          <div class="library-body">
            <h3>${escapeHtml(purchase.title)}</h3>
            <p>${escapeHtml(purchase.fileName)} from @${escapeHtml(purchase.creatorHandle)}</p>
            <button class="primary-button" type="button" data-open-purchase="${purchase.id}">
              <i data-lucide="folder-open"></i>
              <span>Open file</span>
            </button>
          </div>
        </article>
      `,
    )
    .join("");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function renderActivity() {
  const list = $("#receipt-list");
  const total = state.fan.purchases.reduce((sum, purchase) => sum + purchase.price, 0);
  $("#activity-total").textContent = money(total);

  if (!state.fan.purchases.length) {
    list.innerHTML = emptyState(
      "receipt-text",
      "No purchases yet",
      "Receipts will be saved here as soon as you unlock content.",
      `<button class="primary-button" type="button" data-view="store">
        <i data-lucide="store"></i>
        <span>Browse drops</span>
      </button>`,
    );
    return;
  }

  list.innerHTML = state.fan.purchases
    .map(
      (purchase) => `
        <button class="receipt-row" type="button" data-open-purchase="${purchase.id}">
          <span class="receipt-icon"><i data-lucide="receipt-text"></i></span>
          <span class="receipt-main">
            <strong>${escapeHtml(purchase.title)}</strong>
            <span>${formatDate(purchase.purchasedAt)} - @${escapeHtml(purchase.creatorHandle)}</span>
          </span>
          <span class="receipt-amount">
            <strong>${money(purchase.price)}</strong>
            <span>Permanent unlock</span>
          </span>
        </button>
      `,
    )
    .join("");
}

function renderAll() {
  renderCreator();
  renderStore();
  renderLibrary();
  renderActivity();
  syncIcons();
}

function closeDialog() {
  const dialog = $("#fan-dialog");
  if (dialog.open) dialog.close();
}

function openDialog(title, body) {
  const dialog = $("#fan-dialog");
  dialog.innerHTML = `
    <div class="dialog-shell">
      <div class="dialog-head">
        <h2>${escapeHtml(title)}</h2>
        <button class="icon-button" type="button" data-close-dialog aria-label="Close dialog">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="dialog-body">${body}</div>
    </div>
  `;
  dialog.showModal();
  syncIcons();
}

function openDrop(dropId) {
  const drop = activeDrops().find((item) => item.id === dropId);
  if (!drop) {
    showToast("Drop is no longer available");
    return;
  }
  markDropViewed(drop.id);
  const purchase = ownedPurchase(drop.id);
  openDialog(
    purchase ? "Unlocked drop" : "Unlock drop",
    `
      <div class="checkout-media">
        <img src="${escapeHtml(drop.thumbnail)}" alt="" />
        <span class="media-lock"><i data-lucide="${purchase ? "lock-open" : "lock-keyhole"}"></i>${purchase ? "Unlocked" : "Locked"}</span>
      </div>
      <div class="checkout-summary">
        <div>
          <h3>${escapeHtml(drop.title)}</h3>
          <p>${escapeHtml(drop.note || "Buy once and keep it in your library.")}</p>
        </div>
        <span class="checkout-price">${money(drop.price)}</span>
      </div>
      <div class="checkout-line">
        <i data-lucide="${purchase ? "folder-open" : "shield-check"}"></i>
        <div>
          <strong>${purchase ? "Already in your library" : "Permanent unlock"}</strong>
          <span>${purchase ? escapeHtml(purchase.fileName) : "Saved to your fan account after payment"}</span>
        </div>
      </div>
      <div class="checkout-line">
        <i data-lucide="credit-card"></i>
        <div>
          <strong>Card ending in 4242</strong>
          <span>${purchase ? "Receipt saved" : `Charged ${money(drop.price)} today`}</span>
        </div>
      </div>
      <button class="primary-button" type="button" data-buy-drop="${drop.id}">
        <i data-lucide="${purchase ? "folder-open" : "credit-card"}"></i>
        <span>${purchase ? "Open file" : `Pay ${money(drop.price)}`}</span>
      </button>
    `,
  );
}

async function buyDrop(dropId) {
  const currentPurchase = ownedPurchase(dropId);
  if (currentPurchase) {
    openPurchase(currentPurchase.id);
    return;
  }

  const drop = activeDrops().find((item) => item.id === dropId);
  if (!drop) {
    showToast("Drop is no longer available");
    return;
  }

  // Require fan to be signed in
  if (!fanUser) {
    showFanLoginOverlay(() => buyDrop(dropId));
    return;
  }

  try {
    const data = await VaultlineAPI.startCheckout(dropId);
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      showToast("Checkout unavailable");
    }
  } catch (err) {
    if (err.message?.toLowerCase().includes("stripe") || err.message?.toLowerCase().includes("not configured")) {
      showToast("Payments coming soon — Stripe not configured yet");
    } else {
      showToast(err.message || "Checkout failed");
    }
  }
}

function openPurchase(purchaseId) {
  const purchase = state.fan.purchases.find((item) => item.id === purchaseId);
  if (!purchase) return;
  closeDialog();
  openDialog(
    "Unlocked file",
    `
      <div class="checkout-media">
        <img src="${escapeHtml(purchase.thumbnail)}" alt="" />
        <span class="owned-badge"><i data-lucide="check"></i>Unlocked</span>
      </div>
      <div class="checkout-summary">
        <div>
          <h3>${escapeHtml(purchase.title)}</h3>
          <p>${escapeHtml(purchase.note || "This file is saved in your library.")}</p>
        </div>
        <span class="checkout-price">${money(purchase.price)}</span>
      </div>
      <div class="checkout-line">
        <i data-lucide="file-check-2"></i>
        <div>
          <strong>${escapeHtml(purchase.fileName)}</strong>
          <span>Purchased ${formatDate(purchase.purchasedAt)}</span>
        </div>
      </div>
      <button class="primary-button" type="button" data-download-file="${purchase.id}">
        <i data-lucide="download"></i>
        <span>Download file</span>
      </button>
    `,
  );
}

function openPaymentCard() {
  openDialog(
    "Payment method",
    `
      <div class="checkout-line">
        <i data-lucide="credit-card"></i>
        <div>
          <strong>Card ending in 4242</strong>
          <span>Ready for one-tap unlocks</span>
        </div>
      </div>
      <div class="checkout-line">
        <i data-lucide="shield-check"></i>
        <div>
          <strong>Checkout protection</strong>
          <span>Receipts are saved to this fan profile.</span>
        </div>
      </div>
      <button class="primary-button" type="button" data-close-dialog>
        <i data-lucide="check"></i>
        <span>Done</span>
      </button>
    `,
  );
}

function refreshFromStorage() {
  loadCreator();
  loadFan();
  renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  refreshFromStorage();
  const initialView = location.hash.replace("#", "");
  setView(initialView || "store", { instant: true });

  // Check fan auth + load storefront from API
  checkFanAuth().then((user) => {
    loadStorefrontFromApi();
    if (user) loadLibraryFromApi();
  });

  document.addEventListener("click", (event) => {
    const accountSurface = event.target.closest(".account-dropdown, [data-open-account-menu]");
    if (!accountSurface) setAccountDropdown(false);

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);

    const accountButton = event.target.closest("[data-open-account-menu]");
    if (accountButton) {
      event.stopPropagation();
      toggleAccountDropdown();
      return;
    }

    const logoutButton = event.target.closest("[data-logout]");
    if (logoutButton) {
      setAccountDropdown(false);
      VaultlineAPI.authLogout().catch(() => {});
      fanUser = null;
      state.fan.purchases = [];
      renderLibrary();
      renderActivity();
      syncIcons();
      showToast("Logged out");
      return;
    }

    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) closeDialog();

    const copyStoreButton = event.target.closest("[data-copy-storefront]");
    if (copyStoreButton) copyText(storefrontUrl(), "Storefront link copied");

    const refreshButton = event.target.closest("[data-refresh-store]");
    if (refreshButton) {
      refreshFromStorage();
      showToast("Store refreshed");
    }

    const openDropButton = event.target.closest("[data-open-drop]");
    if (openDropButton) openDrop(openDropButton.dataset.openDrop);

    const buyButton = event.target.closest("[data-buy-drop]");
    if (buyButton) buyDrop(buyButton.dataset.buyDrop);

    const openPurchaseButton = event.target.closest("[data-open-purchase]");
    if (openPurchaseButton) openPurchase(openPurchaseButton.dataset.openPurchase);

    const downloadButton = event.target.closest("[data-download-file]");
    if (downloadButton) {
      const purchaseId = downloadButton.dataset.downloadFile;
      if (!purchaseId) { showToast("File ready in your library"); return; }
      if (!fanUser) {
        showFanLoginOverlay(() => openDownloadFromApi(purchaseId));
        return;
      }
      openDownloadFromApi(purchaseId);
    }

    const paymentButton = event.target.closest("[data-open-payment-card]");
    if (paymentButton) openPaymentCard();
  });

  $("#fan-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDialog();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setAccountDropdown(false);
  });

  window.addEventListener("hashchange", () => {
    setView(location.hash.replace("#", "") || "store", { instant: true });
  });

  window.addEventListener("storage", (event) => {
    if ([CREATOR_STORAGE_KEY, FAN_STORAGE_KEY].includes(event.key)) {
      refreshFromStorage();
    }
  });
});
