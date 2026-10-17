// Guard for the engine-agnostic rule: core/ and games/ must not reach for
// platform APIs, non-deterministic sources or float math. (tsconfig.core.json
// also builds them with no DOM and no Node types.)
//
// Lexical, so it is a tripwire, not a proof: `%` on a non-integer, or a float
// smuggled in through an integer-looking expression, cannot be detected here.
// Division `/` is detected after stripping comments, strings and regex
// literals; integer halving should be written `>>> 1` instead.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, "Math.random"],
  [/\bDate\b/, "Date"],
  [/performance\./, "performance"],
  [/from\s+["']node:/, "node: import"],
  [/\brequire\(/, "require"],
  [/\bprocess\./, "process"],
  [/\bTextEncoder\b|\bBuffer\b/, "platform text/bytes API"],
  [/\bcrypto\./, "crypto"],
  // Only the integer helpers Math.imul / Math.clz32 are allowed.
  [/\bMath\s*\.\s*(?!imul\b|clz32\b)\w+/, "float math (Math.* other than imul/clz32)"],
  [/\bMath\s*\[/, "Math[...] bracket access"],
  [/\*\*/, "** exponentiation"],
  [/\bparseFloat\b|toFixed\(|toPrecision\(|toExponential\(/, "float parsing/formatting"],
  [/toLocale\w*/, "locale-dependent formatting"],
  [/\blocaleCompare\b/, "localeCompare"],
  [/\bIntl\b/, "Intl"],
  [/[\w)\]]\s*\/(?![/*])/, "division `/` (use >>> 1 / integer helpers)"],
];

/**
 * Documented exceptions: { file (relative, posix), rule name, reason }.
 * Keep this empty unless something legitimate cannot be written otherwise.
 */
const ALLOW: readonly { file: string; rule: string; reason: string }[] = [];

/** Strip comments, string/template literals and regex literals so only code remains. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""')
    .replace(/(^|[(,=:[!&|?{};]|\breturn)\s*\/(?![/*])(?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\n\\[])+\/[dgimsuy]*/gm, "$1 RE");
}

function violations(rel: string, src: string): string[] {
  const code = codeOnly(src);
  return FORBIDDEN.filter(([re, name]) => re.test(code) && !ALLOW.some((a) => a.file === rel && a.rule === name))
    .map(([, name]) => `${rel}: ${name}`);
}

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("core purity", () => {
  const files = [...walk(join(root, "core")), ...walk(join(root, "games"))];
  it.each(files.map((f) => relative(root, f).split("\\").join("/")))("%s uses no forbidden APIs", (rel) => {
    expect(violations(rel, readFileSync(join(root, rel), "utf8"))).toEqual([]);
  });

  it("the detector fires on each banned construct and ignores comments/strings/regexes", () => {
    const bad = [
      "const a = Math.floor(x);", "const a = Math.trunc(x);", "const a = Math.round(x);", "Math.ceil(x)",
      "Math.abs(x)", "Math.random()", "Math.pow(2, 3)", "Math . sqrt(2)", "Math['floor'](x)", "2 ** 3",
      "x.toLocaleString()", "a.localeCompare(b)", "new Intl.NumberFormat()", "Date.now()", "parseFloat(s)",
      "const h = n / 2;", "const h = f(n)/2;", "const h = a[0] / b;", "x /= 2;",
    ];
    for (const s of bad) expect(violations("x.ts", s), s).not.toEqual([]);
    const ok = [
      "Math.imul(a, b) >>> 0", "Math.clz32(x)", 'import { a } from "./b/c.ts";', "// a / b and Math.floor",
      "/* x ** 2 */", 'const s = "a / b";', "if (!/^[0-9a-f]*$/.test(h)) throw e;", "s.split(/,/)", "n >>> 1",
      "const r = x % 2;",
    ];
    for (const s of ok) expect(violations("x.ts", s), s).toEqual([]);
  });

  it("every ALLOW entry names a real file and rule and has a reason", () => {
    for (const a of ALLOW) {
      expect(statSync(join(root, a.file)).isFile()).toBe(true);
      expect(FORBIDDEN.some(([, name]) => name === a.rule)).toBe(true);
      expect(a.reason.length).toBeGreaterThan(10);
    }
  });

  it("core/ stays small (~500 lines; raised to 580 for verifySubmission/appendMove/encoder checks)", () => {
    const lines = walk(join(root, "core")).reduce((n, f) => n + readFileSync(f, "utf8").split("\n").length, 0);
    expect(lines).toBeLessThanOrEqual(580);
  });
});
