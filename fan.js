const CREATOR_STORAGE_KEY = "vaultline-settings-v1";
const FAN_STORAGE_KEY = "vaultline-fan-v1";
const PUBLIC_BASE_URL =
  window.location.origin && window.location.origin !== "null" ? window.location.origin : "http://localhost:8787";
const DEFAULT_THUMBNAIL = "assets/thumb-gallery.svg";
const DEFAULT_COVER = "assets/profile-cover.svg";
const DEFAULT_AVATAR = "assets/avatar-tile.svg";

const state = {
  view: "discover",
  discover: {
    creators: [],
  },
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
    access: String(link.access || "everyone"),
    download: String(link.download || "allowed"),
    downloadExtraPercent: Math.max(0, Number(link.downloadExtraPercent ?? link.download_extra_percent) || 0),
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

function normalizeDiscoverDrop(drop, creatorHandle = "creator") {
  return {
    id: String(drop.id || id()),
    title: String(drop.title || "Untitled drop"),
    note: String(drop.description || drop.note || "Permanent unlock from this creator."),
    price: Math.max(1, Number(drop.price) || 1),
    download: String(drop.download || "allowed"),
    downloadExtraPercent: Math.max(0, Number(drop.downloadExtraPercent ?? drop.download_extra_percent) || 0),
    mediaCount: Math.max(0, Number(drop.mediaCount) || 0),
    fileName: String(drop.fileName || "locked-file"),
    thumbnail: String(drop.thumbnail || DEFAULT_THUMBNAIL),
    creatorHandle: String(creatorHandle || "creator").replace(/^@/, ""),
    unlockCount: Math.max(0, Number(drop.unlockCount) || 0),
  };
}

function effectiveDropPrice(drop) {
  const price = Number(drop?.price) || 0;
  if (drop?.download === "extra") {
    return Number((price * (1 + (Number(drop.downloadExtraPercent) || 0) / 100)).toFixed(2));
  }
  return price;
}

function normalizeDiscoverCreator(creator = {}) {
  const handle = String(creator.handle || "creator").replace(/^@/, "");
  const drops = Array.isArray(creator.drops)
    ? creator.drops.map((drop) => normalizeDiscoverDrop(drop, handle))
    : [];
  return {
    handle,
    bio: String(creator.bio || "Private drops and creator packs in one clean storefront."),
    dropCount: Math.max(drops.length, Number(creator.dropCount) || 0),
    unlockCount: Math.max(0, Number(creator.unlockCount) || 0),
    drops,
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
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111;">Start with Vault'd</h2>
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
      updateFanAccountUI();
      loadLibraryFromApi();
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
  const focusedDropId = params.get("drop");
  if (!handle && !focusedDropId) return; // Fall through to localStorage

  try {
    let publicDrops = [];
    if (handle) {
      const data = await VaultlineAPI.getStorefront(handle);
      if (data?.profile) {
        state.creator.profile.handle = data.profile.handle;
        state.creator.profile.bio = data.profile.bio || state.creator.profile.bio;
        publicDrops = data.drops || [];
      }
    }

    if (focusedDropId) {
      const data = await VaultlineAPI.getPublicDrop(focusedDropId);
      if (data?.drop) {
        const focusedDrop = data.drop;
        state.creator.profile.handle = focusedDrop.creator_profiles?.handle || state.creator.profile.handle;
        if (!publicDrops.some((drop) => drop.id === focusedDrop.id)) publicDrops.unshift(focusedDrop);
      }
    }

    state.creator.links = publicDrops.map((drop) => normalizeDrop({
      id: drop.id,
      title: drop.title,
      note: drop.description || "",
      price: drop.price,
      access: drop.access,
      download: drop.download,
      downloadExtraPercent: drop.download_extra_percent,
      fileName: drop.drop_media?.length > 1
        ? `${drop.drop_media.length} media items`
        : drop.drop_media?.[0]?.file_name || drop.title,
      thumbnail: DEFAULT_THUMBNAIL,
      status: "active",
      url: `${PUBLIC_BASE_URL}/fan.html?handle=${encodeURIComponent(state.creator.profile.handle)}&drop=${encodeURIComponent(drop.id)}#store`,
    }));
    renderAll();
  } catch (err) {
    console.warn("Could not load storefront from API:", err.message);
  }
}

async function loadDiscoverFromApi() {
  try {
    const data = await VaultlineAPI.discover();
    state.discover.creators = (data.creators || []).map(normalizeDiscoverCreator);
    renderDiscover();
    syncIcons();
  } catch (err) {
    console.warn("Could not load discover feed from API:", err.message);
    renderDiscover();
    syncIcons();
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

function localDiscoverCreators() {
  const drops = activeDrops();
  if (!drops.length) return [];
  return [
    normalizeDiscoverCreator({
      handle: state.creator.profile.handle,
      bio: state.creator.profile.bio,
      dropCount: drops.length,
      unlockCount: drops.reduce((total, drop) => total + drop.sales, 0),
      drops: drops.map((drop) => ({
        id: drop.id,
        title: drop.title,
        note: drop.note,
        price: drop.price,
        download: drop.download,
        downloadExtraPercent: drop.downloadExtraPercent,
        mediaCount: 1,
        fileName: drop.fileName,
        thumbnail: drop.thumbnail,
        unlockCount: drop.sales,
      })),
    }),
  ];
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
  return `${PUBLIC_BASE_URL}/fan.html?handle=${encodeURIComponent(state.creator.profile.handle || "creator")}#store`;
}

function discoverUrl() {
  return `${PUBLIC_BASE_URL}/fan.html?discover=1#discover`;
}

function currentShareUrl() {
  if (state.view === "store" && state.creator.profile.handle && state.creator.profile.handle !== "creator") {
    return new URLSearchParams(location.search).get("drop") ? window.location.href : storefrontUrl();
  }
  return discoverUrl();
}

function openCreatorEntry() {
  window.location.assign("/app.html#create");
}

function updateShareActionUI() {
  const shareButton = $(".topbar [data-copy-storefront]");
  if (!shareButton) return;
  const canShareStore = state.view === "store" && state.creator.profile.handle && state.creator.profile.handle !== "creator";
  const canShareFanHome = Boolean(fanUser) && state.view === "discover";
  shareButton.hidden = !(canShareStore || canShareFanHome);
  shareButton.setAttribute("aria-label", canShareStore ? "Share storefront" : "Share fan home");
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

function updateFanAccountUI() {
  const button = $(".fan-chip");
  const dropdown = $("#account-dropdown");
  if (!button) return;

  if (fanUser) {
    button.removeAttribute("data-fan-signup");
    button.setAttribute("data-open-account-menu", "");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Account menu");
    button.innerHTML = `
      <span class="fan-initial" aria-hidden="true">F</span>
      <span>Fan</span>
    `;
    if (dropdown) dropdown.hidden = true;
    updateShareActionUI();
    syncIcons();
    return;
  }

  if (dropdown) dropdown.hidden = true;
  button.removeAttribute("data-open-account-menu");
  button.removeAttribute("aria-haspopup");
  button.removeAttribute("aria-expanded");
  button.setAttribute("data-fan-signup", "");
  button.setAttribute("aria-label", "Sign up as a fan");
  button.innerHTML = `
    <span class="fan-initial" aria-hidden="true">F</span>
    <span>Sign up</span>
  `;
  updateShareActionUI();
  syncIcons();
}

function setAccountDropdown(open) {
  const dropdown = $("#account-dropdown");
  const button = $("[data-open-account-menu]");
  if (!dropdown || !button) return;
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
  if (!["discover", "store", "library", "activity", "profile"].includes(view)) return;
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
  updateShareActionUI();
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

function renderDiscover() {
  const grid = $("#discover-grid");
  if (!grid) return;
  const creators = state.discover.creators.length ? state.discover.creators : localDiscoverCreators();

  if (!creators.length) {
    grid.innerHTML = emptyState(
      "store",
      "No public drops yet",
      "Creators with live public drops will appear here. For now, start selling or check back after creators publish.",
      `<a class="primary-button" href="/app.html#create" data-creator-entry>
        <i data-lucide="plus-square"></i>
        <span>Start selling</span>
      </a>`,
    );
    return;
  }

  grid.innerHTML = creators
    .map((creator) => {
      const drops = creator.drops.slice(0, 3);
      const prices = drops.map((drop) => effectiveDropPrice(drop)).filter(Boolean);
      const startingPrice = prices.length ? Math.min(...prices) : 0;
      const leadDrop = drops[0] || normalizeDiscoverDrop({}, creator.handle);
      return `
        <article class="discover-card">
          <button class="discover-media" type="button" data-open-creator="${escapeHtml(creator.handle)}" aria-label="Open @${escapeHtml(creator.handle)} storefront">
            <img src="${escapeHtml(leadDrop.thumbnail)}" alt="" />
            <span class="media-lock"><i data-lucide="lock-keyhole"></i>${creator.dropCount} drop${creator.dropCount === 1 ? "" : "s"}</span>
            ${startingPrice ? `<span class="price-pill">From ${money(startingPrice)}</span>` : ""}
          </button>
          <div class="discover-body">
            <span class="tiny-label">@${escapeHtml(creator.handle)}</span>
            <h3>${escapeHtml(leadDrop.title || "Creator storefront")}</h3>
            <p>${escapeHtml(creator.bio || "Browse this creator's public locked drops.")}</p>
            <div class="discover-drop-list">
              ${drops
                .map(
                  (drop) => `
                    <button class="discover-drop-row" type="button" data-open-creator="${escapeHtml(creator.handle)}">
                      <span>${escapeHtml(drop.title)}</span>
                      <strong>${money(effectiveDropPrice(drop))}</strong>
                    </button>
                  `,
                )
                .join("")}
            </div>
            <button class="primary-button" type="button" data-open-creator="${escapeHtml(creator.handle)}">
              <i data-lucide="store"></i>
              <span>View storefront</span>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
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
            <span class="price-pill">${money(effectiveDropPrice(drop))}</span>
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
      `<button class="primary-button" type="button" data-view="discover">
        <i data-lucide="compass"></i>
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
      `<button class="primary-button" type="button" data-view="discover">
        <i data-lucide="compass"></i>
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

function renderAccount() {
  const panel = $("#account-panel");
  if (!panel) return;

  if (!fanUser) {
    panel.innerHTML = `
      <article class="account-card wide">
        <span class="card-icon"><i data-lucide="circle-user-round"></i></span>
        <div>
          <h2>Create your fan account</h2>
          <p>Sign up once to save purchases, receipts, and your permanent content library.</p>
        </div>
        <button class="small-button dark" type="button" data-fan-signup>Sign up</button>
      </article>

      <article class="account-card">
        <span class="card-icon yellow"><i data-lucide="folder-open"></i></span>
        <div>
          <h2>Library</h2>
          <p>Your unlocked drops appear here after checkout.</p>
        </div>
        <button class="small-button" type="button" data-view="discover">Browse</button>
      </article>

      <article class="account-card wide">
        <span class="card-icon blue"><i data-lucide="shield-check"></i></span>
        <div>
          <h2>Buyer protection</h2>
          <p>Paid unlocks are tied to your verified account, not a temporary browser session.</p>
        </div>
      </article>

      <article class="account-card wide">
        <span class="card-icon"><i data-lucide="circle-help"></i></span>
        <div>
          <h2>FAQ</h2>
          <p>See how unlocks, downloads, and fan libraries work before buying.</p>
        </div>
        <a class="small-button" href="/#faq">Open</a>
      </article>
    `;
    return;
  }

  panel.innerHTML = `
    <article class="account-card">
      <span class="card-icon"><i data-lucide="credit-card"></i></span>
      <div>
        <h2>Payment method</h2>
        <p>Cards are handled securely during Stripe checkout.</p>
      </div>
      <button class="small-button dark" type="button" data-open-payment-card>Manage</button>
    </article>

    <article class="account-card">
      <span class="card-icon yellow"><i data-lucide="store"></i></span>
      <div>
        <h2>Browse creators</h2>
        <p>Find public drops and save purchases to your library.</p>
      </div>
      <button class="small-button" type="button" data-view="discover">Open</button>
    </article>

    <article class="account-card wide">
      <span class="card-icon blue"><i data-lucide="shield-check"></i></span>
      <div>
        <h2>Buyer protection</h2>
        <p>Purchases are tied to your fan account and restored from your library.</p>
      </div>
    </article>

    <article class="account-card wide">
      <span class="card-icon"><i data-lucide="circle-help"></i></span>
      <div>
        <h2>FAQ</h2>
        <p>See how unlocks, downloads, and fan libraries work before buying.</p>
      </div>
      <a class="small-button" href="/#faq">Open</a>
    </article>
  `;
}

function renderAll() {
  renderDiscover();
  renderCreator();
  renderStore();
  renderLibrary();
  renderActivity();
  renderAccount();
  updateShareActionUI();
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
        <span class="checkout-price">${money(effectiveDropPrice(drop))}</span>
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
          <strong>Secure Stripe checkout</strong>
          <span>${purchase ? "Receipt saved to your library" : `You will review and pay ${money(effectiveDropPrice(drop))} on Stripe`}</span>
        </div>
      </div>
      <button class="primary-button" type="button" data-buy-drop="${drop.id}">
        <i data-lucide="${purchase ? "folder-open" : "credit-card"}"></i>
        <span>${purchase ? "Open file" : `Pay ${money(effectiveDropPrice(drop))}`}</span>
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
          <strong>Secure checkout</strong>
          <span>Payment methods are managed through Stripe when you buy.</span>
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
  updateFanAccountUI();
  loadDiscoverFromApi();
  const params = new URLSearchParams(location.search);
  const hasStorefrontHandle = Boolean(params.get("handle") || params.get("drop"));
  const initialView = location.hash.replace("#", "");
  setView(initialView || (hasStorefrontHandle ? "store" : "discover"), { instant: true });

  // Check fan auth + load storefront from API
  checkFanAuth().then((user) => {
    updateFanAccountUI();
    loadStorefrontFromApi();
    if (user) loadLibraryFromApi();
    if (params.get("signup") === "fan" && !user) {
      showFanLoginOverlay(() => setView("library"));
    }
  });

  document.addEventListener("click", (event) => {
    const accountSurface = event.target.closest(".account-dropdown, [data-open-account-menu]");
    if (!accountSurface) setAccountDropdown(false);

    const creatorEntry = event.target.closest("[data-creator-entry]");
    if (creatorEntry) {
      event.preventDefault();
      openCreatorEntry();
      return;
    }

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);

    const fanSignupButton = event.target.closest("[data-fan-signup]");
    if (fanSignupButton) {
      if (fanUser) {
        setView("library");
      } else {
        showFanLoginOverlay(() => setView("library"));
      }
      return;
    }

    const accountButton = event.target.closest("[data-open-account-menu]");
    if (accountButton) {
      event.stopPropagation();
      toggleAccountDropdown();
      return;
    }

    const logoutButton = event.target.closest("[data-logout]");
    if (logoutButton) {
      setAccountDropdown(false);
      fanUser = null;
      state.fan.purchases = [];
      VaultlineAPI.authLogout()
        .catch(() => {})
        .finally(() => {
          window.location.href = "index.html?logout=1";
        });
      return;
    }

    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) closeDialog();

    const copyStoreButton = event.target.closest("[data-copy-storefront]");
    if (copyStoreButton) {
      const isStore = state.view === "store" && state.creator.profile.handle !== "creator";
      copyText(currentShareUrl(), isStore ? "Storefront link copied" : "Discover link copied");
    }

    const refreshButton = event.target.closest("[data-refresh-store]");
    if (refreshButton) {
      refreshFromStorage();
      showToast("Store refreshed");
    }

    const refreshDiscoverButton = event.target.closest("[data-refresh-discover]");
    if (refreshDiscoverButton) {
      loadDiscoverFromApi();
      showToast("Feed refreshed");
    }

    const openCreatorButton = event.target.closest("[data-open-creator]");
    if (openCreatorButton) {
      window.location.href = `fan.html?handle=${encodeURIComponent(openCreatorButton.dataset.openCreator)}#store`;
      return;
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
    const params = new URLSearchParams(location.search);
    const hasHandle = Boolean(params.get("handle") || params.get("drop"));
    setView(location.hash.replace("#", "") || (hasHandle ? "store" : "discover"), { instant: true });
  });

  window.addEventListener("storage", (event) => {
    if ([CREATOR_STORAGE_KEY, FAN_STORAGE_KEY].includes(event.key)) {
      refreshFromStorage();
    }
  });
});
