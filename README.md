# ThermoLab on the living-book platform: pilot

A pilot of moving [ThermoLab](../thermolab) (thermodynamics and statistical mechanics, English and
Hebrew, built with MyST) onto the Astro "living book" platform of the newer courses. It is a fork of
unimech at `35e18fb`, carrying two modules rewritten for the platform in both languages, with live
figures in place of the rendered videos:

- **04: the microscopic origin of pressure**, the first pilot: the smallest module, chosen to build the
  bilingual platform on.
- **15: phase transitions and the Ising model**, the second: three times larger, with Monte Carlo live
  figures, chosen to measure what a hard module costs. See [the second pilot](#the-second-pilot-module-15).

The question it answered is what a full migration would cost; see [what the pilot measured](#what-the-pilot-measured).
After the two pilots the full migration was decided (November 2026). Modules are ported one PR at a
time, in course order, by the process in [docs/porting-a-module.md](docs/porting-a-module.md).
What the ports find wrong in ThermoLab is collected in [docs/thermolab-errata.md](docs/thermolab-errata.md).

## Migration

| Module | Lesson | Status |
|---|---|---|
| 00 Orientation: how many makes a law | 0.1 | done |
| 01 Thermal equilibrium | 1.1 | in progress |
| 02 Equations of state | 2.1 | |
| 03 Probability and emergence | 3.1 | |
| 04 Pressure | 4.1 | done (pilot, #1, #3) |
| 05 Work and thermodynamic paths | 5.1 | |
| 06 Thermodynamic processes | 6.1 | |
| 07 The second law and heat engines | 7.1 | |
| 08 Entropy and multiplicity | 8.1 | |
| 09 The fundamental relation | 9.1 | |
| 10 Thermodynamic potentials | 10.1 | |
| 11 Statistical ensembles | 11.1 | |
| 12 Partition functions | 12.1 | |
| 13 Chemical potential | 13.1 | |
| 14 Phase coexistence | 14.1 | |
| 15 Phase transitions and the Ising model | 15.1 | done (pilot, #4) |
| 16 Thermal radiation and the heat capacity of solids | 16.1 | |
| 17 Quantum gases | 17.1 | |
| 18 Fluctuations and transport | 18.1 | |

Module 00 also carries ThermoLab's mathematics refresher and conventions page, as the later
spreads of lesson 0.1, so later modules can link to them.

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
- **Corrections to the original.** ThermoLab's module 04 said the relative pressure fluctuation of a
  mole is about 4·10⁻¹³; N^(-1/2) for 6.02·10²³ is 1.3·10⁻¹² (fixed in ThermoLab, PR #23). An
  independent physics review of the pilot then found that the lesson, following ThermoLab, explained
  a steady gauge by the N^(-1/2) spread between gases. A gauge is steady because it averages an
  astronomical number of impacts, which is a different count, and its jitter does depend on the
  temperature and the mass. The lesson now separates the two. ThermoLab's module 04 still conflates
  them.

## The second pilot: module 15

Module 15 is ThermoLab's Ising module: 8,972 words of English against module 04's 2,709, three videos
and a finite-size plot, a Python Monte Carlo library, and seven objectives. It is lesson 15.1 here.

**What was built**, per language unless noted, with module 04 for comparison:

| | Module 04 | Module 15 |
|---|---|---|
| Lesson (spreads, steps, six worked examples) | 419 lines | 575 lines, 25 steps over 3 spreads |
| Physics port + tests (once) | 263 + 140 | 554 + 422 ([src/physics/ising.ts](src/physics/ising.ts)) |
| Live figures (once) | 2 figures, 571 lines | 3 figures, 1,227 lines, plus a worker and helpers (185) |
| Question bank | 12 questions, 309 lines | 28 questions, 724 lines |
| Review problems | 4, 416 lines | 6, 694 lines |
| Workbook | 296 lines | 431 lines |
| Glossary terms / misconceptions | 10 / 5 | 27 / 7 |

In all, the branch adds about 7,900 lines in 30 files.

**The figures.** [IsingLattice](src/sims/IsingLattice.tsx) runs a live lattice of up to 128×128 spins
(Metropolis or Glauber, temperature and field adjustable while it runs). [IsingSweep](src/sims/IsingSweep.tsx)
cools lattices of side 8 to 64 through 41 temperatures in four Web Workers, about 8 s on a laptop, and
plots ⟨|m|⟩ against Onsager and Yang, the susceptibility, the heat capacity and the autocorrelation time.
[IsingHysteresis](src/sims/IsingHysteresis.tsx) sweeps the field around a loop. The physics runs at
about 100 million spin updates a second in Node.

**What it measured.**

- **A Monte Carlo module costs about 2.5 times module 04 in code, and 1.7 times in content.** The physics,
  its tests and the figures, done once per module, grew from about 970 lines to about 2,430. The content
  (lesson, banks, workbook, summary), written twice, grew from about 1,500 lines per language to about
  2,500, for a source three times as long: the lesson condenses, the problems do not.
- **The platform's standards cost content again.** Seven objectives need at least 21 questions; ThermoLab
  had 10, so 18 were written, in both languages. That accounts for most of the question-bank growth.
- **Time.** About an hour and a half of wall-clock time, from branch to reviewed content, with up to four
  agents working in parallel (figures, question banks, workbook, translations); about 2.4 million agent
  tokens, a third of them in the two reviews and their fixes. Module 04 took far longer, but it also
  built the bilingual platform.
- **The reviews are not optional.** As with module 04, an independent physics review and a Hebrew review
  each found real errors in content that had passed every automated check. The physics review found
  three, and the Hebrew review six places where the Hebrew said something else than the English.
- **The port is a check on the original.** Running ThermoLab's own claims against two implementations
  (its Python library and the TypeScript port) found these errors in ThermoLab's module 15, all fixed here
  and not yet in ThermoLab:
  - the hysteresis loop areas, quoted as 2.20, 1.48 and 1.18, are 1.82, 1.33 and 1.08 (64 seeds; the
    Python library agrees);
  - quiz question Q-15-6 uses a variance, 0.0049 at 2.5 J, that no run produces (it is about 0.060);
  - a 16×16 lattice at 2.0 J does sometimes reverse in 10⁵ sweeps; the autocorrelation time at T_c for
    L = 16 is 10.5 sweeps, not 9.6; the extrapolated T_c from the quoted peaks is 2.268, not 2.272;
  - a bulk magnet cooled in zero field breaks into domains, so it is not magnetized as the hook said;
    the Peierls argument, made rigorous, does prove that the square lattice orders;
  - worked example 3's sixth iterate is 0.762, not 0.763.
- **And on the platform.** The seeded generator the platform inherited from unimech, mulberry32, biased the
  Ising chain's energy by six standard errors over 48 seeds. Every figure now uses sfc32.
