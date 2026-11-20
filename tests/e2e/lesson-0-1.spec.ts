/**
 * Lesson 0.1 in both languages: the three live figures draw, every step runs, the dice spread matches
 * the N^(-1/2) law, the form-paths readouts match the physics, the prediction loop, a graded question,
 * and a rendered page that matches its translation part for part.
 */

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { freezeSteps, hydrated, inked, overflow, progress, walkSteps } from './helpers';

const LANGS = [
  { lang: 'en', dir: 'ltr', other: 'he', correct: 'Correct!', commit: 'This is my prediction' },
  { lang: 'he', dir: 'rtl', other: 'en', correct: 'נכון!', commit: 'זה החיזוי שלי' },
] as const;

const STEPS = (readFileSync('src/content/lessons/en/ch0/0-1-orientation.mdx', 'utf8').match(/<Step\b/g) ?? []).length;

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

/** Open a figure, click the step that sets it, then stop later steps from resetting it. */
const setByStep = async (page: Page, fig: string, step: string) => {
  const figure = page.locator(fig);
  await figure.scrollIntoViewIfNeeded();
  await hydrated(figure.locator('canvas'));
  await page.locator(step).click();
  await freezeSteps(page);
  await figure.locator('canvas').scrollIntoViewIfNeeded();
  return figure;
};

const readouts = async (fig: ReturnType<Page['locator']>) => (await fig.locator('.gas-readout b.q').allTextContents()).map((t) => Number(t.replace('−', '-').replace('+', '')));

for (const L of LANGS) {
  test.describe(`lesson 0.1 (${L.lang})`, () => {
    test('is in its language and direction, and links to its translation', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/0-1/`);
      await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
      await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
      await expect(page.locator('.lang-switch')).toHaveAttribute('href', `/${L.other}/lessons/0-1/`);
    });

    test('all three figures draw, every step runs, and nothing scrolls sideways', async ({ page }) => {
      const errors = errorsOf(page);
      await page.goto(`/${L.lang}/lessons/0-1/`);
      for (const fig of ['#fig-0-1a', '#fig-0-1b', '#fig-0-1c']) {
        const canvas = page.locator(`${fig} canvas`).first();
        await canvas.scrollIntoViewIfNeeded();
        await hydrated(canvas);
        await expect.poll(() => inked(canvas)).toBeGreaterThan(200);
      }
      expect(await walkSteps(page)).toBe(STEPS);
      expect(await overflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('form paths: the inexact form gives 1 and 2, heat 2.193 and 2.886, entropy 1.733', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/0-1/`);
      let fig = await setByStep(page, '#fig-0-1c', '#line-integral');
      let v = await readouts(fig);
      expect(v.slice(0, 3)).toEqual([1, 2, 1.5]);
      // freezeSteps lasts until reload, so each state starts from a fresh page
      await page.goto(`/${L.lang}/lessons/0-1/`);
      fig = await setByStep(page, '#fig-0-1c', '#units');
      v = await readouts(fig);
      expect(v[0]).toBeCloseTo(2.193, 3);
      expect(v[1]).toBeCloseTo(2.886, 3);
      await page.goto(`/${L.lang}/lessons/0-1/`);
      fig = await setByStep(page, '#fig-0-1c', '#integrating-factor');
      v = await readouts(fig);
      expect(v[0]).toBeCloseTo(1.733, 3);
      expect(v[1]).toBeCloseTo(1.733, 3);
      expect(v[2]).toBeCloseTo(1.733, 3);
    });

    test('dice spread: at N = 100 the measured relative spread is within 15% of the predicted value', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/0-1/`);
      const fig = await setByStep(page, '#fig-0-1b', '#law');
      await expect.poll(async () => (await readouts(fig))[0]).toBe(100);
      const [, measured, predicted] = await readouts(fig);
      expect(Math.abs(measured - predicted) / predicted).toBeLessThan(0.15);
      expect(predicted).toBeCloseTo(1.708 / 10, 2);
    });

    test('a prediction opens its flap and comes back in the summary', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/0-1/`);
      const predict = page.locator('[data-predict-id="pred-0-1"]');
      await predict.scrollIntoViewIfNeeded();
      await hydrated(predict);
      await predict.locator('.q-choice').nth(1).click();
      await predict.getByRole('button', { name: L.commit }).click();
      await expect(predict).toHaveClass(/is-open/);
      expect((await progress(page)).predictions['pred-0-1'].choice).toBe('1');
      await page.locator('.revisit').scrollIntoViewIfNeeded();
      await expect(page.locator('.revisit.wrong')).toBeVisible();
    });

    test('a numeric question grades in the page language', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/0-1/`);
      const card = page.locator('[data-qid="Q-0.1-die-variance"]');
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input').fill('2.917');
      await card.locator('.q-actions .btn.primary').click();
      await expect(card.locator('.q-verdict')).toHaveText(L.correct);
    });
  });
}

test('the two languages render lesson 0.1 the same, part for part', async ({ page }) => {
  const shape = async (lang: string) => {
    await page.goto(`/${lang}/lessons/0-1/`);
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
