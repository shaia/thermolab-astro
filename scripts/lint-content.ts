/**
 * Content lint: the rules a schema cannot express, across lessons, question banks and the glossary,
 * in both languages, plus the parity between them. Reports every problem, then exits 1 if any.
 *
 *   npm run lint:content                       # the whole course (CI)
 *   npx tsx scripts/lint-content.ts --file <p> # problems in one file only (an edit hook)
 *
 * --file skips completeness checks ("≥ 3 questions per objective", "every template part is
 * present"): a lesson being written is incomplete by design.
 *
 * PARITY. English is written first and Hebrew mirrors it, as in the original ThermoLab, whose
 * check_parity.py compared equations and code cells byte for byte. Here the two lessons of one id
 * must share their objectives, figures and figure settings, every step and the state it sets, every
 * display formula, the prediction's answer, the questions they ask and the worked examples they
 * hold; the two banks must hold the same questions with the same answers. Only the prose differs.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { chapters, chapterObjectives, lessonOrder, objectiveById } from '../src/course.ts';
import { questionBank } from '../src/assessment/schema.ts';
import { tex } from '../src/lib/tex.ts';
import { LANGS, type Lang } from '../src/i18n.ts';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'src/content');
const fileArg = process.argv.indexOf('--file');
const onlyFile = fileArg > 0 ? process.argv[fileArg + 1]?.replaceAll('\\', '/') : null;
const problems: string[] = [];
const fail = (where: string, msg: string, completeness = false) => {
  if (onlyFile && (completeness || !where.startsWith(onlyFile))) return;
  problems.push(`${where}: ${msg}`);
};

const walk = (dir: string): string[] =>
  statSync(dir, { throwIfNoEntry: false })
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];
const rel = (p: string) => relative(ROOT, p).replaceAll('\\', '/');
const yamlFile = <T>(p: string): T => {
  try {
    return parse(readFileSync(p, 'utf8')) as T;
  } catch (e) {
    // the usual cause: a plain scalar with ": " inside it. Use a folded block (>-) for prose.
    fail(rel(p), `YAML: ${(e as Error).message.split(/\r?\n/)[0]}`);
    return undefined as T;
  }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Words that mark the limit check every worked example shows, per language. */
const LIMIT_CHECK: Record<Lang, string> = { en: '**Limit check:**', he: '**בדיקת גבולות:**' };
/** A lettered part of an example: (a) in English, (א) in Hebrew. */
const PART: Record<Lang, RegExp> = { en: /^\s*\([a-h]\)\s/, he: /^\s*(\([א-ח]\)|[א-ח]\.)\s/ };

/* ------------------------------------------------------------------ load */

interface Choice {
  text: string;
  correct?: boolean;
  feedback: string;
}
interface Question {
  id: string;
  type: string;
  objectives: string[];
  level?: string;
  qualitative?: boolean;
  prompt: string;
  choices?: Choice[];
  answer?: unknown;
  unit?: string;
  tolerance?: number;
  [k: string]: unknown;
}
interface Lesson {
  file: string;
  lang: Lang;
  id: string;
  objectives: { id: string; text: string }[];
  figures: string[];
  order: number;
  body: string;
}

const lessons: Lesson[] = walk(join(CONTENT, 'lessons'))
  .filter((f) => f.endsWith('.mdx'))
  .flatMap((file) => {
    const raw = readFileSync(file, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) {
      fail(rel(file), 'no frontmatter');
      return [];
    }
    const fm = parse(m[1]) as Omit<Lesson, 'file' | 'body'>;
    const folder = rel(file).match(/lessons\/(en|he)\/ch(\d+)\//);
    if (!folder) fail(rel(file), 'a lesson lives in src/content/lessons/<en|he>/ch<N>/');
    else if (folder[1] !== fm.lang) fail(rel(file), `lang: ${fm.lang} does not match the folder ${folder[1]}/`);
    return [{ file: rel(file), lang: fm.lang, id: fm.id, objectives: fm.objectives ?? [], figures: fm.figures ?? [], order: fm.order, body: m[2] }];
  });

const banks = walk(join(CONTENT, 'questions'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ file: rel(f), data: yamlFile<{ lang: Lang; chapter: number; questions: Question[] }>(f) }));

