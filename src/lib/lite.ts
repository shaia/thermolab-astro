/**
 * Where the laboratory notebooks live. They are ThermoLab's: its own build makes the JupyterLite
 * bundle (the lab app, the thermolab wheel for Pyodide and every notebook in both languages) and
 * publishes it with the ThermoLab site. This site links to that bundle, in order of preference:
 *
 *   1. PUBLIC_LITE_URL, when the build sets it (a mirror, or a bundle served elsewhere);
 *   2. this site's own copy, public/lite, when `npm run lite` has put one there (offline work);
 *   3. the bundle ThermoLab publishes, so a fresh clone and CI get working links with no copy.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { url } from './url';

/** The JupyterLite bundle ThermoLab publishes with its site. */
export const PUBLISHED_LITE = 'https://slow-is-smooth.io/thermolab/lite/';

const local = existsSync(join(process.cwd(), 'public', 'lite', 'lab', 'index.html'));

/** The bundle's root, ending in a slash. */
export function liteRoot(): string {
  const configured = import.meta.env.PUBLIC_LITE_URL as string | undefined;
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`;
  return local ? url('lite/') : PUBLISHED_LITE;
}

/** The lab app opened on one notebook, e.g. labHref('en', '04-pressure'). */
export const labHref = (lang: string, notebook: string) => `${liteRoot()}lab/index.html?path=${lang}/labs/${notebook}.ipynb`;
