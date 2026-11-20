# Porting a ThermoLab module

How one ThermoLab module becomes one lesson on this platform, in English and Hebrew. Modules 04 and
15 were ported this way; follow them. Module 15 is the fuller example
([src/content/lessons/en/ch15/15-1-ising.mdx](../src/content/lessons/en/ch15/15-1-ising.mdx) and
everything listed under "Files" below).

The content linter (`npm run lint:content`, [scripts/lint-content.ts](../scripts/lint-content.ts))
enforces the structural rules. This document covers what it cannot check: where the material comes
from, how numbers are verified, the two reviews, and the order of work.

## The source

ThermoLab lives in the sibling repo `../thermolab` (`C:\development\courses\thermolab`). For module
`NN-name`:

| What | Where in ThermoLab |
|---|---|
| Lesson text, objectives (frontmatter) | `content/en/<part>/NN-name.md`, `content/he/<part>/NN-name.md` |
| Problems (become review problems and workbook) | `content/<lang>/<part>/NN-name-problems.md` |
| Quiz (seeds the question bank) | `assessment/quizzes/NN-name.<lang>.yml` |
| Misconceptions (ids to keep) | `assessment/misconceptions.yml`, `assigned_module: NN-name` |
| Physics library (port to TypeScript) | `src/thermolab/<module>.py`, its tests in `tests/` |
| Videos and plots (become live figures) | `content/en/media/*`, referenced from the lesson |
| Notebook (linked, not ported) | `notebooks/en/NN-name.ipynb`, `notebooks/he/…`; `<Lab notebook="NN-name" />` |
| Hebrew terminology | `glossary/terms.yml` |
| Course conventions | `content/en/conventions.md` |

Run ThermoLab's Python with its venv: `C:\development\courses\thermolab\.venv\Scripts\python.exe`,
with `PYTHONPATH=C:\development\courses\thermolab\src` and `PYTHONIOENCODING=utf-8`.

## Mapping

- **Module NN is chapter NN, lesson NN.1**, one lesson per module. Objectives become
  `OBJ-NN.1-k`, in the same order and wording as ThermoLab's (adapt only where the port corrects
  them). They are written in [src/course.ts](../src/course.ts) and in both lessons' frontmatter,
  identically.
- **The lesson** is rewritten as spreads and steps, not transcribed: Hook, Predict, Explore,
  Explain, Example (exactly six worked examples, each with a limit check), Check, Summary. Each
  ThermoLab section becomes one or more `<Step>`s that set the figure's state. Keep ThermoLab's
  physics, its arguments and its honesty labels; cut repetition. Module 15 condensed 9,000 words
  into 575 lines.
- **Videos and plots become live figures** (Preact islands in `src/sims/`), computed in the
  browser from the ported physics. A figure takes `figureProps` and a `tasks` list; steps drive
  it with `set={{…}}`. A static plot may stay a computed plot rather than an animation, but it is
  drawn from the port, not shipped as an image. Reuse `src/sims/core/` (SimShell, plot, canvas,
  ink, format) and the existing figures as patterns. Heavy sweeps go in a Web Worker
  (`src/sims/ising.worker.ts`).
- **The physics** is ported from `src/thermolab/<module>.py` to `src/physics/<module>.ts`, with
  `tests/physics/<module>.test.ts` holding to every quantitative claim the lesson makes. Seeded
  randomness uses `uniform(seed)` from `src/physics/kinetics.ts` (sfc32); never mulberry32 or
  `Math.random` in anything a test or a quoted number depends on.