interface Term {
  id: string;
  term: { en: string; he: string };
  reject?: string[];
  file: string;
}
const glossary: Term[] = walk(join(CONTENT, 'glossary'))
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => (yamlFile<Omit<Term, 'file'>[]>(f) ?? []).map((e) => ({ ...e, file: rel(f) })));
const glossaryIds = new Set(glossary.map((g) => g.id));
{
  const seen = new Map<string, string>();
  for (const g of glossary) {
    if (seen.has(g.id)) fail(g.file, `glossary id ${g.id} is also defined in ${seen.get(g.id)}`);
    seen.set(g.id, g.file);
  }
}

const plannedById = new Map(lessonOrder.map((l) => [l.id, l]));
const objectiveIds = new Set(objectiveById.keys());
const questionsOf = (lang: Lang) => banks.filter((b) => b.data?.lang === lang).flatMap((b) => (b.data?.questions ?? []).map((q) => ({ q, file: b.file })));

/* ------------------------------------------------------- lessons ↔ course map */

for (const l of lessons) {
  const planned = plannedById.get(l.id);
  if (!planned) {
    fail(l.file, `lesson ${l.id} is not in the course map (src/course.ts)`);
    continue;
  }
  if (!same(l.objectives.map((o) => o.id), planned.objectives.map((o) => o.id))) {
    fail(l.file, `objectives [${l.objectives.map((o) => o.id).join(', ')}] differ from the course map's`);
  }
  for (const o of l.objectives) {
    const want = planned.objectives.find((p) => p.id === o.id)?.text[l.lang];
    if (want !== undefined && want !== o.text) fail(l.file, `${o.id}: the text differs from the course map's ${l.lang} text`);
  }
  if (l.order !== Number(l.id.split('.')[1])) fail(l.file, `order: ${l.order} does not match the lesson number ${l.id}`);
}

/* ------------------------------------------------------- banks: schema, placement, TeX */

const NOT_TEXT = new Set(['id', 'type', 'objectives', 'level', 'answer', 'unit', 'value']);
const texStrings = (v: unknown, path: string, out: [string, string][] = []): [string, string][] => {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => texStrings(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!NOT_TEXT.has(k)) texStrings(x, path ? `${path}.${k}` : k, out);
  return out;
};
for (const { file, data } of banks) {
  const parsed = questionBank.safeParse(data);
  if (!parsed.success) for (const issue of parsed.error.issues.slice(0, 8)) fail(file, `schema: ${issue.path.join('.')}: ${issue.message}`);
  const folder = file.match(/questions\/(en|he)\/ch(\d+)\/(\d+-\d+)\.yaml$/);
  if (!folder) {
    fail(file, 'a bank lives in src/content/questions/<en|he>/ch<N>/<chapter>-<lesson>.yaml');
    continue;
  }
  if (data?.lang !== folder[1]) fail(file, `lang: ${data?.lang} does not match the folder ${folder[1]}/`);
  if (data?.chapter !== Number(folder[2])) fail(file, `chapter: ${data?.chapter} does not match the folder ch${folder[2]}`);
  const prefix = `Q-${folder[3].replace('-', '.')}-`;
  for (const q of data?.questions ?? []) {
    const w = `${file} ${q.id}`;
    if (!q.id.startsWith(prefix)) fail(w, `a question in ${folder[3]}.yaml has an id ${prefix}…`);
    for (const o of q.objectives ?? []) {
      if (!objectiveIds.has(o)) fail(w, `objective ${o} is not in the course map`);
      else if (!o.startsWith(`OBJ-${folder[3].replace('-', '.')}-`)) fail(w, `objective ${o} belongs to another lesson`);
    }
    if ((q.objectives ?? []).length === 0) fail(w, 'no objectives');
    if (q.type === 'mc' && (q.choices ?? []).filter((c) => c.correct).length !== 1) fail(w, 'needs exactly one correct choice');
    for (const c of q.choices ?? []) if (!c.feedback?.trim()) fail(w, `choice "${c.text}" has no feedback`);
    for (const [path, text] of texStrings(q, '')) {
      try {
        tex(text, path);
      } catch (e) {
        fail(w, (e as Error).message);
      }
    }
  }
}
for (const lang of LANGS) {
  const seen = new Map<string, string>();
  for (const { q, file } of questionsOf(lang)) {
    if (seen.has(q.id)) fail(`${file} ${q.id}`, `duplicate question id (also in ${seen.get(q.id)})`);
    seen.set(q.id, file);
  }
}

