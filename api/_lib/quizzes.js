const fs = require("fs");
const path = require("path");

let cachedQuizFiles = null;
const projectRoot = path.resolve(__dirname, "../..");

function loadQuizFiles() {
  if (cachedQuizFiles) return cachedQuizFiles;

  const configPath = path.join(projectRoot, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const files = [];

  if (Array.isArray(config.semesters)) {
    config.semesters.forEach((semester) => {
      (semester.files || []).forEach((file) => files.push(file));
    });
  } else {
    files.push(...(config.files || []));
  }

  cachedQuizFiles = files;
  return files;
}

function getQuizMeta(quizId) {
  if (typeof quizId !== "string") return null;
  return loadQuizFiles().find((file) => file.file === quizId) || null;
}

function loadQuiz(quizId) {
  const meta = getQuizMeta(quizId);
  if (!meta) return null;

  const quizPath = path.join(projectRoot, meta.file);
  const relativePath = path.relative(projectRoot, quizPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;

  const questions = JSON.parse(fs.readFileSync(quizPath, "utf8"));
  return {
    meta,
    questions,
  };
}

function normalizeQuestionIndices(questionIndices, questionCount) {
  if (!Array.isArray(questionIndices)) return null;
  if (questionIndices.length < 1 || questionIndices.length > questionCount) return null;

  const indices = questionIndices.map((index) => Number.parseInt(index, 10));
  const unique = new Set(indices);
  const valid = indices.every((index) => Number.isInteger(index) && index >= 0 && index < questionCount);

  return valid && unique.size === indices.length ? indices : null;
}

module.exports = {
  getQuizMeta,
  loadQuiz,
  normalizeQuestionIndices,
};
