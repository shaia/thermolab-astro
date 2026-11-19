/**
 * One question, any type: answer, commit with a confidence level, get feedback traced to the
 * misconception behind a wrong answer, retry, and see the worked explanation.
 *
 * Confidence is asked in the same click as checking ("check — I'm sure" / "check — not sure"),
 * before the verdict is visible, so it reflects what the student believed.
 *
 * The question text arrives in its own language; `lang` is the language of the card's chrome.
 */

import { useState } from 'preact/hooks';
import { ui, type Lang } from '~/i18n';
import { recordAttempt, type AttemptKind } from '~/progress/store';
import type { Simple } from './bagrut';
import { grade, parseNumber, probesOf, type Answer, type Dir, type Verdict } from './check';
import './question.css';

type Question = Simple;

export interface GradedInfo {
  hints: number;
  confident: boolean | null;
}

interface Props {
  q: Question;
  lang: Lang;
  /** lesson the question is embedded in, for the attempt record */
  lesson?: string | null;
  kind?: AttemptKind;
  /** shown in the header, e.g. "Question 2" */
  label?: string;
  /** called after every graded attempt (tests use it to tally scores) */
  onGraded?: (v: Verdict, info: GradedInfo) => void;
  /** tell the student that hints cost points (Bagrut parts) */
  hintCost?: boolean;
}

export type Draft =
  | { type: 'mc'; choice: number | null }
  | { type: 'multi'; choices: number[] }
  | { type: 'numeric'; text: string }
  | { type: 'vector'; dir: Dir | null }
  | { type: 'rank'; order: string[]; tied: boolean[] }
  | { type: 'twotier'; choice: number | null; reason: number | null };

export function emptyDraft(q: Question): Draft {
  switch (q.type) {
    case 'mc':
      return { type: 'mc', choice: null };
    case 'multi':
      return { type: 'multi', choices: [] };
    case 'numeric':
      return { type: 'numeric', text: '' };
    case 'vector':
      return { type: 'vector', dir: null };
    case 'rank':
      return { type: 'rank', order: q.items.map((i) => i.id), tied: q.items.slice(1).map(() => false) };
    case 'twotier':
      return { type: 'twotier', choice: null, reason: null };
  }
}

/** The draft as a gradable answer, or a reason it is not ready yet. */
export function toAnswer(d: Draft, lang: Lang): Answer | { error: string } | null {
  switch (d.type) {
    case 'mc':
      return d.choice === null ? null : { type: 'mc', choice: d.choice };
    case 'multi':
      return d.choices.length === 0 ? null : { type: 'multi', choices: d.choices };
    case 'numeric': {
      if (d.text.trim() === '') return null;
      const v = parseNumber(d.text);
      return v === null ? { error: ui(lang).q.unreadable } : { type: 'numeric', value: v };
    }
    case 'vector':
      return d.dir === null ? null : { type: 'vector', dir: d.dir };
    case 'rank':
      return { type: 'rank', order: d.order, tied: d.tied };
    case 'twotier':
      return d.choice === null || d.reason === null ? null : { type: 'twotier', choice: d.choice, reason: d.reason };
  }
}

export default function QuestionCard({ q, lang, lesson = null, kind = 'check', label, onGraded, hintCost = false }: Props) {
  const s = ui(lang).q;
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(q));
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answer = toAnswer(draft, lang);
  const locked = verdict !== null;
  const solved = verdict?.correct === true;

  const check = (confident: boolean | null) => {
    const a = toAnswer(draft, lang);
    if (!a) return;
    if ('error' in a) {
      setError(a.error);
      return;
    }
    setError(null);
    const v = grade(q, a, lang);
    setVerdict(v);
    setTries((n) => n + 1);
    recordAttempt({
      qid: q.id,
      lesson,
      kind,
      objectives: q.objectives,
      probes: probesOf(q),
      misconception: v.misconception,
      correct: v.correct,
      confident,
      hints,
    });
    onGraded?.(v, { hints, confident });
  };

  const retry = () => {
    setVerdict(null);
    if (draft.type === 'numeric') return; // keep the typed number for editing
    setDraft(emptyDraft(q));
  };

  return (
    <div class={`qcard ${verdict ? (verdict.correct ? 'is-right' : 'is-wrong') : ''}`} data-qid={q.id} data-type={q.type}>
      <div class="q-meta">
        {label && <span class="q-num">{label}</span>}
        <span class="chip">{s.kind[q.type]}</span>
        {q.qualitative && <span class="chip">{s.qualitative}</span>}
        {q.level === 'bagrut' && <span class="chip">{s.examLevel}</span>}
      </div>
      <div class="q-prompt" dangerouslySetInnerHTML={{ __html: q.prompt }} />

      <AnswerArea q={q} lang={lang} draft={draft} setDraft={(d) => (setError(null), setDraft(d))} locked={locked} verdict={verdict} />

      {hints > 0 && (
        <ol class="q-hints">
          {q.hints.slice(0, hints).map((h, i) => (
            <li key={i} class="hand" dangerouslySetInnerHTML={{ __html: h }} />
          ))}
        </ol>
      )}

      {error && (
        <p class="q-error" role="alert">
          {error}
        </p>
      )}

      {!locked && (
        <div class="q-actions">
          {q.confidence ? (
            <>
              <button type="button" class="btn primary" disabled={!answer} onClick={() => check(true)}>
                {s.checkSure}
              </button>
              <button type="button" class="btn" disabled={!answer} onClick={() => check(false)}>
                {s.checkUnsure}
              </button>
            </>
          ) : (
            <button type="button" class="btn primary" disabled={!answer} onClick={() => check(null)}>
              {s.check}
            </button>
          )}
          {hints < q.hints.length && (
            <button type="button" class="btn ghost" onClick={() => setHints((n) => n + 1)}>
              {s.hint} {q.hints.length > 1 ? `(${hints + 1}/${q.hints.length})` : ''}
              {hintCost ? s.hintCost : ''}
            </button>
          )}
        </div>
      )}

      {verdict && (
        <div class={`q-feedback ${verdict.correct ? 'ok' : 'bad'}`} role="status">
          <p class="q-verdict">{verdict.correct ? s.correct : s.notQuite}</p>
          {verdict.feedback.filter(Boolean).map((f, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: f }} />
          ))}
          <div class="q-actions">
            {!solved && (
              <button type="button" class="btn primary" onClick={retry}>
                {s.tryAgain}
              </button>
            )}
            {!solved && q.explanation && !showSolution && (
              <button type="button" class="btn ghost" onClick={() => setShowSolution(true)}>
                {s.showSolution}
              </button>
            )}
          </div>
        </div>
      )}

      {q.explanation && (solved || showSolution || tries >= 3) && (
        <div class="q-explanation">
          <p class="kicker">{s.explanation}</p>
          <div dangerouslySetInnerHTML={{ __html: q.explanation }} />
        </div>
      )}
    </div>
  );
}

