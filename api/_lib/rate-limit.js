const { getClientIp, hashValue } = require("./http");
const { isSupabaseConfigured, supabaseRequest } = require("./supabase");

async function enforceRateLimit(request, endpoint, playerId, options = {}) {
  if (!isSupabaseConfigured()) return;

  const limit = options.limit || 20;
  const windowSeconds = options.windowSeconds || 3600;
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const keys = [`ip:${hashValue(getClientIp(request))}`];

  if (playerId) {
    keys.push(`player:${hashValue(playerId)}`);
  }

  for (const key of keys) {
    const rows = await supabaseRequest("/rest/v1/rate_limit_events", {
      query: {
        select: "id",
        endpoint: `eq.${endpoint}`,
        rate_key: `eq.${key}`,
        created_at: `gte.${since}`,
        limit: limit + 1,
      },
    });

    if (Array.isArray(rows) && rows.length >= limit) {
      const error = new Error("rate_limited");
      error.status = 429;
      throw error;
    }
  }

  await supabaseRequest("/rest/v1/rate_limit_events", {
    method: "POST",
    body: keys.map((key) => ({
      endpoint,
      rate_key: key,
    })),
  });
}

module.exports = {
  enforceRateLimit,
};
