/**
 * Renders a single-card question. The platform's multi-part review problems (BagrutCard, OpenPart)
 * are not part of this pilot: lesson Checks only ask single-card questions.
 */

import type { Question } from '~/content.config';
import type { Lang } from '~/i18n';
import type { AttemptKind } from '~/progress/store';
import QuestionCard from './QuestionCard';

interface Props {
  q: Question;
  lang: Lang;
  lesson?: string | null;
  kind?: AttemptKind;
  label?: string;
}

export default function AnyQuestion({ q, lang, lesson = null, kind = 'check', label }: Props) {
  if (q.type === 'bagrut') throw new Error(`${q.id}: multi-part review problems are not rendered in this pilot`);
  return <QuestionCard q={q} lang={lang} lesson={lesson} kind={kind} label={label} />;
}
