import { arraysEqual, escapeHtml, scrollToTop } from "./utils.js";
import { updateQuestionProgress, isQuestionLearned } from "./storage.js";
import { shuffleAndMapQuestions, selectRandomQuestions, selectQuestionsInRange } from "./logic.js";
import { getPlayerId, startSitePresence, updatePresenceCounter } from "./presence-client.js";
import * as UI from "./ui.js";

let availableFiles = [];
let currentFile = null;
let allQuestions = [];
let currentQuestions = [];
let currentMode = null;
let isChecked = false;
let currentSessionId = null;
let quizStartedAt = null;
let quizSessionPromise = null;
let rankingBackendEnabled = null;
let heartbeatIntervalId = null;
let turnstileWidgetId = null;
let pendingScoreSubmission = false;
const PLAYER_NICK_KEY = "bazasiada-player-nick";
const PLAYER_NICK_CHOICE_KEY = "bazasiada-player-nick-choice";
const PLAYER_NICK_SKIP_SESSION_KEY = "bazasiada-player-nick-skip-session";

document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  setupEventListeners();
  initPlayerProfile();
  initTurnstileWidget();
  startSitePresence();
});

function setupEventListeners() {
  document.getElementById("checkBtn").addEventListener("click", checkAnswers);
  document.getElementById("drawNextBtn").addEventListener("click", drawNextRandomQuestions);
  document.getElementById("resetBtn").addEventListener("click", resetQuiz);
  document.getElementById("backBtn").addEventListener("click", backToMenu);
  document.getElementById("profileSettingsButton")?.addEventListener("click", () => openProfileModal(true));
  document.getElementById("profileModalClose")?.addEventListener("click", closeProfileModal);
  document.getElementById("saveNickButton")?.addEventListener("click", savePlayerNick);
  document.getElementById("anonymousNickButton")?.addEventListener("click", useAnonymousNick);
  document.getElementById("playerNick")?.addEventListener("input", clearPlayerNickError);
  document.getElementById("profileModal")?.addEventListener("click", (event) => {
    if (event.target.id === "profileModal" && localStorage.getItem(PLAYER_NICK_CHOICE_KEY)) {
      closeProfileModal();
    }
  });
  document.getElementById("mode-selector")?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const modeButton = target?.closest(".mode-btn");
    if (modeButton) selectMode(modeButton.dataset.mode);
  });
  document.getElementById("mode-selector")?.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(".input-group")) return;

    const modeButton = target.closest(".mode-btn");
    if (modeButton && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectMode(modeButton.dataset.mode);
    }
  });

  document.querySelectorAll(".mode-btn .input-group").forEach((group) => {
    group.addEventListener("click", (event) => event.stopPropagation());
  });
}

function initPlayerProfile() {
  const nickInput = document.getElementById("playerNick");
  if (!nickInput) return;

  nickInput.value = localStorage.getItem(PLAYER_NICK_KEY) || "";

  if (!localStorage.getItem(PLAYER_NICK_KEY) && !sessionStorage.getItem(PLAYER_NICK_SKIP_SESSION_KEY)) {
    openProfileModal(false);
  }
}

function openProfileModal(canClose) {
  const modal = document.getElementById("profileModal");
  const closeButton = document.getElementById("profileModalClose");
  const nickInput = document.getElementById("playerNick");
  if (!modal) return;

  if (nickInput) {
    nickInput.value = localStorage.getItem(PLAYER_NICK_KEY) || "";
  }

  modal.dataset.canClose = canClose ? "true" : "false";
  closeButton?.classList.toggle("hidden", !canClose);
  clearPlayerNickError();
  modal.classList.remove("hidden");
  window.setTimeout(() => nickInput?.focus(), 0);
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (!modal || modal.dataset.canClose !== "true") return;
  modal.classList.add("hidden");
}

function savePlayerNick() {
  const nickInput = document.getElementById("playerNick");
  const nick = nickInput?.value?.trim().slice(0, 24) || "";

  if (containsProfanity(nick)) {
    showPlayerNickError("Ten nick zawiera niedozwolone słowo. Wybierz inny nick.");
    nickInput?.focus();
    return;
  }

  if (nick) {
    localStorage.setItem(PLAYER_NICK_KEY, nick);
    localStorage.setItem(PLAYER_NICK_CHOICE_KEY, "named");
  } else {
    localStorage.removeItem(PLAYER_NICK_KEY);
    localStorage.setItem(PLAYER_NICK_CHOICE_KEY, "anonymous");
    sessionStorage.setItem(PLAYER_NICK_SKIP_SESSION_KEY, "true");
  }

  const modal = document.getElementById("profileModal");
  if (modal) modal.dataset.canClose = "true";
  modal?.classList.add("hidden");
  retryPendingScoreSubmission();
}

