/**
 * Lesson 2.1 in both languages: both live figures draw, every step runs, the isotherm figure's readouts match the
 * physics (zero slope at the inflection point of the critical isotherm, T_r = 0.9207 with the CO2 data on, the CO2
 * datum's Z below ideal and nearer the van der Waals value in the vapour range), the surface rotates from the keyboard
 * and ticks its task, the prediction loop, a graded question, and a rendered page that matches its translation part
 * for part.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { freezeSteps, hydrated, inked, overflow, progress, walkSteps } from './helpers';

const LANGS = [
  { lang: 'en', dir: 'ltr', other: 'he', correct: 'Correct!', commit: 'This is my prediction' },
  { lang: 'he', dir: 'rtl', other: 'en', correct: 'נכון!', commit: 'זה החיזוי שלי' },
] as const;

const STEPS = (readFileSync('src/content/lessons/en/ch2/2-1-equations-of-state.mdx', 'utf8').match(/<Step\b/g) ?? []).length;

/** the isotherm figure's volume window with the CO2 data on (X_CO2 in VdwIsotherm.tsx) */
const X_CO2 = [0.35, 50] as const;
/** the saturated vapour of CO2 at 280 K sits at v_r of about 3.8: the vapour range is above it */
const VAPOUR_FROM = 4;

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

const texts = (fig: Locator) => fig.locator('.gas-readout b.q').allTextContents();
const num = (t: string) => Number(t.replace('−', '-').replace('+', ''));

/** open the lesson with steps frozen, so scrolling to a figure cannot reset it mid-test */
const open = async (page: Page, lang: string, id: string) => {
  await page.goto(`/${lang}/lessons/2-1/`);
  const fig = page.locator(`#${id}`);
  await fig.scrollIntoViewIfNeeded();
  await hydrated(fig.locator('canvas'));
  await freezeSteps(page);
  return fig;
};

for (const L of LANGS) {
  test.describe(`lesson 2.1 (${L.lang})`, () => {
    test('is in its language and direction, and links to its translation', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/2-1/`);
      await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
      await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
      await expect(page.locator('.lang-switch')).toHaveAttribute('href', `/${L.other}/lessons/2-1/`);
    });

    test('both figures draw, every step runs, and nothing scrolls sideways', async ({ page }) => {
      const errors = errorsOf(page);
      await page.goto(`/${L.lang}/lessons/2-1/`);
      for (const fig of ['#fig-2-1a', '#fig-2-1b']) {
        const canvas = page.locator(`${fig} canvas`).first();
        await canvas.scrollIntoViewIfNeeded();
        await hydrated(canvas);
        await expect.poll(() => inked(canvas)).toBeGreaterThan(200);
      }
      expect(await walkSteps(page)).toBe(STEPS);
      expect(await overflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('isotherm: at T_r = 1 the inflection slope reads 0', async ({ page }) => {
      const fig = await open(page, L.lang, 'fig-2-1b');
      await fig.locator('input[type=range]').first().fill('1');
      // readouts: T_r, slope, v_r of the inflection point, cursor v_r, P_r, Z, ideal P_r, ideal Z
      await expect.poll(async () => (await texts(fig))[0]).toBe('1.000');
      const t = (await texts(fig)).map(num);
      expect(t).toHaveLength(8);
      expect(t[1]).toBeCloseTo(0, 3);
      expect(t[2]).toBeCloseTo(1, 2);
    });

    test('isotherm with CO2 on: T_r reads 0.9207, and in the vapour the datum is below ideal and nearer van der Waals', async ({ page }) => {
      const fig = await open(page, L.lang, 'fig-2-1b');
      await fig.locator('.toggle', { hasText: 'CO₂' }).click();
      await expect.poll(async () => (await texts(fig))[0]).toBe('0.9207');
      for (const vr of [5, 8]) {
        const t = Math.log(vr / X_CO2[0]) / Math.log(X_CO2[1] / X_CO2[0]);
        // fill() refuses a range value off the step grid; set it and announce it as a drag would
        await fig.locator('input[type=range]').nth(1).evaluate((el: HTMLInputElement, v: number) => {
          el.value = String(v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, t);
        // counting from the end: cursor v_r, vdW P_r, Z, ideal P_r, Z, datum P_r, Z
        await expect.poll(async () => num((await texts(fig)).at(-7)!)).toBeCloseTo(vr, 0);
        const b = (await texts(fig)).map(num);
        const [cursor, zVdw, zIdeal, zDatum] = [b[b.length - 7], b[b.length - 5], b[b.length - 3], b[b.length - 1]];
        expect(cursor).toBeGreaterThan(VAPOUR_FROM);
        expect(zIdeal).toBe(1);
        expect(zDatum).toBeLessThan(1);
        expect(Math.abs(zDatum - zVdw)).toBeLessThan(Math.abs(zDatum - zIdeal));
      }
    });

    test('surface: the arrow keys rotate it, and enough rotation ticks the rotate task', async ({ page }) => {
      const fig = await open(page, L.lang, 'fig-2-1a');
      const azimuth = fig.locator('input[type=range]').nth(1);
      const before = await azimuth.getAttribute('aria-valuetext');
      const tasks = fig.locator('.sim-tasks li');
      await expect(tasks).toHaveCount(4);
      await expect(tasks.nth(3)).not.toHaveClass(/done/);
      await fig.locator('canvas').focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => azimuth.getAttribute('aria-valuetext')).not.toBe(before);
      expect((await progress(page))?.tasks?.['fig-2-1a:rotate']).toBeUndefined();
      // 5 degrees a press: nine presses in all pass the 40 degree threshold
      for (let k = 0; k < 8; k++) await page.keyboard.press('ArrowRight');
      await expect(tasks.nth(3)).toHaveClass(/done/);
      expect((await progress(page)).tasks['fig-2-1a:rotate']).toBeGreaterThan(0);
    });

    test('a prediction opens its flap and comes back in the summary', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/2-1/`);
      const predict = page.locator('[data-predict-id="pred-2-1"]');
      await predict.scrollIntoViewIfNeeded();
      await hydrated(predict);
      await predict.locator('.q-choice').nth(0).click();
      await predict.getByRole('button', { name: L.commit }).click();
      await expect(predict).toHaveClass(/is-open/);
      expect((await progress(page)).predictions['pred-2-1'].choice).toBe('0');
      await page.locator('.revisit').scrollIntoViewIfNeeded();
      await expect(page.locator('.revisit.wrong')).toBeVisible();
    });

    test('a numeric question grades in the page language', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/2-1/`);
      const card = page.locator('[data-qid="Q-2.1-boyle"]');
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input').fill('521.7');
      await card.locator('.q-actions .btn.primary').click();
      await expect(card.locator('.q-verdict')).toHaveText(L.correct);
    });
  });
}

test('the two languages render lesson 2.1 the same, part for part', async ({ page }) => {
  const shape = async (lang: string) => {
    await page.goto(`/${lang}/lessons/2-1/`);
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
