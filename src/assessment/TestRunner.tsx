/**
 * The module test. Three phases in one island:
 *   intro   - what the test is, an optional timer;
 *   running - questions drawn by buildTest (every objective at least once), no feedback;
 *   report  - score, per-objective mastery, misconceptions with their remedies, what to review.
 *
 * Attempts are recorded only on submission, with kind 'test', so the answer history that
 * mastery reads is the same as for practice.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { objectiveMastery, type Level } from '~/progress/mastery';
import { progress, recordAttempt } from '~/progress/store';
import { grade, probesOf, type Verdict } from './check';
import { lessonOfObjective, lessonOfQuestion } from './ids';
import { emptyDraft, toAnswer, AnswerArea, type Draft } from './QuestionCard';
import type { Simple } from './bagrut';
import { buildTest } from './test-builder';
import './question.css';

interface Props {
  lang: Lang;
  pool: Simple[];
  objectives: { id: string; text: string }[];
  lessons: Record<string, { title: string; href: string }>;
  misconceptions: Record<string, { title: string; truth: string; href: string; label: string }>;
  practiceHref: string;
  meHref: string;
}

interface Result {
  q: Simple;
  answered: boolean;
  verdict: Verdict | null;
  correct: boolean;
}

const TEXT = {
  en: {
    level: { none: '○ not tested yet', learning: '◐ learning', mastered: '● mastered' } satisfies Record<Level, string>,
    intro: (n: number) => `The test is drawn from the module’s questions and covers all ${n} objectives at least once. There is no feedback until you submit: answer, submit, and only then see the report. The questions run from easy to hard.`,
    timed: 'Test with a clock',
    minutes: 'Length of the test in minutes',
    clockNote: 'Without a clock you can take as long as you like. An exam is written against the clock, so try it with one too.',
    start: 'Start the test',
    practiceFirst: 'Practise first',
    answered: (a: number, n: number) => `Answered ${a} of ${n}`,
    left: 'Time left',
    submit: 'Submit and see the report',
    question: (i: number) => `Question ${i}`,
    sure: 'Sure of the answer',
    score: (pct: number, seed: number) => `correct (${pct}%). Test number: ${seed}`,
    byObjective: 'Mastery by objective',
    objective: 'Objective',
    inTest: 'In the test',
    overall: 'Overall',
    mcFound: 'Misconceptions found',
    noMc: 'No known misconception showed up in your answers.',
    review: 'What to go back to',
    allRight: 'You answered every objective tested correctly. Keep practising to keep it.',
    lesson: (id: string, title: string) => `Lesson ${id} ${title}`,
    questions: 'The questions',
    right: 'correct',
    wrong: 'wrong',
    blank: 'not answered',
    again: 'A new test',
    toPractice: 'To the practice page',
    me: 'My path',
  },
  he: {
    level: { none: '○ עוד לא נבחנתם', learning: '◐ בלמידה', mastered: '● שליטה' } satisfies Record<Level, string>,
    intro: (n: number) => `המבחן נבחר מתוך שאלות המודול, ומכסה את כל ${n} המטרות לפחות פעם אחת. אין משוב עד ההגשה: עונים, מגישים, ורק אז רואים את הדוח. השאלות מסודרות מהקל לקשה.`,
    timed: 'מבחן עם שעון',
    minutes: 'משך המבחן בדקות',
    clockNote: 'בלי שעון אפשר לקחת כמה זמן שרוצים. במבחן עובדים מול שעון, ולכן כדאי לנסות גם עם שעון.',
    start: 'התחלת המבחן',
    practiceFirst: 'קודם לתרגל',
    answered: (a: number, n: number) => `ענו על ${a} מתוך ${n}`,
    left: 'הזמן שנשאר',
    submit: 'הגשה וקבלת דוח',
    question: (i: number) => `שאלה ${i}`,
    sure: 'בטוחים בתשובה',
    score: (pct: number, seed: number) => `תשובות נכונות (${pct}%). מספר המבחן: ${seed}`,
    byObjective: 'שליטה לפי מטרה',
    objective: 'מטרה',
    inTest: 'במבחן',
    overall: 'מצב כולל',
    mcFound: 'טעויות מושגיות שזוהו',
    noMc: 'לא זוהתה בתשובות טעות מושגית מוכרת.',
    review: 'מה כדאי לחזור עליו',
    allRight: 'ענו נכון על כל המטרות שנבחנו. המשיכו לדף התרגול כדי לשמור על הידע.',
    lesson: (id: string, title: string) => `שיעור ${id} ${title}`,
    questions: 'סקירת השאלות',
    right: 'נכון',
    wrong: 'לא נכון',
    blank: 'לא נענתה',
    again: 'מבחן חדש',
    toPractice: 'לדף התרגול',
    me: 'המסלול שלי',
  },
} satisfies Record<Lang, unknown>;

const DEFAULT_MINUTES = 30;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function TestRunner({ lang, pool, objectives, lessons, misconceptions, practiceHref, meHref }: Props) {
  const t = TEXT[lang];
  const [phase, setPhase] = useState<'intro' | 'running' | 'report'>('intro');
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [seed, setSeed] = useState(0);
  const [questions, setQuestions] = useState<Simple[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sure, setSure] = useState<Record<string, boolean>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const submitRef = useRef<() => void>(() => {});

  const start = (explicitSeed?: number) => {
    const fromUrl = new URLSearchParams(location.search).get('seed');
    const s = explicitSeed ?? (fromUrl && /^\d+$/.test(fromUrl) ? Number(fromUrl) : Math.floor(Math.random() * 1_000_000));
    const { ids } = buildTest(pool, objectives.map((o) => o.id), s);
    const picked = ids.map((id) => pool.find((p) => p.id === id)!);
    setSeed(s);
    setQuestions(picked);
    setDrafts(Object.fromEntries(picked.map((q) => [q.id, emptyDraft(q)])));
    setSure({});
    const time = Date.now();
    setNow(time);
    setDeadline(timed ? time + minutes * 60_000 : null);
    setPhase('running');
    window.scrollTo(0, 0);
  };

  const submit = () => {
    const rs: Result[] = questions.map((q) => {
      const a = toAnswer(drafts[q.id], lang);
      const ready = a !== null && !('error' in a);
      const verdict = ready ? grade(q, a, lang) : null;
      const correct = verdict?.correct === true;
      recordAttempt({
        qid: q.id,
        lesson: lessonOfQuestion(q.id),
        kind: 'test',
        objectives: q.objectives,
        probes: probesOf(q),
        misconception: verdict?.misconception ?? null,
        correct,
        confident: ready ? (sure[q.id] ?? false) : false,
        hints: 0,
      });
      return { q, answered: ready, verdict, correct };
    });
    setResults(rs);
    setDeadline(null);
    setPhase('report');
    window.scrollTo(0, 0);
  };
  submitRef.current = submit;

  // the clock: ticks once a second and submits when time is up
  useEffect(() => {
    if (phase !== 'running' || deadline === null) return;
    const id = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) submitRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [phase, deadline]);

  if (phase === 'intro') {
    return (
      <div class="test-intro" data-phase="intro">
        <p class="p-lede">{t.intro(objectives.length)}</p>
        <div class="test-options">
          <label>
            <input type="checkbox" checked={timed} onChange={(e) => setTimed((e.target as HTMLInputElement).checked)} />
            {t.timed}
          </label>
          {timed && (
            <label>
              {t.minutes}
              <input
                type="number"
                min={5}
                max={180}
                value={minutes}
                onInput={(e) => setMinutes(Math.min(180, Math.max(5, Number((e.target as HTMLInputElement).value) || DEFAULT_MINUTES)))}
              />
            </label>
          )}
          <p class="p-note">{t.clockNote}</p>
        </div>
        <div class="p-links">
          <button type="button" class="btn primary" onClick={() => start()}>
            {t.start}
          </button>
          <a class="btn" href={practiceHref}>
            {t.practiceFirst}
          </a>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    const answered = questions.filter((q) => {
      const a = toAnswer(drafts[q.id], lang);
      return a !== null && !('error' in a);
    }).length;
    const left = deadline === null ? null : deadline - now;
    return (
      <div class="test-run" data-phase="running">
        <div class="test-bar">
          <span>{t.answered(answered, questions.length)}</span>
          {left !== null && (
            <span class={`test-timer ${left < 60_000 ? 'low' : ''}`} role="timer" aria-label={t.left}>
              <span class="ltr">{mmss(left)}</span>
            </span>
          )}
          <button type="button" class="btn primary" onClick={submit}>
            {t.submit}
          </button>
        </div>
        {questions.map((q, i) => (
          <div key={q.id} class="test-q" data-qid={q.id} data-type={q.type}>
            <div class="test-q-head">
              <span class="q-num">{t.question(i + 1)}</span>
            </div>
            <div class="q-prompt" dangerouslySetInnerHTML={{ __html: q.prompt }} />
            <AnswerArea q={q} lang={lang} draft={drafts[q.id]} setDraft={(d) => setDrafts({ ...drafts, [q.id]: d })} locked={false} verdict={null} />
            {q.confidence && (
              <label class="test-sure">
                <input type="checkbox" checked={sure[q.id] ?? false} onChange={(e) => setSure({ ...sure, [q.id]: (e.target as HTMLInputElement).checked })} />
                {t.sure}
              </label>
            )}
          </div>
        ))}
        <div class="p-links">
          <button type="button" class="btn primary" onClick={submit}>
            {t.submit}
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------------- report */
  const right = results.filter((r) => r.correct).length;
  const pct = results.length ? Math.round((100 * right) / results.length) : 0;
  const attempts = progress.value.attempts;
  const objRows = objectives
    .map((o) => {
      const mine = results.filter((r) => r.q.objectives.includes(o.id));
      return { o, n: mine.length, right: mine.filter((r) => r.correct).length, level: objectiveMastery(attempts, o.id).level };
    })
    .filter((r) => r.n > 0);
  const found = [...new Set(results.flatMap((r) => (!r.correct && r.verdict?.misconception ? [r.verdict.misconception] : [])))];
  const review = [
    ...new Set(
      objRows
        .filter((r) => r.right < r.n)
        .map((r) => lessonOfObjective(r.o.id))
        .filter((l): l is string => !!l && !!lessons[l]),
    ),
  ];

  return (
    <div class="test-report" data-phase="report">
      <div class="test-score" role="status">
        <strong class="ltr" data-testid="score">
          {right}/{results.length}
        </strong>
        <span>{t.score(pct, seed)}</span>
      </div>

      <section>
        <h2>{t.byObjective}</h2>
        <div class="table-scroll">
          <table class="report-table">
            <thead>
              <tr>
                <th scope="col">{t.objective}</th>
                <th scope="col">{t.inTest}</th>
                <th scope="col">{t.overall}</th>
              </tr>
            </thead>
            <tbody>
              {objRows.map((r) => (
                <tr key={r.o.id}>
                  <td>
                    <span class="ltr">{r.o.id}</span> {r.o.text}
                  </td>
                  <td>
                    <span class="ltr">
                      {r.right}/{r.n}
                    </span>
                  </td>
                  <td>
                    <span class={`level ${r.level}`}>{t.level[r.level]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{t.mcFound}</h2>
        {found.length === 0 ? (
          <p>{t.noMc}</p>
        ) : (
          <ul class="report-list">
            {found.map((id) => {
              const m = misconceptions[id];
              return (
                <li key={id}>
                  <strong>{m?.title ?? id}</strong>
                  {m && <p>{m.truth}</p>}
                  {m && (
                    <a href={m.href} class="btn">
                      {m.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>{t.review}</h2>
        {review.length === 0 ? (
          <p>{t.allRight}</p>
        ) : (
          <ul class="report-list">
            {review.map((l) => (
              <li key={l}>
                <a href={lessons[l].href}>{t.lesson(l, lessons[l].title)}</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="report-review">
        <h2>{t.questions}</h2>
        {results.map((r, i) => (
          <details key={r.q.id} data-qid={r.q.id}>
            <summary>
              {t.question(i + 1)}: <span class={`verdict-mark ${r.correct ? 'ok' : 'bad'}`}>{r.correct ? t.right : r.answered ? t.wrong : t.blank}</span>
            </summary>
            <div class="q-prompt" dangerouslySetInnerHTML={{ __html: r.q.prompt }} />
            {r.verdict?.feedback.filter(Boolean).map((f, k) => <p key={k} dangerouslySetInnerHTML={{ __html: f }} />)}
            {!r.correct && r.q.explanation && <div dangerouslySetInnerHTML={{ __html: r.q.explanation }} />}
          </details>
        ))}
      </section>

      <div class="p-links">
        <button type="button" class="btn primary" onClick={() => start(Math.floor(Math.random() * 1_000_000))}>
          {t.again}
        </button>
        <a class="btn" href={practiceHref}>
          {t.toPractice}
        </a>
        <a class="btn" href={meHref}>
          {t.me}
        </a>
      </div>
    </div>
  );
}
