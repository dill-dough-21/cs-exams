const crypto = require("crypto");
const { enforceRateLimit } = require("./_lib/rate-limit");
const { normalizeId, parseBody, sendJson } = require("./_lib/http");
const { getActivePlayerCount } = require("./_lib/presence");
const { isSupabaseConfigured, supabaseRequest } = require("./_lib/supabase");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 200, { enabled: false });
    return;
  }

  const body = parseBody(request);
  const playerId = normalizeId(body.player_id);
  const action = body.action === "heartbeat" ? "heartbeat" : "start";

  if (!playerId) {
    sendJson(response, 400, { error: "invalid_player" });
    return;
  }

  try {
    await enforceRateLimit(request, `presence-${action}`, playerId, {
      limit: action === "start" ? 80 : 180,
      windowSeconds: 3600,
    });

    if (action === "start") {
      const sessionId = crypto.randomUUID();
      const path = typeof body.path === "string" ? body.path.slice(0, 160) : "/";

      await supabaseRequest("/rest/v1/presence_sessions", {
        method: "POST",
        body: {
          session_id: sessionId,
          player_id: playerId,
          path,
        },
      });

      sendJson(response, 200, {
        enabled: true,
        session_id: sessionId,
        active_count: await getActivePlayerCount(),
      });
      return;
    }

    const sessionId = normalizeId(body.session_id);
    if (!sessionId) {
      sendJson(response, 400, { error: "invalid_session" });
      return;
    }

    const rows = await supabaseRequest("/rest/v1/presence_sessions", {
      method: "PATCH",
      query: {
        session_id: `eq.${sessionId}`,
        player_id: `eq.${playerId}`,
        select: "session_id",
      },
      body: {
        last_seen: new Date().toISOString(),
      },
      prefer: "return=representation",
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      sendJson(response, 404, { error: "presence_session_not_found" });
      return;
    }

    sendJson(response, 200, {
      enabled: true,
      active_count: await getActivePlayerCount(),
    });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "presence_failed" });
  }
};
