// Translation completeness. Run with: npm run test:i18n
// Every phrase must exist in both languages with the same {blanks}, Slovak plurals need 3 forms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { en } from "../src/i18n/en.ts";
import { sk } from "../src/i18n/sk.ts";

const blanks = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

test("English and Slovak have exactly the same phrases", () => {
  const a = Object.keys(en).sort();
  const b = Object.keys(sk).sort();
  assert.deepEqual(a.filter((k) => !(k in sk)), [], "missing in sk.ts");
  assert.deepEqual(b.filter((k) => !(k in en)), [], "missing in en.ts");
});

test("no empty phrases, same {blanks}, plural forms are complete", () => {
  for (const k of Object.keys(en)) {
    assert.ok(en[k].trim() && sk[k].trim(), `${k} is empty`);
    assert.deepEqual(blanks(en[k]), blanks(sk[k]), `${k}: {blanks} differ between en and sk`);
    if (en[k].includes("|")) {
      assert.equal(en[k].split("|").length, 2, `${k}: en needs 2 plural forms`);
      assert.equal(sk[k].split("|").length, 3, `${k}: sk needs 3 plural forms (1, 2-4, 5+)`);
    } else assert.ok(!sk[k].includes("|"), `${k}: stray | in sk`);
  }
});

test("every t(\"key\") used in the code exists", () => {
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(tsx?|jsx?)$/.test(f) && files.push(join(d, f))));
  walk("src");
  const missing = [];
  for (const f of files.filter((x) => !x.startsWith(join("src", "i18n")))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt[rt]?\(\s*["']([a-zA-Z0-9_.]+)["']/g)) if (!(m[1] in en)) missing.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});
