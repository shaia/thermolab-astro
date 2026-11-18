/**
 * Lesson 4.1 in both languages: the same lesson, mirrored. Direction and language switch, the two
 * live figures, the steps driving them, the prediction loop, a graded question, and a rendered
 * page that matches its translation part for part.
 */

import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, overflow, progress, walkSteps } from './helpers';

const LANGS = [
  { lang: 'en', dir: 'ltr', other: 'he', correct: 'Correct!', commit: 'This is my prediction', heavy: '4× argon' },
  { lang: 'he', dir: 'rtl', other: 'en', correct: 'נכון!', commit: 'זה החיזוי שלי', heavy: 'פי 4 מארגון' },
] as const;

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

for (const L of LANGS) {
  test.describe(`lesson 4.1 (${L.lang})`, () => {
    test('is in its language and direction, and links to its translation', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/4-1/`);
      await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
      await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
      const sw = page.locator('.lang-switch');
      await expect(sw).toHaveAttribute('href', `/${L.other}/lessons/4-1/`);
      await sw.click();
      await expect(page).toHaveURL(new RegExp(`/${L.other}/lessons/4-1/$`));
    });

    test('both figures draw, every step runs, and nothing scrolls sideways', async ({ page }) => {
      const errors = errorsOf(page);
      await page.goto(`/${L.lang}/lessons/4-1/`);
      for (const fig of ['#fig-4-1a', '#fig-4-1b']) {
        const canvas = page.locator(`${fig} canvas`);
        await canvas.scrollIntoViewIfNeeded();
        await hydrated(canvas);
        await expect.poll(() => inked(canvas)).toBeGreaterThan(200);
      }
      expect(await walkSteps(page)).toBe(13);
      expect(await overflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('a step sets the gas, and the gas runs to the ideal-gas value', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/4-1/`);
      const fig = page.locator('#fig-4-1a');
      await fig.scrollIntoViewIfNeeded();
      await hydrated(fig.locator('canvas'));
      await page.locator('#many').click();
      // on a phone the figure sits above the text: scrolling back to it must not let earlier steps reset it
      await freezeSteps(page);
      await fig.locator('canvas').scrollIntoViewIfNeeded();
      await expect(fig.locator('.slider output').first()).toHaveText('2000');
      // the running average settles within a few percent of N k_B T / A
      await expect
        .poll(async () => Number((await fig.locator('.gas-readout b').nth(2).textContent()) ?? 0), { timeout: 15_000 })
        .toBeGreaterThan(0.95);
      expect(Number(await fig.locator('.gas-readout b').nth(2).textContent())).toBeLessThan(1.05);
    });

    test('a prediction opens its flap and comes back in the summary', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/4-1/`);
      const predict = page.locator('[data-predict-id="pred-4-1"]');
      await predict.scrollIntoViewIfNeeded();
      await hydrated(predict);
      await predict.locator('.q-choice').nth(2).click();
      await predict.getByRole('button', { name: L.commit }).click();
      await expect(predict).toHaveClass(/is-open/);
      expect((await progress(page)).predictions['pred-4-1'].choice).toBe('2');
      // the summary's island hydrates when it scrolls into view, and only then reads the prediction
      await page.locator('.revisit').scrollIntoViewIfNeeded();
      await expect(page.locator('.revisit.right')).toBeVisible();
    });

    test('a numeric question grades in the page language', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/4-1/`);
      const card = page.locator('[data-qid="Q-4.1-ten-thousand"]');
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input').fill('0.01');
      await card.locator('.q-actions .btn.primary').click();
      await expect(card.locator('.q-verdict')).toHaveText(L.correct);
    });
  });
}

test('the two languages render the same lesson, part for part', async ({ page }) => {
  const shape = async (lang: string) => {
    await page.goto(`/${lang}/lessons/4-1/`);
    return page.evaluate(() => ({
      blocks: [...document.querySelectorAll('[data-block]')].map((b) => (b as HTMLElement).dataset.block),
      steps: [...document.querySelectorAll<HTMLElement>('[data-step]')].map((s) => s.dataset.state),
      display: document.querySelectorAll('.katex-display').length,
      questions: [...document.querySelectorAll<HTMLElement>('[data-qid]')].map((q) => q.dataset.qid),
      figures: [...document.querySelectorAll('figure.fig')].map((f) => f.id),
      terms: document.querySelectorAll('.term').length,
    }));
  };
  expect(await shape('he')).toEqual(await shape('en'));
});

test('the contents list all nineteen modules in both languages, and the root chooses one', async ({ page }) => {
  for (const lang of ['en', 'he']) {
    await page.goto(`/${lang}/`);
    await expect(page.locator('[data-lesson-id]')).toHaveCount(19);
    await expect(page.locator('[data-lesson-id="4.1"] a')).toHaveAttribute('href', `/${lang}/lessons/4-1/`);
  }
  await page.goto('/');
  await expect(page).toHaveURL(/\/(en|he)\/$/);
});
