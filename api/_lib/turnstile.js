const { getClientIp } = require("./http");

async function verifyTurnstile(token, request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { enabled: false, ok: true };

  if (typeof token !== "string" || token.length < 10) {
    return { enabled: true, ok: false, error: "missing_turnstile_token" };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  form.set("remoteip", getClientIp(request));

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    return { enabled: true, ok: false, error: "turnstile_unavailable" };
  }

  const result = await response.json();
  return {
    enabled: true,
    ok: Boolean(result.success),
    error: result.success ? null : "turnstile_failed",
  };
}

module.exports = {
  verifyTurnstile,
};
