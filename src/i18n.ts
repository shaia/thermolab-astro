/**
 * The two languages, and every word of the platform's own interface in both.
 *
 * The unimech platform this course is forked from was Hebrew-only: `dir="rtl"` was set once and
 * interface text was written straight into ~45 components. Here each language is a path prefix
 * (/en/…, /he/…), the direction follows the language, and interface text lives in this one table.
 * Lesson text, questions and glossary entries are content and live in their own files per language.
 *
 * Components that render on the server read the language from the page URL (`langOf`), so lesson
 * MDX never has to pass it. Islands cannot see the URL while they render on the server, so their
 * .astro wrapper passes `lang` as a prop.
 */

export type Lang = 'en' | 'he';
export const LANGS: Lang[] = ['en', 'he'];
export const DEFAULT_LANG: Lang = 'en';

export const isLang = (s: unknown): s is Lang => s === 'en' || s === 'he';
export const dirOf = (lang: Lang) => (lang === 'he' ? 'rtl' : 'ltr');
export const otherLang = (lang: Lang): Lang => (lang === 'he' ? 'en' : 'he');

/** The language of a page from its path: '/thermolab/he/lessons/4-1/' → 'he'. */
export function langOf(pathname: string): Lang {
  const m = pathname.match(/\/(en|he)(?:\/|$)/);
  return m && isLang(m[1]) ? m[1] : DEFAULT_LANG;
}

/** The same page in the other language: only the language segment changes. */
export function swapLang(pathname: string, to: Lang): string {
  return pathname.replace(/\/(en|he)(\/|$)/, `/${to}$2`);
}

/** Dates in the reader's language. */
export const locale = (lang: Lang) => (lang === 'he' ? 'he-IL' : 'en-GB');

export type BlockKind = 'hook' | 'predict' | 'explore' | 'explain' | 'example' | 'check' | 'summary';

const en = {
  siteName: 'ThermoLab',
  siteFull: 'ThermoLab: thermal physics you can run',
  siteDescription: 'An interactive course in thermodynamics and statistical mechanics.',
  skip: 'Skip to content',
  langName: 'English',
  readIn: 'Read this page in English',
  nav: {
    main: 'Main navigation',
    contents: 'Contents',
    me: 'My path',
    formulas: 'Formula sheet',
    glossary: 'Glossary',
    search: 'Search',
    lesson: 'Lesson navigation',
    sections: 'Parts of the lesson',
    prev: (id: string, title: string) => `Previous: ${id} ${title}`,
    next: (id: string, title: string) => `Next: ${id} ${title}`,
    prevLesson: (title: string) => `Previous lesson: ${title}`,
    nextLesson: (title: string) => `Next lesson: ${title}`,
    /** the arrow that points back / forward in reading order */
    backArrow: '←',
    fwdArrow: '→',
  },
  lesson: {
    kicker: (module: string, title: string, n: string) => `Module ${module} · ${title} · Lesson ${n}`,
    minutes: (n: number) => `about ${n} min`,
    objectives: 'By the end of this lesson you can:',
    figure: 'Figure',
    solution: 'Tried it yourself? Open the solution',
    print: 'Print or save as PDF',
    question: (i: number) => `Question ${i}`,
  },
  block: {
    hook: 'Phenomenon',
    predict: 'Predict',
    explore: 'Explore',
    explain: 'Explain',
    example: 'Worked example',
    check: 'Check yourself',
    summary: 'In summary',
  } satisfies Record<BlockKind, string>,
  blockShort: {
    hook: 'Phenomenon',
    predict: 'Predict',
    explore: 'Explore',
    explain: 'Explain',
    example: 'Example',
    check: 'Check',
    summary: 'Summary',
  } satisfies Record<BlockKind, string>,
  predict: {
    legend: 'Your prediction',
    commit: 'This is my prediction',
    why: 'No grade here. You commit so that you find out whether your intuition was right.',
    cover: 'Lift the flap once you have predicted ↑',
    yours: 'You predicted:',
  },
  revisit: {
    none: 'No prediction was recorded at the start of the lesson. You can scroll up and make one, even now.',
    yours: 'Your prediction at the start of the lesson:',
    right: 'Your intuition was right. Now you have the explanation too.',
    found: 'What you found:',
    wrongNote: 'A wrong prediction is part of learning: a mistake an experiment exposes stays with you far longer than a rule stated in a lecture.',
  },
  end: {
    done: 'Completed',
    stamp: (id: string, date: string) => `Stamp: lesson ${id} completed on ${date}`,
    saved: 'The stamp is saved on this device. To reach mastery, answer the lesson’s questions correctly.',
    finish: (title: string) => `I finished “${title}”`,
  },
  settings: {
    stillOn: 'Still mode is on: nothing moves',
    stillOff: 'Still mode: stop all motion',
    stillLabel: 'Still',
    motionLabel: 'Motion',
    theme: { auto: 'Colours: automatic', light: 'Colours: light', dark: 'Colours: dark' },
  },
  sim: {
    reset: 'Reset',
    fullscreen: 'Full screen',
    tasks: 'Tasks',
    done: ' (done)',
  },
  q: {
    kind: { mc: 'Choice', multi: 'Several correct answers', numeric: 'Calculation', vector: 'Direction', rank: 'Ranking', twotier: 'Answer and reason' },
    qualitative: 'Qualitative',
    examLevel: 'Exam level',
    checkSure: 'Check · sure',
    checkUnsure: 'Check · not sure',
    check: 'Check',
    hint: 'Hint',
    hintCost: ' · costs points',
    correct: 'Correct!',
    notQuite: 'Not quite.',
    tryAgain: 'Try again',
    showSolution: 'Show me the solution',
    explanation: 'Explanation',
    pickAll: 'Mark every correct answer',
    pickOne: 'Choose an answer',
    answerIn: (unit: string) => `The answer, in ${unit}`,
    answerNoUnit: 'The answer, a number without units',
    numericHelpBefore: 'Powers of ten can be written as',
    numericHelpOr: 'or',
    rankHelp: 'Order from largest to smallest. If two are equal, click “=” between them.',
    up: 'Up',
    down: 'Down',
    tied: 'Equal',
    greater: 'Greater than',
    unreadable: 'That number could not be read. Write, for example, 3.6e4 or 3.6*10^4.',
    missedOne: 'There is another correct answer you did not mark.',
    offBy: (k: number) => `Your result is off by a factor of ${k}. Check prefixes and units (for example cm and m, or ms and s).`,
    reasonPrompt: 'And the reason?',
    dir: {
      e: 'Right', ne: 'Right and up', n: 'Up', nw: 'Left and up', w: 'Left', sw: 'Left and down', s: 'Down', se: 'Right and down',
      pick: 'Choose a direction', zero: 'Zero: no direction', perp: 'Perpendicular to the page', out: 'Out of the page', in: 'Into the page',
    },
  },
  home: {
    kicker: 'Thermal physics · undergraduate · English and Hebrew',
    sub: 'A living textbook of thermodynamics and statistical mechanics: every law derived, then checked against a simulation you can run and question.',
    note: 'This is a pilot of one module on the new platform. The full course lives at the original site.',
    open: 'Open the book',
    practice: 'Practice',
    test: 'Module test',
    summary: 'Summary',
    contents: 'Contents',
    soon: 'Coming soon',
    visited: 'Started',
    completed: 'Completed',
  },
};

