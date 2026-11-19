/**
 * "My path": the learner's own page. Everything here is read from the progress record in this
 * browser: the mastery map (module, lesson, objective), the misconceptions that keep coming back
 * with their remedies, the stamp passport, one suggestion for what to do next, and export / import
 * of the whole record. Progress is per lesson, shared by both languages.
 */

import { useRef, useState } from 'preact/hooks';
import { locale, ui, type Lang } from '~/i18n';
import { misconceptionStatus, objectiveMastery, type Level } from '~/progress/mastery';
import { nextStep } from '~/progress/next';
import { exportProgress, importProgress, persistent, progress } from '~/progress/store';
import { useMounted } from './useMounted';
import './stamp.css';

export interface MyPathChapter {
  n: number;
  title: string;
  lessons: { id: string; title: string; href: string; objectives: { id: string; text: string }[] }[];
}

interface Props {
  lang: Lang;
  chapters: MyPathChapter[];
  misconceptions: Record<string, { title: string; truth: string; href: string; label: string }>;
  /** practice and test pages that exist, per module number */
  practice: { n: number; title: string; practiceHref: string; testHref: string }[];
}

const TEXT = {
  en: {
    level: { none: '○ not started', learning: '◐ learning', mastered: '● mastered' } satisfies Record<Level, string>,
    downloaded: 'The file is downloaded. Keep it somewhere safe.',
    merged: (n: number) => `The progress in the file was merged into yours. ${n} attempts were added.`,
    next: 'What next',
    start: 'Start',
    continue: 'Continue',
    loading: 'Loading your progress…',
    practice: (n: string) => `Practice · module ${n}`,
    test: (n: string) => `Module ${n} test`,
    map: 'Mastery map',
    mapLede: (total: number) => `Mastery of an objective is built from several correct answers, without hints, on different days. Of ${total} objectives you have mastered`,
    module: (n: string) => `Module ${n}`,
    mc: 'Misconceptions that keep coming back',
    loadingShort: 'Loading…',
    noMc: 'No misconception is active right now. One becomes active after two wrong answers that reveal it, and closes after two correct answers to questions that test it.',
    passport: 'Stamp passport',
    passportLede: (done: number, total: number) => `You get a stamp at the end of a lesson, by pressing “I finished”. You have finished ${done} of ${total}.`,
    notYet: (id: string) => `Lesson ${id} not finished yet`,
    save: 'Saving and moving',
    saveNote: 'Your progress is saved only in this browser, on this computer or phone. There is no account and no server. If you clear the site’s data, change device or open a private window, it will not be there. To keep it, export a file now and then.',
    blocked: 'This browser blocks saving, so your progress lasts only until you close the tab.',
    export: 'Export progress to a file',
    import: 'Import from a file',
    importNote: 'Importing merges the file with what is saved here. Nothing is deleted, and attempts already here are not counted twice.',
  },
  he: {
    level: { none: '○ עוד לא התחלתם', learning: '◐ בלמידה', mastered: '● שליטה' } satisfies Record<Level, string>,
    downloaded: 'הקובץ הורד. שמרו אותו במקום בטוח.',
    merged: (n: number) => `ההתקדמות מהקובץ מוזגה לשלכם. נוספו ${n} ניסיונות.`,
    next: 'מה הלאה',
    start: 'מתחילים',
    continue: 'ממשיכים',
    loading: 'טוענים את ההתקדמות שלכם…',
    practice: (n: string) => `דף תרגול · מודול ${n}`,
    test: (n: string) => `מבחן מודול ${n}`,
    map: 'מפת השליטה',
    mapLede: (total: number) => `שליטה במטרה נבנית מכמה תשובות נכונות, בלי רמזים, ובימים שונים. מתוך ${total} מטרות, שלטתם עד עכשיו ב-`,
    module: (n: string) => `מודול ${n}`,
    mc: 'טעויות מושגיות שחוזרות',
    loadingShort: 'טוענים…',
    noMc: 'אין כרגע טעות מושגית פעילה. טעות נחשבת פעילה אחרי שתי תשובות שגויות שחושפות אותה, ונסגרת אחרי שתי תשובות נכונות על שאלות שבודקות אותה.',
    passport: 'דרכון החותמות',
    passportLede: (done: number, total: number) => `חותמת מקבלים בסוף שיעור, בלחיצה על „סיימתי את השיעור”. סיימתם ${done} מתוך ${total}.`,
    notYet: (id: string) => `שיעור ${id} עוד לא הושלם`,
    save: 'שמירה והעברה',
    saveNote: 'ההתקדמות נשמרת רק בדפדפן הזה, במחשב או בטלפון הזה. אין חשבון ואין שרת. אם תנקו את נתוני האתר, תעברו מכשיר או תפתחו חלון גלישה פרטית, היא לא תהיה שם. כדי לא לאבד אותה, ייצאו קובץ מדי פעם.',
    blocked: 'הדפדפן הזה חוסם שמירה, ולכן ההתקדמות תישמר רק עד שתסגרו את הלשונית.',
    export: 'ייצוא ההתקדמות לקובץ',
    import: 'ייבוא מקובץ',
    importNote: 'ייבוא ממזג את הקובץ עם מה ששמור כאן. שום דבר לא נמחק, וניסיונות שכבר קיימים לא נספרים פעמיים.',
  },
} satisfies Record<Lang, unknown>;

const pad = (n: number) => String(n).padStart(2, '0');

