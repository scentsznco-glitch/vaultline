const CREATOR_STORAGE_KEY = "vaultline-settings-v1";
const FAN_STORAGE_KEY = "vaultline-fan-v1";
const FAN_MESSAGE_STORAGE_KEY = "vaultline-fan-messages-v1";
const PUBLIC_BASE_URL = "https://vaultd.me";
const DEFAULT_THUMBNAIL = "assets/thumb-gallery.svg";
const DEFAULT_COVER = "assets/profile-cover.svg";
const DEFAULT_AVATAR = "assets/avatar-tile.svg";
const CUSTOMER_PRIVACY_SECURITY_FEE_PERCENT = 15;

const state = {
  view: "discover",
  discover: {
    creators: [],
  },
  checkout: {
    dropIds: [],
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

function publicUrl(path) {
  return `${PUBLIC_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizePublicUrl(value) {
  return String(value || "")
    .replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, PUBLIC_BASE_URL)
    .replace(/^https?:\/\/vaultline\.app/i, PUBLIC_BASE_URL)
    .replace(/^http:\/\/vaultd\.me/i, PUBLIC_BASE_URL);
}

function dropPublicRef(dropId) {
  const clean = String(dropId || "").trim().replace(/^drop[_-]?/i, "");
  return (clean || String(dropId || "link")).slice(0, 10).toLowerCase();
}

function purchaseLinkLabel(dropId) {
  return `Purchase Link #${dropPublicRef(dropId)}`;
}

function dropShortUrl(dropId) {
  return publicUrl(`/l/${encodeURIComponent(dropPublicRef(dropId))}`);
}

function normalizeDrop(link) {
  const dropId = String(link.id);
  const publicRef = String(link.publicRef || link.public_ref || link.shortRef || link.short_ref || dropPublicRef(dropId));
  return {
    id: dropId,
    publicRef,
    title: String(link.title || "Untitled drop"),
    price: Math.max(1, Number(link.price) || 1),
    access: String(link.access || "everyone"),
    download: String(link.download || "allowed"),
    downloadExtraPercent: Math.max(0, Number(link.downloadExtraPercent ?? link.download_extra_percent) || 0),
    mediaCount: Math.max(1, Number(link.mediaCount ?? link.media_count) || 1),
    note: String(link.note || "Permanent unlock from this creator."),
    fileName: String(link.fileName || "locked-file"),
    thumbnail: String(link.thumbnail || DEFAULT_THUMBNAIL),
    status: link.status === "expired" ? "expired" : "active",
    views: Math.max(0, Number(link.views) || 0),
    sales: Math.max(0, Number(link.sales) || 0),
    revenue: Math.max(0, Number(link.revenue) || 0),
    createdAt: String(link.createdAt || link.created_at || new Date().toISOString()),
    url: dropShortUrl(publicRef),
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

function privacySecurityFee(drop) {
  return Number((effectiveDropPrice(drop) * (CUSTOMER_PRIVACY_SECURITY_FEE_PERCENT / 100)).toFixed(2));
}

function buyerCheckoutTotal(drop) {
  return Number((effectiveDropPrice(drop) + privacySecurityFee(drop)).toFixed(2));
}

function roundMoney(value) {
  return Number((Math.max(0, Number(value) || 0)).toFixed(2));
}

function checkoutBundleDiscountRate(count) {
  if (count >= 4) return 0.3;
  if (count === 3) return 0.2;
  if (count === 2) return 0.1;
  return 0;
}

function checkoutProgressText(count) {
  if (count <= 1) return "Add 1 more to get 10% off";
  if (count === 2) return "Add 1 more to get 20% off";
  if (count === 3) return "Add 1 more to get 30% off";
  return "Best bundle discount unlocked";
}

function checkoutProgressPercent(count) {
  return Math.min(100, Math.max(18, count * 25));
}

function findActiveDrop(dropId) {
  const lookup = String(dropId || "").trim();
  const ref = dropPublicRef(lookup);
  return activeDrops().find((item) => {
    const aliases = [
      item.id,
      item.publicRef,
      item.shortRef,
      item.url,
      dropPublicRef(item.id),
      dropPublicRef(item.publicRef),
      dropPublicRef(item.shortRef),
    ].filter(Boolean).map(String);

    return aliases.some((alias) => alias === lookup || dropPublicRef(alias) === ref || alias.endsWith(`/l/${lookup}`));
  });
}

function focusedDropParam() {
  return new URLSearchParams(location.search).get("drop") || "";
}

function currentFocusedDrop() {
  const dropRef = focusedDropParam();
  return dropRef ? findActiveDrop(dropRef) : null;
}

function checkoutDrops() {
  const seen = new Set();
  return state.checkout.dropIds
    .map((dropId) => findActiveDrop(dropId))
    .filter((drop) => {
      if (!drop || seen.has(drop.id)) return false;
      seen.add(drop.id);
      return true;
    });
}

function checkoutTotals(drops) {
  const subtotal = roundMoney(drops.reduce((sum, drop) => sum + effectiveDropPrice(drop), 0));
  const discountRate = checkoutBundleDiscountRate(drops.length);
  const discount = roundMoney(subtotal * discountRate);
  const order = roundMoney(subtotal - discount);
  const privacyFee = roundMoney(order * (CUSTOMER_PRIVACY_SECURITY_FEE_PERCENT / 100));
  const total = roundMoney(order + privacyFee);
  return { subtotal, discountRate, discount, order, privacyFee, total };
}

function recommendedDropsForCheckout(drops) {
  const selected = new Set(drops.map((drop) => drop.id));
  const owned = purchasedDropIds();
  return activeDrops()
    .filter((drop) => !selected.has(drop.id) && !owned.has(drop.id))
    .slice(0, 6);
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
          <label style="display:flex;align-items:flex-start;gap:10px;margin:0 0 16px;font-size:13px;color:#555;line-height:1.4;">
            <input id="vl-phone-age" type="checkbox" required style="margin-top:2px;accent-color:#22c55e;" />
            <span>I confirm I am 18 or older and agree to Vault'd terms.</span>
          </label>
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
  const ageInput = overlay.querySelector("#vl-phone-age");
  const phoneBtn = overlay.querySelector("#vl-phone-btn");
  const status = overlay.querySelector("#vl-login-status");

  const syncPhoneButton = () => {
    phoneBtn.style.opacity = phoneInput.value.trim() && ageInput.checked ? "1" : ".4";
  };
  phoneInput.addEventListener("input", syncPhoneButton);
  ageInput.addEventListener("change", syncPhoneButton);

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
    if (!ageInput.checked) {
      status.style.color = "#ef4444";
      status.textContent = "Confirm you are 18+ to continue.";
      return;
    }
    phoneBtn.disabled = true;
    phoneBtn.textContent = "Sending…";
    status.textContent = "";
    try {
      await VaultlineAPI.phoneStart(phone, "fan", true);
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
      await VaultlineAPI.phoneStart(currentPhone, "fan", true);
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
      updateFanSessionUI();
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
    let focusedResolvedDropId = "";
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
        focusedResolvedDropId = focusedDrop.id;
        state.creator.profile.handle = focusedDrop.creator_profiles?.handle || state.creator.profile.handle;
        if (!publicDrops.some((drop) => drop.id === focusedDrop.id)) publicDrops.unshift(focusedDrop);
      }
    }

    state.creator.links = publicDrops.map((drop) => normalizeDrop({
      id: drop.id,
      publicRef: focusedDropId && drop.id === focusedResolvedDropId ? focusedDropId : drop.public_ref,
      title: drop.title,
      note: drop.description || "",
      price: drop.price,
      access: drop.access,
      download: drop.download,
      downloadExtraPercent: drop.download_extra_percent,
      mediaCount: drop.drop_media?.length || 1,
      fileName: drop.drop_media?.length > 1
        ? `${drop.drop_media.length} media items`
        : drop.drop_media?.[0]?.file_name || drop.title,
      thumbnail: drop.thumbnail || DEFAULT_THUMBNAIL,
      status: "active",
      createdAt: drop.created_at,
      url: dropShortUrl(drop.id),
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
      thumbnail: item.drops?.thumbnail || DEFAULT_THUMBNAIL,
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

function saveLocalCreatorMessage(message) {
  const messages = JSON.parse(localStorage.getItem(FAN_MESSAGE_STORAGE_KEY) || "[]");
  messages.unshift({
    id: id(),
    creatorHandle: state.creator.profile.handle || "creator",
    fanEmail: fanUser?.email || "",
    message,
    createdAt: new Date().toISOString(),
    status: "preview",
  });
  localStorage.setItem(FAN_MESSAGE_STORAGE_KEY, JSON.stringify(messages.slice(0, 50)));
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
  return publicUrl(`/fan.html?handle=${encodeURIComponent(state.creator.profile.handle || "creator")}#store`);
}

function discoverUrl() {
  return publicUrl("/fan.html?discover=1#discover");
}

function currentShareUrl() {
  if (state.view === "store" && state.creator.profile.handle && state.creator.profile.handle !== "creator") {
    const dropId = new URLSearchParams(location.search).get("drop");
    return dropId ? dropShortUrl(dropId) : storefrontUrl();
  }
  return discoverUrl();
}

function openCreatorEntry() {
  window.location.assign("/app.html#create");
}

function updateShareActionUI() {
  const shareButton = $(".topbar [data-copy-storefront]");
  if (!shareButton) return;
  shareButton.hidden = true;
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

function updateFanHomeActionUI() {
  const button = $("#fan-home-primary-action");
  if (!button) return;

  if (fanUser) {
    button.removeAttribute("data-fan-signup");
    button.setAttribute("data-view", "library");
    button.innerHTML = `
      <i data-lucide="folder-open"></i>
      <span>Open my library</span>
    `;
    return;
  }

  button.removeAttribute("data-view");
  button.setAttribute("data-fan-signup", "");
  button.innerHTML = `
    <i data-lucide="circle-user-round"></i>
    <span>Fan sign up</span>
  `;
}

function updateFanSessionUI() {
  updateFanAccountUI();
  updateFanHomeActionUI();
  renderAccount();
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
    history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
  }
  updateShareActionUI();
  document.body.classList.toggle("single-drop-page", view === "store" && Boolean(currentFocusedDrop()));
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
  const cover = $("#creator-cover");
  const avatar = $("#creator-avatar");
  if (cover) cover.src = state.creator.coverImage || DEFAULT_COVER;
  if (avatar) avatar.src = state.creator.avatarImage || DEFAULT_AVATAR;

  const drops = activeDrops();
  const purchases = purchasedDropIds();
  const dropStat = $("#store-stat-drops");
  const unlockStat = $("#store-stat-unlocks");
  const ownedStat = $("#store-stat-owned");
  if (dropStat) dropStat.textContent = drops.length;
  if (unlockStat) unlockStat.textContent = state.creator.links.reduce((total, drop) => total + drop.sales, 0);
  if (ownedStat) ownedStat.textContent = drops.filter((drop) => purchases.has(drop.id)).length;
}

function renderStore() {
  const grid = $("#drop-grid");
  const drops = activeDrops();
  const owned = purchasedDropIds();
  const store = $("#fan-store");
  const hero = $(".public-profile-hero", store);
  const heading = $(".section-heading", store);
  const focusedDrop = currentFocusedDrop();

  store?.classList.toggle("single-drop-mode", Boolean(focusedDrop));
  document.body.classList.toggle("single-drop-page", state.view === "store" && Boolean(focusedDrop));
  if (hero) hero.hidden = Boolean(focusedDrop);
  if (heading) heading.hidden = Boolean(focusedDrop);

  if (focusedDrop) {
    grid.innerHTML = renderSingleSharedDrop(focusedDrop);
    return;
  }

  if (!drops.length) {
    grid.innerHTML = emptyState(
      "lock-keyhole",
      "No drops available",
      "When this creator publishes a locked file, it will show up here for fans to unlock.",
      "",
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
            <div class="drop-actions drop-actions-single">
              <button class="primary-button" type="button" data-buy-drop="${drop.id}">
                <i data-lucide="${hasDrop ? "folder-open" : "credit-card"}"></i>
                <span>${hasDrop ? "Open" : "Unlock now"}</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function previewDuration(drop) {
  const descriptor = `${drop.title || ""} ${drop.fileName || ""}`.toLowerCase();
  if (descriptor.includes("podcast") || descriptor.includes("audio")) return "1:36";
  if (descriptor.includes("video") || descriptor.includes("mp4") || descriptor.includes("mov")) return "0:18";
  return "0:18";
}

function supportsApplePay() {
  try {
    return Boolean(window.ApplePaySession && window.ApplePaySession.canMakePayments?.());
  } catch (err) {
    return false;
  }
}

function renderSingleSharedDrop(drop) {
  const mediaCount = Math.max(1, Number(drop.mediaCount) || 1);
  const isOwned = purchasedDropIds().has(drop.id);
  const price = money(effectiveDropPrice(drop));
  const handle = state.creator.profile.handle || "creator";
  const note = drop.note || `Permanent Vault'd unlock from @${handle}.`;
  const canApplePay = !isOwned && supportsApplePay();
  return `
    <div class="single-drop-shell">
      <article class="single-drop-card">
        <div class="single-drop-media">
          <img src="${escapeHtml(drop.thumbnail)}" alt="" />
          <div class="single-drop-media-badges">
            <span><i data-lucide="copy"></i>1/${mediaCount} media</span>
            <span><i data-lucide="play"></i>${previewDuration(drop)}</span>
          </div>
        </div>

        <div class="single-creator-card">
          <div class="single-creator-row">
            <img src="${escapeHtml(state.creator.avatarImage || DEFAULT_AVATAR)}" alt="" />
            <strong>${escapeHtml(handle)}</strong>
            <button type="button" data-open-message>
              <i data-lucide="message-square"></i>
              <span>Message</span>
            </button>
          </div>
          <p>${escapeHtml(note)}</p>
          <span>${formatDate(drop.createdAt || new Date().toISOString())}</span>
        </div>

        <div class="single-trust-card" aria-label="Purchase details">
          <span><i data-lucide="zap"></i>Easy access</span>
          <span><i data-lucide="shield-check"></i>Private payments</span>
          <span><i data-lucide="calendar-x"></i>No subscription</span>
          <div class="single-card-brands" aria-label="Payment methods">
            <b>MC</b>
            <b>VISA</b>
          </div>
        </div>
      </article>

      <footer class="single-purchase-bar">
        <div class="single-purchase-summary">
          <strong>${mediaCount} ${mediaCount === 1 ? "media" : "media"}</strong>
          <span>${price}</span>
        </div>
        <div class="single-drop-actions ${canApplePay ? "has-apple-pay" : "is-single-action"}">
          <button class="single-unlock-button" type="button" data-buy-drop="${escapeHtml(drop.id)}">
            ${isOwned ? "Open now" : "Unlock now"}
          </button>
          <button class="single-apple-pay-button" type="button" data-buy-drop="${escapeHtml(drop.id)}" aria-label="Apple Pay">
            <span class="apple-pay-mark" aria-hidden="true"></span>
            <span>Apple Pay</span>
          </button>
        </div>
        <small>Taxes &amp; fees are calculated at next step.</small>
      </footer>
    </div>
  `;
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

      <article class="account-card wide">
        <span class="card-icon"><i data-lucide="file-text"></i></span>
        <div>
          <h2>Policies</h2>
          <p>Read the terms, privacy, refunds, content rules, and DMCA process.</p>
        </div>
        <a class="small-button" href="/policies.html">Open</a>
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

    <article class="account-card wide">
      <span class="card-icon"><i data-lucide="file-text"></i></span>
      <div>
        <h2>Policies</h2>
        <p>Review terms, privacy, refunds, content rules, and DMCA support.</p>
      </div>
      <a class="small-button" href="/policies.html">Open</a>
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

function openMessageComposer() {
  if (!fanUser) {
    showFanLoginOverlay(() => openMessageComposer());
    return;
  }

  const handle = creatorHandle();
  openDialog(
    "Message creator",
    `
      <form class="message-form" id="creator-message-form">
        <div class="message-recipient">
          <img src="${escapeHtml(state.creator.avatarImage || DEFAULT_AVATAR)}" alt="" />
          <div>
            <strong>${escapeHtml(handle)}</strong>
            <span>Send a private message to this creator.</span>
          </div>
        </div>
        <label>
          <span>Your message</span>
          <textarea id="creator-message-text" name="message" maxlength="1000" required placeholder="Write your message..."></textarea>
        </label>
        <p class="form-status" id="creator-message-status" hidden></p>
        <button class="primary-button" type="submit">
          <i data-lucide="send"></i>
          <span>Send message</span>
        </button>
      </form>
    `,
  );
}

async function sendCreatorMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const textarea = $("#creator-message-text", form);
  const status = $("#creator-message-status", form);
  const button = form.querySelector("button[type='submit']");
  const message = textarea?.value.trim() || "";

  if (!message) {
    if (status) {
      status.hidden = false;
      status.textContent = "Write a message first.";
    }
    textarea?.focus();
    return;
  }

  if (button) button.disabled = true;
  if (status) status.hidden = true;

  try {
    await VaultlineAPI.sendCreatorMessage(state.creator.profile.handle || "creator", message);
    closeDialog();
    showToast("Message sent");
  } catch (err) {
    const canQueuePreview = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    if (canQueuePreview) {
      saveLocalCreatorMessage(message);
      closeDialog();
      showToast("Message saved in preview");
      return;
    }
    if (status) {
      status.hidden = false;
      status.textContent = err.message || "Could not send message";
    } else {
      showToast(err.message || "Could not send message");
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function openDropLegacy(dropId) {
  const drop = activeDrops().find((item) => item.id === dropId);
  if (!drop) {
    showToast("Drop is no longer available");
    return;
  }
  markDropViewed(drop.id);
  const purchase = ownedPurchase(drop.id);
  const contentPrice = effectiveDropPrice(drop);
  const privacyFee = privacySecurityFee(drop);
  const checkoutTotal = buyerCheckoutTotal(drop);
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
        <span class="checkout-price">${money(contentPrice)}</span>
      </div>
      <div class="checkout-line">
        <i data-lucide="${purchase ? "folder-open" : "shield-check"}"></i>
        <div>
          <strong>${purchase ? "Already in your library" : "Permanent unlock"}</strong>
          <span>${purchase ? escapeHtml(purchase.fileName) : "Saved to your fan account after payment"}</span>
        </div>
      </div>
      ${
        purchase
          ? ""
          : `<div class="checkout-line">
              <i data-lucide="shield-check"></i>
              <div>
                <strong>Privacy &amp; security fees</strong>
                <span>${CUSTOMER_PRIVACY_SECURITY_FEE_PERCENT}% buyer fee shown separately at checkout: ${money(privacyFee)}</span>
              </div>
            </div>`
      }
      <div class="checkout-line">
        <i data-lucide="credit-card"></i>
        <div>
          <strong>Secure Stripe checkout</strong>
          <span>${purchase ? "Receipt saved to your library" : `You will review and pay ${money(checkoutTotal)} on Stripe`}</span>
        </div>
      </div>
      <button class="primary-button" type="button" data-buy-drop="${drop.id}">
        <i data-lucide="${purchase ? "folder-open" : "credit-card"}"></i>
        <span>${purchase ? "Open file" : `Pay ${money(checkoutTotal)}`}</span>
      </button>
    `,
  );
}

async function buyDropLegacy(dropId) {
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

function checkoutScreen() {
  let screen = $("#checkout-screen");
  if (screen) return screen;
  screen = document.createElement("section");
  screen.id = "checkout-screen";
  screen.className = "checkout-screen";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-label", "Checkout");
  screen.hidden = true;
  document.body.appendChild(screen);
  return screen;
}

function closeCheckout() {
  const screen = $("#checkout-screen");
  if (screen) screen.hidden = true;
  document.body.classList.remove("checkout-open");
  state.checkout.dropIds = [];
}

function renderCheckout() {
  const screen = checkoutScreen();
  const drops = checkoutDrops();
  if (!drops.length) {
    closeCheckout();
    return;
  }

  const primary = drops[0];
  const totals = checkoutTotals(drops);
  const related = recommendedDropsForCheckout(drops);
  const handle = state.creator.profile.handle || primary.creatorHandle || "creator";
  const selectedCount = drops.length;
  const discountLabel = totals.discountRate ? `${Math.round(totals.discountRate * 100)}% bundle discount` : "";

  screen.innerHTML = `
    <header class="checkout-header">
      <button class="checkout-back" type="button" data-checkout-close aria-label="Back to storefront">
        <i data-lucide="chevron-left"></i>
      </button>
      <strong>Checkout</strong>
      <span aria-hidden="true"></span>
    </header>

    <div class="checkout-scroll">
      <section class="checkout-section">
        <h2>Order summary</h2>
        <article class="checkout-order-card">
          <div class="checkout-creator">
            <img src="${escapeHtml(state.creator.avatarImage || DEFAULT_AVATAR)}" alt="" />
            <div>
              <strong>${escapeHtml(handle)}</strong>
              <span>${selectedCount} item${selectedCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div class="checkout-order-list">
            ${drops
              .map(
                (drop) => `
                  <div class="checkout-order-item">
                    <img src="${escapeHtml(drop.thumbnail)}" alt="" />
                    <div>
                      <strong>${escapeHtml(purchaseLinkLabel(drop.id))}</strong>
                    </div>
                    <b>${money(effectiveDropPrice(drop))}</b>
                    ${
                      drops.length > 1
                        ? `<button class="checkout-remove" type="button" data-checkout-remove="${escapeHtml(drop.id)}" aria-label="Remove ${escapeHtml(drop.title)}">
                            <i data-lucide="x"></i>
                          </button>`
                        : ""
                    }
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <div class="checkout-totals">
          <div>
            <span>Order</span>
            <strong>${money(totals.subtotal)}</strong>
          </div>
          ${
            totals.discount
              ? `<div class="discount">
                  <span>${discountLabel}</span>
                  <strong>-${money(totals.discount)}</strong>
                </div>`
              : ""
          }
          <div>
            <span>Privacy &amp; security fees</span>
            <strong>${money(totals.privacyFee)}</strong>
          </div>
          <div class="total">
            <span>Total</span>
            <strong>${money(totals.total)}</strong>
          </div>
        </div>
      </section>

      <section class="checkout-section">
        <h2>Buy more links from <span>@${escapeHtml(handle)}</span></h2>
        <p>Add multiple drops at the same time and save up to 30%.</p>
        ${
          related.length
            ? `<div class="checkout-related-rail">
                ${related
                  .map(
                    (drop) => `
                      <article class="checkout-related-card">
                        <div class="checkout-related-media">
                          <img src="${escapeHtml(drop.thumbnail)}" alt="" />
                          <span><i data-lucide="copy"></i>${Math.max(1, Number(drop.mediaCount) || 1)} media</span>
                        </div>
                        <strong>${escapeHtml(drop.title)}</strong>
                        <small>${formatDate(drop.createdAt || new Date().toISOString())}</small>
                        <div>
                          <b>${money(effectiveDropPrice(drop))}</b>
                          <button type="button" data-checkout-add="${escapeHtml(drop.id)}">Add</button>
                        </div>
                      </article>
                    `,
                  )
                  .join("")}
              </div>`
            : `<div class="checkout-empty-addons">
                <i data-lucide="check-circle-2"></i>
                <strong>No more public drops from this creator yet</strong>
              </div>`
        }
      </section>

      <section class="checkout-section checkout-payment-section">
        <h2>Payment method</h2>
        <div class="checkout-method">
          <span><i data-lucide="credit-card"></i></span>
          <div>
            <strong>Secure card checkout</strong>
            <small>Cards, receipts, and invoice details are handled by Stripe.</small>
          </div>
        </div>
        <label class="checkout-message">
          <span>Message to creator</span>
          <textarea rows="3" placeholder="Add a quick note (optional)"></textarea>
        </label>
      </section>
    </div>

    <footer class="checkout-paybar">
      <div class="checkout-progress-label">
        <i data-lucide="badge-percent"></i>
        <span>${checkoutProgressText(selectedCount)}</span>
      </div>
      <div class="checkout-progress" aria-hidden="true">
        <span style="width:${checkoutProgressPercent(selectedCount)}%"></span>
        <i></i><i></i><i></i>
      </div>
      <button class="checkout-pay-button" type="button" data-checkout-pay>
        <span class="checkout-count">${selectedCount}</span>
        <strong>Proceed to pay</strong>
        <b>${money(totals.total)}</b>
      </button>
    </footer>
  `;

  screen.hidden = false;
  document.body.classList.add("checkout-open");
  syncIcons();
}

function openCheckout(dropIds) {
  const nextIds = Array.isArray(dropIds) ? dropIds : [dropIds];
  const current = new Set(state.checkout.dropIds);
  nextIds.forEach((dropId) => {
    const drop = findActiveDrop(dropId);
    if (drop && !ownedPurchase(drop.id)) current.add(drop.id);
  });
  state.checkout.dropIds = [...current];
  if (!state.checkout.dropIds.length) {
    showToast("Drop is no longer available");
    return;
  }
  state.checkout.dropIds.forEach(markDropViewed);
  renderCheckout();
}

async function buyCheckout() {
  const drops = checkoutDrops();
  if (!drops.length) {
    showToast("Drop is no longer available");
    return;
  }

  if (!fanUser) {
    showFanLoginOverlay(() => buyCheckout());
    return;
  }

  try {
    const data = await VaultlineAPI.startCheckout(drops.map((drop) => drop.id));
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      showToast("Checkout unavailable");
    }
  } catch (err) {
    if (err.message?.toLowerCase().includes("stripe") || err.message?.toLowerCase().includes("not configured")) {
      showToast("Payments coming soon - Stripe not configured yet");
    } else {
      showToast(err.message || "Checkout failed");
    }
  }
}

function openDrop(dropId) {
  const drop = findActiveDrop(dropId);
  if (!drop) {
    showToast("Drop is no longer available");
    return;
  }
  const purchase = ownedPurchase(drop.id);
  if (purchase) {
    openPurchase(purchase.id);
    return;
  }
  openCheckout(drop.id);
}

async function buyDrop(dropId) {
  const purchase = ownedPurchase(dropId);
  if (purchase) {
    openPurchase(purchase.id);
    return;
  }
  openCheckout(dropId);
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
  updateFanSessionUI();
  loadDiscoverFromApi();
  const params = new URLSearchParams(location.search);
  const hasStorefrontHandle = Boolean(params.get("handle") || params.get("drop"));
  const initialView = location.hash.replace("#", "");
  setView(initialView || (hasStorefrontHandle ? "store" : "discover"), { instant: true });

  // Check fan auth + load storefront from API
  checkFanAuth().then((user) => {
    updateFanSessionUI();
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

    const fanBrandHome = event.target.closest("[data-fan-brand-home]");
    if (fanBrandHome) {
      event.preventDefault();
      if (fanUser) {
        setView("discover");
      } else {
        window.location.href = "/";
      }
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

    const checkoutCloseButton = event.target.closest("[data-checkout-close]");
    if (checkoutCloseButton) {
      closeCheckout();
      return;
    }

    const checkoutAddButton = event.target.closest("[data-checkout-add]");
    if (checkoutAddButton) {
      openCheckout(checkoutAddButton.dataset.checkoutAdd);
      return;
    }

    const checkoutRemoveButton = event.target.closest("[data-checkout-remove]");
    if (checkoutRemoveButton) {
      state.checkout.dropIds = state.checkout.dropIds.filter((dropId) => dropId !== checkoutRemoveButton.dataset.checkoutRemove);
      renderCheckout();
      return;
    }

    const checkoutPayButton = event.target.closest("[data-checkout-pay]");
    if (checkoutPayButton) {
      buyCheckout();
      return;
    }

    const copyStoreButton = event.target.closest("[data-copy-storefront]");
    if (copyStoreButton) {
      const isStore = state.view === "store" && state.creator.profile.handle !== "creator";
      copyText(currentShareUrl(), isStore ? "Storefront link copied" : "Discover link copied");
    }

    const messageButton = event.target.closest("[data-open-message]");
    if (messageButton) {
      openMessageComposer();
      return;
    }

    const refreshButton = event.target.closest("[data-refresh-store]");
    if (refreshButton) {
      refreshFromStorage();
      showToast("Store refreshed");
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

  document.addEventListener("submit", (event) => {
    if (event.target?.id === "creator-message-form") {
      sendCreatorMessage(event);
    }
  });

  $("#fan-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDialog();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setAccountDropdown(false);
      closeCheckout();
    }
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
