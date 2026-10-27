"use strict";

const STORAGE_KEY = "simple-notepad.notes.v1";

const tabbar = document.querySelector("#tabbar");
const editor = document.querySelector("#editor");
const titleInput = document.querySelector("#note-title");
const fileInput = document.querySelector("#file-input");
const lineNumbers = document.querySelector("#line-numbers");
const saveIndicator = document.querySelector("#save-indicator");
const saveMessage = document.querySelector("#save-message");
const statusMessage = document.querySelector("#status-message");
const lineCount = document.querySelector("#line-count");
const characterCount = document.querySelector("#character-count");
const toast = document.querySelector("#toast");
const workspace = document.querySelector(".workspace");
const findButton = document.querySelector("#find-button");
const findPanel = document.querySelector("#find-panel");
const findInput = document.querySelector("#find-input");
const replaceInput = document.querySelector("#replace-input");
const findCount = document.querySelector("#find-count");
const findPreviousButton = document.querySelector("#find-previous-button");
const findNextButton = document.querySelector("#find-next-button");
const replaceButton = document.querySelector("#replace-button");
const replaceAllButton = document.querySelector("#replace-all-button");
const findCaseSensitive = document.querySelector("#find-case-sensitive");
const compareControls = document.querySelector("#compare-controls");
const compareSelectedButton = document.querySelector("#compare-selected-button");
const compareHint = document.querySelector("#compare-hint");
const compareView = document.querySelector("#compare-view");
const wrapButton = document.querySelector("#wrap-button");
const manglishButton = document.querySelector("#manglish-button");
const manglishSuggestions = document.querySelector("#manglish-suggestions");
const pluginsButton = document.querySelector("#plugins-button");
const pluginMenu = document.querySelector("#plugin-menu");
const inputPluginList = document.querySelector("#input-plugin-list");
const inputPluginEmpty = document.querySelector("#input-plugin-empty");
const formatterPluginList = document.querySelector("#formatter-plugin-list");
const formatterPluginEmpty = document.querySelector("#formatter-plugin-empty");
const pluginHelpButton = document.querySelector("#plugin-help-button");
const pluginGuideDialog = document.querySelector("#plugin-guide-dialog");
const pluginGuideCloseButton = document.querySelector("#plugin-guide-close");
const minimumFontSize = 10;
const maximumFontSize = 32;
const defaultFontSize = 13;

let notes = loadNotes();
let activeNoteId = notes[0].id;
let selectingForComparison = false;
let selectedNoteIds = [];
let wrapText = loadWrapPreference();
let editorFontSize = loadFontSize();
let activeInputPlugin = null;
let pendingManglishDelimiter = "";
let activeSuggestions = [];
let activeSuggestionRange = null;
let selectedSuggestionIndex = 0;
let lastManglishConversion = null;
const plugins = new Map();
let saveTimer;
let toastTimer;

function findPattern(query = findInput.value) {
  if (!query) return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(escaped, findCaseSensitive.checked ? "gu" : "giu");
}

function getFindMatches() {
  const pattern = findPattern();
  return pattern ? [...editor.value.matchAll(pattern)] : [];
}

function updateFindCount(matches = getFindMatches()) {
  const selectedStart = editor.selectionStart;
  const selectedEnd = editor.selectionEnd;
  const activeIndex = matches.findIndex(
    (match) => match.index === selectedStart && match.index + match[0].length === selectedEnd,
  );
  findCount.textContent = matches.length === 0
    ? "0 matches"
    : activeIndex < 0
      ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
      : `${activeIndex + 1} of ${matches.length}`;
  replaceButton.disabled = matches.length === 0;
  replaceAllButton.disabled = matches.length === 0;
  findPreviousButton.disabled = matches.length === 0;
  findNextButton.disabled = matches.length === 0;
}

function selectFindMatch(match, keepFindFocus = false) {
  editor.setSelectionRange(match.index, match.index + match[0].length);
  if (keepFindFocus) findInput.focus();
  updateFindCount();
}

function findMatch(direction = 1, keepFindFocus = false) {
  const matches = getFindMatches();
  if (matches.length === 0) {
    updateFindCount(matches);
    return false;
  }

  const selectionStart = editor.selectionStart;
  const selectionEnd = editor.selectionEnd;
  let match;
  if (direction > 0) {
    match = matches.find((item) => item.index >= selectionEnd) ?? matches[0];
  } else {
    match = [...matches].reverse().find((item) => item.index + item[0].length <= selectionStart)
      ?? matches[matches.length - 1];
  }
  selectFindMatch(match, keepFindFocus);
  return true;
}

function openFindPanel() {
  findPanel.hidden = false;
  findButton.setAttribute("aria-pressed", "true");
  const selection = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (selection) findInput.value = selection;
  findInput.focus();
  findInput.select();
  if (findInput.value) findMatch(1, true);
  else updateFindCount([]);
}