- **Question bank** `src/content/questions/<lang>/chNN/NN-1.yaml`: ThermoLab's quiz questions
  (keep their ids' sense, renamed `Q-NN.1-<slug>`), plus as many new ones as the rules need: at
  least 3 per objective, one of them qualitative, every level present. Every misconception is
  detected by at least one distractor.
- **Review problems** `chNN/bagrut.yaml`, `Q-NN-bagrut-k`: from ThermoLab's problems page, 25
  points each, last part open with a limit check, model solution and rubric.
- **Workbook** `src/content/workbook/<lang>/NN-1.yaml`: 10 practice problems (≥ 2 per level,
  ≥ 3 qualitative, every objective covered) and 2 challenge problems adapted from a published
  source that was **downloaded and read** (MIT OpenCourseWare problem sets have served so far);
  cite course, year, problem set and problem.
- **Summary** `src/content/summaries/<lang>/chNN.mdx`: the five fixed sections.
- **Glossary** `src/content/glossary/NN-1.yaml` and **misconceptions**
  `src/content/misconceptions/NN-1.yaml` (ThermoLab's ids where it has one).
- **Tests**: `tests/e2e/lesson-NN-1.spec.ts` (copy `lesson-15-1.spec.ts`: language and
  direction, every figure inks, the step walk, one figure readout checked against the physics, a
  graded question, en/he shape parity), and the module's four pages added to `PAGES` in
  `tests/e2e/pages.spec.ts`.

## Rules the linter does not check

**Glossary ids are global.** A term is defined once, in the module that introduces it. Before
adding a term, search `src/content/glossary/` for it; a later module uses `<Term id>` of the
earlier definition. Modules are ported in course order so the first use comes first.

**Every number is recomputed.** Do not copy a number from ThermoLab. Recompute it with the
TypeScript port, and where a claim rests on simulation, with several seeds (8 at least; 64 for
anything a problem's conclusion depends on), quoting the multi-seed mean and its seed-to-seed
error. Check against ThermoLab's Python as a second implementation. Both pilots found wrong
numbers in ThermoLab this way. When the port and ThermoLab disagree, find out which is right
before writing either.

**Record what is wrong in ThermoLab** in [docs/thermolab-errata.md](thermolab-errata.md), one
line each, with the evidence. ThermoLab is fixed separately, from that list.

**Hebrew.**
- Terms follow ThermoLab's `glossary/terms.yml`. The glossary's `reject` lists are enforced.
  Decided during the pilots: error bar = פס שגיאה, run = הרצה, Onsager = אונסאגר, real (as
  opposed to model) = ממשי, true = אמיתי.
- Write Hebrew as Hebrew, not as translated English. It must say the same thing as the English;
  the Hebrew review checks meaning, not just grammar.
- Bidi: in plain-text fields (objectives, Predict choices, Formula labels, misconceptions,
  `course.ts`) wrap a formula in U+2066 … U+2069. Do not put U+200F marks next to `$…$`;
  KaTeX output is already isolated. A minus sign in plain Hebrew text is U+2212, inside an
  isolate.
- TeX is shared between the languages: never `\text{English words}` in TeX that both lessons
  carry; rephrase in symbols or move the words out of the formula.

**YAML.** Quote any value containing `: `. Write TeX in YAML with single quotes or block
scalars so backslashes survive. Never generate files through a shell string that eats `\b` or
`\t`; use a script file or Python raw strings, and scan for control characters afterwards.

## Order of work

Each stage's agents work on disjoint files and run in parallel. Commit after each verified
piece, staging explicit paths.

1. **Read** the module (English and Hebrew), its problems page, quiz, misconceptions, library and
   media list. Decide the figures: what each shows, its props, its tasks.
2. **English lesson, course map, glossary, misconceptions**; in parallel, **the physics port and
   its tests**.
3. In parallel: **figures** (to the lesson's props and step states); **English question bank and
   review problems**; **English workbook and summary**.
4. In parallel: **Hebrew** lesson; Hebrew banks; Hebrew workbook and summary. **e2e test** and
   `PAGES`.
5. **Gates**: `npm run lint:content`, `npm test`, `npx astro check`, `npm run build`,
   `npx playwright test` (all projects; it builds nothing, so build first).
6. **Two independent reviews**, in parallel, by agents that did not write the content:
   - *Physics*: every claim, number and derivation in the lesson, banks, review problems,
     workbook and summary, re-measured where measurable. Findings as errors and imprecisions,
     with evidence.
   - *Hebrew*: meaning against the English first, then terminology, bidi, style.
   Apply both, in both languages, then run the gates again.
7. **README**: the module's row in the migration table. **PR**, one per module; merge when every
   gate and both reviews have passed, then start the next module from `master`.
