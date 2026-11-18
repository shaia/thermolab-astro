/**
 * The course map: every module of ThermoLab, in both languages, and the objectives of every
 * written lesson.
 *
 * ThermoLab is organised in nineteen modules (00–18), grouped into four parts. The platform this
 * course is forked from numbers everything chapter.lesson, so a module is a chapter here and its
 * first lesson is <module>.1: module 04, "the microscopic origin of pressure", is lesson 4.1. A
 * module may later split into several lessons (4.1, 4.2, …) without renumbering anything.
 *
 * Objective texts are plain text (lesson header, progress), no TeX. A formula inside Hebrew is
 * wrapped in U+2066 … U+2069 so the bidi algorithm keeps it in reading order.
 */

import type { Lang } from './i18n';

export type Text = Record<Lang, string>;

export interface Objective {
  id: string;
  text: Text;
}

export interface PlannedLesson {
  id: string;
  title: Text;
  objectives: Objective[];
}

export type Part = 'foundations' | 'thermodynamics' | 'statistical' | 'advanced';

export interface Chapter {
  /** the module number */
  n: number;
  part: Part;
  title: Text;
  lessons: PlannedLesson[];
}

export const PARTS: Record<Part, Text> = {
  foundations: { en: 'Foundations', he: 'יסודות' },
  thermodynamics: { en: 'Thermodynamics', he: 'תרמודינמיקה' },
  statistical: { en: 'Statistical mechanics', he: 'מכניקה סטטיסטית' },
  advanced: { en: 'Advanced topics', he: 'נושאים מתקדמים' },
};

const LRI = '⁦';
const PDI = '⁩';
const f = (formula: string) => `${LRI}${formula}${PDI}`;

/** A module not yet moved to this platform: one planned lesson, titled like the module. */
const planned = (n: number, part: Part, en: string, he: string): Chapter => ({
  n,
  part,
  title: { en, he },
  lessons: [{ id: `${n}.1`, title: { en, he }, objectives: [] }],
});

export const chapters: Chapter[] = [
  planned(0, 'foundations', 'Orientation: how many makes a law', 'התמצאות: כמה זה מספיק כדי שיתקיים חוק'),
  planned(1, 'thermodynamics', 'Thermal equilibrium', 'שיווי משקל תרמי'),
  planned(2, 'thermodynamics', 'Equations of state', 'משוואות מצב'),
  planned(3, 'statistical', 'Probability and emergence', 'הסתברות והתהוות'),
  {
    n: 4,
    part: 'thermodynamics',
    title: { en: 'Pressure', he: 'לחץ' },
    lessons: [
      {
        id: '4.1',
        title: { en: 'The microscopic origin of pressure', he: 'המקור המיקרוסקופי של הלחץ' },
        objectives: [
          {
            id: 'OBJ-4.1-1',
            text: {
              en: 'Explain how a steady macroscopic pressure arises from discrete, irregular molecular impacts.',
              he: 'להסביר כיצד לחץ מאקרוסקופי יציב נובע מפגיעות מולקולריות בדידות ולא סדירות.',
            },
          },
          {
            id: 'OBJ-4.1-2',
            text: {
              en: 'Derive P = N k_B T / V from the momentum that particles transfer to a wall.',
              he: `לגזור את ${f('P = N k_B T / V')} מהתנע שחלקיקים מעבירים לדופן.`,
            },
          },
          {
            id: 'OBJ-4.1-3',
            text: {
              en: 'Distinguish temperature (mean energy per particle) from internal energy (total energy).',
              he: 'להבחין בין טמפרטורה (אנרגיה ממוצעת לחלקיק) לבין אנרגיה פנימית (אנרגיה כוללת).',
            },
          },
          {
            id: 'OBJ-4.1-4',
            text: {
              en: 'Predict how relative pressure fluctuations scale with particle number, and justify N^(-1/2).',
              he: `לחזות כיצד הפלוקטואציות היחסיות של הלחץ תלויות במספר החלקיקים, ולנמק את החוק ${f('N^(-1/2)')}.`,
            },
          },
          {
            id: 'OBJ-4.1-5',
            text: {
              en: 'State the assumptions of the ideal-gas kinetic model and the conditions under which it fails.',
              he: 'לנסח את הנחות המודל הקינטי של הגז האידיאלי ואת התנאים שבהם הוא נכשל.',
            },
          },
        ],
      },
    ],
  },
  planned(5, 'thermodynamics', 'Work and thermodynamic paths', 'עבודה ומסלולים תרמודינמיים'),
  planned(6, 'thermodynamics', 'Thermodynamic processes', 'תהליכים תרמודינמיים'),
  planned(7, 'thermodynamics', 'The second law and heat engines', 'החוק השני ומנועי חום'),
  planned(8, 'statistical', 'Entropy and multiplicity', 'אנטרופיה וריבוי מצבים'),
  planned(9, 'thermodynamics', 'The fundamental relation', 'היחס היסודי'),
  planned(10, 'thermodynamics', 'Thermodynamic potentials', 'פוטנציאלים תרמודינמיים'),
  planned(11, 'statistical', 'Statistical ensembles', 'צברים סטטיסטיים'),
  planned(12, 'statistical', 'Partition functions', 'פונקציות החלוקה'),
  planned(13, 'advanced', 'Chemical potential', 'פוטנציאל כימי'),
  planned(14, 'advanced', 'Phase coexistence', 'דו-קיום פאזות'),
  planned(15, 'advanced', 'Phase transitions and the Ising model', 'מעברי פאזה ומודל איזינג'),
  planned(16, 'advanced', 'Thermal radiation and the heat capacity of solids', 'קרינה תרמית וקיבול החום של מוצקים'),
  planned(17, 'advanced', 'Quantum gases', 'גזים קוונטיים'),
  planned(18, 'advanced', 'Fluctuations and transport', 'פלוקטואציות והובלה'),
];

/** "4.1" → "4-1", the lesson's path segment. */
export const lessonSlug = (id: string) => id.replace('.', '-');

/** A module number as ThermoLab prints it: 4 → "04". */
export const moduleNumber = (n: number) => String(n).padStart(2, '0');

export function chapterOf(id: string): Chapter | undefined {
  const n = Number(id.split('.')[0]);
  return chapters.find((c) => c.n === n);
}

/** All planned lessons in course order. */
export const lessonOrder: PlannedLesson[] = chapters.flatMap((c) => c.lessons);

/** Every objective of the course, by id. */
export const objectiveById: Map<string, Objective & { lesson: string }> = new Map(
  lessonOrder.flatMap((l) => l.objectives.map((o) => [o.id, { ...o, lesson: l.id }] as const)),
);

/** The objectives of one chapter, in course order. */
export const chapterObjectives = (n: number): Objective[] =>
  (chapters.find((c) => c.n === n)?.lessons ?? []).flatMap((l) => l.objectives);
