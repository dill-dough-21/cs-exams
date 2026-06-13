const { enforceRateLimit } = require("./_lib/rate-limit");
const { evaluateSubmission } = require("./_lib/scoring");
const { loadQuiz } = require("./_lib/quizzes");
const { normalizeId, parseBody, sanitizeNickname, sendJson } = require("./_lib/http");
const { isSupabaseConfigured, supabaseRequest } = require("./_lib/supabase");
const { verifyTurnstile } = require("./_lib/turnstile");
const { containsProfanity } = require("../js/profanity-filter");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 200, { enabled: false, saved: false });
    return;
  }

  const body = parseBody(request);
  const playerId = normalizeId(body.player_id);
  const sessionId = normalizeId(body.session_id);
  const quizId = typeof body.quiz_id === "string" ? body.quiz_id : null;
  const nickname = sanitizeNickname(body.nickname);
  const durationSeconds = Number(body.duration_seconds);

  if (containsProfanity(body.nickname)) {
    sendJson(response, 422, { error: "profane_nickname" });
    return;
  }

  if (!playerId || !sessionId || !quizId) {
    sendJson(response, 400, { error: "invalid_submission" });
    return;
  }

  try {
    const quiz = loadQuiz(quizId);
    if (!quiz) {
      sendJson(response, 400, { error: "unknown_quiz" });
      return;
    }

    await enforceRateLimit(request, "submit-score", playerId, { limit: 12, windowSeconds: 3600 });

    const turnstile = await verifyTurnstile(body.turnstile_token, request);
    if (!turnstile.ok) {
      sendJson(response, 403, { error: turnstile.error });
      return;
    }

    const sessions = await supabaseRequest("/rest/v1/quiz_sessions", {
      query: {
        select: "session_id,player_id,quiz_id,question_indices,started_at",
        session_id: `eq.${sessionId}`,
        player_id: `eq.${playerId}`,
        quiz_id: `eq.${quizId}`,
        limit: 1,
      },
    });

    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) {
      sendJson(response, 404, { error: "session_not_found" });
      return;
    }

    const startedAt = new Date(session.started_at).getTime();
    const wallDurationSeconds = Math.round((Date.now() - startedAt) / 1000);
    if (Number.isFinite(wallDurationSeconds) && durationSeconds > wallDurationSeconds + 30) {
      sendJson(response, 422, { error: "invalid_duration" });
      return;
    }

    const result = evaluateSubmission({
      quiz,
      questionIndices: session.question_indices,
      answers: body.answers,
      durationSeconds,
    });

    if (!result.ok) {
      sendJson(response, 422, { error: result.error, min_duration_seconds: result.minDurationSeconds });
      return;
    }

    const existingRows = await supabaseRequest("/rest/v1/quiz_scores", {
      query: {
        select: "id,score,duration_seconds",
        quiz_id: `eq.${quizId}`,
        player_id: `eq.${playerId}`,
        limit: 1,
      },
    });
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    const isBetter = !existing
      || result.score > existing.score
      || (result.score === existing.score && durationSeconds < existing.duration_seconds);

    if (!isBetter) {
      sendJson(response, 200, {
        enabled: true,
        saved: false,
        score: result.score,
        best_score: existing.score,
        correct_count: result.correctCount,
        total_questions: result.totalQuestions,
      });
      return;
    }

    const payload = {
      quiz_id: quizId,
      quiz_name: quiz.meta.name,
      player_id: playerId,
      nickname,
      score: result.score,
      correct_count: result.correctCount,
      total_questions: result.totalQuestions,
      duration_seconds: Math.round(durationSeconds),
      answers: result.evaluatedAnswers,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabaseRequest("/rest/v1/quiz_scores", {
        method: "PATCH",
        query: { id: `eq.${existing.id}` },
        body: payload,
      });
    } else {
      await supabaseRequest("/rest/v1/quiz_scores", {
        method: "POST",
        body: payload,
      });
    }

    sendJson(response, 200, {
      enabled: true,
      saved: true,
      score: result.score,
      correct_count: result.correctCount,
      total_questions: result.totalQuestions,
      duration_seconds: Math.round(durationSeconds),
    });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.message || "submit_failed" });
  }
};
