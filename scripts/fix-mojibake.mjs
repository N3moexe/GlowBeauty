#!/usr/bin/env node
/**
 * One-shot fixer for double-encoded UTF-8 (mojibake).
 *
 * Pattern being undone:
 *   Original bytes were valid UTF-8 (e.g. "é" = 0xC3 0xA9).
 *   An editor interpreted those bytes as Windows-1252/Latin-1, producing the
 *   two-character string "Ã©", then saved the file back as UTF-8 — so the on-disk
 *   bytes are now 0xC3 0x83 0xC2 0xA9 where "é" was supposed to be.
 *
 * We reverse it: read as UTF-8 → each char's code point matches the original
 * byte → re-assemble as Latin-1 bytes → decode as UTF-8.
 *
 * Only safe when every character in the source file is in the 0x00-0xFF range
 * (ASCII + Latin-1 supplement). This project is French-language and fits.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: fix-mojibake.mjs <file> [file...]");
  process.exit(1);
}

const MOJIBAKE_SIGNATURE = /Ã©|Ã¨|Ã |Ã´|Ã§|â€¢|â€”|Ã‰/;

// CP1252 code points (0x80-0x9F) that differ from Latin-1. Maps Unicode → byte.
const CP1252_EXTRA = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function charToCp1252Byte(cp) {
  if (cp <= 0xff) return cp;
  if (CP1252_EXTRA.has(cp)) return CP1252_EXTRA.get(cp);
  return null;
}

for (const file of files) {
  const abs = resolve(file);
  let text = readFileSync(abs, "utf8");
  // Strip BOM (source files don't need it, and it doesn't fit in Latin-1 anyway).
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  if (!MOJIBAKE_SIGNATURE.test(text)) {
    console.log(`skip: ${file} (no mojibake markers detected)`);
    continue;
  }
  // Map each char back to the CP1252 byte it represented.
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const byte = charToCp1252Byte(cp);
    if (byte === null) {
      console.error(
        `abort: ${file} contains char U+${cp.toString(16).padStart(4, "0")} with no CP1252 byte mapping`
      );
      process.exit(2);
    }
    bytes.push(byte);
  }
  const fixed = Buffer.from(bytes).toString("utf8");
  writeFileSync(abs, fixed, "utf8");
  console.log(`fixed: ${file}`);
}
