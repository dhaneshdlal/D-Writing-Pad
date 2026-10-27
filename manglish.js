"use strict";

(() => {
  const wordSuggestions = {
    ivide: "ഇവിടെ",
    ivite: "ഇവിടെ",
    nandi: "നന്ദി",
    kadichu: "കടിച്ചു",
    malayalam: "മലയാളം",
    njan: "ഞാൻ",
    njangal: "ഞങ്ങൾ",
    ningal: "നിങ്ങൾ",
    nammal: "നമ്മൾ",
    nee: "നീ",
    aanu: "ആണ്",
    alla: "അല്ല",
    alle: "അല്ലേ",
    entha: "എന്താ",
    enthu: "എന്ത്",
    evide: "എവിടെ",
    avide: "അവിടെ",
    ente: "എന്റെ",
    ninte: "നിന്റെ",
    veedu: "വീട്",
    amma: "അമ്മ",
    achan: "അച്ഛൻ",
    sugham: "സുഖം",
    sukham: "സുഖം",
    venam: "വേണം",
    venda: "വേണ്ട",
    pinne: "പിന്നെ",
    pakshe: "പക്ഷേ",
    cheythu: "ചെയ്തു",
    paranju: "പറഞ്ഞു",
    varum: "വരും",
    poyi: "പോയി",
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
    ["t", ["ത", "ട"]],
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

  function isStandaloneDeadConsonant(word) {
    return /^[\u0D15-\u0D39]\u0D4D$/u.test(word);
  }

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

  function expandTransliterations(word) {
    let states = [{ output: "", pending: "", score: 0 }];
    for (const token of tokenize(word)) {
      const nextStates = [];
      for (const state of states) {
        if (token.type === "consonant") {
          const prefix = state.pending ? `${state.output}${state.pending}്` : state.output;
          token.values.forEach((value, choice) => {
            nextStates.push({ output: prefix, pending: value, score: state.score + choice });
          });
        } else if (token.type === "vowel") {
          const forms = state.pending
            ? token.dependent
            : token.independent;
          forms.forEach((form, choice) => {
            nextStates.push({
              output: state.output + (state.pending ? state.pending + form : form),
              pending: "",
              score: state.score + choice,
            });
          });
        } else {
          nextStates.push({
            output: state.output + (state.pending || "") + token.value,
            pending: "",
            score: state.score,
          });
        }
      }

      const unique = new Map();
      for (const state of nextStates) {
        const key = `${state.output}\u0000${state.pending}`;
        const previous = unique.get(key);
        if (!previous || state.score < previous.score) unique.set(key, state);
      }
      states = [...unique.values()]
        .sort((left, right) => left.score - right.score)
        .slice(0, maximumCandidates);
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
    const dictionaryWords = [...new Set(variants.filter(
      (candidate) => wordDictionary.has(candidate) && !isStandaloneDeadConsonant(candidate),
    ))];
    const words = [
      ...(preferredWord ? [preferredWord] : []),
      ...dictionaryWords,
    ].filter((candidate, index, all) => all.indexOf(candidate) === index).slice(0, 10);

    return words.map((value) => ({ kind: "word", label: value, value }));
  }

  globalThis.ManglishTransliterator = Object.freeze({ getSuggestions, toMalayalam });
})();