function closeFindPanel() {
  findPanel.hidden = true;
  findButton.setAttribute("aria-pressed", "false");
  editor.focus();
}

function replaceCurrentMatch() {
  const matches = getFindMatches();
  const selectedMatch = matches.find(
    (match) => match.index === editor.selectionStart &&
      match.index + match[0].length === editor.selectionEnd,
  );
  if (!selectedMatch && !findMatch()) return;

  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.setRangeText(replaceInput.value, start, end, "select");
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  findMatch(1);
}

function replaceAllMatches() {
  const pattern = findPattern();
  if (!pattern) {
    updateFindCount([]);
    return;
  }
  const matches = [...editor.value.matchAll(pattern)];
  if (matches.length === 0) {
    updateFindCount(matches);
    return;
  }

  const replacement = editor.value.replace(pattern, () => replaceInput.value);
  editor.value = replacement;
  editor.setSelectionRange(0, 0);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  findMatch(1);
}

function loadWrapPreference() {
  if (typeof window.__nativeWrapText === "boolean") return window.__nativeWrapText;
  try {
    return localStorage.getItem("simple-notepad.wrap-text") === "true";
  } catch (error) {
    console.error("Unable to load text-wrap preference:", error);
    return false;
  }
}

function loadFontSize() {
  if (typeof window.__nativeFontSize === "number") {
    return Math.max(minimumFontSize, Math.min(maximumFontSize, window.__nativeFontSize));
  }
  try {
    const saved = Number(localStorage.getItem("simple-notepad.font-size"));
    return Number.isFinite(saved) && saved >= minimumFontSize && saved <= maximumFontSize
      ? saved
      : defaultFontSize;
  } catch (error) {
    console.error("Unable to load font-size preference:", error);
    return defaultFontSize;
  }
}

function makeNote(name = "Untitled", content = "") {
  return {
    id: crypto.randomUUID(),
    name,
    content,
  };
}

function loadNotes() {
  try {
    if (Array.isArray(window.__nativeNotes)) {
      const validNotes = window.__nativeNotes.filter(
        (note) =>
          note &&
          typeof note.id === "string" &&
          typeof note.name === "string" &&
          typeof note.content === "string",
      );
      return validNotes.length > 0 ? validNotes : [makeNote()];
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [makeNote()];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Saved notes are not in the expected format.");

    const validNotes = parsed.filter(
      (note) =>
        note &&
        typeof note.id === "string" &&
        typeof note.name === "string" &&
        typeof note.content === "string",
    );

    return validNotes.length > 0 ? validNotes : [makeNote()];
  } catch (error) {
    console.error("Unable to load saved notes:", error);
    window.setTimeout(() => showToast("Saved notes could not be loaded. Your browser storage may be unavailable."), 0);
    return [makeNote()];
  }
}

function getActiveNote() {
  return notes.find((note) => note.id === activeNoteId) ?? notes[0];
}

function persistNotes() {
  try {
    if (window.webkit?.messageHandlers?.notepad) {
      window.webkit.messageHandlers.notepad.postMessage({ action: "persist", notes });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
    saveIndicator.classList.remove("unsaved");
    saveMessage.textContent = "Saved on this device";
    statusMessage.textContent = "All changes saved locally";
  } catch (error) {
    console.error("Unable to save notes:", error);
    saveIndicator.classList.add("unsaved");
    saveMessage.textContent = "Not saved";
    statusMessage.textContent = "Could not save locally — use Save as to download a copy";
    showToast("Could not save to browser storage. Use Save as to keep a copy.");
  }
}

function scheduleSave() {
  saveIndicator.classList.add("unsaved");
  saveMessage.textContent = "Saving...";
  statusMessage.textContent = "Saving changes...";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistNotes, 180);
}

function renderTabs() {
  tabbar.replaceChildren();
  for (const note of notes) {
    const tab = document.createElement("div");
    const isSelectedForCompare = selectedNoteIds.includes(note.id);
    tab.className = `tab${note.id === activeNoteId && !selectingForComparison ? " active" : ""}${isSelectedForCompare ? " compare-selected" : ""}`;
    tab.setAttribute("role", "presentation");

    const selectButton = document.createElement("button");
    selectButton.className = "tab-select";
    selectButton.type = "button";
    selectButton.setAttribute("role", "tab");
    selectButton.setAttribute("aria-selected", String(note.id === activeNoteId));
    selectButton.setAttribute("aria-pressed", String(isSelectedForCompare));
    selectButton.title = selectingForComparison ? "Select this note for comparison" : "Double-click to rename";

    const icon = document.createElement("span");
    icon.className = "tab-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = note.name;

    selectButton.append(icon, label);
    selectButton.addEventListener("click", () => {
      if (selectingForComparison) {
        toggleCompareSelection(note.id);
      } else {
        activateNote(note.id);
      }
    });
    selectButton.addEventListener("dblclick", () => {
      if (!selectingForComparison) renameNote(note.id);
    });

    const closeButton = document.createElement("button");
    closeButton.className = "tab-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", `Close ${note.name}`);
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => closeNote(note.id));
    tab.append(selectButton, closeButton);
    tabbar.append(tab);
  }
  const addButton = document.createElement("button");
  addButton.className = "add-tab";
  addButton.id = "new-button";
  addButton.type = "button";
  addButton.setAttribute("aria-label", "New note");
  addButton.title = "New note";
  addButton.textContent = "+";
  addButton.addEventListener("click", createNote);
  tabbar.append(addButton);
}

