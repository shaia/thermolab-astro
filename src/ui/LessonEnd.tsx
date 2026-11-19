import { locale, ui, type Lang } from '~/i18n';
import { markLesson, progress } from '~/progress/store';
import { useMounted } from './useMounted';
import './stamp.css';

/** "I finished this lesson": a rubber stamp in the book. Progress is per lesson, shared by both languages. */
export default function LessonEnd({ id, title, lang }: { id: string; title: string; lang: Lang }) {
  const s = ui(lang).end;
  const mounted = useMounted();
  const done = mounted ? progress.value.lessons[id]?.completed : undefined;
  if (done) {
    const date = new Date(done).toLocaleDateString(locale(lang), { day: 'numeric', month: 'long' });
    return (
      <div class="lesson-end">
        <div class="stamp" role="img" aria-label={s.stamp(id, date)}>
          <span class="stamp-top">{s.done}</span>
          <span class="stamp-id ltr">{id}</span>
          <span class="stamp-date">{date}</span>
        </div>
        <p class="hand">{s.saved}</p>
      </div>
    );
  }
  return (
    <div class="lesson-end">
      <button type="button" class="btn primary" onClick={() => markLesson(id, 'completed')}>
        {s.finish(title)}
      </button>
    </div>
  );
}