/* ------------------------------------------------- objectives coverage (completeness) */

const LADDER = ['basic', 'mid', 'bagrut'];
for (const lang of LANGS) {
  const qs = questionsOf(lang).map(({ q }) => q);
  const chaptersWithBanks = [...new Set(banks.filter((b) => b.data?.lang === lang).map((b) => b.data?.chapter))];
  for (const n of chaptersWithBanks) {
    const where = `src/content/questions/${lang}/ch${n}`;
    for (const o of chapterObjectives(n as number)) {
      const mine = qs.filter((q) => q.objectives.includes(o.id));
      if (mine.length < 3) fail(where, `objective ${o.id} has ${mine.length} question(s) (needs ≥ 3)`, true);
      else if (!mine.some((q) => q.qualitative)) fail(where, `objective ${o.id} has no qualitative question`, true);
    }
    for (const l of chapters.find((c) => c.n === n)?.lessons ?? []) {
      const levels = new Set(qs.filter((q) => q.id.startsWith(`Q-${l.id}-`)).map((q) => q.level ?? 'basic'));
      const missing = LADDER.filter((x) => !levels.has(x));
      if (levels.size && missing.length) fail(where, `lesson ${l.id} has no question at level ${missing.join(', ')}`, true);
    }
  }
}

/* -------------------------------------------------------------- lessons */

