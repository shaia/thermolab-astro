/**
 * Question banks, at build time. A question id names the same question in both languages; the
 * bank of each language holds its own text. Ids are unique within a language (lint-content
 * enforces it) and every id exists in both (lint-content's parity check).
 */

import { getCollection } from 'astro:content';
import type { Question } from '~/content.config';
import type { Lang } from '~/i18n';
import { lessonOfQuestion } from './ids';

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
