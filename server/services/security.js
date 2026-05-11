import crypto from "node:crypto";
import { config } from "../config.js";

export function id(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export function hashToken(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function signSession(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  const sig = crypto.createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSessionToken(request) {
  const auth = request.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return request.cookies?.vaultline_session || "";
}

export function verifySession(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [body, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireUser(request, response, next) {
  const user = verifySession(readSessionToken(request));
  if (!user) {
    response.status(401).json({ ok: false, error: "Sign in required" });
    return;
  }
  request.user = user;
  next();
}

export function requireAdmin(request, response, next) {
  if (!request.user || !config.adminEmails.includes(String(request.user.email || "").toLowerCase())) {
    response.status(403).json({ ok: false, error: "Admin access required" });
    return;
  }
  next();
}

const limiterBuckets = new Map();

function clientKey(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.ip || request.socket?.remoteAddress || "unknown";
}

export function rateLimit({ name = "route", windowMs = 60_000, max = 60 } = {}) {
  return (request, response, next) => {
    const now = Date.now();
    const key = `${name}:${clientKey(request)}`;
    const current = limiterBuckets.get(key);

    if (!current || current.resetAt <= now) {
      limiterBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      response.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      response.status(429).json({ ok: false, error: "Too many requests. Try again shortly." });
      return;
    }

    if (limiterBuckets.size > 5000) {
      for (const [bucketKey, bucket] of limiterBuckets.entries()) {
        if (bucket.resetAt <= now) limiterBuckets.delete(bucketKey);
      }
    }

    next();
  };
}
