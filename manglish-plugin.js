"use strict";

(() => {
  const transliterator = globalThis.ManglishTransliterator;
  if (!transliterator) {
    throw new Error("MaltoEng input plugin requires manglish.js to load first.");
  }

  window.NotepadPlugins.register({
    id: "manglish-input",
    name: "MaltoEng (Malayalam)",
    type: "input",
    getSuggestions: transliterator.getSuggestions,
  });
})();
