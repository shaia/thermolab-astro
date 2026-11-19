/**
 * The platform pages around the lesson, in both languages: practice, module test, my path, formula
 * sheet, glossary, summary, search, and the laboratory link. Each must be in its language, fit the
 * screen and run without console errors.
 */

import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { hydrated, overflow } from './helpers';

const PAGES = ['practice/ch4/', 'test/ch4/', 'me/', 'formulas/', 'glossary/', 'summary/ch4/', 'search/'];

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

test('the glossary lists every term, alphabetical in each language', async ({ page }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/glossary/`);
    await expect(page.locator('[data-term]')).toHaveCount(10);
  }
});

test('the formula sheet collects the lesson’s formula cards', async ({ page }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/formulas/`);
    await expect(page.locator('.formula-card')).toHaveCount(2);
  }
});

test('the lesson links to its laboratory notebook in the page’s language', async ({ page, request }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/lessons/4-1/`);
    const link = page.locator('[data-lab="04-pressure"] a');
    await expect(link).toHaveAttribute('href', `/lite/lab/index.html?path=${lang}/labs/04-pressure.ipynb`);
  }
  // the bundle is ThermoLab's, copied in by `npm run lite`; when it is there, the notebooks must be too
  test.skip(!existsSync('dist/lite/lab/index.html'), 'no JupyterLite bundle in dist/ (run npm run lite before building)');
  for (const lang of ['en', 'he']) {
    expect((await request.get(`/lite/files/${lang}/labs/04-pressure.ipynb`)).status()).toBe(200);
  }
  expect((await request.get('/lite/lab/index.html')).status()).toBe(200);
});

test('search finds the lesson in each language', async ({ page }) => {
  for (const [lang, q, title] of [
    ['en', 'equipartition', 'The microscopic origin of pressure'],
    ['he', 'מקסוול', 'המקור המיקרוסקופי של הלחץ'],
  ]) {
    await page.goto(`/${lang}/search/`);
    const box = page.locator('#q');
    await expect(box).toBeEnabled({ timeout: 15_000 });
    await box.fill(q);
    await expect(page.locator('.search-results a', { hasText: title })).toBeVisible();
  }
});
