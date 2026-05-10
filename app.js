const DEFAULT_THUMBNAIL = "assets/thumb-gallery.svg";
const DEFAULT_COVER = "assets/profile-cover.svg";
const DEFAULT_AVATAR = "assets/avatar-tile.svg";
const STORAGE_KEY = "vaultline-settings-v1";
const PUBLIC_BASE_URL = "http://localhost:8787";
const MIN_PRICE = 5;

const state = {
  filter: "all",
  selectedPreview: DEFAULT_THUMBNAIL,
  profile: {
    handle: "creator",
    bio: "Private drops, files, and creator packs in one clean storefront.",
  },
  account: {
    email: "",
    phone: "",
    recoveryEmail: "",
    emailUpdates: true,
  },
  production: {
    backendConnected: false,
    apiEndpoint: "",
    databaseProject: "",
    storageConnected: false,
    storageProvider: "",
    protectedUploads: false,
    paymentsConnected: false,
    paymentProcessor: "Stripe",
    payoutsEnabled: false,
    unlockAccessReady: false,
    signedUrlsEnabled: false,
    emailVerified: false,
    transactionalEmailReady: false,
    complianceReady: false,
    reportingReady: false,
    fanAccountReady: false,
    fanReceiptsReady: false,
    adminReady: false,
    supportReady: false,
  },
  coverImage: DEFAULT_COVER,
  avatarImage: DEFAULT_AVATAR,
  bundle: {
    enabled: true,
    discount: 15,
    minItems: 2,
  },
  payout: {
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    identityStatus: "pending",
    stripeAccountId: null,
  },
  withdrawn: 0,
  operations: [],
  links: [],
  sell: {
    mediaKind: "",
    mediaLabel: "",
    mediaFileType: "",
    mediaItems: [],
    detailOpen: false,
    access: "Everyone",
    download: "Allowed",
    downloadExtraPercent: 10,
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

function currentTotals() {
  return state.links.reduce(
    (totals, link) => {
      totals.revenue += link.revenue;
      totals.sales += link.sales;
      totals.views += link.views;
      return totals;
    },
    { revenue: 0, sales: 0, views: 0 },
  );
}

function availableBalance() {
  return Math.max(0, currentTotals().revenue - state.withdrawn);
}

function syncIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHandle(value) {
  const handle = String(value).replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  return handle || "creator";
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.profile) state.profile = { ...state.profile, ...saved.profile };
    if (saved.account) state.account = { ...state.account, ...saved.account };
    if (saved.production) state.production = { ...state.production, ...saved.production };
    if (saved.bundle) state.bundle = { ...state.bundle, ...saved.bundle };
    if (saved.payout) state.payout = { ...state.payout, ...saved.payout };
    if (saved.coverImage) state.coverImage = saved.coverImage;
    if (saved.avatarImage) state.avatarImage = saved.avatarImage;
    if (Number.isFinite(Number(saved.withdrawn))) state.withdrawn = Math.max(0, Number(saved.withdrawn));
    if (Array.isArray(saved.links)) {
      state.links = saved.links
        .filter((link) => link && link.id)
        .map((link) => ({
          id: String(link.id),
          title: String(link.title || "Untitled drop"),
          price: Math.max(1, Number(link.price) || 1),
          note: String(link.note || ""),
          fileName: String(link.fileName || "locked-file"),
          thumbnail: String(link.thumbnail || DEFAULT_THUMBNAIL),
          status: link.status === "expired" ? "expired" : "active",
          views: Math.max(0, Number(link.views) || 0),
          sales: Math.max(0, Number(link.sales) || 0),
          revenue: Math.max(0, Number(link.revenue) || 0),
          url: String(link.url || `${PUBLIC_BASE_URL}/d/${link.id}`).replace("https://vaultline.app", PUBLIC_BASE_URL),
        }));
    }
    if (Array.isArray(saved.operations)) {
      state.operations = saved.operations
        .filter((operation) => operation && operation.title)
        .map((operation) => ({
          title: String(operation.title),
          time: String(operation.time || "Recently"),
          amount: Number(operation.amount) || 0,
          icon: String(operation.icon || "receipt-text"),
        }));
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profile: state.profile,
      account: state.account,
      production: state.production,
      bundle: state.bundle,
      payout: state.payout,
      coverImage: state.coverImage,
      avatarImage: state.avatarImage,
      withdrawn: state.withdrawn,
      operations: state.operations,
      links: state.links,
    }),
  );
}

function isPayoutReady() {
  return Boolean(state.payout.chargesEnabled && state.payout.payoutsEnabled);
}

function bundleSummary() {
  if (!state.bundle.enabled) return "Bundle discounts are off";
  return `${state.bundle.discount}% off ${state.bundle.minItems} or more drops`;
}

function accountSummary() {
  return state.account.email.trim() || "Email, phone, and login contact";
}

function hasAccountEmail() {
  return /\S+@\S+\.\S+/.test(state.account.email.trim());
}

function isPublicPageCustomized() {
  const defaultBio = "Private drops, files, and creator packs in one clean storefront.";
  return Boolean(
    state.profile.handle !== "creator" ||
      state.profile.bio.trim() !== defaultBio ||
      state.coverImage !== DEFAULT_COVER ||
      state.avatarImage !== DEFAULT_AVATAR,
  );
}

