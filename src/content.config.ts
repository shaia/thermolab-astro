import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { readdir, readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { questionBank } from './assessment/schema';

/**
 * A collection kept as one YAML list per lesson (`<dir>/4-1.yaml`, …), merged into one collection.
 * Per-lesson files let lessons be written in parallel without editing a shared file; a duplicate id
 * across files fails the build.
 */
function yamlDir(dir: string) {
  return async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.yaml')).sort();
    const seen = new Map<string, string>();
    const entries: { id: string }[] = [];
    for (const f of files) {
      const list = (parse(await readFile(`${dir}/${f}`, 'utf8')) ?? []) as { id: string }[];
      for (const e of list) {
        if (seen.has(e.id)) throw new Error(`${dir}: id "${e.id}" appears in both ${seen.get(e.id)} and ${f}`);
        seen.set(e.id, f);
        entries.push(e);
      }
    }
    return entries;
  };
}

const lang = z.enum(['en', 'he']);
const objective = z.object({ id: z.string().regex(/^OBJ-\d+\.\d+-\d+$/), text: z.string() });

/**
 * Lessons live in src/content/lessons/<lang>/ch<N>/. Each language is a full lesson file: the two
 * share ids, figures, steps and formulas (lint-content checks the parity), and differ in prose.
 */
const lessons = defineCollection({
  loader: glob({ base: './src/content/lessons', pattern: '**/*.mdx' }),
  schema: z.object({
    lang,
    id: z.string().regex(/^\d+\.\d+$/),
    chapter: z.number().int().min(0).max(18),
    order: z.number().int().min(1),
    title: z.string(),
    subtitle: z.string().optional(),
    minutes: z.number().int().min(5).max(180),
    objectives: z.array(objective).min(1),
    prerequisites: z.array(z.string()).default([]),
    figures: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export { question } from './assessment/schema';
export type { Question, BagrutQuestion, Part, OpenPart, AutoPart } from './assessment/schema';

/** Question banks live in src/content/questions/<lang>/ch<N>/<lesson>.yaml; ids are shared across languages. */
const questions = defineCollection({
  loader: glob({ base: './src/content/questions', pattern: '**/*.yaml' }),
  schema: questionBank,
});

/** One entry per term, both languages side by side, so a term cannot exist in one language only. */
const glossary = defineCollection({
  loader: yamlDir('src/content/glossary'),
  schema: z.object({
    id: z.string(),
    term: z.object({ en: z.string(), he: z.string() }),
    definition: z.object({ en: z.string(), he: z.string() }),
    symbol: z.string().optional(),
    /** Hebrew spellings that must not appear in course text */
    reject: z.array(z.string()).default([]),
    lesson: z.string().optional(),
  }),
});

const text = z.object({ en: z.string(), he: z.string() });

/**
 * The misconception register: beliefs the questions are built to catch, both languages side by
 * side. A wrong answer may name one; two such answers make it active on the learner's page, with
 * a link to the place in a lesson that refutes it. Converted from ThermoLab's assessment/misconceptions.yml.
 */
const misconceptions = defineCollection({
  loader: yamlDir('src/content/misconceptions'),
  schema: z.object({
    id: z.string().regex(/^MC-[\w-]+$/),
    title: text,
    belief: text,
    truth: text,
    /** where to go to unlearn it: a lesson id plus an anchor or figure */
    remedy: z.object({ lesson: z.string(), anchor: z.string().optional(), label: text }),
  }),
});

/** End-of-module summary, one file per language: what to remember and how to solve the module's problems. */
const summaries = defineCollection({
  loader: glob({ base: './src/content/summaries', pattern: '**/*.mdx' }),
  schema: z.object({ lang, chapter: z.number().int().min(0).max(18), title: z.string() }),
});

export const collections = { lessons, questions, glossary, misconceptions, summaries };
