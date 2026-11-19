# ThermoLab on the living-book platform: pilot

A pilot of moving [ThermoLab](../thermolab) (thermodynamics and statistical mechanics, English and
Hebrew, built with MyST) onto the Astro "living book" platform of the newer courses. It is a fork of
unimech at `35e18fb`, carrying one module, **04: the microscopic origin of pressure**, rewritten for the
platform in both languages, with live figures in place of the rendered videos.

The question it answers is what a full migration would cost; see [what the pilot measured](#what-the-pilot-measured).

## Run it

```sh
npm ci
npm run dev                 # http://localhost:4361/en/  and  /he/
npm run build && npm run preview
npm test                    # physics and unit tests (vitest)
npm run lint:content        # content rules and English/Hebrew parity
npx astro check
npx playwright test         # end to end, desktop and phone, both languages
```

## What changed from unimech

**Two languages.** unimech is Hebrew only: `dir="rtl"` was set once and interface text was written
into about 45 components. Here:

- Each language is a path prefix, `/en/…` and `/he/…`. The root page sends a reader to the
  language their browser prefers. The header links every page to its translation.
- `<html lang dir>` follows the language. Server components read it from the URL (`langOf` in
  [src/i18n.ts](src/i18n.ts)); islands get it as a prop from their `.astro` wrapper.
- All of the platform's own words are in one table, [src/i18n.ts](src/i18n.ts). Figure-specific
  words sit in a table at the top of each figure.
- Places where the platform drew a direction, not just laid one out, now follow the page:
  - the capsule arrows;
  - the step mark ◂ / ▸;
  - the shading of the spread's figure page;
  - the centring of term cards;
  - the axis titles drawn on canvases.

**Content per language.** Lessons live in `src/content/lessons/<lang>/ch<N>/` and question banks in
`src/content/questions/<lang>/ch<N>/`. Each language is a complete file. Glossary entries hold both
languages side by side. The course map, [src/course.ts](src/course.ts), lists all nineteen modules
with titles and objectives in both. A module is a chapter, so module 04 is lesson `4.1`.

**Parity, enforced.** ThermoLab's `check_parity.py` required identical equations across languages.
[scripts/lint-content.ts](scripts/lint-content.ts) does the same for lessons and question banks.

- Both versions of a lesson must share:
  - objectives, figures and figure settings;
  - every step and the state it sets;
  - every display formula and formula card;
  - the prediction's answer;
  - the questions asked, the worked examples and the glossary terms.
- Both banks must hold the same questions with the same answer keys.
- The end-to-end suite also checks that the two rendered pages match part for part.

**The physics, in TypeScript.** [src/physics/kinetics.ts](src/physics/kinetics.ts) ports
`thermolab.kinetics`. [tests/physics/kinetics.test.ts](tests/physics/kinetics.test.ts) holds to the
claims the lesson makes:

- the equation of state across eight seeds;
- energy conserved to machine precision;
- equipartition;
- the cancelling mass;
- independence from the time step;
- the N^(-1/2) law with its fitted exponent.

**Two live figures** replace module 04's two MP4s:

- [GasBox](src/sims/GasBox.tsx): the gas in a box beside the pressure gauge, both short-window and
  running average. You set N, T, the box and the particle mass. It keeps the previous run's reading
  for comparison.
- [PressureSpread](src/sims/PressureSpread.tsx): the pressures of 300 freshly drawn gases, and their
  relative spread against N on log–log axes.

**Around the lesson,** in both languages:

- Practice page, module test, "my path", formula sheet, glossary and the module 04 summary. Each
  page keeps its own words in a two-language table at its top.
- A misconception register (five entries, ThermoLab's ids where it had one). Wrong answers name the
  belief behind them, and "my path" links each active one to the step that refutes it.
- **Laboratory.** The lesson links to ThermoLab's own notebook in JupyterLite, in the page's
  language. The link goes to the bundle ThermoLab publishes with its site. `npm run lite` copies a
  local bundle into `public/lite/` (70 MB, not committed) for offline work, and `PUBLIC_LITE_URL`
  overrides both. See [src/lib/lite.ts](src/lib/lite.ts).
- **Search** with Pagefind, run after `astro build`, one index per language. Hebrew gets no
  stemming: a bare word and its prefixed forms (לחץ, הלחץ) return overlapping but different results.
- A **print / save as PDF** button. A spread prints as its text followed by its figure.

**Problems, with published solutions** (the author's decision; ThermoLab kept its solutions with the instructor):

- Four review problems from ThermoLab's problems 2 to 5, each worth 25 points. Each has auto-graded parts, plus open parts with a model solution and a rubric the student ticks.
- A workbook: ten practice problems with final answers and full solutions. Two of them are ThermoLab's problems 1 and 6(c).
- Two challenge problems adapted from MIT 8.044 (Statistical Physics I, OpenCourseWare 2013), problem set 3 problem 2 and problem set 7 problem 1. Both sources were opened and read.

## Still left out

- **Videos.** ThermoLab has none, so there is nothing to port.

## What the pilot measured

- **Math survives.** [scripts/katex-audit.ts](scripts/katex-audit.ts) renders every formula of the
  current ThermoLab site with this platform's strict KaTeX settings, carrying over the three macros
  from `myst.yml`. That is 8,421 formulas per language, and none fails. Converting the math needs no
  hand-fixing.
- **Bilingual platform: done once.** This is the only change that is not per module. It touched
  about 30 files and added a 280-line string table.
- **Per module, option B:**
  - the lesson rewritten as spreads and steps: 180 lines of MDX per language;
  - the physics ported and tested: 240 + 125 lines;
  - two figures: 350 + 180 lines;
  - 12 questions per language: 290 lines each;
  - 10 glossary terms.
  The figures and the physics are the bulk, and they vary with the module.
- **The platform's standards cost content.** unimech requires at least three questions per
  objective. Module 04 had six questions for five objectives, so the pilot wrote six more, in both
  languages.
- **One correction to the original.** ThermoLab's module 04 says the relative pressure fluctuation of
  a mole is about 4·10⁻¹³. N^(-1/2) for 6.02·10²³ is 1.3·10⁻¹². The pilot uses the corrected value.
