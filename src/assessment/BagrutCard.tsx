/**
 * A review problem: one scenario (text and an optional diagram) and lettered parts. Auto-graded
 * parts reuse QuestionCard; open parts use OpenPart. Every part records its own attempt with its
 * own objectives, and the card keeps a running score out of the total. (The file keeps emlab's
 * name for the type, `bagrut`; in this course it is a module review problem.)
 */

import { useState } from 'preact/hooks';
import type { BagrutQuestion } from '~/content.config';
import type { Lang } from '~/i18n';
import type { AttemptKind } from '~/progress/store';
import { isOpen, partQuestion, partScore, totalPoints } from './bagrut';
import OpenPart from './OpenPart';
import QuestionCard from './QuestionCard';
import './question.css';

const TEXT = {
  en: {
    review: 'Review problem',
    points: (n: number) => `${n} points`,
    note: 'Each hint takes a quarter off the part’s points (down to 40% of them). Answer the parts in any order.',
    part: (l: string) => `Part (${l})`,
    start: 'Answer the parts to see your score here.',
    score: (s: number, total: number) => `Score so far: ${s} of ${total}`,
    answered: (n: number, all: number) => ` · ${n} of ${all} parts answered`,
  },
  he: {
    review: 'שאלת חזרה',
    points: (n: number) => `${n} נקודות`,
    note: 'כל רמז מוריד רבע מנקודות הסעיף (עד שנשארים 40% מהן). אפשר לענות על הסעיפים בכל סדר.',
    part: (l: string) => `סעיף ${l}`,
    start: 'ענו על הסעיפים ותראו כאן את הניקוד.',
    score: (s: number, total: number) => `ניקוד עד כה: ${s} מתוך ${total}`,
    answered: (n: number, all: number) => ` · נענו ${n} מתוך ${all} סעיפים`,
  },
} satisfies Record<Lang, unknown>;

interface Props {
  q: BagrutQuestion;
  lang: Lang;
  lesson?: string | null;
  kind?: AttemptKind;
  label?: string;
}

export default function BagrutCard({ q, lang, lesson = null, kind = 'practice', label }: Props) {
  const t = TEXT[lang];
  const [earned, setEarned] = useState<Record<string, number>>({});
  const [answered, setAnswered] = useState<Record<string, true>>({});
  const total = totalPoints(q);
  const score = Object.values(earned).reduce((s, v) => s + v, 0);
  const n = Object.keys(answered).length;

  return (
    <article class="bagrut" data-qid={q.id} data-type="bagrut">
      <header class="bagrut-head">
        <div class="q-meta">
          {label && <span class="q-num">{label}</span>}
          <span class="chip">{t.review}</span>
          <span class="chip">{t.points(total)}</span>
        </div>
        <h3>{q.title}</h3>
        <div class="q-prompt" dangerouslySetInnerHTML={{ __html: q.prompt }} />
        {q.diagram && (
          <figure class="bagrut-diagram">
            <div class="ltr-space" role="img" aria-label={q.diagramAlt} dangerouslySetInnerHTML={{ __html: q.diagram }} />
          </figure>
        )}
        <p class="bagrut-note">{t.note}</p>
      </header>

      <ol class="bagrut-parts">
        {q.parts.map((p) => (
          <li key={p.label} class="b-part" data-part={p.label}>
            <h4 class="b-part-head">
              {t.part(p.label)}
              <span class="chip">{t.points(p.points)}</span>
            </h4>
            {isOpen(p) ? (
              <OpenPart
                q={q}
                part={p}
                lang={lang}
                lesson={lesson}
                kind={kind}
                onScored={(e) => {
                  setEarned((s) => ({ ...s, [p.label]: e }));
                  setAnswered((s) => ({ ...s, [p.label]: true }));
                }}
              />
            ) : (
              <QuestionCard
                q={partQuestion(q, p)}
                lang={lang}
                lesson={lesson}
                kind={kind}
                hintCost
                onGraded={(v, info) => {
                  setAnswered((s) => ({ ...s, [p.label]: true }));
                  setEarned((s) => ({ ...s, [p.label]: v.correct ? partScore(p.points, 1, info.hints) : (s[p.label] ?? 0) }));
                }}
              />
            )}
          </li>
        ))}
      </ol>

      <div class="bagrut-score" role="status" aria-live="polite">
        {n === 0 ? (
          <span>{t.start}</span>
        ) : (
          <span>
            {t.score(Math.round(score * 10) / 10, total)}
            {n < q.parts.length && t.answered(n, q.parts.length)}
          </span>
        )}
      </div>
    </article>
  );
}
