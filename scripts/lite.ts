/**
 * Bring ThermoLab's laboratory notebooks into this site: copy the JupyterLite bundle that ThermoLab's
 * own build produces (_site/lite: the lab app, the thermolab wheel for Pyodide, and every notebook in
 * both languages) into public/lite, where Astro serves it in dev and copies it into dist/ on build.
 *
 *   npm run lite                          # from ../thermolab/_site/lite
 *   THERMOLAB_LITE=<path> npm run lite    # from anywhere else
 *
 * The bundle is ThermoLab's, built by its build_site.py; this site does not rebuild it. It is not
 * committed here (70 MB): run this before `npm run build` wherever the site is published.
 * Without it the lesson's lab card still renders, and its link leads nowhere.
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const source = resolve(process.env.THERMOLAB_LITE ?? join(ROOT, '..', 'thermolab', '_site', 'lite'));
const target = join(ROOT, 'public', 'lite');

if (!existsSync(join(source, 'lab', 'index.html'))) {
  console.error(
    `lite: no JupyterLite bundle at ${source}.\n` +
      '  Build it in ThermoLab first (.\\build.ps1 -NoMedia, or uv run python scripts/build_site.py --no-media),\n' +
      '  or point THERMOLAB_LITE at a built bundle.',
  );
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`lite: copied ${source} -> public/lite`);
