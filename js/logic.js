import { secureShuffle } from "./utils.js";
import { isQuestionLearned } from "./storage.js";

export function shuffleAndMapQuestions(questions) {
  return questions.map((q) => {
    const indices = q.options.map((_, i) => i);

    for (let i = indices.length - 1; i > 0; i--) {
      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      const j = randomBuffer[0] % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const newOptions = indices.map((i) => q.options[i]);
    const newCorrect = q.correct.map((oldIndex) => indices.indexOf(oldIndex));

    return {
      ...q,
      options: newOptions,
      correct: newCorrect,
    };
  });
}

export function selectRandomQuestions(allQuestions, count, excludeLearned, currentFilename) {
  const availableQuestions = excludeLearned
    ? allQuestions.filter((q) => !isQuestionLearned(currentFilename, q._originalIndex))
    : [...allQuestions];

  let pool = availableQuestions;
  if (pool.length === 0) {
    return { questions: [], usedFallback: false, empty: true }; 
  }

  const shuffled = secureShuffle([...pool]);
  return { 
      questions: shuffled.slice(0, Math.min(count, pool.length)), 
      usedFallback: false,
      empty: false
  };
}

export function selectQuestionsInRange(allQuestions, startIndex, endIndex) {
  return allQuestions.slice(startIndex, endIndex + 1);
}
