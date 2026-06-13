const { enforceRateLimit } = require("./_lib/rate-limit");
const { normalizeId, parseBody, sendJson } = require("./_lib/http");
const { isSupabaseConfigured, supabaseRequest } = require("./_lib/supabase");
const { getActivePlayerCount } = require("./_lib/presence");

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
  const sessionId = normalizeId(body.session_id);

  if (!playerId || !sessionId) {
    sendJson(response, 400, { error: "invalid_session" });
    return;
  }

  try {
    await enforceRateLimit(request, "heartbeat", playerId, { limit: 180, windowSeconds: 3600 });

    const rows = await supabaseRequest("/rest/v1/quiz_sessions", {
      method: "PATCH",
      query: {
        session_id: `eq.${sessionId}`,
        player_id: `eq.${playerId}`,
        select: "quiz_id",
      },
      body: {
        last_seen: new Date().toISOString(),
      },
      prefer: "return=representation",
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      sendJson(response, 404, { error: "session_not_found" });
      return;
    }

    sendJson(response, 200, {
      enabled: true,
      active_count: await getActivePlayerCount(),
    });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "heartbeat_failed" });
  }
};