export default function MyPath({ lang, chapters, misconceptions, practice }: Props) {
  const t = TEXT[lang];
  const end = ui(lang).end;
  const mounted = useMounted();
  const state = mounted ? progress.value : null;
  const attempts = state?.attempts ?? [];
  const lessons = chapters.flatMap((c) => c.lessons);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = misconceptionStatus(attempts).filter((m) => m.active);
  const objectives = lessons.flatMap((l) => l.objectives);
  const masteredCount = objectives.filter((o) => objectiveMastery(attempts, o.id).level === 'mastered').length;
  const completed = lessons.filter((l) => state?.lessons[l.id]?.completed);

  const first = practice[0];
  const next =
    state && first
      ? nextStep({
          lessons: lessons.map((l) => ({ ...l, objectives: l.objectives.map((o) => o.id) })),
          state,
          remedies: misconceptions,
          practiceHref: first.practiceHref,
          testHref: first.testHref,
          lang,
        })
      : null;

  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `thermolab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMessage({ ok: true, text: t.downloaded });
  };

  const upload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const before = progress.value.attempts.length;
    const res = importProgress(await file.text(), lang);
    input.value = '';
    if (res.ok) setMessage({ ok: true, text: t.merged(progress.value.attempts.length - before) });
    else setMessage({ ok: false, text: res.error });
  };

  return (
    <div class="me-grid" data-ready={mounted ? '1' : '0'}>
      <section aria-labelledby="me-next">
        <h2 id="me-next">{t.next}</h2>
        {next ? (
          <div class="next-step" data-kind={next.kind}>
            <p>
              <strong>{next.label}</strong>
            </p>
            <p>{next.reason}</p>
            <p>
              <a class="btn primary" href={next.href}>
                {next.kind === 'continue' || next.kind === 'remedy' ? t.continue : t.start}
              </a>
            </p>
          </div>
        ) : (
          <p>{t.loading}</p>
        )}
        {practice.length > 0 && (
          <p class="p-links">
            {practice.map((c) => (
              <span key={c.n} class="p-links">
                <a class="btn" href={c.practiceHref}>
                  {t.practice(pad(c.n))}
                </a>
                <a class="btn" href={c.testHref}>
                  {t.test(pad(c.n))}
                </a>
              </span>
            ))}
          </p>
        )}
      </section>

      <section aria-labelledby="me-map">
        <h2 id="me-map">{t.map}</h2>
        <p class="p-lede">
          {t.mapLede(objectives.length)}
          <span class="ltr" data-testid="mastered-count">
            {lang === 'en' ? ' ' : ''}
            {masteredCount}
          </span>
          .
        </p>
        {chapters.map((c) => (
          <div key={c.n} class="mastery-chapter">
            <h3>
              {t.module(pad(c.n))}: {c.title}
            </h3>
            {c.lessons.map((l) => (
              <div key={l.id} class="mastery-lesson" data-lesson={l.id}>
                <h4>
                  <span class="ltr">{l.id}</span>
                  <a href={l.href}>{l.title}</a>
                </h4>
                <ul>
                  {l.objectives.map((o) => {
                    const m = objectiveMastery(attempts, o.id);
                    return (
                      <li key={o.id} data-objective={o.id} data-level={m.level}>
                        <span>{o.text}</span>
                        <span class={`level ${m.level}`}>{t.level[m.level]}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section aria-labelledby="me-mc">
        <h2 id="me-mc">{t.mc}</h2>
        {!mounted ? (
          <p>{t.loadingShort}</p>
        ) : active.length === 0 ? (
          <p data-testid="no-misconceptions">{t.noMc}</p>
        ) : (
          <ul class="report-list" data-testid="misconceptions">
            {active.map((a) => {
              const m = misconceptions[a.id];
              return (
                <li key={a.id} data-misconception={a.id}>
                  <strong>{m?.title ?? a.id}</strong>
                  {m && <p>{m.truth}</p>}
                  {m && (
                    <a class="btn" href={m.href}>
                      {m.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="me-pass">
        <h2 id="me-pass">{t.passport}</h2>
        <p class="p-lede">{t.passportLede(completed.length, lessons.length)}</p>
        <div class="passport">
          {lessons.map((l) => {
            const done = state?.lessons[l.id]?.completed;
            const date = done ? new Date(done).toLocaleDateString(locale(lang), { day: 'numeric', month: 'long' }) : '';
            return (
              <div key={l.id} class="passport-slot" data-lesson={l.id} data-done={done ? '1' : '0'}>
                {done ? (
                  <div class="stamp" role="img" aria-label={end.stamp(l.id, date)}>
                    <span class="stamp-top">{end.done}</span>
                    <span class="stamp-id ltr">{l.id}</span>
                    <span class="stamp-date">{date}</span>
                  </div>
                ) : (
                  <div class="passport-empty" role="img" aria-label={t.notYet(l.id)}>
                    <span class="ltr">{l.id}</span>
                  </div>
                )}
                <a href={l.href}>{l.title}</a>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="me-save">
        <h2 id="me-save">{t.save}</h2>
        <p class="local-note" role="note">
          {t.saveNote}
          {mounted && !persistent.value && (
            <>
              {' '}
              <strong>{t.blocked}</strong>
            </>
          )}
        </p>
        <div class="io-row">
          <button type="button" class="btn primary" onClick={download}>
            {t.export}
          </button>
          <label class="btn">
            {t.import}
            <input ref={fileRef} type="file" accept=".json,application/json" class="sr-only" onChange={upload} />
          </label>
        </div>
        <p class="p-note">{t.importNote}</p>
        {message && (
          <p class={`io-msg ${message.ok ? 'ok' : 'bad'}`} role="status">
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
