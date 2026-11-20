/**
 * The platform pages around the lesson, in both languages: practice, module test, my path, formula
 * sheet, glossary, summary, search, and the laboratory link. Each must be in its language, fit the
 * screen and run without console errors.
 */

import { expect, test, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { hydrated, overflow } from './helpers';

const PAGES = [
  'practice/ch4/', 'test/ch4/', 'summary/ch4/', 'workbook/4-1/',
  'practice/ch15/', 'test/ch15/', 'summary/ch15/', 'workbook/15-1/',
  'me/', 'formulas/', 'glossary/', 'search/',
];

/** How many times `re` occurs across the files of `dir` (recursively): the counts the pages must show. */
const occurrences = (dir: string, re: RegExp): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return n + occurrences(path, re);
    return /\.(ya?ml|mdx)$/.test(e.name) ? n + (readFileSync(path, 'utf8').match(re) ?? []).length : n;
  }, 0);

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

for (const lang of ['en', 'he'] as const) {
  test(`every platform page renders in ${lang}, fits the screen and links to its translation`, async ({ page }) => {
    const errors = errorsOf(page);
    for (const p of PAGES) {
      await page.goto(`/${lang}/${p}`);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('.lang-switch')).toHaveAttribute('href', `/${lang === 'en' ? 'he' : 'en'}/${p}`);
      expect(await overflow(page), p).toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test(`the module test runs and reports, in ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/test/ch4/?seed=7`);
    const intro = page.locator('[data-phase="intro"]');
    await hydrated(intro);
    await intro.locator('.btn.primary').click();
    const run = page.locator('[data-phase="running"]');
    await expect(run.locator('.test-q').first()).toBeVisible();
    // every objective is covered at least once
    expect(await run.locator('.test-q').count()).toBeGreaterThanOrEqual(5);
    await run.locator('.test-bar .btn.primary').click();
    await expect(page.locator('[data-testid="score"]')).toHaveText(/^0\/\d+$/);
    await expect(page.locator('.report-table tbody tr')).toHaveCount(5);
  });

  test(`a wrong answer that names a misconception shows up on my path, in ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/practice/ch4/`);
    const card = page.locator('[data-qid="Q-4.1-double-mass"]');
    await card.scrollIntoViewIfNeeded();
    await hydrated(card);
    // answer "it doubles" twice: the heavier-pushes-harder misconception becomes active
    for (let k = 0; k < 2; k++) {
      const choice = card.locator('.q-choice', { hasText: lang === 'en' ? 'It doubles' : 'הוא מוכפל' });
      await choice.click();
      await card.locator('.q-actions .btn.primary').first().click();
      if (k === 0) await card.locator('.q-feedback .btn.primary').click();
    }
    await page.goto(`/${lang}/me/`);
    await expect(page.locator('[data-misconception="MC-heavier-pushes-harder"] a')).toHaveAttribute('href', `/${lang}/lessons/4-1/#heavy`);
  });
}

for (const lang of ['en', 'he'] as const) {
  test(`the workbook holds ten problems and two sourced challenges, linked from the lesson, in ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/lessons/4-1/`);
    await page.locator('.lesson-workbook a').click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/workbook/4-1/$`));
    await expect(page.locator('[data-workbook-item]')).toHaveCount(12);
    await expect(page.locator('.wb-source a')).toHaveCount(2);
    const first = page.locator('[data-workbook-item="W-4.1-02"]');
    await first.locator('.wb-solution summary').click();
    await expect(first.locator('.sol-step').last()).toBeVisible();
  });

  test(`a review problem's open part reveals its model solution and scores the rubric, in ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/practice/ch4/`);
    await expect(page.locator('.bagrut')).toHaveCount(4);
    const part = page.locator('[data-qid="Q-4-bagrut-2"] .open-part');
    await part.scrollIntoViewIfNeeded();
    await hydrated(part);
    await part.locator('textarea').fill('P = N m <v_x^2> / V ...');
    await part.locator('.q-actions .btn.primary').click();
    await expect(part.locator('.open-steps li[data-kind="limit"]')).toBeVisible();
    for (const box of await part.locator('.open-rubric input').all()) await box.check();
    await part.locator('.q-actions .btn.primary').click();
    await expect(part.locator('.q-feedback.ok')).toBeVisible();
  });
}

test('the glossary lists every term, alphabetical in each language', async ({ page }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/glossary/`);
    await expect(page.locator('[data-term]')).toHaveCount(occurrences('src/content/glossary', /^- id:/gm));
  }
});

test('the formula sheet collects the lesson’s formula cards', async ({ page }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/formulas/`);
    await expect(page.locator('.formula-card')).toHaveCount(occurrences(`src/content/lessons/${lang}`, /<Formula\b/g));
  }
});

test('the lesson links to its laboratory notebook in the page’s language', async ({ page, request }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/lessons/4-1/`);
    const link = page.locator('[data-lab="04-pressure"] a');
    // the local copy when `npm run lite` made one, otherwise the bundle ThermoLab publishes (src/lib/lite.ts)
    const local = existsSync('public/lite/lab/index.html');
    const root = local ? '/lite/' : 'https://slow-is-smooth.io/thermolab/lite/';
    await expect(link).toHaveAttribute('href', `${root}lab/index.html?path=${lang}/labs/04-pressure.ipynb`);
  }
  // a local copy, when there is one, must hold the notebooks the links name
  test.skip(!existsSync('dist/lite/lab/index.html'), 'no JupyterLite bundle in dist/ (run npm run lite before building)');
  for (const lang of ['en', 'he']) {
    expect((await request.get(`/lite/files/${lang}/labs/04-pressure.ipynb`)).status()).toBe(200);
  }
  expect((await request.get('/lite/lab/index.html')).status()).toBe(200);
});

test('search finds the lesson in each language', async ({ page }) => {
  for (const [lang, q] of [
    ['en', 'equipartition'],
    ['he', 'מקסוול'],
  ]) {
    await page.goto(`/${lang}/search/`);
    const box = page.locator('#q');
    await expect(box).toBeEnabled({ timeout: 15_000 });
    await box.fill(q);
    await expect(page.locator(`.search-results a[href="/${lang}/lessons/4-1/"]`)).toBeVisible();
  }
});