function checklistItems() {
  const activeDrops = state.links.filter((link) => link.status === "active").length;
  return [
    {
      id: "account",
      icon: "mail-check",
      title: "Add account email",
      detail: hasAccountEmail() ? state.account.email.trim() : "Used for login, receipts, and account recovery",
      complete: hasAccountEmail(),
      action: "account",
      cta: "Add",
    },
    {
      id: "payout",
      icon: "landmark",
      title: "Connect Stripe account",
      detail: state.payout.connected
        ? state.payout.chargesEnabled
          ? "Stripe account connected and active"
          : "Stripe connected — finish setup on Stripe dashboard"
        : "Required to accept payments and receive payouts",
      complete: state.payout.connected,
      action: "payout",
      cta: state.payout.connected ? "Manage" : "Set up",
    },
    {
      id: "identity",
      icon: "shield-check",
      title: "Enable payouts",
      detail: isPayoutReady()
        ? "Payouts are active and ready"
        : state.payout.connected
        ? "Complete Stripe identity verification to enable payouts"
        : "Needed for creator safety and payment compliance",
      complete: isPayoutReady(),
      action: "payout",
      cta: isPayoutReady() ? "View" : "Complete",
    },
    {
      id: "profile",
      icon: "image-up",
      title: "Customize public page",
      detail: isPublicPageCustomized() ? `Your mobile storefront is @${state.profile.handle}` : "Add your handle, profile photo, cover, and bio",
      complete: isPublicPageCustomized(),
      action: "profile",
      cta: "Edit",
    },
    {
      id: "drop",
      icon: "lock-keyhole",
      title: "Create first locked drop",
      detail: activeDrops ? `${activeDrops} live paid ${activeDrops === 1 ? "drop" : "drops"}` : "Upload media or add a content URL and set a price",
      complete: activeDrops > 0,
      action: "create",
      cta: "Create",
    },
  ];
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function setView(view, syncHash = true) {
  if (!$(`[data-view-panel="${view}"]`)) return;

  $$("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });

  $$("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });

  if (syncHash && window.location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function syncViewFromHash() {
  const hashView = window.location.hash.replace("#", "");
  if (hashView) setView(hashView, false);
}

function filteredLinks() {
  const links = [...state.links];
  if (state.filter === "top") return links.sort((a, b) => b.revenue - a.revenue);
  if (state.filter === "viewed") return links.sort((a, b) => b.views - a.views);
  if (state.filter === "expired") return links.filter((link) => link.status === "expired");
  return links;
}

function emptyLinksMarkup(title = "Create your first link", copy = "No drops in this filter yet.") {
  return `
    <div class="empty-state">
      <span class="upload-icon"><i data-lucide="plus"></i></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(copy)}</span>
      </div>
    </div>
  `;
}

function renderLinks() {
  const linkList = $("#link-list");
  const links = filteredLinks();
  const totals = currentTotals();

  $("#create-stat-links").textContent = state.links.length;
  $("#links-stat-active").textContent = state.links.filter((link) => link.status === "active").length;
  $("#links-stat-revenue").textContent = money(totals.revenue);
  $("#links-stat-views").textContent = totals.views;

  linkList.innerHTML = links.length
    ? links
        .map(
          (link) => `
            <article class="link-card" data-link-id="${link.id}">
              <div class="link-media">
                <img src="${escapeHtml(link.thumbnail)}" alt="" />
                <span class="link-status ${link.status === "expired" ? "is-expired" : ""}">
                  ${link.status === "expired" ? "Expired" : "Live"}
                </span>
              </div>
              <div class="link-copy">
                <h2>${escapeHtml(link.title)}</h2>
                <p>${escapeHtml(link.fileName)} - Permanent unlock</p>
                <div class="link-metrics">
                  <span class="metric-pill"><i data-lucide="eye"></i>${link.views}</span>
                  <span class="metric-pill"><i data-lucide="shopping-bag"></i>${link.sales}</span>
                  <span class="metric-pill"><i data-lucide="banknote"></i>${money(link.revenue)}</span>
                </div>
              </div>
              <div class="link-price">
                <strong>${money(link.price)}</strong>
                <span>Pay once</span>
              </div>
              <div class="link-actions">
                <button class="icon-button" type="button" data-preview-link="${link.id}" aria-label="Preview ${escapeHtml(link.title)}">
                  <i data-lucide="external-link"></i>
                </button>
                <button class="icon-button" type="button" data-copy-link="${link.id}" aria-label="Copy ${escapeHtml(link.title)} link">
                  <i data-lucide="copy"></i>
                </button>
                <button class="icon-button" type="button" data-toggle-link="${link.id}" aria-label="${link.status === "expired" ? "Restore" : "Expire"} ${escapeHtml(link.title)}">
                  <i data-lucide="${link.status === "expired" ? "rotate-ccw" : "timer-off"}"></i>
                </button>
                <button class="icon-button danger" type="button" data-delete-link="${link.id}" aria-label="Delete ${escapeHtml(link.title)}">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </article>
          `,
        )
        .join("")
    : emptyLinksMarkup();

  renderProfileLinks();
  syncIcons();
}

function renderProfileLinks() {
  const profileLinks = $("#profile-links");
  const publicLinks = state.links.filter((link) => link.status === "active");
  $("#profile-link-count").textContent = publicLinks.length;
  $("#profile-stat-links").textContent = publicLinks.length;
  $("#profile-stat-sales").textContent = state.links.reduce((total, link) => total + link.sales, 0);
  $("#profile-stat-revenue").textContent = money(state.links.reduce((total, link) => total + link.revenue, 0));

  profileLinks.innerHTML = publicLinks.length
    ? publicLinks
        .map(
          (link) => `
            <article class="profile-tile">
              <div class="profile-media">
                <img src="${escapeHtml(link.thumbnail)}" alt="" />
                <span class="price-badge">${money(link.price)}</span>
              </div>
              <div class="profile-tile-copy">
                <strong>${escapeHtml(link.title)}</strong>
                <span>${link.sales} permanent unlocks</span>
              </div>
            </article>
          `,
        )
        .join("")
    : emptyLinksMarkup("Create your first link", "Create a locked drop to publish it here.");
}

function renderOperations() {
  const operationList = $("#operation-list");
  $("#operation-count").textContent = state.operations.length;

  operationList.innerHTML = state.operations.length
    ? state.operations
        .map(
          (operation) => `
            <div class="operation-row">
              <span class="op-icon"><i data-lucide="${operation.icon}"></i></span>
              <div>
                <strong>${operation.title}</strong>
                <span>${operation.time}</span>
              </div>
              <b>${money(operation.amount)}</b>
            </div>
          `,
        )
        .join("")
    : `
      <div class="empty-state">
        <span class="upload-icon"><i data-lucide="receipt-text"></i></span>
        <div>
          <strong>No operations yet</strong>
          <span>Sales and payouts will land here.</span>
        </div>
      </div>
    `;

  syncIcons();
}

function renderProfileMeta() {
  const handle = `@${state.profile.handle}`;
  $$("[data-profile-handle]").forEach((element) => {
    element.textContent = handle;
  });
  $$("[data-profile-bio]").forEach((element) => {
    element.textContent = state.profile.bio;
  });
  const avatar = $(".avatar-mini");
  if (avatar) {
    avatar.textContent = state.profile.handle.charAt(0).toUpperCase();
    avatar.classList.toggle("has-image", state.avatarImage !== DEFAULT_AVATAR);
    avatar.style.backgroundImage = state.avatarImage !== DEFAULT_AVATAR ? `url("${state.avatarImage}")` : "";
  }
  const cover = $("#profile-cover-image");
  if (cover) cover.src = state.coverImage;
  const profileAvatar = $("#profile-avatar-image");
  if (profileAvatar) profileAvatar.src = state.avatarImage;
  const dropdownAvatar = $("#account-dropdown-avatar");
  if (dropdownAvatar) dropdownAvatar.src = state.avatarImage;
}

function renderSettingsMeta() {
  const payoutReady = isPayoutReady();
  const methodTitle = $("#wallet-method-title");
  const methodSubtitle = $("#wallet-method-subtitle");
  const payoutStatus = $("#wallet-payout-status");
  const requirementCount = $("#requirement-count");
  const requirementTitle = $("#requirement-title");
  const requirementCopy = $("#requirement-copy");
  const requirementButton = $("#requirement-button");
  const bundleTitle = $("#bundle-title");
  const bundleText = $("#bundle-summary");

  if (payoutStatus) payoutStatus.textContent = payoutReady ? "Active" : state.payout.connected ? "Pending" : "Not set up";
  if (methodTitle) methodTitle.textContent = payoutReady ? "Stripe Payouts" : state.payout.connected ? "Stripe (pending)" : "Stripe";
  if (methodSubtitle) {
    methodSubtitle.textContent = payoutReady
      ? "Charges and payouts enabled"
      : state.payout.connected
      ? "Complete identity verification on Stripe"
      : "Connect your Stripe account to get paid";
  }
  if (requirementCount) requirementCount.textContent = payoutReady ? "OK" : state.payout.connected ? "1" : "2";
  if (requirementTitle) requirementTitle.textContent = payoutReady ? "Payouts active" : "Stripe setup required";
  if (requirementCopy) {
    requirementCopy.textContent = payoutReady
      ? "Your Stripe account is fully connected"
      : state.payout.connected
      ? "Finish identity verification in the Stripe dashboard"
      : "You need a Stripe account to accept payments and receive payouts";
  }
  if (requirementButton) requirementButton.textContent = payoutReady ? "Manage" : state.payout.connected ? "Continue" : "Connect";
  if (bundleTitle) bundleTitle.textContent = state.bundle.enabled ? "Bundle discounts" : "Bundles disabled";
  if (bundleText) bundleText.textContent = bundleSummary();
}

function renderLaunchChecklist() {
  const list = $("#launch-checklist-items");
  if (!list) return;

  const items = checklistItems();
  const completed = items.filter((item) => item.complete).length;
  const total = items.length;
  const progress = Math.round((completed / total) * 100);
  const progressText = $("#launch-checklist-progress");
  const copy = $("#launch-checklist-copy");
  const bar = $("#launch-progress-bar");

  if (progressText) progressText.textContent = `${completed}/${total}`;
  if (copy) {
    copy.textContent =
      completed === total
        ? "Your mobile storefront is ready to share."
        : "Finish the basics before sharing your paid mobile storefront.";
  }
  if (bar) bar.style.width = `${progress}%`;

  list.innerHTML = items
    .map(
      (item) => `
        <button class="launch-checklist-item ${item.complete ? "is-complete" : ""}" type="button" data-onboarding-action="${item.action}">
          <span class="launch-check">
            <i data-lucide="${item.complete ? "check" : item.icon}"></i>
          </span>
          <span class="launch-item-copy">
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </span>
          <span class="launch-item-action">${item.complete ? "Done" : item.cta}</span>
        </button>
      `,
    )
    .join("");

  $$("[data-onboarding-action]", list).forEach((button) => {
    button.addEventListener("click", () => runOnboardingAction(button.dataset.onboardingAction));
  });
}

function runOnboardingAction(action) {
  if (action === "account") {
    openAccountSettings();
    return;
  }

  if (action === "payout") {
    openPaymentSettings();
    return;
  }

  if (action === "profile") {
    if (isPublicPageCustomized()) {
      openShareProfile();
    } else {
      openEditProfile();
    }
    return;
  }

  if (action === "create") {
    setView("create");
  }
}

function renderAnalytics() {
  const totals = currentTotals();
  const averageOrder = totals.sales ? totals.revenue / totals.sales : 0;
  const conversion = totals.views ? Math.round((totals.sales / totals.views) * 100) : 0;

  $("#analytics-revenue").textContent = money(totals.revenue);
  $("#buyers-count").textContent = totals.sales;
  $("#views-count").textContent = totals.views;
  $("#sales-count").textContent = totals.sales;
  $("#wallet-balance").textContent = money(availableBalance());
  $("#wallet-pending").textContent = money(availableBalance() * 0.18);
  $("#analytics-conversion").textContent = `${conversion}%`;
  $("#analytics-order").textContent = money(averageOrder);

  const max = Math.max(totals.revenue, 1);
  const points = [0.05, 0.18, 0.3, 0.54, 0.73, 1].map((weight, index) => {
    const x = 36 + index * 137.6;
    const y = 220 - Math.min(172, (totals.revenue / max) * weight * 172);
    return `${x},${y}`;
  });

  $("#chart-line").setAttribute("points", points.join(" "));
  $("#chart-line-shadow").setAttribute("points", points.join(" "));
}

function renderAll() {
  renderLinks();
  renderOperations();
  renderLaunchChecklist();
  renderAnalytics();
  renderProfileMeta();
  renderSettingsMeta();
  updatePreview();
}

function updatePreview() {
  syncSellDetailFields();
  const titleInput = $("#title-input");
  const priceInput = $("#price-input");
  const noteInput = $("#note-input");
  const title = titleInput?.value.trim() || "Locked media";
  const price = Number(priceInput?.value) || 0;
  const note = noteInput?.value.trim() || "Pay once to unlock this content.";
  const src = state.selectedPreview || DEFAULT_THUMBNAIL;
  const canCreate = isSellReadyToCreate();
  syncPriceWidth();
  syncPriceErrors();

  const previewTitle = $("#preview-title");
  const previewPrice = $("#preview-price");
  const previewNote = $("#preview-note");
  const previewArt = $("#preview-art img");
  if (previewTitle) previewTitle.textContent = title;
  if (previewPrice) previewPrice.textContent = money(price);
  if (previewNote) previewNote.textContent = note;
  if (previewArt) previewArt.src = src;

  const generateButton = $("#generate-link-button");
  const stickyGenerateButton = $("[data-generate-link]");
  const detailCreateButton = $("#sell-detail-create");
  if (generateButton) generateButton.disabled = !canCreate;
  if (stickyGenerateButton) stickyGenerateButton.disabled = !canCreate;
  if (detailCreateButton) detailCreateButton.disabled = !canCreate;
}

function hasSellContentReady() {
  if (!state.sell.mediaKind) return false;
  if (state.sell.mediaKind === "photo-video") {
    return state.sell.mediaItems.length > 0;
  }

  const detailTitle = $("#detail-title-input")?.value.trim() || "";
  const detailUrl = $("#detail-url-input")?.value.trim() || "";
  return Boolean(detailTitle && detailUrl);
}

function isSellReadyToCreate() {
  const price = Number($("#price-input")?.value) || 0;
  return Boolean(state.sell.mediaKind && price >= MIN_PRICE && hasSellContentReady());
}

function sellValidationMessage() {
  if (!state.sell.mediaKind) return "Add media first";

  const price = Number($("#price-input")?.value) || 0;
  if (price <= 0) return "Set a price first";
  if (price < MIN_PRICE) return "minimum of $5";

  if (state.sell.mediaKind === "photo-video" && !state.sell.mediaItems.length) {
    return "Add media first";
  }

  if (state.sell.mediaKind === "photo-video") return "";

  if (!$("#detail-title-input")?.value.trim()) return "Add a name first";
  if (!$("#detail-url-input")?.value.trim()) return "Add the content URL";
  return "";
}

function syncPriceWidth() {
  const priceInput = $("#price-input");
  if (!priceInput) return;
  const visibleValue = priceInput.value || priceInput.placeholder || "0.00";
  priceInput.style.width = `${Math.max(1, visibleValue.length)}ch`;
}

function syncPriceErrors() {
  const priceInput = $("#price-input");
  const detailPriceInput = $("#detail-price-input");
  const price = Number(priceInput?.value) || 0;
  const detailPrice = Number(detailPriceInput?.value) || 0;
  const showMainError = Boolean(priceInput?.value && price < MIN_PRICE);
  const showDetailError = Boolean(detailPriceInput?.value && detailPrice < MIN_PRICE);
  const mainError = $("#price-error");
  const detailError = $("#detail-price-error");

  if (mainError) mainError.hidden = !showMainError;
  if (detailError) detailError.hidden = !showDetailError;
  if (priceInput) priceInput.setAttribute("aria-invalid", String(showMainError));
  if (detailPriceInput) detailPriceInput.setAttribute("aria-invalid", String(showDetailError));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Link copied");
  } catch {
    const input = document.createElement("input");
    input.value = text;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast("Link copied");
  }
}

function openDialog(title, body, options = {}) {
  const dialog = $("#share-dialog");
  const closeButton = $("[data-close-dialog]", dialog);
  dialog.classList.toggle("is-bottom-sheet", Boolean(options.sheet));
  if (closeButton) {
    closeButton.className = options.sheet ? "sheet-done" : "icon-button";
    closeButton.innerHTML = options.sheet ? "<span>Done</span>" : '<i data-lucide="x"></i>';
  }
  $("#dialog-title").textContent = title;
  $("#dialog-body").innerHTML = body;
  if (dialog.open) {
    syncIcons();
    return;
  }
  if (dialog.showModal) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  syncIcons();
}

function setAccountDropdown(open) {
  const dropdown = $("#account-dropdown");
  const button = $("[data-open-account-menu]");
  if (!dropdown || !button) return;

  dropdown.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) syncIcons();
}

function toggleAccountDropdown() {
  const dropdown = $("#account-dropdown");
  setAccountDropdown(Boolean(dropdown?.hidden));
}

const sellMediaTypes = {
  "photo-video": { label: "Photo, Video", icon: "image", thumbnail: DEFAULT_THUMBNAIL, title: "Media drop" },
  template: { label: "Template", icon: "layout-template", thumbnail: "assets/thumb-course.svg", title: "Template drop" },
  course: { label: "Course", icon: "graduation-cap", thumbnail: "assets/thumb-course.svg", title: "Course drop" },
  ebook: { label: "E-book", icon: "book-open", thumbnail: "assets/thumb-download.svg", title: "E-book drop" },
  podcast: { label: "Podcast", icon: "mic", thumbnail: "assets/thumb-video.svg", title: "Podcast drop" },
};

function compactLabel(value, maxLength = 34) {
  const clean = String(value || "").replace(/\.[^.]+$/, "").trim();
  if (!clean || clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3)}...`;
}

function downloadLabel() {
  if (state.sell.download === "Allowed (Charge Extra)") {
    return `Allowed +${state.sell.downloadExtraPercent}%`;
  }
  return state.sell.download;
}

function downloadNoteText() {
  if (state.sell.download === "Allowed (Charge Extra)") {
    return `allowed with a ${state.sell.downloadExtraPercent}% download add-on`;
  }
  return state.sell.download.toLowerCase();
}

function updateSellNote() {
  const noteInput = $("#note-input");
  if (!noteInput || !state.sell.mediaKind) return;
  const media = sellMediaTypes[state.sell.mediaKind] || sellMediaTypes["photo-video"];
  noteInput.value = `${media.label} - ${state.sell.access}. Download ${downloadNoteText()}.`;
}

function updateSellMediaPreview() {
  const stage = $("#sell-media-stage");
  const emptyButton = $("#sell-media-empty");
  const grid = $("#selected-media-grid");
  const count = $("#sell-media-count");
  const items = state.sell.mediaItems;
  const showPreview = state.sell.mediaKind === "photo-video" && items.length > 0;

  if (stage) stage.hidden = !showPreview;
  if (emptyButton) emptyButton.hidden = showPreview;
  if (count) count.textContent = mediaCountLabel(items.length);
  $$("[data-media-rail-nav]").forEach((button) => {
    button.hidden = items.length < 2;
  });

  if (grid) {
    grid.classList.toggle("is-single", items.length === 1);
    grid.innerHTML = items
      .map((item, index) => {
        const duration = item.type === "video" ? `<span class="sell-media-duration">${formatDuration(item.duration)}</span>` : "";
        return `
          <article class="sell-media-tile" role="listitem">
            <img src="${escapeHtml(item.preview || DEFAULT_THUMBNAIL)}" alt="${escapeHtml(item.name)}" draggable="false" />
            ${duration}
            <button class="sell-media-item-remove" type="button" data-remove-media-item="${escapeHtml(item.id)}" aria-label="Remove media ${index + 1}">
              <i data-lucide="x"></i>
            </button>
          </article>
        `;
      })
      .join("");
  }

  state.selectedPreview = items[0]?.preview || DEFAULT_THUMBNAIL;
  syncIcons();
}

function mediaRailStep() {
  const grid = $("#selected-media-grid");
  if (!grid) return 0;
  const tile = $(".sell-media-tile", grid);
  if (!tile) return 0;
  const styles = window.getComputedStyle(grid);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
  return tile.getBoundingClientRect().width + gap;
}

function scrollMediaRail(direction) {
  const grid = $("#selected-media-grid");
  if (!grid) return;
  const step = mediaRailStep() || grid.clientWidth;
  grid.scrollBy({
    left: direction === "next" ? step : -step,
    behavior: "smooth",
  });
}

function initMediaRailControls() {
  const grid = $("#selected-media-grid");
  if (!grid) return;

  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;

  const stopDragging = (event) => {
    if (!isDragging) return;
    isDragging = false;
    grid.classList.remove("is-dragging");
    if (event?.pointerId !== undefined && grid.hasPointerCapture?.(event.pointerId)) {
      grid.releasePointerCapture(event.pointerId);
    }
  };

  const moveDrag = (event) => {
    if (!isDragging) return;
    event.preventDefault();
    grid.scrollLeft = startScrollLeft - (event.clientX - startX);
  };

  grid.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    isDragging = true;
    startX = event.clientX;
    startScrollLeft = grid.scrollLeft;
    grid.classList.add("is-dragging");
    grid.setPointerCapture?.(event.pointerId);
  });

  grid.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointermove", moveDrag);

  grid.addEventListener("pointerup", stopDragging);
  window.addEventListener("pointerup", stopDragging);
  grid.addEventListener("pointercancel", stopDragging);
  window.addEventListener("pointercancel", stopDragging);
  grid.addEventListener("lostpointercapture", stopDragging);
  grid.addEventListener("dragstart", (event) => event.preventDefault());

  grid.addEventListener(
    "wheel",
    (event) => {
      if (state.sell.mediaItems.length < 2 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      grid.scrollLeft += event.deltaY;
    },
    { passive: false },
  );
}

function resetSellMediaSelection() {
  const fileInput = $("#file-input");
  if (fileInput) fileInput.value = "";
  state.sell.mediaKind = "";
  state.sell.mediaLabel = "";
  state.sell.mediaFileType = "";
  state.sell.mediaItems = [];
  state.selectedPreview = DEFAULT_THUMBNAIL;
  $("#title-input").value = "Locked media";
  $("#note-input").value = "Pay once to unlock this content.";
  $("#content-url-input").value = "";
  $("#sell-media-title").textContent = "Add Media";
  $("#file-meta").textContent = "Photo, video, template, course, e-book, or podcast";
  $("#sell-media-icon").innerHTML = '<i data-lucide="plus"></i>';
  updateSellMediaPreview();
  updatePreview();
}

function mediaTypeForFile(file) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}

function mediaPreviewFallback(type) {
  if (type === "video") return "assets/thumb-video.svg";
  if (type === "image") return DEFAULT_THUMBNAIL;
  return "assets/thumb-download.svg";
}

function mediaCountLabel(count) {
  return count === 1 ? "1 media" : `${count} media`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Video";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function mediaSummary() {
  const count = state.sell.mediaItems.length;
  if (!count) return "Photo, video, template, course, e-book, or podcast";
  const images = state.sell.mediaItems.filter((item) => item.type === "image").length;
  const videos = state.sell.mediaItems.filter((item) => item.type === "video").length;
  const parts = [];
  if (images) parts.push(`${images} photo${images === 1 ? "" : "s"}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
  const other = count - images - videos;
  if (other) parts.push(`${other} file${other === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

function createMediaItem(file) {
  const type = mediaTypeForFile(file);
  const item = {
    id: id(),
    name: file.name,
    size: file.size,
    type,
    duration: 0,
    preview: mediaPreviewFallback(type),
  };

  if (type === "image") {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      item.preview = reader.result;
      updateSellMediaPreview();
      updatePreview();
    });
    reader.readAsDataURL(file);
  } else if (type === "video") {
    createVideoThumbnail(file, item);
  }

  return item;
}

function addMediaFiles(files) {
  const selectedFiles = [...files].filter((file) => {
    const type = mediaTypeForFile(file);
    return type === "image" || type === "video";
  });

  if (!selectedFiles.length) {
    showToast("Choose photos or videos");
    return;
  }

  state.sell.mediaItems.push(...selectedFiles.map(createMediaItem));
  state.sell.mediaKind = "photo-video";
  state.sell.mediaLabel = mediaSummary();
  state.sell.mediaFileType = state.sell.mediaItems.some((item) => item.type === "video") ? "video" : "image";
  state.selectedPreview = state.sell.mediaItems[0]?.preview || DEFAULT_THUMBNAIL;

  $("#title-input").value = state.sell.mediaItems.length === 1 ? state.sell.mediaItems[0].name.replace(/\.[^.]+$/, "") : `${state.sell.mediaItems.length} media drop`;
  $("#sell-media-title").textContent = "Photo, Video";
  $("#file-meta").textContent = mediaSummary();
  $("#sell-media-icon").innerHTML = '<i data-lucide="image"></i>';
  updateSellNote();
  updateSellMediaPreview();
  updatePreview();
  syncIcons();
}

function removeSellMediaItem(itemId) {
  state.sell.mediaItems = state.sell.mediaItems.filter((item) => item.id !== itemId);

  if (!state.sell.mediaItems.length) {
    resetSellMediaSelection();
    return;
  }

  state.sell.mediaLabel = mediaSummary();
  state.sell.mediaFileType = state.sell.mediaItems.some((item) => item.type === "video") ? "video" : "image";
  state.selectedPreview = state.sell.mediaItems[0]?.preview || DEFAULT_THUMBNAIL;
  $("#title-input").value = state.sell.mediaItems.length === 1 ? state.sell.mediaItems[0].name.replace(/\.[^.]+$/, "") : `${state.sell.mediaItems.length} media drop`;
  $("#file-meta").textContent = mediaSummary();
  updateSellNote();
  updateSellMediaPreview();
  updatePreview();
}

function createVideoThumbnail(file, item) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;
  let done = false;

  const finish = (src) => {
    if (done) return;
    done = true;
    URL.revokeObjectURL(objectUrl);
    item.duration = Number.isFinite(video.duration) ? video.duration : 0;
    item.preview = src;
    updateSellMediaPreview();
    updatePreview();
  };

  const capture = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 900;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      finish(canvas.toDataURL("image/jpeg", 0.82));
    } catch {
      finish("assets/thumb-video.svg");
    }
  };

  video.addEventListener(
    "loadeddata",
    () => {
      try {
        const targetTime = Math.min(0.25, Math.max(0, video.duration || 0));
        if (targetTime > 0) {
          video.currentTime = targetTime;
        } else {
          capture();
        }
      } catch {
        capture();
      }
    },
    { once: true },
  );

  video.addEventListener(
    "seeked",
    capture,
    { once: true },
  );

  video.addEventListener("error", () => finish("assets/thumb-video.svg"), { once: true });
}

function setSellMedia(kind, label = "") {
  const media = sellMediaTypes[kind] || sellMediaTypes["photo-video"];
  state.sell.mediaKind = kind;
  state.sell.mediaLabel = label || media.label;
  if (kind !== "photo-video") {
    state.sell.mediaFileType = "";
    state.sell.mediaItems = [];
  }
  state.selectedPreview = kind === "photo-video" ? state.sell.mediaItems[0]?.preview || DEFAULT_THUMBNAIL : media.thumbnail;

  const titleInput = $("#title-input");
  const noteInput = $("#note-input");
  const mediaTitle = $("#sell-media-title");
  const mediaMeta = $("#file-meta");
  const icon = $("#sell-media-icon");

  if (titleInput) titleInput.value = label ? label.replace(/\.[^.]+$/, "") : media.title;
  if (noteInput) updateSellNote();
  if (mediaTitle) mediaTitle.textContent = media.label;
  if (mediaMeta) mediaMeta.textContent = kind === "photo-video" && state.sell.mediaItems.length ? mediaSummary() : label ? compactLabel(label) : "Ready to price and publish";
  if (icon) icon.innerHTML = `<i data-lucide="${media.icon}"></i>`;
  const downloadLabelElement = $("#sell-download-label");
  if (downloadLabelElement) downloadLabelElement.textContent = downloadLabel();
  updateSellMediaPreview();
  updatePreview();
  syncIcons();
}

function syncSellDetailFields() {
  if (!state.sell.detailOpen) return;
  const media = sellMediaTypes[state.sell.mediaKind] || sellMediaTypes.template;
  const detailTitle = $("#detail-title-input");
  const detailPrice = $("#detail-price-input");
  const detailNote = $("#detail-note-input");
  const detailUrl = $("#detail-url-input");
  const titleInput = $("#title-input");
  const priceInput = $("#price-input");
  const noteInput = $("#note-input");
  const urlInput = $("#content-url-input");

  const title = detailTitle?.value.trim() || media.title;
  const description = detailNote?.value.trim();
  const meta = `${media.label} - ${state.sell.access}. Download ${downloadNoteText()}.`;

  if (titleInput) titleInput.value = title;
  if (priceInput && detailPrice) priceInput.value = detailPrice.value;
  if (noteInput) noteInput.value = description ? `${description}\n\n${meta}` : meta;
  if (urlInput && detailUrl) urlInput.value = detailUrl.value.trim();
}

function openSellDetail(kind) {
  const media = sellMediaTypes[kind] || sellMediaTypes.template;
  setSellMedia(kind);
  state.sell.detailOpen = true;
  document.body.classList.add("is-sell-detail");
  $("#sell-start").hidden = true;
  $("#sell-detail").hidden = false;
  $("#sell-detail-title").textContent = media.label;
  $("#sell-detail-icon").innerHTML = `<i data-lucide="${media.icon}"></i>`;
  $("#detail-title-input").value = "";
  $("#detail-price-input").value = "";
  $("#detail-note-input").value = "";
  $("#detail-url-input").value = "";
  $("#price-input").value = "";
  $("#content-url-input").value = "";
  $("#title-input").value = media.title;
  updateSellNote();
  updatePreview();
  syncIcons();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function closeSellDetail() {
  state.sell.detailOpen = false;
  document.body.classList.remove("is-sell-detail");
  $("#sell-detail").hidden = true;
  $("#sell-start").hidden = false;
  updatePreview();
  syncIcons();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setSellAccess(value) {
  state.sell.access = value;
  const label = $("#sell-access-label");
  if (label) label.textContent = value;
  updateSellNote();
  updatePreview();
}

function setSellDownload(value) {
  state.sell.download = value;
  const label = $("#sell-download-label");
  if (label) label.textContent = downloadLabel();
  updateSellNote();
  updatePreview();
}

function setDownloadExtraPercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return;
  state.sell.downloadExtraPercent = percent;
  if (state.sell.download === "Allowed (Charge Extra)") {
    setSellDownload(state.sell.download);
  }
}

function syncSheetSelection(attribute, selectedValue) {
  const dialog = $("#share-dialog");
  $$(`[${attribute}]`, dialog).forEach((button) => {
    const isSelected = button.getAttribute(attribute) === selectedValue;
    button.classList.toggle("is-selected", isSelected);
    const icon = button.querySelector("svg, i");
    if (icon) {
      const replacement = document.createElement("i");
      replacement.setAttribute("data-lucide", isSelected ? "circle-dot" : "circle");
      icon.replaceWith(replacement);
    }
  });
  syncIcons();
}

function openMediaSheet() {
  openDialog(
    "Add Media",
    `
      <div class="sheet-list">
        <button class="sheet-row" type="button" data-media-kind="photo-video">
          <i data-lucide="image"></i>
          <span>Photo, Video</span>
        </button>
        <button class="sheet-row" type="button" data-media-kind="template">
          <i data-lucide="layout-template"></i>
          <span>Template</span>
        </button>
        <button class="sheet-row" type="button" data-media-kind="course">
          <i data-lucide="graduation-cap"></i>
          <span>Course</span>
        </button>
        <button class="sheet-row" type="button" data-media-kind="ebook">
          <i data-lucide="book-open"></i>
          <span>E-book</span>
        </button>
        <button class="sheet-row" type="button" data-media-kind="podcast">
          <i data-lucide="mic"></i>
          <span>Podcast</span>
        </button>
      </div>
    `,
    { sheet: true },
  );
}

function openAccessSheet() {
  const options = [
    ["Everyone", "Anyone can buy and unlock this content"],
    ["Unlisted", "Only people with the link can unlock this content"],
    ["SVIP", "Only Super VIPs can unlock this content"],
  ];
  openDialog(
    "Who Can Buy",
    `
      <div class="sheet-list option-list">
        ${options
          .map(
            ([label, copy]) => `
              <button class="sheet-option ${state.sell.access === label ? "is-selected" : ""}" type="button" data-access-option="${label}">
                <span>
                  <strong>${label}</strong>
                  <small>${copy}</small>
                </span>
                <i data-lucide="${state.sell.access === label ? "circle-dot" : "circle"}"></i>
              </button>
            `,
          )
          .join("")}
      </div>
    `,
    { sheet: true },
  );
}

function openDownloadSheet() {
  const options = [
    ["Allowed", "Let buyers download."],
    ["Allowed (Charge Extra)", "Let buyers download for an extra price."],
    ["Not Allowed", "Buyers cannot download."],
  ];
  openDialog(
    "Download",
    `
      <div class="sheet-list option-list">
        ${options
          .map(
            ([label, copy]) => `
              <div class="sheet-disclosure ${state.sell.download === label ? "is-selected" : ""}">
                <button class="sheet-option" type="button" data-download-option="${label}">
                  <span>
                    <strong>${label}</strong>
                    <small>${copy}</small>
                  </span>
                  <i data-lucide="${state.sell.download === label ? "circle-dot" : "circle"}"></i>
                </button>
                ${
                  label === "Allowed (Charge Extra)" && state.sell.download === label
                    ? `
                      <button class="sheet-subrow" type="button" data-open-download-extra>
                        <span>Charge extra</span>
                        <strong>${state.sell.downloadExtraPercent}%</strong>
                        <i data-lucide="chevron-right"></i>
                      </button>
                    `
                    : ""
                }
              </div>
            `,
          )
          .join("")}
      </div>
    `,
    { sheet: true },
  );
}

function openDownloadExtraSheet() {
  closeNestedSheet();
  const dialog = $("#share-dialog");
  const options = [10, 15, 20, 25, 30, 35, 40, 45, 50];
  const layer = document.createElement("div");
  layer.className = "nested-sheet-layer";
  layer.innerHTML = `
    <section class="nested-sheet-panel" aria-label="Charge extra">
      <div class="nested-sheet-head">
        <button class="sheet-done" type="button" data-close-nested-sheet>Done</button>
      </div>
      <div class="percent-picker" role="listbox" aria-label="Download extra percentage">
        ${options
          .map(
            (percent) => `
              <button class="${state.sell.downloadExtraPercent === percent ? "is-selected" : ""}" type="button" data-download-extra-percent="${percent}">
                <span>${percent}</span>
                <small>%</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
  dialog.append(layer);
  syncIcons();
}

function closeNestedSheet() {
  $(".nested-sheet-layer")?.remove();
}

function syncDownloadExtraPicker() {
  $$("[data-download-extra-percent]").forEach((button) => {
    const isSelected = Number(button.dataset.downloadExtraPercent) === state.sell.downloadExtraPercent;
    button.classList.toggle("is-selected", isSelected);
  });
  const parentValue = $("[data-open-download-extra] strong");
  if (parentValue) parentValue.textContent = `${state.sell.downloadExtraPercent}%`;
}

function openProfileSettings() {
  openDialog(
    "Profile settings",
    `
      <div class="settings-panel">
        <p class="settings-section-label">Account</p>
        <button class="settings-row" type="button" data-open-account-settings>
          <span class="settings-icon"><i data-lucide="mail"></i></span>
          <span>
            <strong>Account details</strong>
            <small>${escapeHtml(accountSummary())}</small>
          </span>
          <i data-lucide="chevron-right"></i>
        </button>
        <p class="settings-section-label">Creator page</p>
        <button class="settings-row" type="button" data-open-edit-profile>
          <span class="settings-icon"><i data-lucide="user-round-pen"></i></span>
          <span>
            <strong>Public profile</strong>
            <small>Edit handle and bio</small>
          </span>
          <i data-lucide="chevron-right"></i>
        </button>
        <button class="settings-row" type="button" data-open-share>
          <span class="settings-icon"><i data-lucide="send"></i></span>
          <span>
            <strong>Share page</strong>
            <small>Copy your storefront link</small>
          </span>
          <i data-lucide="chevron-right"></i>
        </button>
        <button class="settings-row" type="button" data-open-payment-settings>
          <span class="settings-icon"><i data-lucide="shield-check"></i></span>
          <span>
            <strong>Payment requirements</strong>
            <small>${isPayoutReady() ? `Ready: ${escapeHtml(state.payout.bankName)} ending ${escapeHtml(state.payout.accountLast4)}` : "Bank, identity, and policy checks"}</small>
          </span>
          <i data-lucide="chevron-right"></i>
        </button>
        <button class="settings-row" type="button" data-open-bundle-settings>
          <span class="settings-icon"><i data-lucide="badge-percent"></i></span>
          <span>
            <strong>Bundle discounts</strong>
            <small>${bundleSummary()}</small>
          </span>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
    `,
  );
}

function openAccountSettings() {
  openDialog(
    "Account details",
    `
      <form class="dialog-form" id="account-settings-form">
        <div class="settings-note">
          <i data-lucide="mail-check"></i>
          <span>Keep your login and contact info current for receipts, security, and account recovery.</span>
        </div>
        <label class="field">
          <span>Email</span>
          <input name="email" type="email" maxlength="80" value="${escapeHtml(state.account.email)}" placeholder="you@example.com" autocomplete="email" required />
        </label>
        <label class="field">
          <span>Phone</span>
          <input name="phone" type="tel" maxlength="24" value="${escapeHtml(state.account.phone)}" placeholder="Optional" autocomplete="tel" />
        </label>
        <label class="field">
          <span>Recovery email</span>
          <input name="recoveryEmail" type="email" maxlength="80" value="${escapeHtml(state.account.recoveryEmail)}" placeholder="Optional backup email" autocomplete="email" />
        </label>
        <label class="check-row">
          <input name="emailUpdates" type="checkbox" ${state.account.emailUpdates ? "checked" : ""} />
          <span>Email me receipts, payout notices, and security alerts.</span>
        </label>
        <button class="primary-button" type="submit">
          <i data-lucide="check"></i>
          <span>Save account details</span>
        </button>
      </form>
    `,
  );
}

function openShareProfile() {
  const url = `${PUBLIC_BASE_URL}/${state.profile.handle}`;
  openDialog(
    "Share profile",
    `
      <div class="share-box">
        <span class="share-url">${url}</span>
        <button class="primary-button" type="button" data-copy-url="${url}">
          <i data-lucide="copy"></i>
          <span>Copy profile link</span>
        </button>
      </div>
    `,
  );
}

function openEditProfile() {
  openDialog(
    "Edit profile",
    `
      <form class="dialog-form" id="edit-profile-form">
        <label class="field">
          <span>Handle</span>
          <span class="handle-input">
            <span>@</span>
            <input id="edit-handle-input" name="handle" type="text" maxlength="24" value="${escapeHtml(state.profile.handle)}" required />
          </span>
        </label>
        <label class="field">
          <span>Bio</span>
          <textarea id="edit-bio-input" name="bio" rows="4" maxlength="120">${escapeHtml(state.profile.bio)}</textarea>
        </label>
        <button class="primary-button" type="submit" data-save-profile>
          <i data-lucide="check"></i>
          <span>Save profile</span>
        </button>
      </form>
    `,
  );
  $("#edit-handle-input")?.focus();
}

function openPaymentSettings() {
  const ready = isPayoutReady();
  const connected = state.payout.connected;

  let statusBlock = "";
  let actionBlock = "";

  if (ready) {
    statusBlock = `
      <div class="settings-note" style="border-color:#22c55e33;">
        <i data-lucide="check-circle" style="color:#22c55e;"></i>
        <span style="color:#22c55e;">Stripe account active. Charges and payouts are enabled.</span>
      </div>`;
    actionBlock = `
      <button class="secondary-button" type="button" id="stripe-connect-btn">
        <i data-lucide="external-link"></i>
        <span>Open Stripe dashboard</span>
      </button>`;
  } else if (connected) {
    statusBlock = `
      <div class="settings-note" style="border-color:#f59e0b33;">
        <i data-lucide="clock" style="color:#f59e0b;"></i>
        <span style="color:#f59e0b;">Stripe connected &mdash; finish identity verification to enable payouts.</span>
      </div>`;
    actionBlock = `
      <button class="primary-button" type="button" id="stripe-connect-btn">
        <i data-lucide="arrow-right"></i>
        <span>Continue Stripe setup</span>
      </button>`;
  } else {
    statusBlock = `
      <div class="settings-note">
        <i data-lucide="credit-card"></i>
        <span>Connect a Stripe account to accept payments and receive payouts directly.</span>
      </div>`;
    actionBlock = `
      <button class="primary-button" type="button" id="stripe-connect-btn">
        <i data-lucide="link"></i>
        <span>Connect with Stripe</span>
      </button>`;
  }

  openDialog(
    "Stripe payouts",
    `<div class="dialog-form" id="payment-settings-form">
      ${statusBlock}
      <div class="settings-note" style="margin-top:8px;">
        <i data-lucide="info"></i>
        <span>Vaultline uses Stripe Connect. Your payouts land directly in your bank account after each sale.</span>
      </div>
      ${actionBlock}
    </div>`,
  );

  document.getElementById("stripe-connect-btn")?.addEventListener("click", async () => {
    if (ready) {
      // Open Stripe dashboard directly — no re-onboarding needed
      window.open("https://dashboard.stripe.com", "_blank");
      return;
    }
    const btn = document.getElementById("stripe-connect-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Redirecting\u2026"; }
    try {
      const data = await VaultlineAPI.connectOnboarding();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      showToast(err.message || "Could not start Stripe onboarding");
      if (btn) { btn.disabled = false; }
    }
  });
}

function openBundleSettings() {
  openDialog(
    "Bundle discounts",
    `
      <form class="dialog-form" id="bundle-settings-form">
        <label class="check-row">
          <input name="enabled" type="checkbox" ${state.bundle.enabled ? "checked" : ""} />
          <span>Offer bundle discounts on my profile</span>
        </label>
        <div class="field-grid">
          <label class="field">
            <span>Discount percent</span>
            <input name="discount" type="number" min="1" max="80" step="1" value="${state.bundle.discount}" required />
          </label>
          <label class="field">
            <span>Minimum drops</span>
            <input name="minItems" type="number" min="2" max="10" step="1" value="${state.bundle.minItems}" required />
          </label>
        </div>
        <div class="settings-note">
          <i data-lucide="shopping-bag"></i>
          <span>Buyers see this offer when they add multiple drops from your storefront.</span>
        </div>
        <button class="primary-button" type="submit">
          <i data-lucide="check"></i>
          <span>Save bundle</span>
        </button>
      </form>
    `,
  );
}

function openBuyerPreview(link) {
  link.views += 1;
  openDialog(
    "Buyer preview",
    `
      <div class="preview-phone">
        <div class="preview-top">
          <span class="preview-handle">@${state.profile.handle}</span>
          <span class="preview-price">${money(link.price)}</span>
        </div>
        <div class="locked-art">
          <img src="${escapeHtml(link.thumbnail)}" alt="" />
          <div class="lock-plate"><i data-lucide="lock-keyhole"></i></div>
        </div>
        <h2>${escapeHtml(link.title)}</h2>
        <p>${escapeHtml(link.note || "Pay once to unlock the file and download instantly.")}</p>
        <button class="buyer-button" type="button" data-buy-link="${link.id}">
          <i data-lucide="credit-card"></i>
          <span>Pay ${money(link.price)}</span>
        </button>
      </div>
    `,
  );
  renderAll();
}

async function createLink(form) {
  syncSellDetailFields();
  const data = new FormData(form);
  const title = String(data.get("title") || "Untitled drop").trim();
  const price = Number(data.get("price")) || 0;
  const contentUrl = String(data.get("contentUrl") || "").trim();
  const mediaItems = state.sell.mediaItems;

  if (!state.sell.mediaKind) {
    showToast("Add media first");
    return;
  }

  const validationMessage = sellValidationMessage();
  if (validationMessage) {
    syncPriceErrors();
    showToast(validationMessage);
    return;
  }

  if (!currentUser) {
    showToast("Sign in first");
    showLoginOverlay("creator");
    return;
  }

  // Disable button during upload
  const btn = form.querySelector("button[type=submit], #generate-link-button");
  if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }

  try {
    const dropData = {
      title,
      description: String(data.get("note") || "").trim(),
      price,
      access: state.sell.access || "everyone",
      download: state.sell.download || "allowed",
      downloadExtraPercent: state.sell.downloadExtraPercent || 0,
    };

    // Use file-based media items if present, otherwise wrap contentUrl as a stub
    let itemsToUpload = mediaItems;
    if (!itemsToUpload.length && contentUrl) {
      // URL-only drop — no file to upload, send a 1-byte stub
      itemsToUpload = [{ name: "link.txt", file: new Blob([contentUrl], { type: "text/plain" }) }];
    }

    const result = await VaultlineAPI.createDrop(dropData, itemsToUpload);
    const drop = result.drop;

    const link = {
      id: drop.id,
      title: drop.title,
      price: drop.price,
      note: drop.description || "",
      fileName: mediaItems.length > 1
        ? `${mediaItems.length} media items`
        : mediaItems[0]?.name || contentUrl || `${title.replace(/\s+/g, "-").toLowerCase()}`,
      mediaCount: mediaItems.length || 1,
      mediaTypes: mediaItems.map((item) => item.type),
      contentUrl,
      download: state.sell.download,
      downloadExtraPercent: state.sell.downloadExtraPercent,
      thumbnail: mediaItems[0]?.preview || state.selectedPreview || DEFAULT_THUMBNAIL,
      status: "active",
      views: 0,
      sales: 0,
      revenue: 0,
      url: `${PUBLIC_BASE_URL}/fan.html?handle=${encodeURIComponent(state.profile?.handle || "")}`,
    };

    state.links.unshift(link);
    saveSettings();
    renderAll();
    setView("links");
    showToast("Drop published ✓");
  } catch (err) {
    showToast(err.message || "Upload failed");
    console.error("createLink error:", err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Generate link"; }
  }
}

function recordSale(link) {
  const creatorAmount = Number((link.price * 0.9).toFixed(2));
  link.sales += 1;
  link.revenue += creatorAmount;
  state.operations.unshift({
    title: link.title,
    time: "Just now",
    amount: creatorAmount,
    icon: "lock-open",
  });
  saveSettings();
  renderAll();
  showToast("Purchase unlocked");
}

function initLocalState() {
  state.links = [];
  state.operations = [];
  state.withdrawn = 0;
}

// ── Auth ──────────────────────────────────────────────────────────────────
let currentUser = null;

function showLoginOverlay(role = "creator") {
  let overlay = document.getElementById("vl-login-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "vl-login-overlay";
    overlay.style.cssText = [
      "position:fixed","inset:0","z-index:9999","display:flex",
      "align-items:center","justify-content:center",
      "background:rgba(0,0,0,0.85)","padding:24px",
    ].join(";");
    overlay.innerHTML = `
      <div style="background:#111;border:1px solid #222;border-radius:20px;padding:32px 28px;width:100%;max-width:360px;">
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">Sign in to Vaultline</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#888;">We'll send you a magic link — no password needed.</p>
        <form id="vl-login-form">
          <input id="vl-login-email" type="email" required placeholder="your@email.com"
            style="width:100%;box-sizing:border-box;background:#1a1a1a;border:1px solid #333;border-radius:12px;
                   color:#fff;font-size:15px;padding:13px 16px;margin-bottom:14px;outline:none;" />
          <button type="submit"
            style="width:100%;background:#22c55e;color:#000;font-weight:700;font-size:15px;
                   border:none;border-radius:12px;padding:14px;cursor:pointer;">
            Send magic link
          </button>
        </form>
        <p id="vl-login-status" style="margin:14px 0 0;font-size:13px;color:#888;text-align:center;"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("vl-login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("vl-login-email").value.trim();
      const status = document.getElementById("vl-login-status");
      const btn = event.target.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Sending…";
      status.textContent = "";
      try {
        await VaultlineAPI.authStart(email, role);
        status.style.color = "#22c55e";
        status.textContent = "✓ Check your email for the magic link";
        btn.textContent = "Link sent";
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Send magic link";
        status.style.color = "#f87171";
        status.textContent = err.message || "Something went wrong";
      }
    });
  }
  overlay.hidden = false;
}

function hideLoginOverlay() {
  const overlay = document.getElementById("vl-login-overlay");
  if (overlay) overlay.hidden = true;
}

async function checkAuth() {
  try {
    const data = await VaultlineAPI.me();
    currentUser = data.user;
    hideLoginOverlay();
    return data.user;
  } catch {
    currentUser = null;
    showLoginOverlay("creator");
    return null;
  }
}

// ── Load creator profile from API ────────────────────────────────────────────
async function loadCreatorProfileFromApi() {
  try {
    const [profileData, connectData] = await Promise.allSettled([
      VaultlineAPI.getCreatorProfile(),
      VaultlineAPI.getConnectStatus(),
    ]);

    if (profileData.status === "fulfilled" && profileData.value?.profile) {
      const profile = profileData.value.profile;
      state.profile.handle = profile.handle || state.profile.handle;
      state.profile.bio = profile.bio || state.profile.bio;
    }

    if (connectData.status === "fulfilled") {
      const cs = connectData.value;
      state.payout.connected = Boolean(cs.connected);
      state.payout.chargesEnabled = Boolean(cs.chargesEnabled);
      state.payout.payoutsEnabled = Boolean(cs.payoutsEnabled);
      state.payout.identityStatus = cs.identityStatus || "pending";
      state.payout.stripeAccountId = cs.stripeAccountId || null;
    }

    saveSettings();
    renderAll();
  } catch (err) {
    console.warn("Could not load creator profile from API:", err.message);
  }
}

// ── Load drops from API ────────────────────────────────────────────────────
async function loadDropsFromApi() {
  try {
    const data = await VaultlineAPI.listCreatorDrops();
    state.links = (data.drops || []).map((drop) => ({
      id: drop.id,
      title: drop.title,
      price: drop.price,
      note: drop.description || "",
      fileName: drop.drop_media?.length > 1
        ? `${drop.drop_media.length} media items`
        : drop.drop_media?.[0]?.file_name || drop.title,
      mediaCount: drop.drop_media?.length || 0,
      mediaTypes: (drop.drop_media || []).map((m) => m.file_type),
      thumbnail: DEFAULT_THUMBNAIL,
      status: drop.status || "active",
      views: 0,
      sales: (drop.purchases || []).filter((p) => p.status === "paid").length,
      revenue: (drop.purchases || [])
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.amount || 0) * 0.9, 0),
      url: `${PUBLIC_BASE_URL}/fan.html?handle=${encodeURIComponent(state.profile?.handle || "")}`,
    }));
    renderAll();
  } catch (err) {
    console.warn("Could not load drops from API:", err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initLocalState();
  loadSettings();
  renderAll();
  syncIcons();

  // Auth gate — check session then load real data
  checkAuth().then((user) => {
    if (user) {
      loadCreatorProfileFromApi();
      loadDropsFromApi();
    }
  });

  const hashView = window.location.hash.replace("#", "");
  if (hashView && $(`[data-view-panel="${hashView}"]`)) {
    setView(hashView, false);
  }

  window.addEventListener("hashchange", syncViewFromHash);

  $$(".segmented button[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      $$(".segmented button[data-filter]").forEach((tab) => tab.classList.toggle("is-selected", tab === button));
      renderLinks();
    });
  });

  $("#create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    createLink(event.currentTarget);
  });

  const generateLinkButton = $("#generate-link-button");
  if (generateLinkButton) {
    generateLinkButton.addEventListener("click", (event) => {
      event.preventDefault();
      createLink($("#create-form"));
    });
  }

  ["#title-input", "#price-input", "#note-input"].forEach((selector) => {
    $(selector).addEventListener("input", updatePreview);
    $(selector).addEventListener("change", updatePreview);
  });

  ["#detail-title-input", "#detail-price-input", "#detail-note-input", "#detail-url-input"].forEach((selector) => {
    $(selector).addEventListener("input", updatePreview);
    $(selector).addEventListener("change", updatePreview);
  });

  $("#file-input").addEventListener("change", (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    addMediaFiles(files);
    event.target.value = "";
  });

  initMediaRailControls();

  $("#cover-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      showToast("Choose an image for the cover");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state.coverImage = reader.result;
      $("#profile-cover-image").src = state.coverImage;
      saveSettings();
      renderLaunchChecklist();
      showToast("Cover updated");
    });
    reader.readAsDataURL(file);
  });

  $("#avatar-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      showToast("Choose an image for the profile photo");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state.avatarImage = reader.result;
      saveSettings();
      renderProfileMeta();
      renderLaunchChecklist();
      syncIcons();
      showToast("Profile photo updated");
    });
    reader.readAsDataURL(file);
  });

  document.addEventListener("click", (event) => {
    const accountMenuSurface = event.target.closest(".account-dropdown, [data-open-account-menu]");
    if (!accountMenuSurface) setAccountDropdown(false);

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);

    const removeMediaItemButton = event.target.closest("[data-remove-media-item]");
    if (removeMediaItemButton) {
      event.preventDefault();
      removeSellMediaItem(removeMediaItemButton.dataset.removeMediaItem);
      return;
    }

    const removeMediaButton = event.target.closest("[data-remove-media]");
    if (removeMediaButton) {
      event.preventDefault();
      resetSellMediaSelection();
      return;
    }

    const addMoreMediaButton = event.target.closest("[data-add-more-media]");
    if (addMoreMediaButton) {
      event.preventDefault();
      $("#file-input").value = "";
      $("#file-input").click();
      return;
    }

    const mediaRailNavButton = event.target.closest("[data-media-rail-nav]");
    if (mediaRailNavButton) {
      event.preventDefault();
      scrollMediaRail(mediaRailNavButton.dataset.mediaRailNav);
      return;
    }

    const mediaSheetButton = event.target.closest("[data-open-media-sheet]");
    if (mediaSheetButton) {
      openMediaSheet();
      return;
    }

    const mediaChoice = event.target.closest("[data-media-kind]");
    if (mediaChoice) {
      const kind = mediaChoice.dataset.mediaKind;
      if (kind === "photo-video") {
        $("#share-dialog").close();
        $("#file-input").value = "";
        $("#file-input").click();
      } else {
        $("#share-dialog").close();
        openSellDetail(kind);
      }
      return;
    }

    const sellBackButton = event.target.closest("[data-sell-back]");
    if (sellBackButton) {
      closeSellDetail();
      return;
    }

    const accessSheetButton = event.target.closest("[data-open-access-sheet]");
    if (accessSheetButton) {
      openAccessSheet();
      return;
    }

    const accessChoice = event.target.closest("[data-access-option]");
    if (accessChoice) {
      setSellAccess(accessChoice.dataset.accessOption);
      syncSheetSelection("data-access-option", state.sell.access);
      return;
    }

    const downloadSheetButton = event.target.closest("[data-open-download-sheet]");
    if (downloadSheetButton) {
      openDownloadSheet();
      return;
    }

    const downloadChoice = event.target.closest("[data-download-option]");
    if (downloadChoice) {
      setSellDownload(downloadChoice.dataset.downloadOption);
      openDownloadSheet();
      return;
    }

    const downloadExtraButton = event.target.closest("[data-open-download-extra]");
    if (downloadExtraButton) {
      openDownloadExtraSheet();
      return;
    }

    const closeNestedButton = event.target.closest("[data-close-nested-sheet]");
    if (closeNestedButton) {
      closeNestedSheet();
      return;
    }

    const downloadExtraChoice = event.target.closest("[data-download-extra-percent]");
    if (downloadExtraChoice) {
      setDownloadExtraPercent(downloadExtraChoice.dataset.downloadExtraPercent);
      syncDownloadExtraPicker();
      return;
    }

    const shareButton = event.target.closest("[data-open-share]");
    if (shareButton) openShareProfile();

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
      currentUser = null;
      showToast("Logged out");
      setTimeout(() => showLoginOverlay("creator"), 400);
      return;
    }

    const accountSettingsButton = event.target.closest("[data-open-account-settings]");
    if (accountSettingsButton) openAccountSettings();

    const settingsButton = event.target.closest("[data-open-profile-settings]");
    if (settingsButton) openProfileSettings();

    const editProfileButton = event.target.closest("[data-open-edit-profile]");
    if (editProfileButton) openEditProfile();

    const paymentButton = event.target.closest("[data-open-payment-settings]");
    if (paymentButton) openPaymentSettings();

    const bundleButton = event.target.closest("[data-open-bundle-settings]");
    if (bundleButton) openBundleSettings();

    const resetPayoutButton = event.target.closest("[data-reset-payout]");
    if (resetPayoutButton) {
      // Reset is a no-op for Stripe Connect — disconnect from Stripe dashboard
      showToast("Manage your Stripe account at dashboard.stripe.com");
    }

    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) $("#share-dialog").close();

    const copyUrlButton = event.target.closest("[data-copy-url]");
    if (copyUrlButton) copyText(copyUrlButton.dataset.copyUrl);

    const copyLinkButton = event.target.closest("[data-copy-link]");
    if (copyLinkButton) {
      const link = state.links.find((item) => item.id === copyLinkButton.dataset.copyLink);
      if (link) copyText(link.url);
    }

    const toggleLinkButton = event.target.closest("[data-toggle-link]");
    if (toggleLinkButton) {
      const link = state.links.find((item) => item.id === toggleLinkButton.dataset.toggleLink);
      if (link) {
        const newStatus = link.status === "expired" ? "active" : "expired";
        link.status = newStatus;
        saveSettings();
        renderAll();
        showToast(newStatus === "expired" ? "Drop expired" : "Drop restored");
        VaultlineAPI.updateDrop(link.id, { status: newStatus }).catch((err) => {
          console.warn("Could not sync drop status:", err.message);
        });
      }
    }

    const deleteLinkButton = event.target.closest("[data-delete-link]");
    if (deleteLinkButton) {
      const dropId = deleteLinkButton.dataset.deleteLink;
      const index = state.links.findIndex((item) => item.id === dropId);
      if (index >= 0) {
        state.links.splice(index, 1);
        saveSettings();
        renderAll();
        showToast("Drop removed");
        VaultlineAPI.deleteDrop(dropId).catch((err) => {
          console.warn("Could not delete drop from API:", err.message);
        });
      }
    }

    const previewButton = event.target.closest("[data-preview-link]");
    if (previewButton) {
      const link = state.links.find((item) => item.id === previewButton.dataset.previewLink);
      if (link) openBuyerPreview(link);
    }

    const buyButton = event.target.closest("[data-buy-link]");
    if (buyButton) {
      const link = state.links.find((item) => item.id === buyButton.dataset.buyLink);
      if (link) recordSale(link);
      $("#share-dialog").close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setAccountDropdown(false);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === "edit-profile-form") {
      event.preventDefault();
      const data = new FormData(form);
      const handle = normalizeHandle(data.get("handle"));
      const bio = String(data.get("bio") || "").trim().slice(0, 120) ||
        "Private drops, files, and creator packs in one clean storefront.";
      state.profile.handle = handle;
      state.profile.bio = bio;
      saveSettings();
      renderProfileMeta();
      renderLaunchChecklist();
      $("#share-dialog").close();
      showToast("Profile updated");
      VaultlineAPI.updateCreatorProfile({ handle, bio }).catch((err) => {
        console.warn("Could not sync profile to API:", err.message);
      });
      return;
    }

    if (form.id === "account-settings-form") {
      event.preventDefault();
      const data = new FormData(form);
      state.account = {
        email: String(data.get("email") || "").trim().slice(0, 80),
        phone: String(data.get("phone") || "").trim().slice(0, 24),
        recoveryEmail: String(data.get("recoveryEmail") || "").trim().slice(0, 80),
        emailUpdates: data.get("emailUpdates") === "on",
      };
      saveSettings();
      renderLaunchChecklist();
      $("#share-dialog").close();
      showToast("Account details saved");
      return;
    }

    if (form.id === "payment-settings-form") {
      // The payment settings dialog now uses a button-driven Stripe Connect flow,
      // not a traditional form submit. This branch is a safety no-op.
      event.preventDefault();
      return;
    }

    if (form.id === "bundle-settings-form") {
      event.preventDefault();
      const data = new FormData(form);
      state.bundle = {
        enabled: data.get("enabled") === "on",
        discount: Math.min(80, Math.max(1, Math.round(Number(data.get("discount")) || 15))),
        minItems: Math.min(10, Math.max(2, Math.round(Number(data.get("minItems")) || 2))),
      };
      saveSettings();
      renderSettingsMeta();
      $("#share-dialog").close();
      showToast("Bundle settings saved");
    }
  });

  $("#withdraw-button").addEventListener("click", () => {
    const total = availableBalance();
    if (!total) {
      showToast("No balance available");
      return;
    }
    if (!isPayoutReady()) {
      openPaymentSettings();
      showToast("Connect your Stripe account first");
      return;
    }
    // Real payouts are handled by Stripe Connect — direct creator to dashboard
    window.open("https://dashboard.stripe.com", "_blank");
    showToast("Manage payouts in your Stripe dashboard");
  });

  // Handle Stripe Connect return / refresh redirects
  (async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("stripe_return") || params.has("stripe_refresh")) {
      // Clean up URL
      history.replaceState(null, "", window.location.pathname + window.location.hash);
      // Re-fetch connect status so UI reflects Stripe
      try {
        const cs = await VaultlineAPI.getConnectStatus();
        state.payout.connected = Boolean(cs.connected);
        state.payout.chargesEnabled = Boolean(cs.chargesEnabled);
        state.payout.payoutsEnabled = Boolean(cs.payoutsEnabled);
        state.payout.identityStatus = cs.identityStatus || "pending";
        state.payout.stripeAccountId = cs.stripeAccountId || null;
        saveSettings();
        renderAll();
        if (isPayoutReady()) {
          showToast("Stripe account connected and ready!");
        } else if (state.payout.connected) {
          showToast("Stripe connected — finish identity verification to enable payouts");
          openPaymentSettings();
        } else {
          showToast("Stripe setup incomplete — try again");
        }
      } catch (err) {
        console.warn("Could not check Stripe status:", err.message);
      }
    }
  })();

  $("#profile-settings-button")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openProfileSettings();
  });

  updatePreview();
});