function renderActiveNote() {
  const note = getActiveNote();
  if (!note) return;
  titleInput.value = note.name;
  editor.value = note.content;
  updateEditorDetails();
  renderTabs();
}

function activateNote(id) {
  activeNoteId = id;
  renderActiveNote();
}

function createNote() {
  const note = makeNote();
  notes.push(note);
  activeNoteId = note.id;
  renderActiveNote();
  persistNotes();
  editor.focus();
}

function closeNote(id) {
  const closingIndex = notes.findIndex((note) => note.id === id);
  if (closingIndex < 0) return;

  notes.splice(closingIndex, 1);
  selectedNoteIds = selectedNoteIds.filter((selectedId) => selectedId !== id);
  updateCompareControls();
  if (notes.length === 0) {
    const note = makeNote();
    notes.push(note);
    activeNoteId = note.id;
  } else if (activeNoteId === id) {
    activeNoteId = notes[Math.min(closingIndex, notes.length - 1)].id;
  }
  renderActiveNote();
  persistNotes();
}

function renameNote(id) {
  const note = notes.find((item) => item.id === id);
  if (!note) return;
  const name = window.prompt("Name this note:", note.name);
  if (name === null) return;
  note.name = name.trim() || "Untitled";
  if (id === activeNoteId) titleInput.value = note.name;
  renderTabs();
  persistNotes();
}

function updateEditorDetails() {
  const text = editor.value;
  const lines = text.split("\n");
  const cursor = editor.selectionStart;
  const precedingText = text.slice(0, cursor);
  const currentLine = precedingText.split("\n").length;
  const currentColumn = precedingText.length - precedingText.lastIndexOf("\n");

  lineNumbers.textContent = Array.from({ length: lines.length }, (_, index) => index + 1).join("\n");
  lineCount.textContent = `Ln ${currentLine}, Col ${currentColumn}`;
  characterCount.textContent = `${text.length} ${text.length === 1 ? "character" : "characters"}`;
}

function updateCompareControls() {
  compareControls.hidden = !selectingForComparison;
  compareHint.textContent =
    selectedNoteIds.length === 2
      ? "Two notes selected. Compare them side by side."
      : `Select ${2 - selectedNoteIds.length} more note${selectedNoteIds.length === 1 ? "" : "s"} to compare.`;
  compareSelectedButton.textContent = `Compare (${selectedNoteIds.length})`;
  compareSelectedButton.disabled = selectedNoteIds.length !== 2;
}

function beginCompareSelection() {
  if (notes.length < 2) {
    showToast("Create or open at least two notes to compare.");
    return;
  }
  selectingForComparison = true;
  selectedNoteIds = [];
  workspace.classList.remove("comparing");
  compareView.hidden = true;
  updateCompareControls();
  renderTabs();
}

function toggleCompareSelection(id) {
  if (selectedNoteIds.includes(id)) {
    selectedNoteIds = selectedNoteIds.filter((selectedId) => selectedId !== id);
  } else if (selectedNoteIds.length < 2) {
    selectedNoteIds.push(id);
  } else {
    showToast("Select only two notes to compare.");
    return;
  }
  updateCompareControls();
  renderTabs();
}

