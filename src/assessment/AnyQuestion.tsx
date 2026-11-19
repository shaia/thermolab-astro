/** Renders any question kind: a multi-part review problem or a single-card question. */

import type { Question } from '~/content.config';
import type { Lang } from '~/i18n';
import type { AttemptKind } from '~/progress/store';
import BagrutCard from './BagrutCard';
import QuestionCard from './QuestionCard';

interface Props {
  q: Question;
  lang: Lang;
  lesson?: string | null;
  kind?: AttemptKind;
  label?: string;
}

export default function AnyQuestion({ q, lang, lesson = null, kind = 'check', label }: Props) {
  if (q.type === 'bagrut') return <BagrutCard q={q} lang={lang} lesson={lesson} kind={kind} label={label} />;
  return <QuestionCard q={q} lang={lang} lesson={lesson} kind={kind} label={label} />;
}