const TEMPLATE = ['Hook', 'Predict', 'Explore', 'Explain', 'Example', 'Check', 'Summary'];
const prose = (s: string) => s.trim() !== '' && !/^\s*(<|\$\$|\||-|\*|#)/.test(s) && !s.includes('="') && !s.includes('$$');

/** Everything about a lesson that must not differ between its two languages. */
function skeleton(l: Lesson) {
  const b = l.body;
  const attr = (tag: string, name: string) => [...b.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?\\b${name}=("[^"]*"|\\{\\{[\\s\\S]*?\\}\\}|\\{[^}]*\\})`, 'g'))].map((m) => m[1].replace(/\s+/g, ' '));
  return {
    objectives: l.objectives.map((o) => o.id),
    figures: l.figures,
    spreads: attr('Spread', 'fig'),
    figureProps: attr('Spread', 'figureProps'),
    blocks: [...b.matchAll(/<(Hook|Predict|Explore|Explain|Example|Check|Summary)\b(?:[^>]*?\bid="([^"]+)")?/g)].map((m) => `${m[1]}${m[2] ? `#${m[2]}` : ''}`),
    steps: [...b.matchAll(/<Step\s+fig="([^"]+)"\s+set=\{\{([\s\S]*?)\}\}(?:\s+id="([^"]+)")?/g)].map((m) => `${m[1]} {${m[2].replace(/\s+/g, ' ').trim()}}${m[3] ? ` #${m[3]}` : ''}`),
    display: [...b.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => m[1].trim()),
    formulas: [...b.matchAll(/<Formula\s+tex="([^"]+)"/g)].map((m) => m[1]),
    predict: [...b.matchAll(/<Predict[\s\S]*?id="([^"]+)"[\s\S]*?choices=\{\[([\s\S]*?)\]\}[\s\S]*?answer=\{(\d+)\}/g)].map((m) => `${m[1]}: ${(m[2].match(/^\s*'/gm) ?? []).length} choices, answer ${m[3]}`),
    checks: [...b.matchAll(/<Check[\s\S]*?ids=\{\[([^\]]*)\]\}/g)].map((m) => (m[1].match(/'([^']+)'/g) ?? []).join(',')),
    revisits: [...b.matchAll(/<Revisit\s+id="([^"]+)"/g)].map((m) => m[1]),
    labs: [...b.matchAll(/<Lab\s+notebook="([^"]+)"/g)].map((m) => m[1]),
    terms: [...new Set([...b.matchAll(/<Term\s+id="([^"]+)"/g)].map((m) => m[1]))].sort(),
  };
}

for (const l of lessons) {
  let inMath = false;
  l.body.split('\n').forEach((line, i, all) => {
    if (line.trim() === '$$') inMath = !inMath;
    if (inMath || !prose(line)) return;
    if (PART[l.lang]?.test(line) && i > 0 && prose(all[i - 1])) fail(l.file, `body line ${i + 1}: a lettered part joins the previous paragraph; put a blank line before it`);
  });
  const blocks = [...l.body.matchAll(/<(Hook|Predict|Explore|Explain|Example|Check|Summary)\b/g)].map((m) => m[1]);
  for (const b of TEMPLATE) if (!blocks.includes(b)) fail(l.file, `lesson template: missing <${b}>`, true);
  let last = -1;
  for (const b of blocks) {
    const i = TEMPLATE.indexOf(b);
    if (i < last) fail(l.file, `lesson template: <${b}> comes after <${TEMPLATE[last]}>`);
    last = Math.max(last, i);
  }
  const sk = skeleton(l);
  for (const f of sk.spreads.map((s) => s.slice(1, -1))) if (!l.figures.includes(f)) fail(l.file, `figure ${f} is not listed in frontmatter figures`);
  for (const f of l.figures) if (!sk.spreads.includes(`"${f}"`)) fail(l.file, `frontmatter figure ${f} has no <Spread>`, true);
  for (const m of l.body.matchAll(/<Step\s+fig="([^"]+)"/g)) if (!l.figures.includes(m[1])) fail(l.file, `<Step fig="${m[1]}"> drives a figure that is not in this lesson`);
  const asked = new Set(questionsOf(l.lang).map(({ q }) => q.id));
  for (const ids of sk.checks) for (const id of ids.split(',').filter(Boolean)) if (!asked.has(id.slice(1, -1))) fail(l.file, `<Check> asks for ${id}, which is not in the ${l.lang} banks`, true);
  for (const m of l.body.matchAll(/<Example\s+id="([^"]+)"[\s\S]*?<\/Example>/g)) {
    if (!m[0].includes(LIMIT_CHECK[l.lang])) fail(l.file, `${m[1]}: every worked example shows a ${LIMIT_CHECK[l.lang]}`);
  }
  for (const t of sk.terms) if (!glossaryIds.has(t)) fail(l.file, `<Term id="${t}"> is not in the glossary`);
  // JS strings in MDX props turn "\f", "\v", "\t"… into control characters: TeX there must be doubled.
  for (const m of l.body.matchAll(/=\{[\s\S]*?\}\}?/g)) {
    if (/'[^']*?(?<!\\)\\[a-z][^']*'/.test(m[0])) fail(l.file, `TeX backslash inside a JS string prop (${m[0].slice(0, 40)}…): use a "..." attribute or \\\\`);
  }
}

/* -------------------------------------------------------------- parity */

const byId = new Map<string, Partial<Record<Lang, Lesson>>>();
for (const l of lessons) byId.set(l.id, { ...byId.get(l.id), [l.lang]: l });
for (const [id, pair] of byId) {
  const missing = LANGS.filter((lang) => !pair[lang]);
  if (missing.length) {
    fail((pair.en ?? pair.he)!.file, `lesson ${id} has no ${missing.join(', ')} version`, true);
    continue;
  }
  const en = skeleton(pair.en!);
  const he = skeleton(pair.he!);
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    if (same(en[key], he[key])) continue;
    const a = en[key];
    const b = he[key];
    const i = a.findIndex((x, k) => x !== b[k]);
    fail(pair.he!.file, `parity with ${pair.en!.file}: ${key} differ (${a.length} vs ${b.length}; first difference at #${i + 1}: ${JSON.stringify(a[i])?.slice(0, 80)} vs ${JSON.stringify(b[i])?.slice(0, 80)})`);
  }
}

/** What a question must share with its translation: everything but the words. */
const answerKey = (q: Question) => ({
  type: q.type,
  objectives: q.objectives,
  level: q.level ?? 'basic',
  qualitative: q.qualitative ?? false,
  correct: (q.choices ?? []).map((c) => !!c.correct),
  answer: q.answer,
  unit: q.unit,
  tolerance: q.tolerance,
  commonWrong: ((q.commonWrong as { value: number }[] | undefined) ?? []).map((w) => w.value),
  misconceptions: [...(q.choices ?? []), ...((q.commonWrong as Choice[] | undefined) ?? [])].map((c) => (c as { misconception?: string }).misconception ?? null),
});
const enQ = new Map(questionsOf('en').map(({ q, file }) => [q.id, { q, file }]));
const heQ = new Map(questionsOf('he').map(({ q, file }) => [q.id, { q, file }]));
for (const [qid, { q, file }] of enQ) {
  const other = heQ.get(qid);
  if (!other) {
    fail(file, `${qid} has no Hebrew version`, true);
    continue;
  }
  if (!same(answerKey(q), answerKey(other.q))) fail(other.file, `${qid}: answer key differs from the English (${JSON.stringify(answerKey(q))} vs ${JSON.stringify(answerKey(other.q))})`);
}
for (const [qid, { file }] of heQ) if (!enQ.has(qid)) fail(file, `${qid} has no English version`, true);

/* ------------------------------------------------------------- misconceptions */

interface Misconception {
  id: string;
  remedy: { lesson: string; anchor?: string };
  file: string;
}
const misconceptions: Misconception[] = walk(join(CONTENT, 'misconceptions'))
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => (yamlFile<Omit<Misconception, 'file'>[]>(f) ?? []).map((e) => ({ ...e, file: rel(f) })));
const mcIds = new Set(misconceptions.map((m) => m.id));
const detected = new Set<string>();
for (const lang of LANGS) {
  for (const { q, file } of questionsOf(lang)) {
    const tags = [...(q.choices ?? []), ...((q.commonWrong as Choice[] | undefined) ?? [])].flatMap((c) => {
      const t = (c as { misconception?: string }).misconception;
      return t ? [t] : [];
    });
    for (const t of tags) {
      if (!mcIds.has(t)) fail(`${file} ${q.id}`, `misconception ${t} is not in the register (src/content/misconceptions/)`);
      detected.add(t);
    }
  }
}
/** Whether a lesson renders an element with this HTML id (a <Spread fig> renders its figure with it). */
const hasAnchor = (body: string, id: string) =>
  [...body.matchAll(/<(\w+)\b[^>]*?\sid="([^"]+)"/g)].some((m) => m[2] === id && m[1] !== 'Term') ||
  [...body.matchAll(/<Spread\b[^>]*?\sfig="([^"]+)"/g)].some((m) => m[1] === id);
for (const m of misconceptions) {
  if (!detected.has(m.id)) fail(m.file, `${m.id} is not detected by any distractor`, true);
  if (!plannedById.has(m.remedy.lesson)) fail(m.file, `${m.id} remedy points at lesson ${m.remedy.lesson}, which is not in the course map`);
  for (const l of lessons.filter((x) => x.id === m.remedy.lesson)) {
    if (m.remedy.anchor && !hasAnchor(l.body, m.remedy.anchor)) fail(m.file, `${m.id} remedy anchor #${m.remedy.anchor} is not in ${l.file}`);
  }
}

/* ------------------------------------------------------------- module summaries */

const SUMMARY_SECTIONS: Record<Lang, string[]> = {
  en: ['The big idea', 'What to remember', 'Common mistakes', 'How to solve', 'Checklist before an exam'],
  he: ['הרעיון הגדול', 'מה חייבים לזכור', 'טעויות נפוצות', 'איך פותרים', 'רשימת בדיקה לפני מבחן'],
};
const summaries = walk(join(CONTENT, 'summaries'))
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => {
    const m = rel(f).match(/summaries\/(en|he)\/ch(\d+)\.mdx$/);
    return { file: rel(f), lang: (m?.[1] ?? 'en') as Lang, chapter: Number(m?.[2]), ok: !!m, body: readFileSync(f, 'utf8') };
  });
