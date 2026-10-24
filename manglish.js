"use strict";

(() => {
  const wordSuggestions = {
    ivide: "ഇവിടെ",
    ivite: "ഇവിടെ",
    nandi: "നന്ദി",
    kadichu: "കടിച്ചു",
    malayalam: "മലയാളം",
    njan: "ഞാൻ",
    ente: "എന്റെ",
    veedu: "വീട്",
  };

  const wordDictionary = globalThis.MalayalamWordList ?? new Set();
  const maximumCandidates = 4096;

  const vowels = [
    ["aa", ["ആ"], ["ാ"]],
    ["ee", ["ഈ"], ["ീ"]],
    ["ii", ["ഈ"], ["ീ"]],
    ["oo", ["ഊ"], ["ൂ"]],
    ["uu", ["ഊ"], ["ൂ"]],
    ["ai", ["ഐ"], ["ൈ"]],
    ["au", ["ഔ"], ["ൗ"]],
    ["ou", ["ഔ"], ["ൗ"]],
    ["a", ["അ", "ആ"], ["", "ാ"]],
    ["i", ["ഇ", "ഈ"], ["ി", "ീ"]],
    ["u", ["ഉ", "ഊ"], ["ു", "ൂ"]],
    ["e", ["എ", "ഏ"], ["െ", "േ"]],
    ["o", ["ഒ", "ഓ"], ["ൊ", "ോ"]],
  ].map(([key, independent, dependent]) => ({ key, independent, dependent }));

  const consonants = [
    ["chh", ["ഛ"]],
    ["ch", ["ച", "ഛ"]],
    ["sh", ["ശ", "ഷ"]],
    ["zh", ["ഴ"]],
    ["th", ["ത", "ഥ", "ഠ"]],
    ["dh", ["ധ", "ഢ"]],
    ["kh", ["ഖ", "ക"]],
    ["gh", ["ഘ", "ഗ"]],
    ["ph", ["ഫ", "പ"]],
    ["bh", ["ഭ", "ബ"]],
    ["ng", ["ങ"]],
    ["nj", ["ഞ"]],
    ["ny", ["ഞ"]],
    ["jh", ["ഝ", "ജ"]],
    ["k", ["ക", "ഖ"]],
    ["g", ["ഗ", "ഘ"]],
    ["c", ["ച", "ക"]],
    ["j", ["ജ", "ച"]],
    ["t", ["ട", "ത"]],
    ["d", ["ദ", "ഡ", "ട"]],
    ["n", ["ന", "ണ"]],
    ["m", ["മ"]],
    ["p", ["പ", "ഫ"]],
    ["b", ["ബ", "ഭ"]],
    ["y", ["യ"]],
    ["r", ["ര", "റ"]],
    ["l", ["ല", "ള"]],
    ["v", ["വ"]],
    ["w", ["വ"]],
    ["s", ["സ", "ശ", "ഷ"]],
    ["h", ["ഹ"]],
    ["f", ["ഫ"]],
    ["q", ["ക"]],
    ["x", ["ക്സ"]],
  ]
    .map(([key, values]) => ({ key, values }))
    .sort((left, right) => right.key.length - left.key.length);

  const finalConsonants = {
    മ: "ം",
    ന: "ൻ",
    ര: "ർ",
    ല: "ൽ",
    ള: "ൾ",
  };

  function tokenize(word) {
    const input = word.toLowerCase();
    const tokens = [];
    let index = 0;

    while (index < input.length) {
      const vowel = vowels.find((item) => input.startsWith(item.key, index));
      if (vowel) {
        tokens.push({ type: "vowel", ...vowel });
        index += vowel.key.length;
        continue;
      }

      const consonant = consonants.find((item) => input.startsWith(item.key, index));
      if (consonant) {
        tokens.push({ type: "consonant", ...consonant });
        index += consonant.key.length;
        continue;
      }

      tokens.push({ type: "literal", value: input[index] });
      index += 1;
    }
    return tokens;
  }

  function renderTokens(tokens, choices = new Map()) {
    let output = "";
    let pending = "";

    for (const [index, token] of tokens.entries()) {
      if (token.type === "consonant") {
        if (pending) output += `${pending}്`;
        pending = token.values[choices.get(index) ?? 0];
      } else if (token.type === "vowel") {
        const forms = pending ? token.dependent : token.independent;
        const form = forms[choices.get(index) ?? 0];
        output += pending ? pending + form : form;
        pending = "";
      } else {
        output += pending + token.value;
        pending = "";
      }
    }

    return output + (pending ? finalConsonants[pending] ?? `${pending}്` : "");
  }

  function getLetterAlternatives(word, base, rawDefault, words, limit) {
    const tokens = tokenize(word);
    const alternatives = [];
    const seen = new Set();
    const choices = new Map();
    const changedLabels = [];
    let visited = 0;

    function visit(index) {
      if (
        alternatives.length >= limit ||
        visited >= maximumCandidates ||
        changedLabels.length > 2
      ) return;
      visited += 1;
      if (index === tokens.length) {
        const value = renderTokens(tokens, choices);
        if (
          changedLabels.length > 0 &&
          value !== base &&
          value !== rawDefault &&
          !words.includes(value) &&
          !wordDictionary.has(value) &&
          !seen.has(value)
        ) {
          seen.add(value);
          alternatives.push({
            kind: "letter",
            label: changedLabels.join(" + "),
            value,
          });
        }
        return;
      }

      const token = tokens[index];
      const optionCount = token.type === "consonant"
        ? token.values.length
        : token.type === "vowel"
          ? Math.max(token.independent.length, token.dependent.length)
          : 1;

      for (let choice = 0; choice < optionCount; choice += 1) {
        if (choice === 0) {
          visit(index + 1);
          continue;
        }
        const label = token.type === "consonant"
          ? token.values[choice]
          : token.independent[choice] ?? token.dependent[choice];
        if (!label) continue;
        choices.set(index, choice);
        changedLabels.push(label);
        visit(index + 1);
        changedLabels.pop();
        choices.delete(index);
        if (alternatives.length >= limit) return;
      }
    }

    visit(0);
    return alternatives;
  }

  function expandTransliterations(word) {
    let states = [{ output: "", pending: "" }];
    for (const [tokenIndex, token] of tokenize(word).entries()) {
      const nextStates = [];
      for (const state of states) {
        if (token.type === "consonant") {
          const prefix = state.pending ? `${state.output}${state.pending}്` : state.output;
          for (const value of token.values) {
            nextStates.push({ output: prefix, pending: value });
          }
        } else if (token.type === "vowel") {
          const forms = state.pending
            ? token.dependent
            : token.independent;
          for (const form of forms) {
            nextStates.push({
              output: state.output + (state.pending ? state.pending + form : form),
              pending: "",
            });
          }
        } else {
          nextStates.push({
            output: state.output + (state.pending || "") + token.value,
            pending: "",
          });
        }
      }

      const unique = new Map();
      for (const state of nextStates) {
        const key = `${state.output}\u0000${state.pending}`;
        if (!unique.has(key)) unique.set(key, state);
        if (unique.size >= maximumCandidates) break;
      }
      states = [...unique.values()];
    }

    return states.map(({ output, pending }) => (
      output + (pending ? finalConsonants[pending] ?? `${pending}്` : "")
    ));
  }

  function transliterateWord(word) {
    return wordSuggestions[word.toLowerCase()] ?? expandTransliterations(word)[0];
  }

  function toMalayalam(text) {
    return text.replace(/[A-Za-z]+/gu, transliterateWord);
  }

  function getSuggestions(word) {
    const preferredWord = wordSuggestions[word.toLowerCase()];
    const variants = expandTransliterations(word);
    const dictionaryWords = [...new Set(variants.filter((candidate) => wordDictionary.has(candidate)))];
    const words = [
      ...(preferredWord ? [preferredWord] : []),
      ...dictionaryWords,
    ].filter((candidate, index, all) => all.indexOf(candidate) === index).slice(0, 10);

    const options = words.map((value) => ({ kind: "word", label: value, value }));
    if (options.length >= 10) return options;

    const base = preferredWord ?? variants[0];
    options.push(...getLetterAlternatives(word, base, variants[0], words, 10 - options.length));
    return options;
  }

  globalThis.ManglishTransliterator = Object.freeze({ getSuggestions, toMalayalam });
})();
