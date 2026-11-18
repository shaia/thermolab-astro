import type { Lang } from '~/i18n';

/** Site-relative link that respects the GitHub Pages base path ('/' locally, '/<repo>/' in CI). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
}

/** A link inside one language's half of the site: langUrl('he', 'lessons/4-1/') → '/he/lessons/4-1/'. */
export const langUrl = (lang: Lang, path = '') => url(`${lang}/${path.replace(/^\//, '')}`);