function useAnonymousNick() {
  localStorage.removeItem(PLAYER_NICK_KEY);
  localStorage.setItem(PLAYER_NICK_CHOICE_KEY, "anonymous");
  sessionStorage.setItem(PLAYER_NICK_SKIP_SESSION_KEY, "true");
  clearPlayerNickError();
  const nickInput = document.getElementById("playerNick");
  if (nickInput) nickInput.value = "";

  const modal = document.getElementById("profileModal");
  if (modal) modal.dataset.canClose = "true";
  modal?.classList.add("hidden");
  retryPendingScoreSubmission();
}

function getPlayerNick() {
  if (localStorage.getItem(PLAYER_NICK_CHOICE_KEY) === "anonymous") return "Student";
  const rawNick = localStorage.getItem(PLAYER_NICK_KEY) || "";
  return containsProfanity(rawNick) ? "Student" : rawNick.slice(0, 24) || "Student";
}

function containsProfanity(value) {
  return window.ProfanityFilter?.containsProfanity(value) === true;
}

function showPlayerNickError(message) {
  const errorElement = document.getElementById("playerNickError");
  if (!errorElement) return;

  errorElement.textContent = message;
  errorElement.classList.remove("hidden");
}

function clearPlayerNickError() {
  const errorElement = document.getElementById("playerNickError");
  if (!errorElement) return;

  errorElement.textContent = "";
  errorElement.classList.add("hidden");
}

function getTurnstileSiteKey() {
  return document.querySelector('meta[name="turnstile-site-key"]')?.content?.trim() || "";
}

function initTurnstileWidget() {
  const siteKey = getTurnstileSiteKey();
  const container = document.getElementById("turnstile-container");
  if (!siteKey || !container) return;

  container.classList.remove("hidden");
  let attempts = 0;
  const tryRender = () => {
    attempts++;
    if (window.turnstile && turnstileWidgetId === null) {
      turnstileWidgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "dark",
        callback: () => {
          if (pendingScoreSubmission) {
            retryPendingScoreSubmission();
          }
        },
        "expired-callback": () => {
          pendingScoreSubmission = false;
        },
      });
      return;
    }

    if (attempts < 30 && turnstileWidgetId === null) {
      window.setTimeout(tryRender, 300);
    }
  };

  tryRender();
}

function getTurnstileToken() {
  if (turnstileWidgetId === null || !window.turnstile) return null;
  return window.turnstile.getResponse(turnstileWidgetId) || null;
}

function resetTurnstile() {
  if (turnstileWidgetId !== null && window.turnstile) {
    window.turnstile.reset(turnstileWidgetId);
  }
}

function requestRankingVerification(message) {
  pendingScoreSubmission = true;
  showScoreSubmitStatus(message, "warning");
  openProfileModal(true);
}

function retryPendingScoreSubmission() {
  if (!pendingScoreSubmission) return;

  window.setTimeout(() => {
    if (!pendingScoreSubmission) return;
    submitScoreToBackend();
  }, 0);
}

function stopQuizHeartbeat() {
  if (heartbeatIntervalId) {
    window.clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

async function startQuizSession() {
  stopQuizHeartbeat();
  currentSessionId = null;
  quizSessionPromise = null;
  rankingBackendEnabled = null;
  quizStartedAt = Date.now();

  if (!currentFile || currentMode === "study" || currentQuestions.length === 0) {
    return;
  }

  quizSessionPromise = (async () => {
    const response = await fetch("/api/start-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: getPlayerId(),
        quiz_id: currentFile.file,
        mode: currentMode,
        question_indices: currentQuestions.map((question) => question._originalIndex),
      }),
    });

    const data = await response.json();
    rankingBackendEnabled = data.enabled !== false;

    if (!data.enabled) {
      return;
    }

    if (!response.ok || !data.session_id) {
      throw new Error(data.error || "start_failed");
    }

    currentSessionId = data.session_id;
    updatePresenceCounter(data.active_count);
    heartbeatIntervalId = window.setInterval(sendQuizHeartbeat, 60_000);
  })();

  try {
    await quizSessionPromise;
  } catch {
    currentSessionId = null;
  }
}