function findChangedLines(leftText, rightText) {
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const leftChanged = new Set();
  const rightChanged = new Set();
  const columns = rightLines.length + 1;
  const cells = (leftLines.length + 1) * columns;

  if (cells > 4_000_000) {
    let prefix = 0;
    while (
      prefix < leftLines.length &&
      prefix < rightLines.length &&
      leftLines[prefix] === rightLines[prefix]
    ) prefix += 1;
    let leftEnd = leftLines.length - 1;
    let rightEnd = rightLines.length - 1;
    while (
      leftEnd >= prefix &&
      rightEnd >= prefix &&
      leftLines[leftEnd] === rightLines[rightEnd]
    ) {
      leftEnd -= 1;
      rightEnd -= 1;
    }
    for (let index = prefix; index <= leftEnd; index += 1) leftChanged.add(index);
    for (let index = prefix; index <= rightEnd; index += 1) rightChanged.add(index);
    return { leftChanged, rightChanged };
  }

  const table = new Uint32Array(cells);
  for (let left = leftLines.length - 1; left >= 0; left -= 1) {
    const row = left * columns;
    const nextRow = (left + 1) * columns;
    for (let right = rightLines.length - 1; right >= 0; right -= 1) {
      table[row + right] = leftLines[left] === rightLines[right]
        ? table[nextRow + right + 1] + 1
        : Math.max(table[nextRow + right], table[row + right + 1]);
    }
  }

  let left = 0;
  let right = 0;
  while (left < leftLines.length && right < rightLines.length) {
    if (leftLines[left] === rightLines[right]) {
      left += 1;
      right += 1;
      continue;
    }

    const leftStart = left;
    const rightStart = right;
    while (
      left < leftLines.length &&
      right < rightLines.length &&
      leftLines[left] !== rightLines[right]
    ) {
      if (table[(left + 1) * columns + right] >= table[left * columns + right + 1]) {
        left += 1;
      } else {
        right += 1;
      }
    }
    for (let index = leftStart; index < left; index += 1) leftChanged.add(index);
    for (let index = rightStart; index < right; index += 1) rightChanged.add(index);
  }
  for (; left < leftLines.length; left += 1) leftChanged.add(left);
  for (; right < rightLines.length; right += 1) rightChanged.add(right);
  return { leftChanged, rightChanged };
}

function paintChangedLines(pane, changedLines, side) {
  pane.classList.toggle("diff-left", side === "left");
  pane.classList.toggle("diff-right", side === "right");
  if (changedLines.size === 0) {
    pane.style.backgroundImage = "none";
    pane.style.backgroundPosition = "";
    pane.style.backgroundSize = "";
    return;
  }

  const lineHeight = getComputedStyle(pane).lineHeight;
  const height = Number.parseFloat(lineHeight);
  pane.style.backgroundImage = [...changedLines]
    .map(() => "linear-gradient(var(--diff-line-color), var(--diff-line-color))")
    .join(", ");
  pane.style.backgroundSize = [...changedLines]
    .map(() => `100% ${height}px`)
    .join(", ");
  pane.style.backgroundPosition = [...changedLines]
    .map((line) => `0 ${line * height}px`)
    .join(", ");
  pane.style.backgroundRepeat = [...changedLines].map(() => "no-repeat").join(", ");
}

function updateComparisonDiff() {
  const leftContent = document.querySelector("#compare-content-left");
  const rightContent = document.querySelector("#compare-content-right");
  const { leftChanged, rightChanged } = findChangedLines(leftContent.value, rightContent.value);
  paintChangedLines(leftContent, leftChanged, "left");
  paintChangedLines(rightContent, rightChanged, "right");
}

function showComparison() {
  if (selectedNoteIds.length !== 2) return;
  const [left, right] = selectedNoteIds.map((id) => notes.find((note) => note.id === id));
  if (!left || !right) {
    showToast("One of the selected notes is no longer available.");
    return;
  }
  document.querySelector("#compare-title-left").textContent = left.name;
  document.querySelector("#compare-title-right").textContent = right.name;
  const leftContent = document.querySelector("#compare-content-left");
  const rightContent = document.querySelector("#compare-content-right");
  leftContent.value = left.content;
  rightContent.value = right.content;
  leftContent.setAttribute("aria-label", `Edit ${left.name}`);
  rightContent.setAttribute("aria-label", `Edit ${right.name}`);
  leftContent.dataset.noteId = left.id;
  rightContent.dataset.noteId = right.id;
  document.querySelectorAll(".compare-content").forEach((pane) => {
    pane.classList.toggle("wrap-text", wrapText);
  });
  updateComparisonDiff();
  compareView.hidden = false;
  compareControls.hidden = true;
  workspace.classList.add("comparing");
  document.querySelector("#compare-button").setAttribute("title", "Back to notes");
  document.querySelector("#compare-button").setAttribute("aria-label", "Back to notes");
}

function finishComparison() {
  selectingForComparison = false;
  selectedNoteIds = [];
  compareView.hidden = true;
  workspace.classList.remove("comparing");
  document.querySelector("#compare-button").setAttribute("title", "Compare notes");
  document.querySelector("#compare-button").setAttribute("aria-label", "Compare notes");
  updateCompareControls();
  renderActiveNote();
}

