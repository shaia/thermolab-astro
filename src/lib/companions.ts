/** Pages that accompany lessons and modules, in one language: lesson links, practice and summary pages. */

import { getCollection } from 'astro:content';
import { lessonSlug } from '~/course';
import type { Lang } from '~/i18n';
import { langUrl } from '~/lib/url';

/** Lesson ids written in this language (drafts count only in dev). */
export async function writtenLessons(lang: Lang): Promise<Set<string>> {
  return new Set((await getCollection('lessons', (e) => e.data.lang === lang && (!e.data.draft || import.meta.env.DEV))).map((e) => e.data.id));
}

/** Module numbers with a question bank in this language. */
async function withQuestions(lang: Lang): Promise<Set<number>> {
  return new Set((await getCollection('questions')).filter((b) => b.data.lang === lang).map((b) => b.data.chapter));
}

/**
 * Where a link to a lesson goes: the lesson page once it is written; until then the lesson's
 * questions on the module practice page, if there are any; otherwise the contents. A remedy or a
 * "what next" never leads to a dead page.
 */
export async function lessonHref(lang: Lang): Promise<(id: string, anchor?: string) => string> {
  const written = await writtenLessons(lang);
  const banks = await withQuestions(lang);
  return (id, anchor) => {
    if (written.has(id)) return langUrl(lang, `lessons/${lessonSlug(id)}/${anchor ? `#${anchor}` : ''}`);
    const ch = Number(id.split('.')[0]);
    return banks.has(ch) ? langUrl(lang, `practice/ch${ch}/#pl-${lessonSlug(id)}`) : langUrl(lang);
  };
}

/** Module numbers that have a summary page in this language. */
export async function chaptersWithSummary(lang: Lang): Promise<Set<number>> {
  return new Set((await getCollection('summaries')).filter((s) => s.data.lang === lang).map((s) => s.data.chapter));
}

/** The misconception register in one language, keyed by id, with a link to each remedy. */
export async function misconceptionsFor(lang: Lang): Promise<Record<string, { title: string; truth: string; href: string; label: string }>> {
  const href = await lessonHref(lang);
  return Object.fromEntries(
    (await getCollection('misconceptions')).map((m) => [
      m.data.id,
      { title: m.data.title[lang], truth: m.data.truth[lang], label: m.data.remedy.label[lang], href: href(m.data.remedy.lesson, m.data.remedy.anchor) },
    ]),
  );
}