async function sendQuizHeartbeat() {
  if (!currentSessionId) return;

  try {
    const response = await fetch("/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: getPlayerId(),
        session_id: currentSessionId,
      }),
    });

    const data = await response.json();
    if (data.enabled) updatePresenceCounter(data.active_count);
  } catch {
  }
}

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
      UI.renderFileSelector(config.semesters, selectFile);
    } else {
      availableFiles = config.files;
      UI.renderFileSelector([{ title: "Dostępne Kursy", files: availableFiles }], selectFile);
    }

    document.getElementById("loading").style.display = "none";
    document.getElementById("file-selector").style.display = "block";
  } catch (error) {
    UI.showError(
      `<strong>Błąd konfiguracji!</strong><br>Sprawdź plik 'config.json'.<br><small>${escapeHtml(error.message)}</small>`,
    );
  }
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
    const rawQuestions = await response.json();
    allQuestions = rawQuestions.map((q, index) => ({ ...q, _originalIndex: index }));


    document.getElementById("loading").style.display = "none";
    document.getElementById("mode-selector").style.display = "block";
    updateGlobalProgressWithDOM();
    document
      .getElementById("mode-selector")
      .scrollIntoView({ behavior: "smooth" });

  } catch (error) {
    UI.showError(`Błąd wczytywania pliku: ${escapeHtml(error.message)}`);
  }
}

function selectMode(mode) {
  currentMode = mode;
  document.getElementById("file-selector").style.display = "none";
  document.getElementById("mode-selector").style.display = "none";
  prepareQuiz();
}

function setQuizNavigationVisible(isVisible) {
  const controls = document.getElementById("controls");
  const appBar = document.querySelector(".app-bar");
  const quizActions = document.querySelector(".quiz-actions");

  controls?.classList.toggle("hidden", !isVisible);
  controls?.removeAttribute("style");
  appBar?.classList.toggle("is-quiz-active", isVisible);
  quizActions?.classList.toggle("is-active", isVisible);
}

function prepareQuiz() {
  document.getElementById("quiz-info").style.display = "block";
  setQuizNavigationVisible(true);
  document.getElementById("drawNextBtn").style.display = "none";
  

  
  document.getElementById("checkBtn").style.display = "block";
  document.getElementById("resetBtn").style.display = "block";

  const title = document.getElementById("quiz-title");
  const description = document.getElementById("quiz-description");
  const stats = document.getElementById("quiz-stats");

  switch (currentMode) {
    case "study":
      title.textContent = `${currentFile.name} - Tryb Nauki`;
      description.textContent =
        "Wszystkie pytania z poprawnymi odpowiedziami. Użyj CTRL+F, aby szybko wyszukać.";
      currentQuestions = [...allQuestions];
      document.getElementById("checkBtn").style.display = "none";
      document.getElementById("resetBtn").style.display = "none";
      UI.renderStudyMode(currentQuestions, currentFile.file);
      break;

    case "random5":
      const countInput = document.getElementById("questionCount");
      const questionCount = parseInt(countInput.value) || 5;
      const excludeLearned = document.getElementById("excludeLearned").checked;
      
      title.textContent = `${currentFile.name} - Szybki Test`;
      description.textContent = `Wylosowano ${questionCount} pytań z pełnej bazy. Sprawdź swoją wiedzę!`;
      
      const selection = selectRandomQuestions(allQuestions, questionCount, excludeLearned, currentFile.file);
      if (selection.empty) {
           alert("Gratulacje! Wszystkie pytania w tym zestawie zostały uznane za nauczone. Losuję z pełnej puli.");
           const fallback = selectRandomQuestions(allQuestions, questionCount, false, currentFile.file);
           currentQuestions = shuffleAndMapQuestions(fallback.questions);
      } else {
           currentQuestions = shuffleAndMapQuestions(selection.questions);
      }
      
      UI.renderQuizMode(currentQuestions);
      break;

    case "range":
      const startInput = document.getElementById("rangeStart");
      const endInput = document.getElementById("rangeEnd");
      const rangeStart = Math.max(1, parseInt(startInput.value) || 1);
      const rangeEnd = Math.min(allQuestions.length, parseInt(endInput.value) || allQuestions.length);
      
      if (rangeStart > rangeEnd || rangeStart > allQuestions.length) {
        UI.showError("Błąd: Podaj prawidłowy zakres pytań!");
        setQuizNavigationVisible(false);
        document.getElementById("quiz-info").style.display = "none";
        document.getElementById("mode-selector").style.display = "block";
        return;
      }
      
      title.textContent = `${currentFile.name} - Test z Zakresu`;
      description.textContent = `Pytania od ${rangeStart} do ${rangeEnd}. Razem ${rangeEnd - rangeStart + 1} pytań. Powodzenia!`;
      const rangeQuestions = selectQuestionsInRange(allQuestions, rangeStart - 1, rangeEnd - 1);
      currentQuestions = shuffleAndMapQuestions(rangeQuestions);
      UI.renderQuizMode(currentQuestions);
      break;

    case "fullquiz":
      title.textContent = `${currentFile.name} - Pełny Egzamin`;
      description.textContent =
        "Wszystkie pytania w trybie quizu. Pokaż co potrafisz!";
      currentQuestions = shuffleAndMapQuestions([...allQuestions]);
      UI.renderQuizMode(currentQuestions);
      break;
  }
  stats.innerHTML = `<strong>Statystyki:</strong> ${currentQuestions.length} pytań | ${UI.getModeDisplayName(currentMode)}`;
  startQuizSession();
}

