const fs = require("fs");
const path = require("path");

const byteMap = new Map([
  ["\u20ac", 0x80], ["\u201a", 0x82], ["\u0192", 0x83], ["\u201e", 0x84],
  ["\u2026", 0x85], ["\u2020", 0x86], ["\u2021", 0x87], ["\u02c6", 0x88],
  ["\u2030", 0x89], ["\u0160", 0x8a], ["\u2039", 0x8b], ["\u0152", 0x8c],
  ["\u017d", 0x8e], ["\u2018", 0x91], ["\u2019", 0x92], ["\u201c", 0x93],
  ["\u201d", 0x94], ["\u2022", 0x95], ["\u2013", 0x96], ["\u2014", 0x97],
  ["\u02dc", 0x98], ["\u2122", 0x99], ["\u0161", 0x9a], ["\u203a", 0x9b],
  ["\u0153", 0x9c], ["\u017e", 0x9e], ["\u0178", 0x9f],
  ["\u011e", 0xd0], ["\u0130", 0xdd], ["\u015e", 0xde],
  ["\u011f", 0xf0], ["\u0131", 0xfd], ["\u015f", 0xfe],
]);

const suspicious = [
  "\u00c3", "\u00c2", "\u0102", "\u00c4", "\u00c5", "\u00e2",
  "\u011f\u0178", "\u00c4\u0178", "\u00c5\u00b8", "\u00c5\u0161",
  "\u00c5\u0178", "\u00c5\u009e", "\u00c5\u009f", "\ufffd",
];

function encodeWin125x(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
    } else if (byteMap.has(ch)) {
      bytes.push(byteMap.get(ch));
    } else {
      return null;
    }
  }
  return Buffer.from(bytes);
}

function decodeOnce(text) {
  const bytes = encodeWin125x(text);
  if (!bytes) return null;
  return bytes.toString("utf8");
}

function score(text) {
  let n = 0;
  for (const token of suspicious) {
    n += (text.split(token).length - 1) * 5;
  }
  n += (text.match(/[\u0080-\u009f]/g) || []).length * 4;
  n += (text.match(/[\u00c2-\u00c5][\u0080-\u00ff]?/g) || []).length * 2;
  n += (text.match(/\u00e2[\u0080-\u00ff]{0,2}/g) || []).length * 2;
  return n;
}

function fixText(text) {
  let current = text;
  let currentScore = score(current);

  for (let i = 0; i < 4; i++) {
    const next = decodeOnce(current);
    if (!next || next.includes("\ufffd")) break;

    const nextScore = score(next);
    if (nextScore >= currentScore) break;

    current = next;
    currentScore = nextScore;
  }

  return current;
}

function fixMixedText(text) {
  return text.replace(/[A-Za-z0-9_\-]*[\u00c2-\u00c5\u00e2\u0102\u011f\u00c4\u00c5][A-Za-z0-9_\-.\u0080-\u00ff\u0100-\u017f\u0192\u02c6\u02dc\u2010-\u203a]*/g, (part) => {
    const fixed = fixText(part);
    return score(fixed) < score(part) ? fixed : part;
  });
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node fix_encoding.js <file...>");
  process.exit(1);
}

for (const file of files) {
  const fullPath = path.resolve(file);
  const before = fs.readFileSync(fullPath, "utf8");
  let after = fixText(before);
  after = fixMixedText(after);
  if (after !== before) {
    fs.writeFileSync(fullPath, after, "utf8");
    console.log(`fixed ${file}: ${score(before)} -> ${score(after)}`);
  } else {
    console.log(`unchanged ${file}: ${score(before)}`);
  }
}
