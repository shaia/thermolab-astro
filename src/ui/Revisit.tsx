import { useEffect, useState } from 'preact/hooks';
import { ui, type Lang } from '~/i18n';
import { progress } from '~/progress/store';

interface PredictData {
  choices: string[];
  answer: number;
}

/** A choice is quoted mid-paragraph: close it with a period unless it already ends a sentence. */
const endSentence = (html: string) => (/[.?!]\s*$/.test(html) ? html : `${html}.`);

/**
 * "Your prediction vs what you found": closes the loop the lesson's <Predict> opened.
 * Reads the choices from the JSON the matching <Predict> left on the page.
 */
export default function Revisit({ id, lang }: { id: string; lang: Lang }) {
  const s = ui(lang).revisit;
  const [data, setData] = useState<PredictData | null>(null);
  useEffect(() => {
    const el = document.querySelector(`script[data-predict="${CSS.escape(id)}"]`);
    if (el?.textContent) setData(JSON.parse(el.textContent) as PredictData);
  }, [id]);
  // never render nothing: client:visible observes the island's children, so an empty island
  // would never hydrate. This empty box is what the server sends and what it observes.
  if (!data) return <div class="revisit" aria-hidden="true" />;
  const saved = progress.value.predictions[id];
  if (!saved) return <p class="revisit hand">{s.none}</p>;
  const mine = Number(saved.choice);
  const right = mine === data.answer;
  return (
    <div class={`revisit ${right ? 'right' : 'wrong'}`}>
      <p class="hand">
        {s.yours} <span dangerouslySetInnerHTML={{ __html: data.choices[mine] ?? '' }} />
      </p>
      {right ? (
        <p>{s.right}</p>
      ) : (
        <p>
          {s.found} <span dangerouslySetInnerHTML={{ __html: endSentence(data.choices[data.answer]) }} /> {s.wrongNote}
        </p>
      )}
    </div>
  );
}
