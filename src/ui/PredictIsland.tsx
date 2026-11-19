import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ui, type Lang } from '~/i18n';
import { progress, recordPrediction } from '~/progress/store';
import '~/assessment/question.css';
import './flap.css';
import { useMounted } from './useMounted';

interface Props {
  id: string;
  lang: Lang;
  prompt: string;
  choices: string[];
  children?: ComponentChildren;
}

/** The "lift the flap" prediction: choose, commit, and only then see what is under the flap. */
export default function PredictIsland({ id, lang, prompt, choices, children }: Props) {
  const s = ui(lang).predict;
  const mounted = useMounted();
  const saved = mounted ? progress.value.predictions[id] : undefined;
  const [pick, setPick] = useState<number | null>(null);
  const committed = !!saved;
  // a prediction committed in another tab, or restored by import, opens the flap here too
  useEffect(() => {
    if (saved) setPick(Number(saved.choice));
  }, [saved?.choice]);

  return (
    <div class={`predict ${committed ? 'is-open' : ''}`} data-predict-id={id}>
      <div class="predict-prompt" dangerouslySetInnerHTML={{ __html: prompt }} />
      <fieldset class="q-choices predict-choices">
        <legend class="sr-only">{s.legend}</legend>
        {choices.map((c, i) => (
          <label key={i} class={`q-choice ${pick === i ? 'on' : ''}`}>
            <input type="radio" name={`predict-${id}`} checked={pick === i} disabled={committed} onChange={() => setPick(i)} />
            <span dangerouslySetInnerHTML={{ __html: c }} />
          </label>
        ))}
      </fieldset>
      {!committed && (
        <div class="predict-actions">
          <button type="button" class="btn primary" disabled={pick === null} onClick={() => pick !== null && recordPrediction(id, String(pick))}>
            {s.commit}
          </button>
          <span class="hand predict-why">{s.why}</span>
        </div>
      )}
      <div class="flap" aria-hidden={!committed}>
        <div class="flap-cover" aria-hidden="true">
          <span class="hand">{s.cover}</span>
        </div>
        <div class="flap-inner" inert={!committed}>
          {committed && pick !== null && (
            <p class="hand flap-yours">
              {s.yours} <span dangerouslySetInnerHTML={{ __html: choices[pick] }} />
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
