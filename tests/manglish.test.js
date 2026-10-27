"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "manglish.js"), "utf8");

function createTransliterator(words = []) {
  const globalThis = { MalayalamWordList: new Set(words) };
  vm.runInNewContext(source, { globalThis });
  return globalThis.ManglishTransliterator;
}

test("uses preferred Malayalam spellings for common Manglish words", () => {
  const transliterator = createTransliterator();

  assert.equal(transliterator.toMalayalam("njan ente veedu"), "ഞാൻ എന്റെ വീട്");
  assert.equal(transliterator.toMalayalam("njangal sukham aanu"), "ഞങ്ങൾ സുഖം ആണ്");
});

test("prefers dental ത for the unmarked Manglish t sound", () => {
  const transliterator = createTransliterator(["ടാ", "താ"]);
  const values = Array.from(transliterator.getSuggestions("taa"), ({ value }) => value);

  assert.deepEqual(values.slice(0, 2), ["താ", "ടാ"]);
});

test("does not offer standalone dead consonants as word suggestions", () => {
  const transliterator = createTransliterator(["ട്", "ത്"]);
  const suggestions = Array.from(transliterator.getSuggestions("t"));

  assert.deepEqual(suggestions, []);
});

test("does not offer arbitrary single-letter alternatives", () => {
  const transliterator = createTransliterator();

  assert.deepEqual(Array.from(transliterator.getSuggestions("t")), []);
});

test("ranks dictionary matches by phonetic preference", () => {
  const transliterator = createTransliterator(["ഷ്ഷ്", "ശ്ഷ്", "സ്സ്"]);
  const values = Array.from(transliterator.getSuggestions("ss"), ({ value }) => value);

  assert.deepEqual(values.slice(0, 3), ["സ്സ്", "ശ്ഷ്", "ഷ്ഷ്"]);
});