type Strings = typeof en;

const he: Strings = {
  siteName: 'תרמו-מעבדה',
  siteFull: 'תרמו-מעבדה: פיזיקה תרמית שאפשר להריץ',
  siteDescription: 'קורס אינטראקטיבי בתרמודינמיקה ובמכניקה סטטיסטית.',
  skip: 'דלגו לתוכן',
  langName: 'עברית',
  readIn: 'לקריאת העמוד בעברית',
  nav: {
    main: 'ניווט ראשי',
    contents: 'תוכן העניינים',
    me: 'המסלול שלי',
    formulas: 'דף נוסחאות',
    glossary: 'מילון',
    search: 'חיפוש',
    lesson: 'ניווט בשיעור',
    sections: 'חלקי השיעור',
    prev: (id, title) => `הקודם: ${id} ${title}`,
    next: (id, title) => `הבא: ${id} ${title}`,
    prevLesson: (title) => `השיעור הקודם: ${title}`,
    nextLesson: (title) => `השיעור הבא: ${title}`,
    backArrow: '→',
    fwdArrow: '←',
  },
  lesson: {
    kicker: (module, title, n) => `מודול ${module} · ${title} · שיעור ${n}`,
    minutes: (n) => `כ-${n} דקות`,
    objectives: 'בסוף השיעור תוכלו:',
    figure: 'איור',
    solution: 'ניסיתם לבד? פתחו את הפתרון',
    print: 'הדפסה או שמירה כ-PDF',
    question: (i) => `שאלה ${i}`,
  },
  block: {
    hook: 'תופעה',
    predict: 'חזו',
    explore: 'חקרו',
    explain: 'הסבר',
    example: 'דוגמה פתורה',
    check: 'בדקו את עצמכם',
    summary: 'לסיכום',
  },
  blockShort: {
    hook: 'תופעה',
    predict: 'חזו',
    explore: 'חקרו',
    explain: 'הסבר',
    example: 'דוגמה',
    check: 'בדקו',
    summary: 'סיכום',
  },
  predict: {
    legend: 'החיזוי שלכם',
    commit: 'זה החיזוי שלי',
    why: 'אין כאן ציון. מתחייבים כדי לגלות אם האינטואיציה צדקה.',
    cover: 'הרימו את הדש אחרי שתחזו ↑',
    yours: 'חזיתם:',
  },
  revisit: {
    none: 'בתחילת השיעור לא נרשם חיזוי. אפשר לחזור למעלה ולנסות, גם עכשיו.',
    yours: 'החיזוי שלכם בתחילת השיעור:',
    right: 'והאינטואיציה צדקה. עכשיו יש לכם גם את ההסבר.',
    found: 'מה שגיליתם:',
    wrongNote: 'חיזוי שגוי הוא חלק מהלמידה: טעות שמתגלה בניסוי נזכרת הרבה יותר טוב מכלל שנאמר בהרצאה.',
  },
  end: {
    done: 'הושלם',
    stamp: (id, date) => `חותמת: שיעור ${id} הושלם ב-${date}`,
    saved: 'החותמת נשמרה במכשיר הזה. כדי להגיע לשליטה, ענו נכון על שאלות השיעור.',
    finish: (title) => `סיימתי את השיעור „${title}”`,
  },
  settings: {
    stillOn: 'מצב שקט פעיל: אין תנועה',
    stillOff: 'מצב שקט: לעצור כל תנועה',
    stillLabel: 'מצב שקט',
    motionLabel: 'תנועה',
    theme: { auto: 'ערכת צבעים: אוטומטית', light: 'ערכת צבעים: בהירה', dark: 'ערכת צבעים: כהה' },
  },
  sim: {
    reset: 'איפוס',
    fullscreen: 'מסך מלא',
    tasks: 'משימות',
    done: ' (הושלם)',
  },
  q: {
    kind: { mc: 'בחירה', multi: 'כמה תשובות נכונות', numeric: 'חישוב', vector: 'כיוון', rank: 'דירוג', twotier: 'תשובה ונימוק' },
    qualitative: 'איכותית',
    examLevel: 'רמת מבחן',
    checkSure: 'בדיקה · בטוחים',
    checkUnsure: 'בדיקה · לא בטוחים',
    check: 'בדיקה',
    hint: 'רמז',
    hintCost: ' · עולה בנקודות',
    correct: 'נכון!',
    notQuite: 'לא בדיוק.',
    tryAgain: 'נסו שוב',
    showSolution: 'הראו לי את הפתרון',
    explanation: 'הסבר',
    pickAll: 'סמנו את כל התשובות הנכונות',
    pickOne: 'בחרו תשובה',
    answerIn: (unit) => `התשובה, ב-${unit}`,
    answerNoUnit: 'התשובה, מספר בלי יחידות',
    numericHelpBefore: 'אפשר לכתוב חזקות של 10 כך:',
    numericHelpOr: 'או',
    rankHelp: 'סדרו מהגדול לקטן. אם שניים שווים, לחצו על „=” ביניהם.',
    up: 'למעלה',
    down: 'למטה',
    tied: 'שווים',
    greater: 'גדול מ-',
    unreadable: 'לא הצלחנו לקרוא את המספר. כתבו למשל 3.6e4 או 3.6*10^4.',
    missedOne: 'יש עוד תשובה נכונה שלא סימנתם.',
    offBy: (k) => `התוצאה שלכם רחוקה פי ${k} מהתשובה. בדקו קידומות ויחידות (למשל cm ו-m, או ms ו-s).`,
    reasonPrompt: 'ומה הנימוק?',
    dir: {
      e: 'ימינה', ne: 'ימינה ולמעלה', n: 'למעלה', nw: 'שמאלה ולמעלה', w: 'שמאלה', sw: 'שמאלה ולמטה', s: 'למטה', se: 'ימינה ולמטה',
      pick: 'בחרו כיוון', zero: 'אפס: אין כיוון', perp: 'ניצב לדף', out: 'החוצה מהדף', in: 'לתוך הדף',
    },
  },
  home: {
    kicker: 'פיזיקה תרמית · תואר ראשון · עברית ואנגלית',
    sub: 'ספר לימוד חי בתרמודינמיקה ובמכניקה סטטיסטית: כל חוק נגזר, ואחר כך נבדק מול סימולציה שאפשר להריץ ולשאול.',
    note: 'זהו פיילוט של מודול אחד על הפלטפורמה החדשה. הקורס המלא נמצא באתר המקורי.',
    open: 'פתחו את הספר',
    practice: 'תרגול',
    test: 'מבחן מודול',
    summary: 'סיכום',
    contents: 'תוכן העניינים',
    soon: 'בקרוב',
    visited: 'התחלתם',
    completed: 'הושלם',
  },
};

const TABLE: Record<Lang, Strings> = { en, he };

/** The interface strings of one language. */
export const ui = (lang: Lang): Strings => TABLE[lang];
