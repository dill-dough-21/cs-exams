let availableFiles = [],
  currentFile = null;
let allQuestions = [],
  currentQuestions = [];
let currentMode = null,
  isChecked = false;

async function loadConfig() {
  try {
    const response = await fetch("config.json");
    if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
    const config = await response.json();

    if (config.semesters) {
      availableFiles = [];
      config.semesters.forEach((semester) => {
        availableFiles.push(...semester.files);
      });
      renderFileSelector(config.semesters);
    } else {
      availableFiles = config.files;
      renderFileSelector([{ title: "Dostępne Kursy", files: availableFiles }]);
    }

    document.getElementById("loading").style.display = "none";
    document.getElementById("file-selector").style.display = "block";
  } catch (error) {
    showError(
      `<strong>Błąd konfiguracji!</strong><br>Sprawdź plik 'config.json'.<br><small>${error.message}</small>`,
    );
  }
}

function renderFileSelector(semesters) {
  const grid = document.getElementById("file-grid");
  grid.innerHTML = "";

  let globalIndex = 0;

  semesters.forEach((semester) => {
    const semesterHeader = document.createElement("div");
    semesterHeader.className = "semester-header";
    semesterHeader.innerHTML = `<h2>${semester.title}</h2>`;
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
      card.innerHTML = `<h3>${file.name}</h3><p>${file.description}</p>`;

      const capturedIndex = globalIndex;
      card.addEventListener("click", () => selectFile(capturedIndex));

      grid.appendChild(card);
      globalIndex++;
    });
  });
}

async function selectFile(index) {
  document
    .querySelectorAll(".file-card")
    .forEach((card) => card.classList.remove("selected"));
  const selectedCard = document.querySelector(`[data-index="${index}"]`);
  if (selectedCard) selectedCard.classList.add("selected");

  currentFile = availableFiles[index];
  try {
    document.getElementById("loading").style.display = "block";
    const response = await fetch(currentFile.file);
    if (!response.ok)
      throw new Error(`Nie można wczytać pliku: ${currentFile.file}`);
    allQuestions = await response.json();
    document.getElementById("loading").style.display = "none";
    document.getElementById("mode-selector").style.display = "block";

    document
      .getElementById("mode-selector")
      .scrollIntoView({ behavior: "smooth" });

    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.onclick = () => selectMode(btn.dataset.mode);
    });
  } catch (error) {
    showError(`Błąd wczytywania pliku: ${error.message}`);
  }
}

function selectMode(mode) {
  currentMode = mode;
  document.getElementById("file-selector").style.display = "none";
  document.getElementById("mode-selector").style.display = "none";
  prepareQuiz();
}

function prepareQuiz() {
  document.getElementById("quiz-info").style.display = "block";
  document.getElementById("controls").style.display = "block";
  document.getElementById("drawNextBtn").style.display = "none";

  const title = document.getElementById("quiz-title");
  const description = document.getElementById("quiz-description");
  const stats = document.getElementById("quiz-stats");

  document.getElementById("checkBtn").style.display = "inline-block";
  document.getElementById("resetBtn").style.display = "inline-block";

  switch (currentMode) {
    case "study":
      title.textContent = `💡 ${currentFile.name} - Tryb Nauki`;
      description.textContent =
        "Wszystkie pytania z poprawnymi odpowiedziami. Użyj CTRL+F, aby szybko wyszukać.";
      currentQuestions = [...allQuestions];
      document.getElementById("checkBtn").style.display = "none";
      document.getElementById("resetBtn").style.display = "none";
      renderStudyMode();
      break;

    case "random5":
      const countInput = document.getElementById("questionCount");
      const questionCount = parseInt(countInput.value) || 5;
      title.textContent = `🎲 ${currentFile.name} - Szybki Test`;
      description.textContent = `Wylosowano ${questionCount} pytań z pełnej bazy. Sprawdź swoją wiedzę!`;
      selectRandomQuestions(questionCount);
      currentQuestions = shuffleAndMapQuestions(currentQuestions);
      renderQuizMode();
      break;

    case "fullquiz":
      title.textContent = `📝 ${currentFile.name} - Pełny Egzamin`;
      description.textContent =
        "Wszystkie pytania w trybie quizu. Pokaż co potrafisz!";
      currentQuestions = shuffleAndMapQuestions([...allQuestions]);
      renderQuizMode();
      break;
  }
  stats.innerHTML = `<strong>📊 Statystyki:</strong> ${currentQuestions.length} pytań | ${getModeDisplayName(currentMode)}`;
}

