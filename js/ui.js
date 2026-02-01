import { scrollToTop, escapeHtml } from "./utils.js";
import { getQuestionStreak } from "./storage.js";

export const uiCallbacks = {
  onSelectFile: null,
  onSelectMode: null
};

export function renderFileSelector(semesters, onSelectFile) {
  const grid = document.getElementById("file-grid");
  grid.innerHTML = "";
  uiCallbacks.onSelectFile = onSelectFile;

  let globalIndex = 0;

  semesters.forEach((semester) => {
    const semesterHeader = document.createElement("div");
    semesterHeader.className = "semester-header";
    semesterHeader.innerHTML = `<h2>${escapeHtml(semester.title)}</h2>`;
    semesterHeader.style.width = "100%";
    semesterHeader.style.gridColumn = "1 / -1";
    semesterHeader.style.marginTop = "20px";
    semesterHeader.style.marginBottom = "10px";
    semesterHeader.style.color = "var(--color-text-primary)";
    semesterHeader.style.borderBottom = "1px solid var(--color-glass-border)";
    semesterHeader.style.paddingBottom = "10px";
    grid.appendChild(semesterHeader);

    semester.files.forEach((file) => {
      const card = document.createElement("div");
      card.className = "file-card";
      card.dataset.index = globalIndex;
      card.innerHTML = `<h3>${escapeHtml(file.name)}</h3><p>${escapeHtml(file.description)}</p>`;

      const capturedIndex = globalIndex;
      card.addEventListener("click", () => {
          if (uiCallbacks.onSelectFile) uiCallbacks.onSelectFile(capturedIndex);
      });

      grid.appendChild(card);
      globalIndex++;
    });
  });
}

export function renderStudyMode(questions, currentFilename) {
  const quizContent = document.getElementById("quiz-content");
  quizContent.innerHTML = "";

  questions.forEach((q, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "study-question";

    const optionsHtml = q.options
      .map((option, optIndex) => {
        const isCorrect = q.correct.includes(optIndex);
        
        let marker = "";
        let className = "study-answer";
        
        if (isCorrect) {
            className += " correct";
            marker = `<span style="color: var(--color-correct-text); margin-right: 12px; font-weight: bold;">✓</span>`;
        } else {
            className += " incorrect2";
            marker = `<span style="color: var(--color-text-tertiary); margin-right: 12px;">•</span>`; 
        }

        return `<div class="${className}">${marker}${escapeHtml(option)}</div>`;
      })
      .join("");

    const streak = getQuestionStreak(currentFilename, q._originalIndex);
    const progressBar = renderProgressBar(streak);

    questionDiv.innerHTML = `
            <h4><span style="display:inline-block; margin-right: 10px;">${progressBar}</span>${index + 1}. ${escapeHtml(q.question)}</h4>

            <div class="study-answers">
                ${optionsHtml}
            </div>
        `;
    quizContent.appendChild(questionDiv);
  });
  scrollToTop();
  renderLatex();
}

export function renderQuizMode(questions) {
  const quizContent = document.getElementById("quiz-content");
  quizContent.innerHTML = "";

  questions.forEach((q, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "question";

    const optionsHtml = q.options
      .map(
        (option, optIndex) => `
            <div class="option">
                <input type="checkbox" id="q${index}_${optIndex}" data-question="${index}" data-answer="${optIndex}">
                <label for="q${index}_${optIndex}">${escapeHtml(option)}</label>
            </div>
        `,
      )
      .join("");

    questionDiv.innerHTML = `
            <div class="question-number">Pytanie ${index + 1}/${questions.length}</div>
            <h3>${escapeHtml(q.question)}</h3>
            ${optionsHtml}
        `;
    quizContent.appendChild(questionDiv);
  });

  addOptionClickHandlers();
  scrollToTop();
  renderLatex();
}

function addOptionClickHandlers() {
  document.querySelectorAll(".option").forEach((option) => {
    const cb = option.querySelector('input[type="checkbox"]');
    if (!cb) return;

    cb.addEventListener("change", () => {
      if (cb.checked) option.classList.add("selected");
      else option.classList.remove("selected");
    });

    option.addEventListener("click", (e) => {
      if (e.target !== cb && e.target.tagName !== "LABEL") {
         cb.checked = !cb.checked;
         cb.dispatchEvent(new Event("change"));
      }
    });
  });
}

export function renderProgressBar(streak) {
  const maxStreak = 3;
  const effectiveStreak = Math.min(streak, maxStreak);
  
  let html = '';
  for (let i = 0; i < maxStreak; i++) {
    if (i < effectiveStreak) {
      html += '<span style="color: var(--color-correct-text); font-size: 1.2em; line-height: 1;">•</span>';
    } else {
      html += '<span style="color: var(--color-element-bg); font-size: 1.2em; line-height: 1;">•</span>';
    }
  }
  
  if (streak >= 3) {
      html += ' <span style="font-size: 0.8em; color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">[Nauczone]</span>';
  }
  
  return html;
}

export function showResults(correctQuestions, totalQuestions, percentage, grade, gradeColor, encouragement, newlyLearnedCount) {
  let masteryMsg = "";
  if (newlyLearnedCount > 0) {
    masteryMsg = `<p style="margin-top: 15px; color: var(--color-primary);">+${newlyLearnedCount} nowych pytań opanowanych!</p>`;
  }

  document.getElementById("results").innerHTML = `
        <div class="score">
            <h2 style="color: ${gradeColor}; font-size: 2rem;">${grade}</h2>
            <p style="font-size: 2.5rem; margin: 10px 0;"><strong>${correctQuestions}/${totalQuestions} (${percentage}%)</strong></p>
            <p>${encouragement}</p>
            ${masteryMsg}
        </div>`;
  
  document
    .getElementById("results")
    .scrollIntoView({ behavior: "smooth", block: "center" });
}

export function renderLatex() {
  if (typeof renderMathInElement === "function") {
    renderMathInElement(document.getElementById("quiz-content"), {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
    });
  }
}

export function showError(message) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("error-container").innerHTML =
    `<div class="error-message">${message}</div>`;
}

export function getModeDisplayName(mode) {
  switch (mode) {
    case "study":
      return "Tryb Nauki";
    case "random5":
      return "Szybki Test";
    case "range":
      return "Test z Zakresu";
    case "fullquiz":
      return "Pełny Egzamin";
    default:
      return "Quiz";
  }
}
