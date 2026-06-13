const { supabaseRequest } = require("./supabase");

async function getActivePlayerCount() {
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const rows = await supabaseRequest("/rest/v1/presence_sessions", {
    query: {
      select: "player_id",
      last_seen: `gte.${cutoff}`,
      limit: 5000,
    },
  });

  if (!Array.isArray(rows)) return 0;
  return new Set(rows.map((row) => row.player_id).filter(Boolean)).size;
}

module.exports = {
  getActivePlayerCount,
};
