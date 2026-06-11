const { clampLimit, sendJson } = require("./_lib/http");
const { getQuizMeta } = require("./_lib/quizzes");
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

  const quizId = request.query?.quiz_id;
  const limit = clampLimit(request.query?.limit, 10, 50);
  if (!getQuizMeta(quizId)) {
    sendJson(response, 400, { error: "unknown_quiz" });
    return;
  }

  try {
    const rows = await supabaseRequest("/rest/v1/quiz_scores", {
      query: {
        select: "nickname,score,correct_count,total_questions,duration_seconds,updated_at",
        quiz_id: `eq.${quizId}`,
        order: "score.desc,duration_seconds.asc,updated_at.asc",
        limit,
      },
    });

    sendJson(response, 200, { enabled: true, entries: rows || [] });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "leaderboard_failed" });
  }
};