function checkAnswers() {
  if (isChecked) return;
  scrollToTop();
  
  const quizContent = document.getElementById('quiz-content');
  const questions = quizContent.querySelectorAll(".question");
  let correctQuestions = 0;
  let newlyLearnedCount = 0;

  questions.forEach((questionDiv, index) => {
    const question = currentQuestions[index];
    const checkboxes = questionDiv.querySelectorAll('input[type="checkbox"]');
    const selectedAnswers = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => parseInt(cb.dataset.answer));

    if (arraysEqual(selectedAnswers.sort(), question.correct.sort())) {
      correctQuestions++;
      const wasLearned = isQuestionLearned(currentFile.file, question._originalIndex);
      updateQuestionProgress(currentFile.file, question._originalIndex, true);
      const isNowLearned = isQuestionLearned(currentFile.file, question._originalIndex);
      
      if (!wasLearned && isNowLearned) {
        newlyLearnedCount++;
      }
    } else {

      updateQuestionProgress(currentFile.file, question._originalIndex, false);
    }


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

  quizContent.querySelectorAll('input[type="checkbox"]')
    .forEach((cb) => (cb.disabled = true));
  isChecked = true;
  
  processResults(correctQuestions, newlyLearnedCount);
  if (correctQuestions === currentQuestions.length && currentQuestions.length > 0) {
    launchConfetti();
  }
  submitScoreToBackend();

  document.getElementById("legend").style.display = "flex";
  
  document.getElementById("checkBtn").style.display = "none";

  if (currentMode === "random5") {
    document.getElementById("drawNextBtn").style.display = "block";
  }
}

function processResults(correctQuestions, newlyLearnedCount) {
    const totalQuestions = currentQuestions.length;
  const percentage = Math.round((correctQuestions / totalQuestions) * 100);

  let grade, gradeColor, encouragement;
  if (percentage === 100) {
    grade = "Perfekcja!";
    gradeColor = "var(--color-correct-text)";
    encouragement = "Absolutne mistrzostwo!";
  } else if (percentage >= 80) {
    grade = "Znakomity wynik!";
    gradeColor = "#4A90E2";
    encouragement = "Świetna robota!";
  } else if (percentage >= 60) {
    grade = "Dobry wynik!";
    gradeColor = "var(--color-missed-text)";
    encouragement = "Jesteś na dobrej drodze!";
  } else if (percentage >= 40) {
    grade = "Warto powtórzyć";
    gradeColor = "#F5A623";
    encouragement = "Następnym razem będzie lepiej!";
  } else {
    grade = "Czas na naukę";
    gradeColor = "var(--color-incorrect-text)";
    encouragement = "Nie poddawaj się!";
  }
  
  UI.showResults(correctQuestions, totalQuestions, percentage, grade, gradeColor, encouragement, newlyLearnedCount);
}

function getSubmissionAnswers() {
  const quizContent = document.getElementById("quiz-content");
  const questionElements = quizContent.querySelectorAll(".question");

  return currentQuestions.map((question, index) => {
    const checkboxes = questionElements[index]?.querySelectorAll('input[type="checkbox"]') || [];
    const optionMap = question._optionIndexMap || question.options.map((_, optionIndex) => optionIndex);
    const selected = Array.from(checkboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => optionMap[parseInt(checkbox.dataset.answer, 10)])
      .filter((answerIndex) => Number.isInteger(answerIndex))
      .sort((a, b) => a - b);

    return {
      question_index: question._originalIndex,
      selected,
    };
  });
}

function showScoreSubmitStatus(message, type = "info") {
  const status = document.getElementById("score-submit-status");
  if (!status) return;

  status.textContent = message;
  status.className = `score-submit-status ${type}`;
}

function getScoreSubmitErrorMessage(data) {
  switch (data?.error) {
    case "too_fast":
      return `Nie zapisano wyniku: test rozwiązany za szybko (minimum ${data.min_duration_seconds}s).`;
    case "session_not_found":
      return "Nie zapisano wyniku: sesja testu wygasła. Spróbuj uruchomić test ponownie.";
    case "invalid_submission":
    case "invalid_answer_shape":
    case "answer_count_mismatch":
    case "duplicate_answer":
    case "unknown_question":
    case "answer_index_out_of_range":
      return "Nie zapisano wyniku: odpowiedzi nie pasują do rozpoczętej sesji testu.";
    case "unknown_quiz":
      return "Nie zapisano wyniku: ten quiz nie jest dostępny w rankingu.";
    case "invalid_duration":
      return "Nie zapisano wyniku: czas testu jest nieprawidłowy.";
    default:
      return `Nie zapisano wyniku: ${data?.error || "błąd API"}`;
  }
}

async function submitScoreToBackend() {
  if (!currentFile || currentMode === "study" || !quizStartedAt) return;

  if (!currentSessionId && quizSessionPromise) {
    showScoreSubmitStatus("Przygotowywanie zapisu wyniku...", "info");
    try {
      await quizSessionPromise;
    } catch {
      currentSessionId = null;
    }
  }

  if (!currentSessionId) {
    if (rankingBackendEnabled === false) {
      showScoreSubmitStatus("Ranking nie jest skonfigurowany w tym środowisku.", "warning");
    } else {
      showScoreSubmitStatus("Nie zapisano wyniku: nie udało się utworzyć sesji rankingu. Odśwież stronę i spróbuj ponownie.", "error");
    }
    return;
  }

  const turnstileToken = getTurnstileToken();
  if (turnstileWidgetId !== null && !turnstileToken) {
    requestRankingVerification("Potwierdź weryfikację, żeby zapisać wynik w rankingu.");
    return;
  }

  pendingScoreSubmission = false;
  showScoreSubmitStatus("Zapisywanie wyniku w rankingu...", "info");

  try {
    const response = await fetch("/api/submit-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: getPlayerId(),
        nickname: getPlayerNick(),
        quiz_id: currentFile.file,
        session_id: currentSessionId,
        duration_seconds: Math.max(0, Math.round((Date.now() - quizStartedAt) / 1000)),
        answers: getSubmissionAnswers(),
        turnstile_token: turnstileToken,
      }),
    });

    const data = await response.json();
    resetTurnstile();

    if (!data.enabled) {
      showScoreSubmitStatus("Ranking nie jest skonfigurowany w tym środowisku.", "warning");
      return;
    }

    if (!response.ok) {
      if (data.error === "missing_turnstile_token" || data.error === "turnstile_failed") {
        resetTurnstile();
        requestRankingVerification("Potwierdź weryfikację, żeby zapisać wynik w rankingu.");
        return;
      }

      if (data.error === "profane_nickname") {
        showScoreSubmitStatus("Nie zapisano wyniku: nick zawiera niedozwolone słowo.", "error");
        openProfileModal(true);
        return;
      }

      showScoreSubmitStatus(getScoreSubmitErrorMessage(data), "error");
      return;
    }

    if (data.saved) {
      showScoreSubmitStatus(`Zapisano najlepszy wynik: ${data.score} pkt.`, "success");
    } else {
      showScoreSubmitStatus(`Wynik ${data.score} pkt nie przebił rekordu (${data.best_score} pkt).`, "info");
    }

  } catch {
    showScoreSubmitStatus("Nie udało się połączyć z API rankingu.", "error");
  }
}