function setTextWrap(enabled, persist = true) {
  wrapText = enabled;
  editor.classList.toggle("wrap-text", wrapText);
  editor.wrap = wrapText ? "soft" : "off";
  document.querySelectorAll(".compare-content").forEach((pane) => {
    pane.classList.toggle("wrap-text", wrapText);
  });
  wrapButton.title = `Text wrap: ${wrapText ? "On" : "Off"}`;
  wrapButton.setAttribute("aria-pressed", String(wrapText));
  if (!persist) return;

  if (window.webkit?.messageHandlers?.notepad) {
    window.webkit.messageHandlers.notepad.postMessage({ action: "wrapPreference", enabled: wrapText });
    return;
  }
  try {
    localStorage.setItem("simple-notepad.wrap-text", String(wrapText));
  } catch (error) {
    console.error("Unable to save text-wrap preference:", error);
    showToast("Text-wrap preference could not be saved.");
  }
}

function setFontSize(size, persist = true) {
  editorFontSize = Math.max(minimumFontSize, Math.min(maximumFontSize, size));
  document.documentElement.style.setProperty("--editor-font-size", `${editorFontSize}px`);
  document.documentElement.style.setProperty("--editor-line-height", `${Math.round(editorFontSize * 1.85)}px`);
  document.querySelector("#decrease-font-button").disabled = editorFontSize <= minimumFontSize;
  document.querySelector("#increase-font-button").disabled = editorFontSize >= maximumFontSize;
  document.querySelector("#decrease-font-button").title = `Decrease font size (${editorFontSize}px)`;
  document.querySelector("#increase-font-button").title = `Increase font size (${editorFontSize}px)`;
  if (!persist) return;

  if (window.webkit?.messageHandlers?.notepad) {
    window.webkit.messageHandlers.notepad.postMessage({
      action: "fontSizePreference",
      fontSize: editorFontSize,
    });
    return;
  }
  try {
    localStorage.setItem("simple-notepad.font-size", String(editorFontSize));
  } catch (error) {
    console.error("Unable to save font-size preference:", error);
    showToast("Font-size preference could not be saved.");
  }
}

function registerPlugin(plugin) {
  const isFormatter = typeof plugin?.format === "function" && plugin.type !== "input";
  const isInputPlugin =
    plugin?.type === "input" &&
    typeof plugin.getSuggestions === "function";
  if (!plugin || typeof plugin.id !== "string" || typeof plugin.name !== "string" || (!isFormatter && !isInputPlugin)) {
    throw new TypeError("A plugin must provide an id, name, and either a format function or an input getSuggestions function.");
  }
  if (plugins.has(plugin.id)) {
    throw new Error(`A plugin with id "${plugin.id}" is already registered.`);
  }
  plugins.set(plugin.id, plugin);

  const button = document.createElement("button");
  button.className = `plugin-menu-item${isInputPlugin ? " input-plugin-item" : ""}`;
  button.type = "button";
  button.setAttribute("role", "menuitem");
  button.textContent = plugin.name;
  button.dataset.pluginId = plugin.id;
  button.addEventListener("click", () => {
    pluginMenu.hidden = true;
    pluginsButton.setAttribute("aria-expanded", "false");
    if (isInputPlugin) {
      toggleInputPlugin(plugin, button);
    } else {
      formatActiveNote(plugin);
    }
  });
  (isInputPlugin ? inputPluginList : formatterPluginList).append(button);
  inputPluginEmpty.hidden = [...plugins.values()].some((item) => item.type === "input");
  formatterPluginEmpty.hidden = [...plugins.values()].some((item) => item.type !== "input");
}

function toggleInputPlugin(plugin, button) {
  if (activeInputPlugin?.id === plugin.id) {
    activeInputPlugin = null;
    button.setAttribute("aria-pressed", "false");
    button.classList.remove("active");
    manglishButton.setAttribute("aria-pressed", "false");
    manglishButton.title = "MaltoEng input: Off (⌘M / Ctrl+M)";
    manglishButton.hidden = true;
    closeManglishSuggestions();
    showToast(`${plugin.name} turned off.`);
    editor.focus();
    return;
  }

  for (const inputButton of inputPluginList.querySelectorAll(".input-plugin-item")) {
    inputButton.setAttribute("aria-pressed", "false");
    inputButton.classList.remove("active");
  }
  activeInputPlugin = plugin;
  button.setAttribute("aria-pressed", "true");
  button.classList.add("active");
  const isMaltoEng = plugin.id === "manglish-input";
  manglishButton.setAttribute("aria-pressed", String(isMaltoEng));
  manglishButton.title = `MaltoEng input: ${isMaltoEng ? "On" : "Off"} (⌘M / Ctrl+M)`;
  manglishButton.hidden = !isMaltoEng;
  showToast(`${plugin.name} on — press Space to convert; F2 reopens word choices.`);
  editor.focus();
}

