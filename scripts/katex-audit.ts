/**
 * Migration audit: render every formula of the original ThermoLab site (MyST Markdown) with the
 * KaTeX settings this platform builds with (throwOnError, strict: 'error'), and count what fails.
 * MyST renders the same TeX leniently, so a formula that ships today may fail here.
 *
 *   npx tsx scripts/katex-audit.ts ../thermolab/content/en
 */

import katex from 'katex';
import { katexMacros } from '../src/lib/katex-macros.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: katex-audit.ts <thermolab content/<lang> folder>');

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (f.startsWith('_') || f === 'media') return [];
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });

let total = 0;
const failures = new Map<string, { count: number; example: string }>();
for (const file of walk(root)) {
  // drop code blocks and inline code: they are not math
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const display = [...text.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => [m[1], true] as const);
  const inline = [...text.replace(/\$\$[\s\S]+?\$\$/g, '').matchAll(/(?<![\\$])\$((?:[^$\n]|\n(?!\s*\n))+?)\$(?!\$)/g)].map((m) => [m[1], false] as const);
  for (const [src, displayMode] of [...display, ...inline]) {
    total++;
    try {
      katex.renderToString(src, { displayMode, throwOnError: true, strict: 'error', macros: katexMacros() });
    } catch (e) {
      const msg = (e as Error).message.replace(/^KaTeX parse error: /, '').replace(/ at position \d+.*$/s, '').replace(/".*?"/g, '"…"').slice(0, 90);
      const f = failures.get(msg) ?? { count: 0, example: `${file.split(/[\\/]/).slice(-2).join('/')}: ${src.trim().slice(0, 70)}` };
      f.count++;
      failures.set(msg, f);
    }
  }
}
const failed = [...failures.values()].reduce((s, f) => s + f.count, 0);
console.log(`${total} formulas, ${failed} fail under strict KaTeX (${((100 * failed) / total).toFixed(2)}%)`);
for (const [msg, f] of [...failures].sort((a, b) => b[1].count - a[1].count)) console.log(`  ${String(f.count).padStart(5)}  ${msg}\n         e.g. ${f.example}`);
