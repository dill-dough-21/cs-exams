const PLAYER_ID_KEY = "bazasiada-player-id";

let sitePresenceSessionId = null;
let sitePresenceIntervalId = null;

export function getPlayerId() {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;

    const playerId = createClientId();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    return playerId;
  } catch {
    return createClientId();
  }
}

export function updatePresenceCounter(count) {
  const counter = document.getElementById("presence-counter");
  const countElement = document.getElementById("presence-count");
  const labelElement = document.getElementById("presence-label");
  if (!counter || !countElement || !labelElement) return;

  if (typeof count !== "number") {
    counter.classList.add("hidden");
    return;
  }

  countElement.textContent = String(count);
  labelElement.textContent = "Aktywni teraz";
  counter.classList.remove("hidden");
}

export function hidePresenceCounter() {
  document.getElementById("presence-counter")?.classList.add("hidden");
}

export async function startSitePresence() {
  stopSitePresence();

  try {
    const response = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        player_id: getPlayerId(),
        path: window.location.pathname,
      }),
    });

    const data = await response.json();
    if (!data.enabled) {
      hidePresenceCounter();
      return;
    }

    sitePresenceSessionId = data.session_id;
    updatePresenceCounter(data.active_count);
    sitePresenceIntervalId = window.setInterval(sendSitePresenceHeartbeat, 60_000);
  } catch {
    hidePresenceCounter();
  }
}

function createClientId() {
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stopSitePresence() {
  if (sitePresenceIntervalId) {
    window.clearInterval(sitePresenceIntervalId);
    sitePresenceIntervalId = null;
  }
}

async function sendSitePresenceHeartbeat() {
  if (!sitePresenceSessionId) return;

  try {
    const response = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "heartbeat",
        player_id: getPlayerId(),
        session_id: sitePresenceSessionId,
      }),
    });

    const data = await response.json();
    if (data.enabled) updatePresenceCounter(data.active_count);
  } catch {
    hidePresenceCounter();
  }
}
