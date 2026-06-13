import { secureShuffle } from "./utils.js";
import { isQuestionLearned } from "./storage.js";

export function shuffleAndMapQuestions(questions) {
  return questions.map((q) => {
    const indices = secureShuffle(q.options.map((_, i) => i));

    const newOptions = indices.map((i) => q.options[i]);
    const newCorrect = q.correct.map((oldIndex) => indices.indexOf(oldIndex));

    return {
      ...q,
      options: newOptions,
      correct: newCorrect,
      _optionIndexMap: indices,
    };
  });
}

export function selectRandomQuestions(allQuestions, count, excludeLearned, currentFilename) {
  const availableQuestions = excludeLearned
    ? allQuestions.filter((q) => !isQuestionLearned(currentFilename, q._originalIndex))
    : [...allQuestions];

  if (availableQuestions.length === 0) {
    return { questions: [], empty: true };
  }

  const shuffled = secureShuffle([...availableQuestions]);
  return {
      questions: shuffled.slice(0, Math.min(count, availableQuestions.length)),
      empty: false
  };
}

export function selectQuestionsInRange(allQuestions, startIndex, endIndex) {
  return allQuestions.slice(startIndex, endIndex + 1);
}