function launchConfetti() {
  removeConfetti();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const container = document.createElement("div");
  container.className = "confetti-layer";
  container.setAttribute("aria-hidden", "true");

  const colors = ["#4ade80", "#3b82f6", "#f6ad55", "#fc8181", "#ffffff"];
  const pieces = 120;

  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 8;
    const duration = 2200 + Math.random() * 1600;

    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * (0.6 + Math.random())}px`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 350}ms`;
    piece.style.setProperty("--confetti-drift", `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty("--confetti-rotation", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--confetti-duration", `${duration}ms`);

    container.appendChild(piece);
  }

  document.body.appendChild(container);
  window.setTimeout(removeConfetti, 4500);
}

function removeConfetti() {
  document.querySelectorAll(".confetti-layer").forEach((layer) => layer.remove());
}

function clearResults() {
  const results = document.getElementById("results");
  if (results) results.innerHTML = "";
}

function drawNextRandomQuestions() {
  if (currentMode !== "random5") return;

  removeConfetti();
  clearResults();
  document.getElementById("legend").style.display = "none";
  
  document.getElementById("drawNextBtn").style.display = "none";
  document.getElementById("checkBtn").style.display = "block";
  document.getElementById("checkBtn").disabled = false;
  
  isChecked = false;

  const countInput = document.getElementById("questionCount");
  const questionCount = parseInt(countInput.value) || 5;
  const excludeLearned = document.getElementById("excludeLearned").checked;

  document.getElementById("quiz-description").textContent =
    `Oto kolejny zestaw ${questionCount} pytań. Powodzenia!`;

  const selection = selectRandomQuestions(allQuestions, questionCount, excludeLearned, currentFile.file);
  if (selection.empty) {
       alert("Gratulacje! Wszystkie pytania w tym zestawie zostały uznane za nauczone. Losuję z pełnej puli.");
       const fallback = selectRandomQuestions(allQuestions, questionCount, false, currentFile.file);
       currentQuestions = shuffleAndMapQuestions(fallback.questions);
  } else {
       currentQuestions = shuffleAndMapQuestions(selection.questions);
  }
  
  UI.renderQuizMode(currentQuestions);
  startQuizSession();
}

function resetQuiz() {
  removeConfetti();
  document.getElementById("score-submit-status")?.classList.add("hidden");
  const quizContent = document.getElementById('quiz-content');
  quizContent.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.disabled = false;
    checkbox.parentElement.classList.remove("correct", "incorrect", "missed");
  });
  
  document.getElementById("checkBtn").style.display = "block";
  document.getElementById("checkBtn").disabled = false;
  
  isChecked = false;
  clearResults();
  document.getElementById("legend").style.display = "none";
  document.getElementById("drawNextBtn").style.display = "none";
  startQuizSession();
  scrollToTop();
}

function backToMenu() {
  stopQuizHeartbeat();
  removeConfetti();
  setQuizNavigationVisible(false);
  ["quiz-info", "legend"].forEach(
    (id) => (document.getElementById(id).style.display = "none"),
  );
  ["quiz-content", "results"].forEach(
    (id) => (document.getElementById(id).innerHTML = ""),
  );
  document.getElementById("score-submit-status")?.classList.add("hidden");
  document.getElementById("file-selector").style.display = "block";
  document.getElementById("mode-selector").style.display = "none";
  if (currentFile) updateGlobalProgressWithDOM();
  currentMode = null;

  isChecked = false;
  document
    .querySelectorAll(".file-card.selected")
    .forEach((c) => c.classList.remove("selected"));
  scrollToTop();
}

function updateGlobalProgressWithDOM() {
  if (!allQuestions || allQuestions.length === 0) return;
  
  const learnedCount = allQuestions.filter(q => isQuestionLearned(currentFile.file, q._originalIndex)).length;
  const total = allQuestions.length;
  const percentage = Math.round((learnedCount / total) * 100);
  
  const bar = document.getElementById("global-progress-bar");
  const text = document.getElementById("global-progress-text");
  
  if (bar && text) {
    bar.style.width = `${percentage}%`;
    bar.setAttribute("aria-valuenow", String(percentage));
    text.textContent = `Postęp: ${learnedCount}/${total} opanowanych (${percentage}%)`;
  }
}
