const { clampLimit, sendJson } = require("./_lib/http");
const { isSupabaseConfigured, supabaseRequest } = require("./_lib/supabase");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 200, { enabled: false, entries: [] });
    return;
  }

  try {
    const rows = await supabaseRequest("/rest/v1/overall_rankings", {
      query: {
        select: "nickname,total_score,quizzes_count,last_updated",
        order: "total_score.desc,quizzes_count.desc,last_updated.asc",
        limit: clampLimit(request.query?.limit, 10, 50),
      },
    });

    sendJson(response, 200, { enabled: true, entries: rows || [] });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "overall_ranking_failed" });
  }
};
