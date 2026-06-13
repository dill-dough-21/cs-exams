const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(projectRoot, "config.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getQuizFiles(config) {
  if (Array.isArray(config.semesters)) {
    return config.semesters.flatMap((semester) => semester.files || []);
  }

  return config.files || [];
}

function validateQuestion(question, questionIndex, quizFile) {
  const label = `${quizFile} question ${questionIndex + 1}`;

  if (!question || typeof question !== "object") {
    throw new Error(`${label}: must be an object`);
  }

  if (typeof question.question !== "string" || question.question.trim() === "") {
    throw new Error(`${label}: missing question text`);
  }

  if (!Array.isArray(question.options) || question.options.length === 0) {
    throw new Error(`${label}: options must be a non-empty array`);
  }

  question.options.forEach((option, optionIndex) => {
    if (typeof option !== "string" || option.trim() === "") {
      throw new Error(`${label}: option ${optionIndex} must be non-empty text`);
    }
  });

  if (!Array.isArray(question.correct)) {
    throw new Error(`${label}: correct must be an array`);
  }

  const uniqueCorrectAnswers = new Set(question.correct);
  if (uniqueCorrectAnswers.size !== question.correct.length) {
    throw new Error(`${label}: correct contains duplicate answer indexes`);
  }

  question.correct.forEach((answerIndex) => {
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.options.length) {
      throw new Error(`${label}: correct answer index ${answerIndex} is out of range`);
    }
  });
}

function validate() {
  const config = readJson(configPath);
  const quizFiles = getQuizFiles(config);

  if (quizFiles.length === 0) {
    throw new Error("config.json does not define any quiz files");
  }

  quizFiles.forEach((quiz) => {
    if (!quiz.name || !quiz.file) {
      throw new Error("Each quiz entry must include name and file");
    }

    const quizPath = path.resolve(projectRoot, quiz.file);
    const relativeQuizPath = path.relative(projectRoot, quizPath);
    if (relativeQuizPath.startsWith("..") || path.isAbsolute(relativeQuizPath)) {
      throw new Error(`${quiz.file}: path must stay inside the project`);
    }

    const questions = readJson(quizPath);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`${quiz.file}: must contain a non-empty question array`);
    }

    questions.forEach((question, questionIndex) => {
      validateQuestion(question, questionIndex, quiz.file);
    });
  });

  console.log(`Validated ${quizFiles.length} quiz files.`);
}

try {
  validate();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
