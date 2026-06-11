const crypto = require("crypto");
const { enforceRateLimit } = require("./_lib/rate-limit");
const { normalizeId, parseBody, sendJson } = require("./_lib/http");
const { isSupabaseConfigured, supabaseRequest } = require("./_lib/supabase");
const { loadQuiz, normalizeQuestionIndices } = require("./_lib/quizzes");
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
  const quizId = typeof body.quiz_id === "string" ? body.quiz_id : null;
  const mode = typeof body.mode === "string" ? body.mode.slice(0, 24) : "quiz";
  const quiz = loadQuiz(quizId);

  if (!playerId || !quiz) {
    sendJson(response, 400, { error: "invalid_quiz_or_player" });
    return;
  }

  const questionIndices = normalizeQuestionIndices(body.question_indices, quiz.questions.length);
  if (!questionIndices) {
    sendJson(response, 400, { error: "invalid_question_indices" });
    return;
  }

  try {
    await enforceRateLimit(request, "start-quiz", playerId, { limit: 40, windowSeconds: 3600 });

    const sessionId = crypto.randomUUID();
    await supabaseRequest("/rest/v1/quiz_sessions", {
      method: "POST",
      body: {
        session_id: sessionId,
        player_id: playerId,
        quiz_id: quizId,
        quiz_name: quiz.meta.name,
        mode,
        question_indices: questionIndices,
        question_count: questionIndices.length,
      },
    });

    sendJson(response, 200, {
      enabled: true,
      session_id: sessionId,
      active_count: await getActivePlayerCount(),
    });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "start_failed" });
  }
};