function toggleManglishInput() {
  const plugin = plugins.get("manglish-input");
  const button = inputPluginList.querySelector('[data-plugin-id="manglish-input"]');
  if (!plugin || !button) {
    showToast("MaltoEng input plugin is unavailable.");
    return;
  }
  toggleInputPlugin(plugin, button);
}

function formatActiveNote(plugin) {
  const note = getActiveNote();
  try {
    const formatted = plugin.format(note.content);
    if (typeof formatted !== "string") {
      throw new TypeError(`${plugin.name} did not return formatted text.`);
    }
    note.content = formatted;
    editor.value = formatted;
    updateEditorDetails();
    scheduleSave();
    showToast(`${plugin.name} applied.`);
    editor.focus();
  } catch (error) {
    console.error(`Unable to format note with ${plugin.name}:`, error);
    showToast(`${plugin.name} could not format this note: ${error.message}`);
  }
}

function getInputPluginSuggestions(plugin, word) {
  try {
    const suggestions = plugin.getSuggestions(word);
    if (
      !Array.isArray(suggestions) ||
      suggestions.some(
        (suggestion) =>
          !suggestion ||
          !["word", "letter"].includes(suggestion.kind) ||
          typeof suggestion.label !== "string" ||
          typeof suggestion.value !== "string",
      )
    ) {
      throw new TypeError(`${plugin.name} returned invalid input suggestions.`);
    }
    return suggestions;
  } catch (error) {
    console.error(`Unable to get suggestions from ${plugin.name}:`, error);
    showToast(`${plugin.name} could not provide suggestions: ${error.message}`);
    return [];
  }
}

window.NotepadPlugins = Object.freeze({ register: registerPlugin });
registerPlugin({
  id: "json-formatter",
  name: "Format JSON",
  format(content) {
    return `${JSON.stringify(JSON.parse(content), null, 2)}\n`;
  },
});

