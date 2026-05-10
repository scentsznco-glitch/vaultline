# Vaultline — Codex Handoff (2026-05-10)

## What This Is
Vaultline is a creator content paywall / drops marketplace. Creators upload files (photos, videos, zips), set a price, share a link. Fans pay once and unlock forever. No subscriptions.

**Live URL:** https://vaultd.me  
**Render service:** https://vaultline-48e8.onrender.com  
**GitHub:** https://github.com/scentsznco-glitch/vaultline (private, branch: main)

---

## Stack
- **Frontend:** Vanilla JS (`app.js`, `fan.js`), served as static files from Express
- **Backend:** Node.js + Express (`server/index.js`)
- **DB:** Supabase (Postgres) via `@supabase/supabase-js`
- **Auth:** Magic link email (no passwords) — Resend for email delivery
- **Storage:** Supabase Storage bucket `locked-media` for encrypted file uploads
- **Payments:** Stripe Connect (creator onboarding) + Stripe Checkout (fan purchases)
- **Deploy:** Render free tier (auto-deploys from `main` branch)
- **Domain:** `vaultd.me` — Namecheap DNS → Render

---

## File Map
```
index.html        ← Landing page (marketing)
app.html          ← Creator dashboard (served to logged-in creators)
app.js            ← All creator dashboard logic (~2300 lines, vanilla JS)
fan.html          ← Fan storefront page
fan.js            ← Fan storefront logic
api.js            ← Client-side API wrapper (calls server routes)
server/
  index.js        ← Express server, all routes
  config.js       ← Env var loading
  data.js         ← All Supabase DB operations
  services/
    email.js      ← Resend email sending (magic links + drop notifications)
    storage.js    ← Supabase Storage upload/download
    stripe.js     ← Stripe Connect + Checkout helpers
    security.js   ← Token hashing, ID generation
db/
  schema.sql      ← Database schema (already applied to Supabase)
```

---

## What's Working
- [x] Magic link auth (sign in → email → click link → redirect to app)
- [x] Creator profile setup (handle, bio)
- [x] Drop creation (upload files, set price $5+, publish)
- [x] Fan storefront at `/fan.html?creator=handle`
- [x] Fan purchase flow (Stripe Checkout → webhook → unlock)
- [x] Download delivery (signed Supabase Storage URLs, time-limited)
- [x] Creator dashboard (drops list, earnings, payout status)
- [x] Stripe Connect onboarding for creator payouts
- [x] Resend email integration (magic links + new drop notifications)
- [x] Supabase table permissions (GRANT ALL TO service_role — was broken, now fixed)
- [x] Production deploy on Render at vaultd.me
- [x] Landing page redesign (index.html) — polished, Syne font, no clunky buttons

---

## What Still Needs Work

### High Priority
1. **Wire `sendNewDropNotification` to drop creation route**
   - Function exists in `server/services/email.js`: `sendNewDropNotification({ to, creatorHandle, dropTitle, storefrontUrl })`
   - Needs to be called in `POST /api/drops` route in `server/index.js` after drop is created
   - Should email all followers of the creator (need to query `follows` table)

2. **Verify `drops` table has `updated_at` column**
   - `updateDropStatus()` in `data.js` does `.update({ status, updated_at: new Date().toISOString() })`
   - Check Supabase schema — add column if missing

3. **Update Stripe webhook endpoint**
   - Change to `https://vaultd.me/api/stripe/webhook` in Stripe Dashboard
   - Currently may still point to old URL

4. **Test end-to-end fan purchase on production**
   - Create a drop as creator → share link → buy as fan → verify download works

### Nice to Have
5. **Fan library page** — fans should be able to see all their purchased drops at `/fan.html?view=library`
6. **Creator analytics** — per-drop sales counts, revenue breakdown
7. **Mobile polish on app.html** — creator dashboard needs responsive review

---

## Key Env Vars (set on Render — do not change without updating Render dashboard)
```
NODE_ENV=production
PUBLIC_BASE_URL=https://vaultd.me
ALLOWED_ORIGINS=https://vaultd.me,https://vaultline.me
SUPABASE_URL=https://srlkkgiwdonjqwjtovog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_STORAGE_BUCKET=locked-media
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_ECavtbnH_...
RESEND_FROM=noreply@surveyhog.co
```

---

## Critical Notes
- **Free tier cold start:** Render spins down after inactivity — first request takes 50s+. Not a bug.
- **api.js BASE URL:** Fixed to use relative path in production (`window.location.hostname === 'localhost'` check)
- **Auth verify route:** Returns `302 redirect` to `app.html?auth=verified` — NOT JSON
- **Supabase GRANTs:** Already applied (`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role`)
- **Never run `Stop-Process -Name node` broadly** — kills OpenClaw. Kill by PID only.
- **Start command:** `npm run start` → `node server/index.js`
- **Port:** Reads `process.env.PORT` (Render sets this automatically)

---

## Recent Commits (newest first)
- `d13ae17` — verify route redirects to app.html; toast on auth=verified/invalid
- `8c457f6` — api.js BASE URL fix (was hardcoded to localhost:8787)
- `a51f0dd` — log route errors in production
- `484eb73` — remove scroll animation (all content always visible)
- `52d4383` — lander redesign (Syne font, grid layout, sharp buttons)
- `cb85230` — landing page at root (index.html), app at app.html
