const crypto = require("crypto");

const COOKIE_NAME = "bazasiada_turnstile_verified";
const TTL_SECONDS = 3 * 60 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function getSigningSecret() {
  return process.env.TURNSTILE_SESSION_SECRET
    || process.env.TURNSTILE_SECRET_KEY
    || process.env.RATE_LIMIT_SALT
    || "bazasiada-dev-turnstile-session";
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") return null;

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .reduce((found, cookie) => {
      if (found !== null) return found;
      const separatorIndex = cookie.indexOf("=");
      if (separatorIndex === -1) return null;

      const cookieName = cookie.slice(0, separatorIndex);
      if (cookieName !== name) return null;

      try {
        return decodeURIComponent(cookie.slice(separatorIndex + 1));
      } catch {
        return null;
      }
    }, null);
}

function createVerificationValue(playerId, now = Date.now()) {
  const payload = base64UrlEncode(JSON.stringify({
    player_id: playerId,
    exp: now + TTL_SECONDS * 1000,
  }));
  return `${payload}.${signPayload(payload)}`;
}

function hasRecentTurnstileVerification(request, playerId, now = Date.now()) {
  const value = getCookieValue(request, COOKIE_NAME);
  if (!value || !playerId) return false;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  if (!timingSafeEqualString(signature, signPayload(payload))) return false;

  try {
    const data = JSON.parse(base64UrlDecode(payload));
    return data.player_id === playerId && Number(data.exp) > now;
  } catch {
    return false;
  }
}

function isHttpsRequest(request) {
  return request.headers["x-forwarded-proto"] === "https"
    || request.headers["x-vercel-forwarded-proto"] === "https";
}

function setRecentTurnstileVerification(response, request, playerId) {
  const value = encodeURIComponent(createVerificationValue(playerId));
  const attributes = [
    `${COOKIE_NAME}=${value}`,
    `Max-Age=${TTL_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (isHttpsRequest(request)) {
    attributes.push("Secure");
  }

  response.setHeader("Set-Cookie", attributes.join("; "));
}

module.exports = {
  TTL_SECONDS,
  hasRecentTurnstileVerification,
  setRecentTurnstileVerification,
};