function downloadNote(note) {
  const blob = new Blob([note.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(note.name)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveActiveNote() {
  const note = getActiveNote();
  if (window.webkit?.messageHandlers?.notepad) {
    window.webkit.messageHandlers.notepad.postMessage({
      action: "save",
      name: note.name,
      content: note.content,
    });
  } else {
    downloadNote(note);
    showToast("Note downloaded as a text file.");
  }
}

function openFiles() {
  if (window.webkit?.messageHandlers?.notepad) {
    window.webkit.messageHandlers.notepad.postMessage({ action: "open" });
  } else {
    fileInput.click();
  }
}

window.openNativeFiles = (files) => {
  for (const file of files) {
    notes.push(makeNote(file.name, file.content));
    activeNoteId = notes[notes.length - 1].id;
  }
  renderActiveNote();
  persistNotes();
};

function safeFilename(name) {
  return name.trim().replace(/[\\/:*?"<>|]/g, "-") || "Untitled";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function closeManglishSuggestions() {
  manglishSuggestions.hidden = true;
  manglishSuggestions.replaceChildren();
  activeSuggestions = [];
  activeSuggestionRange = null;
  selectedSuggestionIndex = 0;
}

function chooseManglishSuggestion(index) {
  if (!activeSuggestionRange || !activeSuggestions[index]) return;
  const { start, end } = activeSuggestionRange;
  const suggestions = activeSuggestions;
  const value = activeSuggestions[index].value;
  editor.setRangeText(value, start, end, "preserve");
  lastManglishConversion = {
    noteId: activeNoteId,
    start,
    end: start + value.length,
    caret: editor.selectionStart,
    suggestions,
  };
  closeManglishSuggestions();
  getActiveNote().content = editor.value;
  updateEditorDetails();
  scheduleSave();
}

function showManglishSuggestions(suggestions, start, end) {
  closeManglishSuggestions();
  if (suggestions.length < 2) return;

  activeSuggestions = suggestions;
  activeSuggestionRange = { start, end };
  manglishSuggestions.replaceChildren();
  suggestions.forEach((suggestion, index) => {
    const option = document.createElement("button");
    option.className = "manglish-suggestion";
    option.type = "button";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));

    const number = document.createElement("span");
    number.className = "manglish-suggestion-number";
    number.textContent = `${index + 1}.`;

    const word = document.createElement("span");
    word.textContent = suggestion.kind === "letter"
      ? `Letter${suggestion.label.includes(" + ") ? "s" : ""}: ${suggestion.label}`
      : suggestion.label;
    option.append(number, word);
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => chooseManglishSuggestion(index));
    manglishSuggestions.append(option);
  });
  const help = document.createElement("div");
  help.className = "manglish-suggestion-help";
  help.setAttribute("aria-hidden", "true");
  help.textContent = "↑↓ move · Enter choose · 1–9, 0=10 · F2 reopen";
  manglishSuggestions.append(help);
  manglishSuggestions.hidden = false;
}

document.querySelector("#open-button").addEventListener("click", openFiles);
document.querySelector("#save-button").addEventListener("click", saveActiveNote);
findButton.addEventListener("click", () => {
  if (findPanel.hidden) openFindPanel();
  else findInput.focus();
});
findPreviousButton.addEventListener("click", () => findMatch(-1));
findNextButton.addEventListener("click", () => findMatch(1));
replaceButton.addEventListener("click", replaceCurrentMatch);
replaceAllButton.addEventListener("click", replaceAllMatches);
findInput.addEventListener("input", () => findMatch(1, true));
findCaseSensitive.addEventListener("change", () => {
  if (findInput.value) findMatch(1, true);
  else updateFindCount([]);
});
findInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    findMatch(event.shiftKey ? -1 : 1, true);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeFindPanel();
  }
});
document.querySelector("#find-close-button").addEventListener("click", closeFindPanel);
document.querySelector("#compare-button").addEventListener("click", () => {
  if (workspace.classList.contains("comparing")) {
    finishComparison();
  } else {
    beginCompareSelection();
  }
});
document.querySelector("#compare-selected-button").addEventListener("click", showComparison);
document.querySelector("#cancel-compare-button").addEventListener("click", finishComparison);
document.querySelectorAll(".compare-content").forEach((pane) => {
  pane.addEventListener("input", () => {
    const note = notes.find((item) => item.id === pane.dataset.noteId);
    if (!note) {
      showToast("The note being compared is no longer available.");
      return;
    }
    note.content = pane.value;
    updateComparisonDiff();
    scheduleSave();
  });
});
wrapButton.addEventListener("click", () => setTextWrap(!wrapText));
manglishButton.addEventListener("click", toggleManglishInput);
document.querySelector("#decrease-font-button").addEventListener("click", () => setFontSize(editorFontSize - 1));
document.querySelector("#increase-font-button").addEventListener("click", () => setFontSize(editorFontSize + 1));
pluginsButton.addEventListener("click", () => {
  pluginMenu.hidden = !pluginMenu.hidden;
  pluginsButton.setAttribute("aria-expanded", String(!pluginMenu.hidden));
});
pluginHelpButton.addEventListener("click", () => {
  pluginMenu.hidden = true;
  pluginsButton.setAttribute("aria-expanded", "false");
  pluginGuideDialog.showModal();
});
pluginGuideCloseButton.addEventListener("click", () => pluginGuideDialog.close());
pluginGuideDialog.addEventListener("click", (event) => {
  if (event.target === pluginGuideDialog) pluginGuideDialog.close();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".plugin-menu-wrap")) {
    pluginMenu.hidden = true;
    pluginsButton.setAttribute("aria-expanded", "false");
  }
  if (event.target !== editor && !event.target.closest("#manglish-suggestions")) {
    closeManglishSuggestions();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !pluginMenu.hidden) {
    pluginMenu.hidden = true;
    pluginsButton.setAttribute("aria-expanded", "false");
    pluginsButton.focus();
  }
});

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files ?? []);
  for (const file of files) {
    try {
      const content = await file.text();
      const note = makeNote(file.name.replace(/\.[^.]+$/, "") || file.name, content);
      notes.push(note);
      activeNoteId = note.id;
    } catch (error) {
      console.error(`Unable to open ${file.name}:`, error);
      showToast(`Could not open ${file.name}.`);
    }
  }
  renderActiveNote();
  persistNotes();
  fileInput.value = "";
});

editor.addEventListener("input", (event) => {
  closeManglishSuggestions();
  const delimiter = event.data ?? pendingManglishDelimiter;
  pendingManglishDelimiter = "";
  if (
    activeInputPlugin &&
    (event.inputType === "insertText" || event.inputType === "insertLineBreak") &&
    delimiter &&
    /[\s.,!?;:()[\]{}"'`—–-]/u.test(delimiter)
  ) {
    const cursor = editor.selectionStart - delimiter.length;
    const precedingText = editor.value.slice(0, cursor);
    const word = precedingText.match(/[A-Za-z]+$/u);
    if (word) {
      const start = cursor - word[0].length;
      const suggestions = getInputPluginSuggestions(activeInputPlugin, word[0]);
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        getActiveNote().content = editor.value;
        updateEditorDetails();
        scheduleSave();
        return;
      }
      const firstSuggestion = suggestions[0].value;
      editor.setRangeText(firstSuggestion, start, cursor, "preserve");
      showManglishSuggestions(suggestions, start, start + firstSuggestion.length);
      lastManglishConversion = {
        noteId: activeNoteId,
        start,
        end: start + firstSuggestion.length,
        caret: editor.selectionStart,
        suggestions,
      };
    } else {
      lastManglishConversion = null;
    }
  } else {
    lastManglishConversion = null;
  }
  getActiveNote().content = editor.value;
  updateEditorDetails();
  scheduleSave();
});
editor.addEventListener("input", () => {
  if (!findPanel.hidden) updateFindCount();
});
editor.addEventListener("click", updateEditorDetails);
editor.addEventListener("keyup", updateEditorDetails);
editor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = editor.scrollTop;
});

