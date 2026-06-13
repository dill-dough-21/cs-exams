import { escapeHtml } from "./utils.js";
import { startSitePresence } from "./presence-client.js";

let availableRankings = [];

document.addEventListener("DOMContentLoaded", () => {
  initRankingPage();
  startSitePresence();
});

async function initRankingPage() {
  const selector = document.getElementById("rankingSelector");
  selector?.addEventListener("change", () => loadSelectedRanking());

  await loadRankingOptions();
  await loadSelectedRanking();
}

async function loadRankingOptions() {
  const selector = document.getElementById("rankingSelector");
  if (!selector) return;

  try {
    const response = await fetch("config.json");
    if (!response.ok) throw new Error("config_failed");

    const config = await response.json();
    const files = config.semesters
      ? config.semesters.flatMap((semester) => semester.files || [])
      : config.files || [];

    availableRankings = files.map((file) => ({
      name: file.name,
      file: file.file,
    })).filter((file) => file.name && file.file);

    selector.innerHTML = `
      <option value="overall">Ranking ogólny</option>
      ${availableRankings.map((file) => `
        <option value="${escapeHtml(file.file)}">${escapeHtml(file.name)}</option>
      `).join("")}
    `;
  } catch {
    availableRankings = [];
  }
}

async function loadSelectedRanking() {
  const selector = document.getElementById("rankingSelector");
  const selectedValue = selector?.value || "overall";

  if (selectedValue === "overall") {
    await loadOverallLeaderboard();
    return;
  }

  const ranking = availableRankings.find((file) => file.file === selectedValue);
  await loadQuizLeaderboard(selectedValue, ranking?.name || "Ranking testu");
}

async function loadOverallLeaderboard() {
  const leaderboard = document.getElementById("ranking-leaderboard");
  if (!leaderboard) return;

  try {
    setRankingHeading("Ranking", "Najlepsze wyniki ogółem");
    leaderboard.innerHTML = `<p class="leaderboard-empty">Ładowanie rankingu...</p>`;
    const response = await fetch("/api/overall-ranking?limit=50");
    const data = await response.json();

    if (!data.enabled) {
      leaderboard.innerHTML = `<p class="leaderboard-empty">Ranking nie jest skonfigurowany w tym środowisku.</p>`;
      return;
    }

    renderOverallLeaderboard(data.entries || []);
  } catch {
    leaderboard.innerHTML = `<p class="leaderboard-empty">Nie udało się pobrać rankingu.</p>`;
  }
}

async function loadQuizLeaderboard(quizId, quizName) {
  const leaderboard = document.getElementById("ranking-leaderboard");
  if (!leaderboard) return;

  try {
    setRankingHeading("Test", quizName);
    leaderboard.innerHTML = `<p class="leaderboard-empty">Ładowanie rankingu...</p>`;
    const response = await fetch(`/api/leaderboard?quiz_id=${encodeURIComponent(quizId)}&limit=50`);
    const data = await response.json();

    if (!data.enabled) {
      leaderboard.innerHTML = `<p class="leaderboard-empty">Ranking nie jest skonfigurowany w tym środowisku.</p>`;
      return;
    }

    renderQuizLeaderboard(data.entries || []);
  } catch {
    leaderboard.innerHTML = `<p class="leaderboard-empty">Nie udało się pobrać rankingu.</p>`;
  }
}

function setRankingHeading(kicker, title) {
  const kickerElement = document.getElementById("ranking-kicker");
  const titleElement = document.getElementById("ranking-title");
  if (kickerElement) kickerElement.textContent = kicker;
  if (titleElement) titleElement.textContent = title;
}

function renderOverallLeaderboard(entries) {
  const element = document.getElementById("ranking-leaderboard");
  if (!element) return;

  if (!entries.length) {
    element.innerHTML = `<p class="leaderboard-empty">Brak wyników.</p>`;
    return;
  }

  element.innerHTML = `
    <ol class="leaderboard-list leaderboard-list-large">
      ${entries.map((entry) => `
        <li>
          <span class="leaderboard-name">${escapeHtml(entry.nickname || "Student")}</span>
          <span class="leaderboard-meta">${escapeHtml(`${entry.quizzes_count} quizów`)}</span>
          <strong>${entry.total_score} pkt</strong>
        </li>
      `).join("")}
    </ol>`;
}

function renderQuizLeaderboard(entries) {
  const element = document.getElementById("ranking-leaderboard");
  if (!element) return;

  if (!entries.length) {
    element.innerHTML = `<p class="leaderboard-empty">Brak wyników.</p>`;
    return;
  }

  element.innerHTML = `
    <ol class="leaderboard-list leaderboard-list-large">
      ${entries.map((entry) => `
        <li>
          <span class="leaderboard-name">${escapeHtml(entry.nickname || "Student")}</span>
          <span class="leaderboard-meta">${escapeHtml(`${entry.correct_count}/${entry.total_questions}, ${entry.duration_seconds}s`)}</span>
          <strong>${entry.score} pkt</strong>
        </li>
      `).join("")}
    </ol>`;
}
