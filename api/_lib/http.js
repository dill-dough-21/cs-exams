const crypto = require("crypto");

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  if (!request.body) return {};
  if (Buffer.isBuffer(request.body)) {
    try {
      return JSON.parse(request.body.toString("utf8"));
    } catch {
      return {};
    }
  }

  if (typeof request.body === "object") return request.body;

  try {
    return JSON.parse(request.body);
  } catch {
    return {};
  }
}

function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers["x-real-ip"] || request.socket?.remoteAddress || "unknown";
}

function hashValue(value) {
  const salt = process.env.RATE_LIMIT_SALT || "bazasiada-dev-salt";
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function normalizeId(value, maxLength = 80) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length >= 8 && trimmed.length <= maxLength
    ? trimmed
    : null;
}

function sanitizeNickname(value) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .slice(0, 24);

  return cleaned.toLowerCase() === "student" ? "" : cleaned;
}

function clampLimit(value, fallback = 10, max = 50) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

module.exports = {
  clampLimit,
  getClientIp,
  hashValue,
  normalizeId,
  parseBody,
  sanitizeNickname,
  sendJson,
};
