"use strict";

(() => {
  const transliterator = globalThis.ManglishTransliterator;
  if (!transliterator) {
    throw new Error("Manglish input plugin requires manglish.js to load first.");
  }

  window.NotepadPlugins.register({
    id: "manglish-input",
    name: "Manglish (Malayalam)",
    type: "input",
    getSuggestions: transliterator.getSuggestions,
  });
})();
