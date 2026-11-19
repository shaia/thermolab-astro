/**
 * Question banks, at build time. A question id names the same question in both languages; the
 * bank of each language holds its own text. Ids are unique within a language (lint-content
 * enforces it) and every id exists in both (lint-content's parity check).
 */

import { getCollection } from 'astro:content';
import type { Question } from '~/content.config';
import type { Lang } from '~/i18n';
import { lessonOrder } from '~/course';
import { isOpen, partQuestion } from './bagrut';
import { lessonOfQuestion } from './ids';
import { renderQuestion } from './render';

export { lessonOfQuestion };

let cache: Map<string, Question> | null = null;
const key = (lang: Lang, id: string) => `${lang}:${id}`;

export async function allQuestions(): Promise<Map<string, Question>> {
  if (cache) return cache;
  const banks = await getCollection('questions');
  const map = new Map<string, Question>();
  for (const b of banks) {
    for (const q of b.data.questions) {
      const k = key(b.data.lang, q.id);
      if (map.has(k)) throw new Error(`duplicate question id ${q.id} in the ${b.data.lang} banks (in ${b.id})`);
      map.set(k, q);
    }
  }
  cache = map;
  return map;
}

export async function getQuestion(id: string, lang: Lang, where: string): Promise<Question> {
  const q = (await allQuestions()).get(key(lang, id));
  if (!q) throw new Error(`${where}: unknown question id ${id} in the ${lang} banks`);
  return q;
}

/** "/en/lessons/4-1/" (with or without a base path) → "4.1" */
export function lessonFromPath(pathname: string): string | null {
  const m = pathname.match(/\/lessons\/(\d+)-(\d+)\/?$/);
  return m ? `${m[1]}.${m[2]}` : null;
}

/* ------------------------------------------------------------------ module views */

/** Module numbers that have at least one question in this language: the practice sheet and test exist for these. */
export async function chaptersWithQuestions(lang: Lang): Promise<number[]> {
  const banks = (await getCollection('questions')).filter((b) => b.data.lang === lang);
  return [...new Set(banks.map((b) => b.data.chapter))].sort((a, b) => a - b);
}

export interface ChapterQuestions {
  /** single-card questions grouped by lesson, in course order, bank order within a lesson */
  byLesson: { lesson: string; questions: Question[] }[];
  /** multi-part review problems, in id order */
  bagrut: Extract<Question, { type: 'bagrut' }>[];
}

/** Every question of a module in one language, rendered for the browser (TeX done at build time). */
export async function chapterQuestions(chapter: number, lang: Lang): Promise<ChapterQuestions> {
  const banks = (await getCollection('questions')).filter((b) => b.data.chapter === chapter && b.data.lang === lang);
  const all = banks.flatMap((b) => b.data.questions).map(renderQuestion);
  const rank = (lesson: string) => {
    const i = lessonOrder.findIndex((l) => l.id === lesson);
    return i < 0 ? 1e6 : i;
  };
  const groups = new Map<string, Question[]>();
  for (const q of all) {
    if (q.type === 'bagrut') continue;
    const lesson = lessonOfQuestion(q.id) ?? '';
    groups.set(lesson, [...(groups.get(lesson) ?? []), q]);
  }
  const byLesson = [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }))
    .map(([lesson, questions]) => ({ lesson, questions }));
  const bagrut = all
    .filter((q): q is Extract<Question, { type: 'bagrut' }> => q.type === 'bagrut')
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  return { byLesson, bagrut };
}

/** A question the module test may draw: a single card. */
export type TestQuestion = Exclude<Question, { type: 'bagrut' }>;

/**
 * The module test's pool: every single-card question, plus each self-contained auto-graded part
 * of a review problem as a card of its own (scenario folded into its prompt). Open parts are
 * self-assessed, so they cannot be scored on submission and stay out.
 */
export function testPool(c: ChapterQuestions): TestQuestion[] {
  const pool: TestQuestion[] = c.byLesson.flatMap((g) => g.questions as TestQuestion[]);
  for (const q of c.bagrut) {
    for (const p of q.parts) {
      if (isOpen(p) || !p.standalone || p.objectives.length === 0) continue;
      const pq = partQuestion(q, p);
      const figure = q.diagram
        ? `<div class="test-diagram ltr-space" role="img" aria-label="${(q.diagramAlt ?? '').replace(/"/g, '&quot;')}">${q.diagram}</div>`
        : '';
      pool.push({ ...pq, prompt: `<div class="test-scenario">${q.prompt}</div>${figure}${pq.prompt}` });
    }
  }
  return pool;
}