for (const sm of summaries) {
  if (!sm.ok) {
    fail(sm.file, 'a summary lives in src/content/summaries/<en|he>/ch<N>.mdx');
    continue;
  }
  if (!lessons.some((l) => l.lang === sm.lang && Number(l.id.split('.')[0]) === sm.chapter)) fail(sm.file, `module ${sm.chapter} has no written ${sm.lang} lesson`);
  const headings = [...sm.body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  if (!same(headings, SUMMARY_SECTIONS[sm.lang])) fail(sm.file, `sections must be exactly: ${SUMMARY_SECTIONS[sm.lang].map((h) => `"## ${h}"`).join(', ')}`);
  for (const m of sm.body.matchAll(/<LessonLink\s+id="([^"]+)"(?:\s+anchor="([^"]+)")?/g)) {
    const target = lessons.find((l) => l.lang === sm.lang && l.id === m[1]);
    if (!target) fail(sm.file, `<LessonLink id="${m[1]}">: lesson not written in ${sm.lang}`);
    else if (m[2] && !hasAnchor(target.body, m[2])) fail(sm.file, `<LessonLink id="${m[1]}" anchor="${m[2]}">: no such id in the lesson`);
  }
  for (const f of [...sm.body.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => `$$${m[1]}$$`).concat([...sm.body.matchAll(/\btex="([^"]+)"/g)].map((m) => `$$${m[1]}$$`))) {
    try {
      tex(f, sm.file);
    } catch (e) {
      fail(sm.file, (e as Error).message);
    }
  }
}
// parity: the two summaries of a module share their formula cards and their links
const summaryKey = (body: string) => ({
  formulas: [...body.matchAll(/<Formula\s+tex="([^"]+)"/g)].map((m) => m[1]),
  links: [...body.matchAll(/<LessonLink\s+id="([^"]+)"(?:\s+anchor="([^"]+)")?/g)].map((m) => `${m[1]}#${m[2] ?? ''}`),
});
for (const en of summaries.filter((s) => s.lang === 'en')) {
  const he = summaries.find((s) => s.lang === 'he' && s.chapter === en.chapter);
  if (!he) fail(en.file, `module ${en.chapter} has no Hebrew summary`, true);
  else if (!same(summaryKey(en.body), summaryKey(he.body))) fail(he.file, `parity with ${en.file}: formula cards or lesson links differ`);
}

