function normalizeSelectedAnswers(selected) {
  if (!Array.isArray(selected)) return null;
  const values = selected.map((index) => Number.parseInt(index, 10));
  if (!values.every((index) => Number.isInteger(index) && index >= 0)) return null;
  return [...new Set(values)].sort((a, b) => a - b);
}

function sameAnswers(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function calculateScore(correctCount, totalQuestions, durationSeconds) {
  const baseScore = correctCount * 100;
  const accuracy = correctCount / totalQuestions;
  const targetSeconds = Math.max(60, totalQuestions * 20);
  const speedRatio = Math.max(0, Math.min(1, (targetSeconds - durationSeconds) / targetSeconds));
  const speedBonus = accuracy >= 0.6 ? Math.round(baseScore * 0.2 * speedRatio) : 0;
  const perfectBonus = correctCount === totalQuestions ? totalQuestions * 10 : 0;

  return baseScore + speedBonus + perfectBonus;
}

function getMinimumDurationSeconds(totalQuestions) {
  return Math.max(3, totalQuestions);
}

function evaluateSubmission({ quiz, questionIndices, answers, durationSeconds }) {
  if (!Array.isArray(answers)) {
    return { ok: false, error: "answers_must_be_array" };
  }

  const totalQuestions = questionIndices.length;
  const minDurationSeconds = getMinimumDurationSeconds(totalQuestions);
  if (!Number.isFinite(durationSeconds) || durationSeconds < minDurationSeconds) {
    return { ok: false, error: "too_fast", minDurationSeconds };
  }

  const answerMap = new Map();
  for (const answer of answers) {
    const questionIndex = Number.parseInt(answer.question_index, 10);
    const selected = normalizeSelectedAnswers(answer.selected);

    if (!Number.isInteger(questionIndex) || !selected) {
      return { ok: false, error: "invalid_answer_shape" };
    }

    if (answerMap.has(questionIndex)) {
      return { ok: false, error: "duplicate_answer" };
    }

    answerMap.set(questionIndex, selected);
  }

  if (answerMap.size !== totalQuestions) {
    return { ok: false, error: "answer_count_mismatch" };
  }

  let correctCount = 0;
  const evaluatedAnswers = [];

  for (const questionIndex of questionIndices) {
    const question = quiz.questions[questionIndex];
    const selected = answerMap.get(questionIndex);

    if (!question || !selected) {
      return { ok: false, error: "unknown_question" };
    }

    if (selected.some((index) => index >= question.options.length)) {
      return { ok: false, error: "answer_index_out_of_range" };
    }

    const correct = [...question.correct].sort((a, b) => a - b);
    const isCorrect = sameAnswers(selected, correct);
    if (isCorrect) correctCount++;

    evaluatedAnswers.push({
      question_index: questionIndex,
      selected,
      is_correct: isCorrect,
    });
  }

  if (correctCount > totalQuestions) {
    return { ok: false, error: "correct_count_overflow" };
  }

  const score = calculateScore(correctCount, totalQuestions, durationSeconds);
  const maxScore = totalQuestions * 130;
  if (score > maxScore) {
    return { ok: false, error: "score_overflow" };
  }

  return {
    ok: true,
    correctCount,
    totalQuestions,
    score,
    maxScore,
    evaluatedAnswers,
  };
}

module.exports = {
  calculateScore,
  evaluateSubmission,
  getMinimumDurationSeconds,
};
