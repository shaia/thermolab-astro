/**
 * Site search, over the static index Pagefind writes into dist/pagefind after the build
 * (`npm run build`). Pagefind keeps one index per page language (from <html lang>), so a search on
 * the Hebrew site finds Hebrew pages and the English site English ones. The index exists only in a
 * built site: under `astro dev` the page says so instead of failing.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';

interface Hit {
  url: string;
  title: string;
  excerpt: string;
}
interface Pagefind {
  init: () => Promise<void>;
  debouncedSearch: (q: string) => Promise<{ results: { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }> }[] } | null>;
}

const TEXT = {
  en: {
    label: 'Search the course',
    placeholder: 'pressure, equipartition, N^(-1/2)…',
    none: (q: string) => `Nothing found for “${q}”.`,
    count: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    missing: 'Search works on the built site: run npm run build, then npm run preview.',
  },
  he: {
    label: 'חיפוש בקורס',
    placeholder: 'לחץ, חלוקת האנרגיה השווה, פלוקטואציה…',
    none: (q: string) => `לא נמצא דבר עבור „${q}”.`,
    count: (n: number) => (n === 1 ? 'תוצאה אחת' : `${n} תוצאות`),
    missing: 'החיפוש עובד באתר הבנוי: הריצו npm run build ואחר כך npm run preview.',
  },
} satisfies Record<Lang, unknown>;

export default function Search({ lang, bundle }: { lang: Lang; bundle: string }) {
  const t = TEXT[lang];
  const pf = useRef<Pagefind | null>(null);
  const [ready, setReady] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const mod = (await import(/* @vite-ignore */ bundle)) as Pagefind;
        await mod.init();
        pf.current = mod;
        setReady('ok');
        const q = new URLSearchParams(location.search).get('q');
        if (q) run(q);
      } catch {
        setReady('missing');
      }
    })();
  }, []);

  const run = async (q: string) => {
    setQuery(q);
    if (!pf.current || q.trim() === '') return setHits(null);
    const res = await pf.current.debouncedSearch(q);
    if (!res) return; // superseded by a newer keystroke
    const data = await Promise.all(res.results.slice(0, 20).map((r) => r.data()));
    setHits(data.map((d) => ({ url: d.url, title: d.meta.title ?? d.url, excerpt: d.excerpt })));
  };

  return (
    <div class="search">
      <label class="sr-only" for="q">
        {t.label}
      </label>
      <input
        id="q"
        type="search"
        class="search-input"
        placeholder={t.placeholder}
        value={query}
        disabled={ready !== 'ok'}
        onInput={(e) => run((e.target as HTMLInputElement).value)}
        autoFocus
      />
      {ready === 'missing' && <p class="p-note">{t.missing}</p>}
      {hits && (
        <>
          <p class="p-note" role="status">
            {hits.length ? t.count(hits.length) : t.none(query)}
          </p>
          <ol class="search-results">
            {hits.map((h) => (
              <li key={h.url}>
                <a href={h.url}>{h.title}</a>
                <p dangerouslySetInnerHTML={{ __html: h.excerpt }} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
