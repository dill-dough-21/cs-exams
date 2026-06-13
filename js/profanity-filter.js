(function initProfanityFilter(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ProfanityFilter = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function profanityFilterFactory() {
  const DIACRITIC_MAP = {
    "ą": "a",
    "ć": "c",
    "ę": "e",
    "ł": "l",
    "ń": "n",
    "ó": "o",
    "ś": "s",
    "ź": "z",
    "ż": "z",
  };

  const LEET_MAP = {
    "0": "o",
    "1": "i",
    "!": "i",
    "|": "i",
    "3": "e",
    "4": "a",
    "@": "a",
    "5": "s",
    "$": "s",
    "7": "t",
    "+": "t",
    "8": "b",
  };

  const CONTAINS_TERMS = [
    "asshole",
    "bitch",
    "chuj",
    "cip",
    "cock",
    "cunt",
    "dziwka",
    "faggot",
    "fuck",
    "jebac",
    "jebal",
    "jeban",
    "jebi",
    "kurw",
    "motherfuck",
    "nigga",
    "nigger",
    "pedal",
    "pierdol",
    "pizd",
    "pussy",
    "skurw",
    "sperma",
    "suka",
    "szmata",
    "whore",
  ];

  const EXACT_TERMS = new Set([
    "bastard",
    "cipa",
    "dupa",
    "huj",
    "kutas",
    "slut",
    "sranie",
    "sra",
    "shit",
    "wanker",
  ]);

  function normalizeForProfanity(value) {
    if (typeof value !== "string") return { compact: "", tokens: [] };

    const normalized = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[ąćęłńóśźż]/g, (character) => DIACRITIC_MAP[character] || character)
      .replace(/[01!|34@5$7+8]/g, (character) => LEET_MAP[character] || character);

    const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
    return {
      compact: tokens.join(""),
      tokens,
    };
  }

  function containsProfanity(value) {
    const { compact, tokens } = normalizeForProfanity(value);
    if (!compact) return false;

    if (tokens.some((token) => EXACT_TERMS.has(token))) return true;
    return CONTAINS_TERMS.some((term) => compact.includes(term));
  }

  return {
    containsProfanity,
    normalizeForProfanity,
  };
}));
