/**
 * Lesson 1.1 in both languages: both live figures draw, every step runs, the two-body readouts match the
 * physics (T_eq 1.75, tau 699.5, the energy constant), the averaged RMS ratio of the relaxation figure sits near
 * sqrt(factor), the prediction loop, a graded question, and a rendered page that matches its translation part
 * for part.
 */

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { freezeSteps, hydrated, inked, overflow, progress, walkSteps } from './helpers';

const LANGS = [
  { lang: 'en', dir: 'ltr', other: 'he', correct: 'Correct!', commit: 'This is my prediction' },
  { lang: 'he', dir: 'rtl', other: 'en', correct: 'נכון!', commit: 'זה החיזוי שלי' },
] as const;

const STEPS = (readFileSync('src/content/lessons/en/ch1/1-1-equilibrium.mdx', 'utf8').match(/<Step\b/g) ?? []).length;

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

const texts = (fig: ReturnType<Page['locator']>) => fig.locator('.gas-readout b.q').allTextContents();
const num = (t: string) => Number(t.replace('−', '-').replace('+', ''));

for (const L of LANGS) {
  test.describe(`lesson 1.1 (${L.lang})`, () => {
    test('is in its language and direction, and links to its translation', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/1-1/`);
      await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
      await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
      await expect(page.locator('.lang-switch')).toHaveAttribute('href', `/${L.other}/lessons/1-1/`);
    });

    test('both figures draw, every step runs, and nothing scrolls sideways', async ({ page }) => {
      const errors = errorsOf(page);
      await page.goto(`/${L.lang}/lessons/1-1/`);
      for (const fig of ['#fig-1-1a', '#fig-1-1b']) {
        const canvas = page.locator(`${fig} canvas`).first();
        await canvas.scrollIntoViewIfNeeded();
        await hydrated(canvas);
        await expect.poll(() => inked(canvas)).toBeGreaterThan(200);
      }
      expect(await walkSteps(page)).toBe(STEPS);
      expect(await overflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('two bodies: T_eq reads 1.75, tau about 699.5, and the energy total stays constant while it runs', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/1-1/`);
      const fig = page.locator('#fig-1-1a');
      await fig.scrollIntoViewIfNeeded();
      await hydrated(fig.locator('canvas'));
      await freezeSteps(page);
      await fig.locator('canvas').scrollIntoViewIfNeeded();
      // readouts in order: steps, T_A, T_B, T_eq, tau, energy
      const first = (await texts(fig)).map(num);
      expect(first[3]).toBeCloseTo(1.75, 3);
      expect(first[4]).toBeCloseTo(699.5, 0);
      const total = first[5];
      expect(total).toBe(700);
      // the run advances, and the total never changes
      await expect.poll(async () => num((await texts(fig))[0]), { timeout: 15_000 }).toBeGreaterThan(300);
      for (let k = 0; k < 5; k++) {
        const v = (await texts(fig)).map(num);
        expect(v[5]).toBe(total);
        expect(v[3]).toBeCloseTo(1.75, 3);
        await page.waitForTimeout(200);
      }
    });

    test('relaxation scale: the averaged RMS ratios stay within a loose band around sqrt(factor)', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/1-1/`);
      const fig = page.locator('#fig-1-1b');
      await fig.scrollIntoViewIfNeeded();
      await hydrated(fig.locator('canvas'));
      // readouts: three panels of (N, RMS of the run, RMS of the mean), then run ratios, mean ratios, expected
      const t = await texts(fig);
      expect(t).toHaveLength(12);
      const expected = num(t[11]);
      expect(expected).toBeCloseTo(Math.sqrt(10), 2);
      // the seed is fixed, so this is deterministic; over 200 seeds the 16-run mean ratio spans 2.4 to 4.2
      const ratios = t[10].split(',').map(num);
      expect(ratios).toHaveLength(2);
      for (const r of ratios) {
        expect(r).toBeGreaterThan(expected * 0.65);
        expect(r).toBeLessThan(expected * 1.4);
      }
      // the scatter falls as the pairs grow
      const rms = [2, 5, 8].map((k) => num(t[k]));
      expect(rms[0]).toBeGreaterThan(rms[1]);
      expect(rms[1]).toBeGreaterThan(rms[2]);
    });

    test('a prediction opens its flap and comes back in the summary', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/1-1/`);
      const predict = page.locator('[data-predict-id="pred-1-1"]');
      await predict.scrollIntoViewIfNeeded();
      await hydrated(predict);
      await predict.locator('.q-choice').nth(0).click();
      await predict.getByRole('button', { name: L.commit }).click();
      await expect(predict).toHaveClass(/is-open/);
      expect((await progress(page)).predictions['pred-1-1'].choice).toBe('0');
      await page.locator('.revisit').scrollIntoViewIfNeeded();
      await expect(page.locator('.revisit.wrong')).toBeVisible();
    });

    test('a numeric question grades in the page language', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/1-1/`);
      const card = page.locator('[data-qid="Q-1.1-teq"]');
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input').fill('35');
      await card.locator('.q-actions .btn.primary').click();
      await expect(card.locator('.q-verdict')).toHaveText(L.correct);
    });
  });
}

test('the two languages render lesson 1.1 the same, part for part', async ({ page }) => {
  const shape = async (lang: string) => {
    await page.goto(`/${lang}/lessons/1-1/`);
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