titleInput.addEventListener("input", () => {
  const note = getActiveNote();
  note.name = titleInput.value.trim() || "Untitled";
  renderTabs();
  scheduleSave();
});

titleInput.addEventListener("blur", () => {
  if (!titleInput.value.trim()) {
    titleInput.value = "Untitled";
    getActiveNote().name = "Untitled";
    renderTabs();
    persistNotes();
  }
});

editor.addEventListener("keydown", (event) => {
  if (event.key === "F2" && activeInputPlugin) {
    event.preventDefault();
    if (
      lastManglishConversion?.noteId === activeNoteId &&
      editor.selectionStart === lastManglishConversion.caret &&
      editor.selectionEnd === lastManglishConversion.caret
    ) {
      showManglishSuggestions(
        lastManglishConversion.suggestions,
        lastManglishConversion.start,
        lastManglishConversion.end,
      );
    } else {
      showToast("Type a word and press Space first.");
    }
    return;
  }
  if (!manglishSuggestions.hidden) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      selectedSuggestionIndex =
        (selectedSuggestionIndex + direction + activeSuggestions.length) % activeSuggestions.length;
      manglishSuggestions.querySelectorAll(".manglish-suggestion").forEach((option, index) => {
        option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));
      });
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseManglishSuggestion(selectedSuggestionIndex);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeManglishSuggestions();
      return;
    }
    if (/^[0-9]$/u.test(event.key)) {
      event.preventDefault();
      const index = event.key === "0" ? 9 : Number(event.key) - 1;
      if (index < activeSuggestions.length) chooseManglishSuggestion(index);
      return;
    }
    closeManglishSuggestions();
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  pendingManglishDelimiter = event.key === "Enter"
    ? "\n"
    : event.key.length === 1 && /[\s.,!?;:()[\]{}"'`—–-]/u.test(event.key)
      ? event.key
      : "";

  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("    ", start, end, "end");
    editor.dispatchEvent(new Event("input"));
    return;
  }

  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}",
    '"': '"',
    "'": "'",
    "`": "`",
  };
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const nextCharacter = editor.value[end];

  if (Object.values(pairs).includes(event.key) && start === end && nextCharacter === event.key) {
    event.preventDefault();
    editor.setSelectionRange(end + 1, end + 1);
    updateEditorDetails();
    return;
  }

  if (event.key === "Backspace" && start === end && start > 0) {
    const opening = editor.value[start - 1];
    if (pairs[opening] === nextCharacter) {
      event.preventDefault();
      editor.setRangeText("", start - 1, end + 1, "end");
      editor.dispatchEvent(new Event("input"));
      return;
    }
  }

  if (Object.hasOwn(pairs, event.key)) {
    if (start === end && (event.key === "'" || event.key === '"')) {
      const previousCharacter = editor.value[start - 1];
      if (
        previousCharacter &&
        /[A-Za-z0-9_$]/.test(previousCharacter) &&
        event.key === "'"
      ) {
        return;
      }
    }

    event.preventDefault();
    const selectedText = editor.value.slice(start, end);
    editor.setRangeText(`${event.key}${selectedText}${pairs[event.key]}`, start, end, "end");
    const selectionStart = start + 1;
    const selectionEnd = selectionStart + selectedText.length;
    editor.setSelectionRange(selectionStart, selectionEnd);
    editor.dispatchEvent(new Event("input"));
  }
});

document.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;
  if (!modifier) return;

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    if (findPanel.hidden) openFindPanel();
    else closeFindPanel();
  } else if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    toggleManglishInput();
  } else if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
  } else if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    openFiles();
  } else if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveActiveNote();
  } else if (event.key.toLowerCase() === "g" && findPanel.hidden === false) {
    event.preventDefault();
    findMatch(event.shiftKey ? -1 : 1);
  } else if (event.key.toLowerCase() === "w") {
    event.preventDefault();
    closeNote(activeNoteId);
  } else if (event.key === "Tab" && notes.length > 1) {
    event.preventDefault();
    const currentIndex = notes.findIndex((note) => note.id === activeNoteId);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = (currentIndex + direction + notes.length) % notes.length;
    activateNote(notes[nextIndex].id);
  }
});

renderActiveNote();
setTextWrap(wrapText, false);
setFontSize(editorFontSize, false);
