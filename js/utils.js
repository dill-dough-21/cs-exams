export const secureShuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

export function escapeHtml(text) {
  if (!text) return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