/* ------------------------------------------------------------- glossary spellings */

for (const g of glossary) {
  for (const bad of g.reject ?? []) {
    const re = new RegExp(bad.trim().split(/\s+/).map((w) => `ה?${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('\\s+'));
    for (const l of lessons.filter((x) => x.lang === 'he')) if (re.test(l.body)) fail(l.file, `"${bad}": the course spells this "${g.term.he}"`);
    for (const { q, file } of questionsOf('he')) if (re.test(JSON.stringify(q))) fail(`${file} ${q.id}`, `"${bad}": the course spells this "${g.term.he}"`);
  }
}

/* -------------------------------------------------- KaTeX in MDX */

const DD = '$$';
for (const l of lessons) {
  const display = [...l.body.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => DD + m[1] + DD);
  const inline = [...l.body.replace(/\$\$[\s\S]+?\$\$/g, '').matchAll(/\$([^$\n]+)\$/g)].map((m) => '$' + m[1] + '$');
  const props = [...l.body.matchAll(/\btex="([^"]+)"/g)].map((m) => DD + m[1] + DD);
  for (const f of [...display, ...inline, ...props]) {
    try {
      tex(f, l.file);
    } catch (e) {
      fail(l.file, (e as Error).message);
    }
  }
}

// glossary definitions are rendered with KaTeX in the term cards and on the glossary page
for (const g of glossary as (Term & { definition?: Record<Lang, string> })[]) {
  for (const lang of LANGS) {
    try {
      tex(g.definition?.[lang] ?? '', `glossary ${g.id}.definition.${lang}`);
    } catch (e) {
      fail(g.file, (e as Error).message);
    }
  }
}

/* --------------------------------------------------------------- report */

if (problems.length) {
  console.error(`lint-content: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
const count = (lang: Lang) => `${lessons.filter((l) => l.lang === lang).length} ${lang}`;
console.log(
  `lint-content: ok${onlyFile ? ` for ${onlyFile}` : ''} (lessons: ${count('en')}, ${count('he')}; questions: ${enQ.size} en, ${heQ.size} he; ${glossary.length} terms; ${misconceptions.length} misconceptions; ${summaries.length} summaries; parity checked for ${byId.size} lesson(s))`,
);
