import { ui, type Lang } from '~/i18n';
import { settings, updateSettings, type Settings as S } from '~/progress/settings';
import './Settings.css';
import { useMounted } from './useMounted';

const themeNext: Record<S['theme'], S['theme']> = { auto: 'light', light: 'dark', dark: 'auto' };
const themeIcon: Record<S['theme'], string> = { auto: '◐', light: '☀', dark: '☾' };

/** Still mode and theme: the two reader settings every page honours. */
export default function Settings({ lang }: { lang: Lang }) {
  const t = ui(lang).settings;
  const mounted = useMounted();
  // the server cannot know the reader's settings: render the defaults until hydrated
  const s: S = mounted ? settings.value : { still: false, theme: 'auto' };
  return (
    <div class="settings">
      <button
        type="button"
        class="btn ghost icon"
        aria-pressed={s.still}
        title={s.still ? t.stillOn : t.stillOff}
        onClick={() => updateSettings({ still: !s.still })}
      >
        <span aria-hidden="true">{s.still ? '❚❚' : '≋'}</span>
        <span class="label">{s.still ? t.stillLabel : t.motionLabel}</span>
      </button>
      <button
        type="button"
        class="btn ghost icon"
        title={t.theme[s.theme]}
        aria-label={t.theme[s.theme]}
        onClick={() => updateSettings({ theme: themeNext[s.theme] })}
      >
        <span aria-hidden="true">{themeIcon[s.theme]}</span>
      </button>
    </div>
  );
}
