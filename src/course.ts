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
              he: `לגזור וליישם את חוק ${f('N^(−1/2)')}: הפיזור היחסי של ממוצע דועך כמו ${f('N^(−1/2)')}, בעוד הפיזור המוחלט של סכום גדל כמו ${f('N^(1/2)')}.`,
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
  {
    n: 1,
    part: 'thermodynamics',
    title: { en: 'Thermal equilibrium', he: 'שיווי משקל תרמי' },
    lessons: [
      {
        id: '1.1',
        title: { en: 'What makes two temperatures the same', he: 'מה הופך שתי טמפרטורות לאותה טמפרטורה' },
        objectives: [
          {
            id: 'OBJ-1.1-1',
            text: {
              en: 'State the zeroth law of thermodynamics and explain why it is what makes temperature a well-defined, transitive property.',
              he: 'לנסח את החוק האפס של התרמודינמיקה ולהסביר מדוע הוא זה שהופך את הטמפרטורה לתכונה מוגדרת היטב וטרנזיטיבית.',
            },
          },
          {
            id: 'OBJ-1.1-2',
            text: {
              en: 'Explain thermal equilibrium as the state at which net heat flow between two bodies in contact stops, and identify what continues at the microscopic level.',
              he: 'להסביר את שיווי המשקל התרמי כמצב שבו נפסקת זרימת החום נטו בין שני גופים במגע, ולזהות מה נמשך ברמה המיקרוסקופית.',
            },
          },
          {
            id: 'OBJ-1.1-3',
            text: {
              en: 'Derive the equilibrium temperature T_eq = (C_A T_A + C_B T_B)/(C_A + C_B) from conservation of energy, and predict how it depends on the two heat capacities.',
              he: `לגזור משימור האנרגיה את טמפרטורת שיווי המשקל ${f('T_eq = (C_A T_A + C_B T_B)/(C_A + C_B)')}, ולחזות כיצד היא תלויה בשני קיבולי החום.`,
            },
          },
          {
            id: 'OBJ-1.1-4',
            text: {
              en: 'Derive and interpret the exponential relaxation law T_A(t) − T_B(t) = (T_A(0) − T_B(0)) e^(−t/τ), and state what determines the relaxation time τ.',
              he: `לגזור ולפרש את חוק הרלקסציה המעריכי ${f('T_A(t) − T_B(t) = (T_A(0) − T_B(0)) e^(−t/τ)')}, ולנסח מה קובע את זמן הרלקסציה ${f('τ')}.`,
            },
          },
          {
            id: 'OBJ-1.1-5',
            text: {
              en: 'Verify computationally that a discrete stochastic energy-exchange model converges to the analytic relaxation law as the system size grows, and state what the simulation does and does not establish.',
              he: 'לאמת חישובית שמודל בדיד והסתברותי של החלפת אנרגיה מתכנס אל חוק הרלקסציה האנליטי ככל שהמערכת גדלה, ולנסח מה הסימולציה מבססת ומה אינה מבססת.',
            },
          },
        ],
      },
    ],
  },
  {
    n: 2,
    part: 'thermodynamics',
    title: { en: 'Equations of state', he: 'משוואות מצב' },
    lessons: [
      {
        id: '2.1',
        title: { en: 'A lighter that sloshes: equations of state', he: 'מצית שמשכשך: משוואות מצב' },
        objectives: [
          {
            id: 'OBJ-2.1-1',
            text: {
              en: 'State the state postulate for a simple compressible substance (fixing two independent intensive variables fixes every other equilibrium property), and explain why all equilibrium states therefore form a single surface in (P, v, T) space.',
              he: `לנסח את הנחת המצב עבור חומר דחיס פשוט (קיבוע שני משתנים אינטנסיביים בלתי תלויים מקבע כל תכונת שיווי משקל אחרת), ולהסביר מדוע, כתוצאה מכך, כל מצבי שיווי המשקל מרכיבים משטח יחיד במרחב ${f('(P, v, T)')}.`,
            },
          },
          {
            id: 'OBJ-2.1-2',
            text: {
              en: 'Classify a thermodynamic variable as intensive or extensive by the doubling test, form per-particle densities such as v = V/N, and predict which quantities change when two identical systems are joined.',
              he: `לסווג משתנה תרמודינמי כאינטנסיבי או אקסטנסיבי באמצעות מבחן ההכפלה, ליצור צפיפויות לחלקיק כגון ${f('v = V/N')}, ולחזות אילו גדלים משתנים כאשר מחברים שתי מערכות זהות.`,
            },
          },
          {
            id: 'OBJ-2.1-3',
            text: {
              en: 'Use the ideal gas law PV = Nk_BT to compute any one of P, V, T, N from the others, and state its epistemic status: an empirical law of the dilute classical regime, not a law of nature.',
              he: `להשתמש בחוק הגזים האידיאליים ${f('PV = Nk_BT')} כדי לחשב כל אחד מבין ${f('P, V, T, N')} מתוך האחרים, ולנסח את מעמדו האפיסטמי: חוק אמפירי של המשטר הדליל והקלאסי, ולא חוק טבע.`,
            },
          },
          {
            id: 'OBJ-2.1-4',
            text: {
              en: 'Explain the physical origin of the van der Waals constants a (mutual attraction lowers the pressure by a/v²) and b (excluded volume shifts v to v − b), and compute pressures from P = k_BT/(v − b) − a/v².',
              he: `להסביר את המקור הפיזיקלי של קבועי ואן דר ואלס ${f('a')} (משיכה הדדית מנמיכה את הלחץ ב-${f('a/v²')}) ו-${f('b')} (נפח מודר מסיט את ${f('v')} אל ${f('v − b')}), ולחשב לחצים מתוך ${f('P = k_BT/(v − b) − a/v²')}.`,
            },
          },
          {
            id: 'OBJ-2.1-5',
            text: {
              en: 'Derive the critical point (v_c, T_c, P_c) = (3b, 8a/(27k_Bb), a/(27b²)) from ∂P/∂v = 0 and ∂²P/∂v² = 0 on the critical isotherm, and explain why no pressure liquefies a gas above T_c.',
              he: `לגזור את הנקודה הקריטית ${f('(v_c, T_c, P_c) = (3b, 8a/(27k_Bb), a/(27b²))')} מתוך ${f('∂P/∂v = 0')} ו-${f('∂²P/∂v² = 0')} על האיזותרמה הקריטית, ולהסביר מדוע שום לחץ אינו מנזל גז מעל ${f('T_c')}.`,
            },
          },
          {
            id: 'OBJ-2.1-6',
            text: {
              en: 'Rewrite the van der Waals equation in reduced variables P_r = P/P_c, v_r = v/v_c, T_r = T/T_c to obtain the parameter-free law of corresponding states, and use the compressibility factor Z = Pv/(k_BT) to quantify how far a real gas is from ideal.',
              he: `לכתוב מחדש את משוואת ואן דר ואלס במשתנים מצומצמים ${f('P_r = P/P_c, v_r = v/v_c, T_r = T/T_c')} ולקבל את חוק המצבים המתאימים חסר הפרמטרים, ולהשתמש במקדם הדחיסות ${f('Z = Pv/(k_BT)')} כדי לכמת את מרחקו של גז ממשי מאידיאליות.`,
            },
          },
        ],
      },
    ],
  },
  {
    n: 3,
    part: 'statistical',
    title: { en: 'Probability and emergence', he: 'הסתברות והתהוות' },
    lessons: [
      {
        id: '3.1',
        title: { en: 'Order out of nothing but noise: random walks', he: 'סדר מתוך רעש בלבד: הילוכים אקראיים' },
        objectives: [
          {
            id: 'OBJ-3.1-1',
            text: {
              en: 'Model a random walk as a sum of independent steps and compute ⟨x_t⟩ = μ₁t and Var(x_t) = σ₁²t, hence the RMS spread σ₁√t, for any step distribution with finite variance.',
              he: `למדל הילוך אקראי כסכום של צעדים בלתי תלויים ולחשב ${f('⟨x_t⟩ = μ₁t')} ו-${f('Var(x_t) = σ₁²t')}, ומכאן את שורש ממוצע ריבוע הפיזור ${f('σ₁√t')}, עבור כל התפלגות צעדים בעלת שונות סופית.`,
            },
          },
          {
            id: 'OBJ-3.1-2',
            text: {
              en: 'Define the binomial distribution P(k) = C(n,k) p^k (1 − p)^(n−k), compute its mean np and variance np(1 − p), and map the ±1 coin walk onto it exactly.',
              he: `להגדיר את ההתפלגות הבינומית ${f('P(k) = C(n,k) p^k (1 − p)^(n−k)')}, לחשב את התוחלת ${f('np')} ואת השונות ${f('np(1 − p)')}, ולמפות עליה במדויק את הילוך המטבע ${f('±1')}.`,
            },
          },
          {
            id: 'OBJ-3.1-3',
            text: {
              en: 'State the central limit theorem with its hypotheses (independent, identically distributed steps of finite variance) and its conclusion, that (S_n − nμ)/(σ√n) approaches a standard Gaussian; identify which hypothesis fails in a given counterexample.',
              he: `לנסח את משפט הגבול המרכזי על הנחותיו (צעדים בלתי תלויים, בעלי אותה התפלגות ובעלי שונות סופית) ואת מסקנתו, ש-${f('(S_n − nμ)/(σ√n)')} שואף להתפלגות גאוסית סטנדרטית; ולזהות איזו הנחה מופרת בדוגמת נגד נתונה.`,
            },
          },
          {
            id: 'OBJ-3.1-4',
            text: {
              en: 'Apply the de Moivre–Laplace bridge (approximate the binomial pmf by a Gaussian of mean np and variance np(1 − p)) and state where the approximation is trustworthy.',
              he: `ליישם את הגשר של דה-מואבר-לפלס (קירוב פונקציית ההסתברות הבינומית בגאוסית בעלת תוחלת ${f('np')} ושונות ${f('np(1 − p)')}), ולנסח היכן הקירוב אמין.`,
            },
          },
          {
            id: 'OBJ-3.1-5',
            text: {
              en: 'Distinguish the standard deviation of one quantity from the standard error of an estimated mean, and absolute spread growing as √N from relative spread falling as N^(−1/2).',
              he: `להבחין בין סטיית התקן של גודל בודד לבין שגיאת התקן של תוחלת מוערכת, ובין פיזור מוחלט הגדל כמו ${f('√N')} לבין פיזור יחסי הדועך כמו ${f('N^(−1/2)')}.`,
            },
          },
          {
            id: 'OBJ-3.1-6',
            text: {
              en: 'Explain how a reproducible Gaussian profile emerges from an ensemble of individually unpredictable walkers, without invoking a restoring force or compensation.',
              he: 'להסביר כיצד פרופיל גאוסי בר-שחזור מתהווה מתוך צבר של הולכים שכל אחד מהם בלתי צפוי, בלי להיזקק לכוח מחזיר או לפיצוי.',
            },
          },
        ],
      },
    ],
  },
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
