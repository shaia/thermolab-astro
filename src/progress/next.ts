/**
 * "What next" on the learner's page: a single suggestion from where the learner stands.
 * Pure over the progress record, so the order of the rules is unit-tested.
 *
 *   1. an active misconception → go to its remedy;
 *   2. a lesson started but not finished → continue it;
 *   3. the first lesson not started → start it;
 *   4. every lesson done but an objective not yet mastered → practice;
 *   5. everything mastered, no module test taken → the test;
 *   6. otherwise → the test again.
 */

import type { Lang } from '~/i18n';
import { objectiveMastery, misconceptionStatus } from './mastery';
import type { ProgressState } from './store';

export interface NextLesson {
  id: string;
  title: string;
  href: string;
  objectives: string[];
}

export interface NextInput {
  /** written lessons in course order */
  lessons: readonly NextLesson[];
  state: ProgressState;
  /** remedies of misconceptions by id: where to go to unlearn each */
  remedies: Record<string, { title: string; href: string }>;
  practiceHref: string;
  testHref: string;
  /** the language of the label and the reason (default Hebrew, as the platform was) */
  lang?: Lang;
}

export interface NextStep {
  kind: 'remedy' | 'continue' | 'start' | 'practice' | 'test' | 'retest';
  label: string;
  href: string;
  /** one sentence saying why this is the suggestion */
  reason: string;
}

const TEXT = {
  en: {
    remedy: 'A misconception that keeps coming back. This experiment refutes it.',
    continue: 'You started this lesson and have not finished it.',
    start: 'The next lesson on your path.',
    practiceLabel: 'The module’s practice page',
    practice: 'Some objectives are not mastered yet.',
    retestLabel: 'A new module test',
    retest: 'Everything is mastered. A new test keeps it sharp.',
    testLabel: 'The module test',
    test: 'You have finished every lesson and mastered the objectives. Time to test yourself.',
  },
  he: {
    remedy: 'טעות מושגית שחוזרת אצלכם. הניסוי הזה מפריך אותה.',
    continue: 'התחלתם את השיעור ולא סיימתם אותו.',
    start: 'השיעור הבא במסלול.',
    practiceLabel: 'דף התרגול של המודול',
    practice: 'יש מטרות שעוד לא הגעתם בהן לשליטה.',
    retestLabel: 'מבחן מודול חדש',
    retest: 'הכול נשלט. מבחן חדש ישמור על הידע חד.',
    testLabel: 'מבחן המודול',
    test: 'סיימתם את כל השיעורים ושלטתם במטרות. הגיע הזמן לבחון את עצמכם.',
  },
} satisfies Record<Lang, Record<string, string>>;

export function nextStep({ lessons, state, remedies, practiceHref, testHref, lang = 'he' }: NextInput): NextStep {
  const t = TEXT[lang];
  const active = misconceptionStatus(state.attempts).find((m) => m.active && remedies[m.id]);
  if (active) {
    const r = remedies[active.id];
    return { kind: 'remedy', label: r.title, href: r.href, reason: t.remedy };
  }
  const started = lessons.find((l) => state.lessons[l.id]?.visited && !state.lessons[l.id]?.completed);
  if (started) return { kind: 'continue', label: `${started.id} ${started.title}`, href: started.href, reason: t.continue };
  const fresh = lessons.find((l) => !state.lessons[l.id]?.visited && !state.lessons[l.id]?.completed);
  if (fresh) return { kind: 'start', label: `${fresh.id} ${fresh.title}`, href: fresh.href, reason: t.start };
  const objectives = lessons.flatMap((l) => l.objectives);
  const unmastered = objectives.some((o) => objectiveMastery(state.attempts, o).level !== 'mastered');
  if (unmastered) return { kind: 'practice', label: t.practiceLabel, href: practiceHref, reason: t.practice };
  const tested = state.attempts.some((a) => a.kind === 'test');
  return tested
    ? { kind: 'retest', label: t.retestLabel, href: testHref, reason: t.retest }
    : { kind: 'test', label: t.testLabel, href: testHref, reason: t.test };
}