function renderStudyMode() {
  const quizContent = document.getElementById("quiz-content");
  quizContent.innerHTML = "";

  currentQuestions.forEach((q, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "study-question";

    const optionsHtml = q.options
      .map((option, optIndex) => {
        const isCorrect = q.correct.includes(optIndex);
        const marker = isCorrect ? "✅" : "—";
        const className = isCorrect ? "correct" : "incorrect2";

        return `<div class="study-answer ${className}">${marker} ${option}</div>`;
      })
      .join("");

    questionDiv.innerHTML = `
            <h4>${index + 1}. ${q.question}</h4>
            <div class="study-answers">
                ${optionsHtml}
            </div>
        `;
    quizContent.appendChild(questionDiv);
  });
  scrollToTop();
  renderLatex();
}

function renderQuizMode() {
  const quizContent = document.getElementById("quiz-content");
  quizContent.innerHTML = "";

  currentQuestions.forEach((q, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.className = "question";

    const optionsHtml = q.options
      .map(
        (option, optIndex) => `
            <div class="option">
                <input type="checkbox" id="q${index}_${optIndex}" data-question="${index}" data-answer="${optIndex}">
                <label for="q${index}_${optIndex}">${option}</label>
            </div>
        `,
      )
      .join("");

    questionDiv.innerHTML = `
            <div class="question-number">Pytanie ${index + 1}/${currentQuestions.length}</div>
            <h3>${q.question}</h3>
            ${optionsHtml}
        `;
    quizContent.appendChild(questionDiv);
  });

  addOptionClickHandlers();
  scrollToTop();
  renderLatex();
}

function checkAnswers() {
  if (currentQuestions.length === 0 || currentMode === "study") return;

  let correctQuestions = 0;

  currentQuestions.forEach((question, qIndex) => {
    const checkboxes = document.querySelectorAll(
      `input[data-question="${qIndex}"]`,
    );
    const selectedAnswers = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => parseInt(cb.dataset.answer));

    if (arraysEqual(selectedAnswers.sort(), question.correct.sort()))
      correctQuestions++;

    checkboxes.forEach((checkbox) => {
      const answerIndex = parseInt(checkbox.dataset.answer);
      const option = checkbox.parentElement;
      option.classList.remove("correct", "incorrect", "missed");

      if (question.correct.includes(answerIndex)) {
        option.classList.add(checkbox.checked ? "correct" : "missed");
      } else if (checkbox.checked) {
        option.classList.add("incorrect");
      }
    });
  });

  document
    .querySelectorAll('input[type="checkbox"]')
    .forEach((cb) => (cb.disabled = true));
  isChecked = true;
  showResults(correctQuestions);
  document.getElementById("legend").style.display = "block";

  if (currentMode === "random5") {
    document.getElementById("drawNextBtn").style.display = "inline-block";
  }
}

