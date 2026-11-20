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
  {
    n: 0,
    part: 'foundations',
    title: { en: 'Orientation: how many makes a law', he: 'התמצאות: כמה זה מספיק כדי שיתקיים חוק' },
    lessons: [
      {
        id: '0.1',
        title: { en: 'How many makes a law', he: 'כמה זה מספיק כדי שיתקיים חוק' },
        objectives: [
          {
            id: 'OBJ-0.1-1',
            text: {
              en: 'Explain how predictable aggregate behaviour emerges from unpredictable individual events, using the average of many independent random quantities.',
              he: 'להסביר כיצד התנהגות מצרפית צפויה נובעת מאירועים בודדים בלתי צפויים, באמצעות הממוצע של גדלים מקריים בלתי תלויים רבים.',
            },
          },
          {
            id: 'OBJ-0.1-2',
            text: {
              en: 'Compute the mean and variance of a discrete random variable, and of the sum and average of N independent copies of it.',
              he: `לחשב את התוחלת והשונות של משתנה מקרי בדיד, ושל הסכום והממוצע של ${f('N')} עותקים בלתי תלויים שלו.`,
            },
          },
          {
            id: 'OBJ-0.1-3',
            text: {
              en: 'Derive and apply the N^(-1/2) law: the relative scatter of an average falls as N^(-1/2) while the absolute scatter of a sum grows as N^(1/2).',
              he: `לגזור וליישם את חוק ${f('N^(-1/2)')}: הפיזור היחסי של ממוצע דועך כמו ${f('N^(-1/2)')}, בעוד הפיזור המוחלט של סכום גדל כמו ${f('N^(1/2)')}.`,
            },
          },
          {
            id: 'OBJ-0.1-4',
            text: {
              en: 'Check a formula by dimensional analysis in SI units, and state the unit conventions this course uses.',
              he: `לבדוק נוסחה בעזרת ניתוח ממדי ביחידות ${f('SI')}, ולנסח את מוסכמות היחידות שהקורס הזה משתמש בהן.`,
            },
          },
          {
            id: 'OBJ-0.1-5',
            text: {
              en: 'Compute partial derivatives in held-variable notation, form a total differential, and evaluate the line integral of a differential form along a path.',
              he: 'לחשב נגזרות חלקיות בסימון של משתנה מוחזק, להרכיב דיפרנציאל שלם, ולחשב אינטגרל קווי של תבנית דיפרנציאלית לאורך מסלול.',
            },
          },
          {
            id: 'OBJ-0.1-6',
            text: {
              en: 'Decide whether a differential form is exact using the mixed-partials criterion, and exhibit an inexact form whose integral depends on the path.',
              he: 'להכריע אם תבנית דיפרנציאלית מדויקת בעזרת קריטריון הנגזרות המעורבות, ולהציג תבנית לא מדויקת שהאינטגרל שלה תלוי במסלול.',
            },
          },
          {
            id: 'OBJ-0.1-7',
            text: {
              en: 'State the conventions this course runs on: the sign of work in the first law, the meaning of the inexact differential, and what the epistemic labels and model specifications promise.',
              he: 'לנסח את המוסכמות שהקורס פועל לפיהן: הסימן של העבודה בחוק הראשון, משמעות הדיפרנציאל הלא מדויק, ומה מבטיחות התוויות האפיסטמיות ומפרטי המודל.',
            },
          },
        ],
      },
    ],
  },
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
  {
    n: 15,
    part: 'advanced',
    title: { en: 'Phase transitions and the Ising model', he: 'מעברי פאזה ומודל איזינג' },
    lessons: [
      {
        id: '15.1',
        title: { en: 'Who chooses the direction? The Ising model', he: 'מי בוחר את הכיוון? מודל איזינג' },
        objectives: [
          {
            id: 'OBJ-15.1-1',
            text: {
              en: 'Write the Ising energy, define the order parameter m, and explain what it means for the up-down symmetry of the h = 0 model to be spontaneously broken.',
              he: `לכתוב את אנרגיית איזינג, להגדיר את פרמטר הסדר ${f('m')}, ולהסביר מה פירוש שבירה ספונטנית של סימטריית מעלה–מטה של המודל ב-${f('h = 0')}.`,
            },
          },
          {
            id: 'OBJ-15.1-2',
            text: {
              en: 'Derive the Metropolis rule A = min(1, e^(-ΔE/k_BT)) from detailed balance, and explain why the chain samples equilibrium rather than the magnet\'s real motion.',
              he: `לגזור את כלל מטרופוליס ${f('A = min(1, e^(-ΔE/k_BT))')} מאיזון מפורט, ולהסביר מדוע השרשרת דוגמת שיווי משקל ואינה מדמה את התנועה הממשית של המגנט.`,
            },
          },
          {
            id: 'OBJ-15.1-3',
            text: {
              en: 'Explain, from the free energy of a domain wall, why the one-dimensional Ising chain has no phase transition at any T > 0.',
              he: `להסביר, מהאנרגיה החופשית של קיר תחום, מדוע לשרשרת איזינג החד-ממדית אין מעבר פאזה בשום ${f('T > 0')}.`,
            },
          },
          {
            id: 'OBJ-15.1-4',
            text: {
              en: 'Derive the mean-field equation m = tanh((qJm + h)/k_BT) and its T_c = qJ/k_B, and quantify how far it misses Onsager\'s exact k_BT_c ≈ 2.269 J.',
              he: `לגזור את משוואת השדה הממוצע ${f('m = tanh((qJm + h)/k_BT)')} ואת ${f('T_c = qJ/k_B')} שלה, ולכמת עד כמה היא מחטיאה את התוצאה המדויקת של אונסאגר ${f('k_BT_c ≈ 2.269 J')}.`,
            },
          },
          {
            id: 'OBJ-15.1-5',
            text: {
              en: 'Estimate ⟨|m|⟩, the susceptibility and the heat capacity from Monte Carlo traces through the fluctuation identities, and locate T_c from the susceptibility peak.',
              he: `לאמוד את ${f('⟨|m|⟩')}, את הסוספטיביליות ואת קיבול החום מעקבות מונטה קרלו בעזרת זהויות הפלוקטואציה, ולאתר את ${f('T_c')} משיא הסוספטיביליות.`,
            },
          },
          {
            id: 'OBJ-15.1-6',
            text: {
              en: 'Describe hysteresis, finite-size rounding and critical slowing down as measurements, and say what finite simulations can and cannot establish about the infinite-N singularity.',
              he: 'לתאר היסטרזיס, עיגול של גודל סופי והאטה קריטית כמדידות, ולומר מה סימולציות סופיות יכולות ואינן יכולות לבסס על הסינגולריות של מערכת אינסופית.',
            },
          },
          {
            id: 'OBJ-15.1-7',
            text: {
              en: 'Attach a defensible error bar to a Monte Carlo average using the autocorrelation time, N_eff = n/(2τ), and reject conclusions that do not survive a change of seed.',
              he: `לצרף פס שגיאה שאפשר להגן עליו לממוצע מונטה קרלו בעזרת זמן המתאם העצמי, ${f('N_eff = n/(2τ)')}, ולדחות מסקנות שאינן שורדות החלפת זרע.`,
            },
          },
        ],
      },
    ],
  },
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
