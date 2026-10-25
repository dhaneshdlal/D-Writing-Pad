"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dictionaryPath = path.join(root, "data/malayalam-hunspell/ml_IN.dic");
const outputPath = path.join(root, "manglish-dictionary.js");
const lines = fs.readFileSync(dictionaryPath, "utf8").split(/\r?\n/u);
const declaredCount = Number(lines[0]);
const words = lines
  .slice(1)
  .filter(Boolean)
  .map((line) => line.split("/")[0])
  .map((word) => word
    .replace(/ണ്‍/gu, "ൺ")
    .replace(/ന്‍/gu, "ൻ")
    .replace(/ര്‍/gu, "ർ")
    .replace(/ല്‍/gu, "ൽ")
    .replace(/ള്‍/gu, "ൾ")
    .replace(/ക്‍/gu, "ൿ"));

if (!Number.isInteger(declaredCount) || declaredCount !== words.length) {
  throw new Error(`Dictionary header declares ${lines[0]} words, but found ${words.length}.`);
}

const source = `"use strict";\n\nglobalThis.MalayalamWordList = new Set(${JSON.stringify(words.join("\n"))}.split("\\n"));\n`;
fs.writeFileSync(outputPath, source);
console.log(`Wrote ${words.length} Malayalam words to ${path.relative(root, outputPath)}.`);