interface AreaProps {
  q: Question;
  lang: Lang;
  draft: Draft;
  setDraft: (d: Draft) => void;
  locked: boolean;
  verdict: Verdict | null;
}

export function AnswerArea({ q, lang, draft, setDraft, locked, verdict }: AreaProps) {
  const s = ui(lang).q;
  const name = `${q.id}-ans`;
  switch (q.type) {
    case 'mc':
    case 'multi': {
      const multi = q.type === 'multi';
      const d = draft as Extract<Draft, { type: 'mc' | 'multi' }>;
      const isOn = (i: number) => (d.type === 'mc' ? d.choice === i : d.choices.includes(i));
      return (
        <fieldset class="q-choices">
          <legend class="sr-only">{multi ? s.pickAll : s.pickOne}</legend>
          {q.choices.map((c, i) => (
            <label key={i} class={`q-choice ${isOn(i) ? 'on' : ''} ${locked && isOn(i) ? (c.correct ? 'right' : 'wrong') : ''}`}>
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={name}
                checked={isOn(i)}
                disabled={locked}
                onChange={() =>
                  d.type === 'mc'
                    ? setDraft({ type: 'mc', choice: i })
                    : setDraft({ type: 'multi', choices: d.choices.includes(i) ? d.choices.filter((x) => x !== i) : [...d.choices, i] })
                }
              />
              <span dangerouslySetInnerHTML={{ __html: c.text }} />
            </label>
          ))}
        </fieldset>
      );
    }
    case 'twotier': {
      const d = draft as Extract<Draft, { type: 'twotier' }>;
      return (
        <div class="q-twotier">
          <fieldset class="q-choices">
            <legend class="sr-only">{s.pickOne}</legend>
            {q.choices.map((c, i) => (
              <label key={i} class={`q-choice ${d.choice === i ? 'on' : ''} ${locked && d.choice === i ? (c.correct ? 'right' : 'wrong') : ''}`}>
                <input type="radio" name={`${name}-a`} checked={d.choice === i} disabled={locked} onChange={() => setDraft({ ...d, choice: i })} />
                <span dangerouslySetInnerHTML={{ __html: c.text }} />
              </label>
            ))}
          </fieldset>
          <fieldset class="q-choices reasons">
            <legend class="q-subprompt" dangerouslySetInnerHTML={{ __html: q.reasonPrompt ?? s.reasonPrompt }} />
            {q.reasons.map((c, i) => (
              <label key={i} class={`q-choice ${d.reason === i ? 'on' : ''} ${locked && d.reason === i ? (c.correct ? 'right' : 'wrong') : ''}`}>
                <input type="radio" name={`${name}-r`} checked={d.reason === i} disabled={locked} onChange={() => setDraft({ ...d, reason: i })} />
                <span dangerouslySetInnerHTML={{ __html: c.text }} />
              </label>
            ))}
          </fieldset>
        </div>
      );
    }
    case 'numeric': {
      const d = draft as Extract<Draft, { type: 'numeric' }>;
      return (
        <div class={`q-numeric ${verdict ? (verdict.correct ? 'right' : 'wrong') : ''}`}>
          <label>
            <span class="sr-only">{q.unit ? s.answerIn(q.unit) : s.answerNoUnit}</span>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              spellcheck={false}
              value={d.text}
              disabled={locked}
              onInput={(e) => setDraft({ type: 'numeric', text: (e.target as HTMLInputElement).value })}
            />
          </label>
          <span class="q-unit q">{q.unit}</span>
          <p class="q-numeric-help">
            {s.numericHelpBefore} <bdi dir="ltr">1.5*10^-3</bdi> {s.numericHelpOr} <bdi dir="ltr">1.5e-3</bdi>
          </p>
        </div>
      );
    }
    case 'vector': {
      const d = draft as Extract<Draft, { type: 'vector' }>;
      return <Rose lang={lang} value={d.dir} allowOutIn={q.allowOutIn} locked={locked} verdict={verdict} onPick={(dir) => setDraft({ type: 'vector', dir })} />;
    }
    case 'rank': {
      const d = draft as Extract<Draft, { type: 'rank' }>;
      const labelOf = (id: string) => q.items.find((i) => i.id === id)?.label ?? id;
      const move = (i: number, by: -1 | 1) => {
        const j = i + by;
        if (j < 0 || j >= d.order.length) return;
        const order = [...d.order];
        [order[i], order[j]] = [order[j], order[i]];
        setDraft({ ...d, order });
      };
      return (
        <div class="q-rank">
          <p class="q-rank-help">{s.rankHelp}</p>
          <ol>
            {d.order.map((id, i) => (
              <li key={id}>
                <div class="q-rank-item">
                  <span class="q-rank-pos">{i + 1}</span>
                  <span class="q-rank-label" dangerouslySetInnerHTML={{ __html: labelOf(id) }} />
                  <span class="q-rank-moves">
                    <button type="button" class="btn ghost" disabled={locked || i === 0} aria-label={s.up} onClick={() => move(i, -1)}>
                      ▲
                    </button>
                    <button type="button" class="btn ghost" disabled={locked || i === d.order.length - 1} aria-label={s.down} onClick={() => move(i, 1)}>
                      ▼
                    </button>
                  </span>
                </div>
                {i < d.order.length - 1 && (
                  <button
                    type="button"
                    class={`q-rank-rel ${d.tied[i] ? 'tied' : ''}`}
                    aria-pressed={d.tied[i]}
                    disabled={locked}
                    title={d.tied[i] ? s.tied : s.greater}
                    onClick={() => setDraft({ ...d, tied: d.tied.map((t, k) => (k === i ? !t : t)) })}
                  >
                    {d.tied[i] ? '=' : '>'}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      );
    }
  }
}

const ROSE: { dir: Exclude<Dir, 'out' | 'in' | 'zero'>; glyph: string; angle: number }[] = [
  { dir: 'e', glyph: '→', angle: 0 },
  { dir: 'ne', glyph: '↗', angle: 45 },
  { dir: 'n', glyph: '↑', angle: 90 },
  { dir: 'nw', glyph: '↖', angle: 135 },
  { dir: 'w', glyph: '←', angle: 180 },
  { dir: 'sw', glyph: '↙', angle: 225 },
  { dir: 's', glyph: '↓', angle: 270 },
  { dir: 'se', glyph: '↘', angle: 315 },
];

function Rose(p: { lang: Lang; value: Dir | null; allowOutIn: boolean; locked: boolean; verdict: Verdict | null; onPick: (d: Dir) => void }) {
  const s = ui(p.lang).q.dir;
  const cls = (d: Dir) => `rose-btn ${p.value === d ? 'on' : ''} ${p.locked && p.value === d ? (p.verdict?.correct ? 'right' : 'wrong') : ''}`;
  return (
    <div class="q-rose-wrap">
      <div class="q-rose ltr-space" role="radiogroup" aria-label={s.pick}>
        {ROSE.map((r) => {
          const a = (r.angle * Math.PI) / 180;
          return (
            <button
              key={r.dir}
              type="button"
              role="radio"
              aria-checked={p.value === r.dir}
              aria-label={s[r.dir]}
              class={cls(r.dir)}
              disabled={p.locked}
              style={{ left: `${50 + 38 * Math.cos(a)}%`, top: `${50 - 38 * Math.sin(a)}%` }}
              onClick={() => p.onPick(r.dir)}
            >
              {r.glyph}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={p.value === 'zero'}
          aria-label={s.zero}
          class={`${cls('zero')} zero`}
          disabled={p.locked}
          style={{ left: '50%', top: '50%' }}
          onClick={() => p.onPick('zero')}
        >
          0
        </button>
      </div>
      {p.allowOutIn && (
        <div class="q-outin" role="radiogroup" aria-label={s.perp}>
          <button type="button" role="radio" aria-checked={p.value === 'out'} class={cls('out')} disabled={p.locked} onClick={() => p.onPick('out')}>
            <span class="ltr">⊙</span> {s.out}
          </button>
          <button type="button" role="radio" aria-checked={p.value === 'in'} class={cls('in')} disabled={p.locked} onClick={() => p.onPick('in')}>
            <span class="ltr">⊗</span> {s.in}
          </button>
        </div>
      )}
    </div>
  );
}
