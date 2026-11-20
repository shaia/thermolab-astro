/**
 * Lesson 15.1 in both languages: the three live Ising figures draw, every step drives them, a step
 * sets the lattice, the temperature sweep finds its susceptibility peak above Onsager's T_c, the
 * prediction loop, a graded question, and a rendered page that matches its translation part for part.
 */

import { expect, test, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, overflow, progress, walkSteps } from './helpers';

const LANGS = [
  { lang: 'en', dir: 'ltr', other: 'he', correct: 'Correct!', commit: 'This is my prediction' },
  { lang: 'he', dir: 'rtl', other: 'en', correct: 'נכון!', commit: 'זה החיזוי שלי' },
] as const;

const ONSAGER_TC = 2 / Math.log(1 + Math.SQRT2);

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

for (const L of LANGS) {
  test.describe(`lesson 15.1 (${L.lang})`, () => {
    test('is in its language and direction, and links to its translation', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/15-1/`);
      await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
      await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
      await expect(page.locator('.lang-switch')).toHaveAttribute('href', `/${L.other}/lessons/15-1/`);
    });

    test('all three figures draw, every step runs, and nothing scrolls sideways', async ({ page }) => {
      const errors = errorsOf(page);
      await page.goto(`/${L.lang}/lessons/15-1/`);
      for (const fig of ['#fig-15-1a', '#fig-15-1b', '#fig-15-1c']) {
        const canvas = page.locator(`${fig} canvas`);
        await canvas.scrollIntoViewIfNeeded();
        await hydrated(canvas);
        await expect.poll(() => inked(canvas)).toBeGreaterThan(200);
      }
      expect(await walkSteps(page)).toBe(25);
      expect(await overflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('a step sets the lattice: a small lattice below T_c, with the exact m0 beside it', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/15-1/`);
      const fig = page.locator('#fig-15-1a');
      await fig.scrollIntoViewIfNeeded();
      await hydrated(fig.locator('canvas'));
      await page.locator('#small').click();
      await freezeSteps(page);
      await fig.locator('canvas').scrollIntoViewIfNeeded();
      // Onsager and Yang at k_BT = 2.0 J
      await expect(fig.locator('.gas-readout b').nth(3)).toHaveText('0.911');
      // the run is alive: the sweep counter moves
      const sweeps = async () => Number((await fig.locator('.gas-readout b').first().textContent())?.replace(/\D/g, '') ?? 0);
      const first = await sweeps();
      await expect.poll(sweeps).toBeGreaterThan(first);
    });

    test('the sweep puts the L = 64 susceptibility peak just above Onsager\'s T_c', async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto(`/${L.lang}/lessons/15-1/`);
      const fig = page.locator('#fig-15-1b');
      await fig.scrollIntoViewIfNeeded();
      await hydrated(fig.locator('canvas'));
      await page.locator('#identities').click();
      await freezeSteps(page);
      await fig.locator('canvas').scrollIntoViewIfNeeded();
      const peak64 = async () => {
        const rows = await fig.locator('.gas-readout').innerText();
        const m = rows.match(/L = 64[^@]*@ T = ([\d.]+)/);
        return m ? Number(m[1]) : NaN;
      };
      await expect.poll(peak64, { timeout: 120_000, intervals: [2000] }).toBeGreaterThan(ONSAGER_TC - 0.03);
      expect(await peak64()).toBeLessThan(ONSAGER_TC + 0.2);
    });

    test('a prediction opens its flap and comes back in the summary', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/15-1/`);
      const predict = page.locator('[data-predict-id="pred-15-1"]');
      await predict.scrollIntoViewIfNeeded();
      await hydrated(predict);
      await predict.locator('.q-choice').nth(1).click();
      await predict.getByRole('button', { name: L.commit }).click();
      await expect(predict).toHaveClass(/is-open/);
      expect((await progress(page)).predictions['pred-15-1'].choice).toBe('1');
      await page.locator('.revisit').scrollIntoViewIfNeeded();
      await expect(page.locator('.revisit.right')).toBeVisible();
    });

    test('a numeric question grades in the page language', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/15-1/`);
      const card = page.locator('[data-qid="Q-15.1-metropolis-accept"]');
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input').fill('0.135');
      await card.locator('.q-actions .btn.primary').click();
      await expect(card.locator('.q-verdict')).toHaveText(L.correct);
    });
  });
}

test('the two languages render lesson 15.1 the same, part for part', async ({ page }) => {
  const shape = async (lang: string) => {
    await page.goto(`/${lang}/lessons/15-1/`);
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
