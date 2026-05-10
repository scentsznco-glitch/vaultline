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
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", config.jwtSecret).update(body).digest("base64url");
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function requireUser(request, response, next) {
  const user = verifySession(readSessionToken(request));
  if (!user) {
    response.status(401).json({ error: "Sign in required" });
    return;
  }
  request.user = user;
  next();
}

export function requireAdmin(request, response, next) {
  if (!request.user || !config.adminEmails.includes(String(request.user.email || "").toLowerCase())) {
    response.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
