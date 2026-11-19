/**
 * An open part of a review problem: the student writes a solution, reveals the model solution,
 * then ticks a rubric against their own work. The ticks decide the credit, and the part is
 * recorded as one attempt, so mastery sees evidence from self-assessed parts too.
 */

import { useState } from 'preact/hooks';
import type { BagrutQuestion, OpenPart as OpenPartData } from '~/content.config';
import type { Lang } from '~/i18n';
import { recordAttempt, type AttemptKind } from '~/progress/store';
import { gradeOpen, partId, partScore } from './bagrut';
import './question.css';

type StepKind = OpenPartData['solution'][number]['kind'];

const TEXT = {
  en: {
    step: { formula: 'Formula', law: 'General law', manipulation: 'Derivation', substitution: 'Substitution, with units', limit: 'Limit check', units: 'Unit check', result: 'Result: significant figures and units' } satisfies Record<StepKind, string>,
    full: 'Full solution',
    self: 'Self-assessed',
    write: 'Write your solution: the law, the derivation, the substitution with units, and the result.',
    reveal: 'Show the model solution',
    hint: 'Hint',
    hintCost: '· costs points',
    tryFirst: 'Try it yourself first: comparing with the solution teaches far more.',
    model: 'Model solution',
    rubric: 'Check your solution against these points. Tick what you did right.',
    finish: 'Done checking',
    score: (e: number, p: number) => `Self-assessed score: ${e} of ${p} points`,
    passed: 'You met most of the points. The result is saved on your path.',
    failed: 'Go back over the points you did not tick and compare with the solution again. The result is saved on your path.',
    explanation: 'Explanation',
  },
  he: {
    step: { formula: 'נוסחה', law: 'החוק הכללי', manipulation: 'פיתוח', substitution: 'הצבה עם יחידות', limit: 'בדיקת גבולות', units: 'בדיקת יחידות', result: 'תוצאה: ספרות משמעותיות ויחידות' } satisfies Record<StepKind, string>,
    full: 'פתרון מלא',
    self: 'הערכה עצמית',
    write: 'כתבו את הפתרון שלכם: החוק, הפיתוח, ההצבה עם יחידות והתוצאה.',
    reveal: 'הראו פתרון לדוגמה',
    hint: 'רמז',
    hintCost: '· עולה בנקודות',
    tryFirst: 'קודם נסו בעצמכם: ההשוואה לפתרון מלמדת הרבה יותר.',
    model: 'פתרון לדוגמה',
    rubric: 'בדקו את הפתרון שלכם מול הסעיפים. סמנו את מה שעשיתם נכון.',
    finish: 'סיימתי את הבדיקה',
    score: (e: number, p: number) => `ציון עצמי: ${e} מתוך ${p} נקודות`,
    passed: 'עמדתם ברוב הסעיפים. התוצאה נשמרה במסלול שלכם.',
    failed: 'חזרו על הסעיפים שלא סימנתם והשוו שוב לפתרון. התוצאה נשמרה במסלול שלכם.',
    explanation: 'הסבר',
  },
} satisfies Record<Lang, unknown>;

interface Props {
  q: BagrutQuestion;
  part: OpenPartData;
  lang: Lang;
  lesson?: string | null;
  kind?: AttemptKind;
  /** called once, when the student finishes the self-check */
  onScored: (earned: number) => void;
}

export default function OpenPart({ q, part, lang, lesson = null, kind = 'practice', onScored }: Props) {
  const t = TEXT[lang];
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [ticked, setTicked] = useState<boolean[]>(() => part.rubric.map(() => false));
  const [done, setDone] = useState<{ earned: number; fraction: number } | null>(null);
  const [hints, setHints] = useState(0);

  const finish = () => {
    const v = gradeOpen(part, ticked);
    const earned = partScore(part.points, v.fraction, hints);
    setDone({ earned, fraction: v.fraction });
    recordAttempt({ qid: partId(q, part), lesson, kind, objectives: part.objectives, probes: [], misconception: null, correct: v.correct, confident: null, hints });
    onScored(earned);
  };

  const passed = done !== null && done.fraction >= part.passMark;

  return (
    <div class={`qcard open-part ${done ? (passed ? 'is-right' : 'is-wrong') : ''}`} data-qid={partId(q, part)} data-type="open">
      <div class="q-meta">
        <span class="chip">{t.full}</span>
        <span class="chip">{t.self}</span>
      </div>
      <div class="q-prompt" dangerouslySetInnerHTML={{ __html: part.prompt }} />

      <label class="open-write">
        <span class="open-write-label">{t.write}</span>
        <textarea rows={5} value={text} disabled={revealed} spellcheck={false} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      </label>

      {hints > 0 && (
        <ol class="q-hints">
          {part.hints.slice(0, hints).map((h, i) => (
            <li key={i} class="hand" dangerouslySetInnerHTML={{ __html: h }} />
          ))}
        </ol>
      )}

      {!revealed && (
        <div class="q-actions">
          <button type="button" class="btn primary" disabled={text.trim() === ''} onClick={() => setRevealed(true)}>
            {t.reveal}
          </button>
          {hints < part.hints.length && (
            <button type="button" class="btn ghost" onClick={() => setHints((n) => n + 1)}>
              {t.hint} {part.hints.length > 1 ? `(${hints + 1}/${part.hints.length})` : ''} {t.hintCost}
            </button>
          )}
          {text.trim() === '' && <span class="open-note">{t.tryFirst}</span>}
        </div>
      )}

      {revealed && (
        <div class="open-model">
          <p class="kicker">{t.model}</p>
          <ol class="open-steps">
            {part.solution.map((s, i) => (
              <li key={i} data-kind={s.kind}>
                <span class="open-step-kind">{t.step[s.kind]}</span>
                <span class="open-step-text" dangerouslySetInnerHTML={{ __html: s.text }} />
              </li>
            ))}
          </ol>

          <fieldset class="open-rubric" disabled={done !== null}>
            <legend class="q-subprompt">{t.rubric}</legend>
            {part.rubric.map((r, i) => (
              <label key={i} class={`q-choice ${ticked[i] ? 'on' : ''}`}>
                <input type="checkbox" checked={ticked[i]} onChange={() => setTicked(ticked.map((x, k) => (k === i ? !x : x)))} />
                <span dangerouslySetInnerHTML={{ __html: r.text }} />
              </label>
            ))}
          </fieldset>

          {!done && (
            <div class="q-actions">
              <button type="button" class="btn primary" onClick={finish}>
                {t.finish}
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <div class={`q-feedback ${passed ? 'ok' : 'bad'}`} role="status">
          <p class="q-verdict">{t.score(done.earned, part.points)}</p>
          <p>{passed ? t.passed : t.failed}</p>
        </div>
      )}

      {part.explanation && done && (
        <div class="q-explanation">
          <p class="kicker">{t.explanation}</p>
          <div dangerouslySetInnerHTML={{ __html: part.explanation }} />
        </div>
      )}
    </div>
  );
}