function showResults(correctQuestions) {
  const totalQuestions = currentQuestions.length;
  const percentage = Math.round((correctQuestions / totalQuestions) * 100);

  let grade, gradeColor, encouragement;
  if (percentage === 100) {
    grade = "🏆 Perfekcja!";
    gradeColor = "var(--color-correct)";
    encouragement = "Absolutne mistrzostwo! 🎉";
  } else if (percentage >= 80) {
    grade = "🎉 Znakomity wynik!";
    gradeColor = "#4A90E2";
    encouragement = "Świetna robota! 💪";
  } else if (percentage >= 60) {
    grade = "👍 Dobry wynik!";
    gradeColor = "var(--color-missed)";
    encouragement = "Jesteś na dobrej drodze! 📈";
  } else if (percentage >= 40) {
    grade = "📈 Warto powtórzyć";
    gradeColor = "#F5A623";
    encouragement = "Następnym razem będzie lepiej! 🔄";
  } else {
    grade = "📚 Czas na naukę";
    gradeColor = "var(--color-incorrect)";
    encouragement = "Nie poddawaj się! 🚀";
  }

  document.getElementById("results").innerHTML = `
        <div class="score">
            <h2 style="color: ${gradeColor}; font-size: 2rem;">${grade}</h2>
            <p style="font-size: 2.5rem; margin: 10px 0;"><strong>${correctQuestions}/${totalQuestions} (${percentage}%)</strong></p>
            <p>${encouragement}</p>
        </div>`;
  document
    .getElementById("results")
    .scrollIntoView({ behavior: "smooth", block: "center" });
}

function drawNextRandomQuestions() {
  if (currentMode !== "random5") return;

  document.getElementById("results").innerHTML = "";
  document.getElementById("legend").style.display = "none";
  document.getElementById("drawNextBtn").style.display = "none";
  document.getElementById("checkBtn").disabled = false;
  isChecked = false;

  const countInput = document.getElementById("questionCount");
  const questionCount = parseInt(countInput.value) || 5;

  document.getElementById("quiz-description").textContent =
    `Oto kolejny zestaw ${questionCount} pytań. Powodzenia!`;

  selectRandomQuestions(questionCount);
  currentQuestions = shuffleAndMapQuestions(currentQuestions);
  renderQuizMode();
}

function resetQuiz() {
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.disabled = false;
    checkbox.parentElement.classList.remove("correct", "incorrect", "missed");
  });
  document.getElementById("checkBtn").disabled = false;
  isChecked = false;
  document.getElementById("results").innerHTML = "";
  document.getElementById("legend").style.display = "none";
  document.getElementById("drawNextBtn").style.display = "none";
  scrollToTop();
}

function backToMenu() {
  ["quiz-info", "controls", "legend"].forEach(
    (id) => (document.getElementById(id).style.display = "none"),
  );
  ["quiz-content", "results"].forEach(
    (id) => (document.getElementById(id).innerHTML = ""),
  );
  ["file-selector"].forEach(
    (id) => (document.getElementById(id).style.display = "block"),
  );
  document.getElementById("mode-selector").style.display = "none";
  currentMode = null;
  isChecked = false;
  document
    .querySelectorAll(".file-card.selected")
    .forEach((c) => c.classList.remove("selected"));
  scrollToTop();
}

function selectRandomQuestions(count) {
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  currentQuestions = shuffled.slice(0, Math.min(count, allQuestions.length));
}

function addOptionClickHandlers() {
  document.querySelectorAll(".option").forEach((option) => {
    option.addEventListener("click", (e) => {
      if (e.target.type !== "checkbox") {
        const cb = option.querySelector('input[type="checkbox"]');
        if (cb && !cb.disabled) cb.checked = !cb.checked;
      }
    });
  });
}

function getModeDisplayName(mode) {
  const names = {
    study: "Tryb Nauki",
    random5: "Szybki Test",
    fullquiz: "Pełny Egzamin",
  };
  return names[mode] || mode;
}

function showError(message) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("error-container").innerHTML =
    `<div class="error-message">${message}</div>`;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}
function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

function shuffleAndMapQuestions(questions) {
  return questions.map((q) => {
    const indices = q.options.map((_, i) => i);

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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

function renderLatex() {
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

document.addEventListener("DOMContentLoaded", loadConfig);
