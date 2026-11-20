/**
 * Lesson 3.1 in both languages: both live figures draw, every step runs, the walker cloud's measured spread follows
 * sigma_1 sqrt(t) once a run is done, the sums figure shows the persistent walk too wide at n >= 64 and the +-1 coin's
 * lattice floor, its binomial view reports the gap to the Gaussian, the prediction loop, a graded question, and a
 * rendered page that matches its translation part for part.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { freezeSteps, hydrated, inked, overflow, progress, walkSteps } from './helpers';

const LANGS = [
  { lang: 'en', dir: 'ltr', other: 'he', correct: 'Correct!', commit: 'This is my prediction' },
  { lang: 'he', dir: 'rtl', other: 'en', correct: 'נכון!', commit: 'זה החיזוי שלי' },
] as const;

const STEPS = (readFileSync('src/content/lessons/en/ch3/3-1-random-walks.mdx', 'utf8').match(/<Step\b/g) ?? []).length;

/** the length of a run in fig-3-1a: the figure's own prop */
const RUN_STEPS = 1000;
/** how far the measured spread may sit from sigma_1 sqrt(t) at the end of a run: 4000 walkers scatter it by about 1.1% */
const SPREAD_BAND = 0.1;
/** the slider position of n = 100 (the n slider is logarithmic, N_MAX = 400) */
const SLIDER_N100 = Math.log(100) / Math.log(400);

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

const num = (t: string) => Number(t.replace('−', '-').replace('+', ''));
const texts = (fig: Locator) => fig.locator('.gas-readout b.q').allTextContents();

/** open the lesson with steps frozen, so scrolling to a figure cannot reset it mid-test */
const open = async (page: Page, lang: string, id: string) => {
  await page.goto(`/${lang}/lessons/3-1/`);
  const fig = page.locator(`#${id}`);
  await fig.scrollIntoViewIfNeeded();
  await hydrated(fig.locator('canvas'));
  await freezeSteps(page);
  return fig;
};

/** set a range input as a drag would: fill() refuses a value off the step grid */
const drag = (input: Locator, v: number) =>
  input.evaluate((el: HTMLInputElement, x: number) => {
    el.value = String(x);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

/** press Step until the run is over (the button disables itself at the end) */
const finishRun = (fig: Locator) =>
  fig
    .locator('.group:not([role]) button.toggle')
    .nth(1)
    .evaluate((b: HTMLButtonElement) => {
      for (let k = 0; k < 100 && !b.disabled; k++) b.click();
    });

for (const L of LANGS) {
  test.describe(`lesson 3.1 (${L.lang})`, () => {
    test('is in its language and direction, and links to its translation', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/3-1/`);
      await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
      await expect(page.locator('html')).toHaveAttribute('dir', L.dir);
      await expect(page.locator('.lang-switch')).toHaveAttribute('href', `/${L.other}/lessons/3-1/`);
    });

    test('both figures draw, every step runs, and nothing scrolls sideways', async ({ page }) => {
      const errors = errorsOf(page);
      await page.goto(`/${L.lang}/lessons/3-1/`);
      for (const fig of ['#fig-3-1a', '#fig-3-1b']) {
        const canvas = page.locator(`${fig} canvas`).first();
        await canvas.scrollIntoViewIfNeeded();
        await hydrated(canvas);
        await expect.poll(() => inked(canvas)).toBeGreaterThan(200);
      }
      expect(await walkSteps(page)).toBe(STEPS);
      expect(await overflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test('walkers: at the end of a run the measured spread is near sigma_1 sqrt(t), for several seeds and steps', async ({ page }) => {
      const fig = await open(page, L.lang, 'fig-3-1a');
      const groups = fig.locator('[role=group]');
      const buttons = fig.locator('.group:not([role]) button.toggle');
      // the figure opens on one walker in the cloud panel: switch to the whole cloud's spread panel
      await groups.nth(1).locator('.toggle').nth(2).click();
      await groups.nth(1).locator('.toggle').nth(1).click();
      const ratios: number[] = [];
      // coin on three seeds, then the uniform and the heavy-tailed step (each has its own sigma_1)
      for (const kind of [0, 0, 0, 2, 3]) {
        await groups.nth(0).locator('.toggle').nth(kind).click();
        await buttons.nth(2).click();
        await finishRun(fig);
        await expect.poll(async () => num((await texts(fig))[0])).toBe(RUN_STEPS);
        // readouts: t, mean +- standard error, spread, sigma_1 sqrt(t)
        const t = await texts(fig);
        expect(t).toHaveLength(4);
        const ratio = num(t[2]) / num(t[3]);
        ratios.push(ratio);
        expect(Math.abs(ratio - 1), `step ${kind}: ${t.join(' | ')}`).toBeLessThan(SPREAD_BAND);
      }
      test.info().annotations.push({ type: 'ratios', description: ratios.map((r) => r.toFixed(4)).join(' ') });
    });

    test('sums: at n >= 64 the persistent walk is much wider than the uniform one, and the coin sits above its lattice floor', async ({ page }) => {
      const fig = await open(page, L.lang, 'fig-3-1b');
      // a step may have set the view or the distributions while the page scrolled here: show all four, standardised
      await fig.locator('[role=group]').first().locator('.toggle').nth(0).click();
      for (const dist of await fig.locator('[role=group]').nth(1).locator('.toggle').all()) {
        if ((await dist.getAttribute('aria-pressed')) !== 'true') await dist.click();
      }
      await drag(fig.locator('input[type=range]').nth(1), 0.5);
      await drag(fig.locator('input[type=range]').first(), SLIDER_N100);
      await expect.poll(async () => num((await texts(fig))[0])).toBeGreaterThanOrEqual(64);
      // the sums are ready when the readout stops saying it is computing (the dot before that word)
      await expect(fig.locator('.gas-readout > span').first()).not.toContainText('·');
      // the persistent walk's variance ratio, 2.9 at q = 0.5, is the last to arrive: the sums are ready once it reads above 2
      await expect.poll(async () => num((await texts(fig))[8]), { timeout: 10_000 }).toBeGreaterThan(2);
      // readouts: n; then D and variance ratio for the coin, uniform, heavy tail and persistent walk; the lattice floor
      const t = (await texts(fig)).map(num);
      expect(t).toHaveLength(10);
      const [n, dCoin, , dUniform, , dHeavy, , dPersistent, varPersistent, floor] = t;
      expect(dPersistent).toBeGreaterThan(dUniform + 0.05);
      expect(dPersistent).toBeGreaterThan(dHeavy + 0.05);
      expect(varPersistent, t.join(" ")).toBeGreaterThan(2);
      // the coin's staircase puts a floor under its distance, 0.4 / sqrt(n); a Gaussian sample would sit near 0.014
      expect(floor).toBeCloseTo(0.4 / Math.sqrt(n), 1);
      expect(dCoin).toBeGreaterThan(floor - 0.015);
      expect(dUniform).toBeLessThan(floor);
    });

    test('binomial view: the readout gives the gap to the Gaussian, 1e-3 of a standard deviation at n = 100', async ({ page }) => {
      const fig = await open(page, L.lang, 'fig-3-1b');
      await fig.locator('[role=group]').first().locator('.toggle').nth(1).click();
      await drag(fig.locator('input[type=range]').first(), SLIDER_N100);
      await expect.poll(async () => num((await texts(fig))[0])).toBeGreaterThanOrEqual(64);
      // readouts: n, largest gap, error at +3 sigma, error at -3 sigma; the gap in units of sigma is printed beside it
      const gap = fig.locator('.gas-readout > span').nth(1);
      const scaled = async () => Number((await gap.innerText()).match(/(\d\.\d+e-\d+)\D*$/)?.[1]);
      await expect.poll(scaled).toBeGreaterThan(5e-4);
      expect(await scaled()).toBeLessThan(2e-3);
      expect(await texts(fig)).toHaveLength(4);
    });

    test('a prediction opens its flap and comes back in the summary', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/3-1/`);
      const predict = page.locator('[data-predict-id="pred-3-1"]');
      await predict.scrollIntoViewIfNeeded();
      await hydrated(predict);
      await predict.locator('.q-choice').nth(0).click();
      await predict.getByRole('button', { name: L.commit }).click();
      await expect(predict).toHaveClass(/is-open/);
      expect((await progress(page)).predictions['pred-3-1'].choice).toBe('0');
      await page.locator('.revisit').scrollIntoViewIfNeeded();
      await expect(page.locator('.revisit.wrong')).toBeVisible();
    });

    test('a numeric question grades in the page language', async ({ page }) => {
      await page.goto(`/${L.lang}/lessons/3-1/`);
      const card = page.locator('[data-qid="Q-3.1-rms-400"]');
      await card.scrollIntoViewIfNeeded();
      await hydrated(card);
      await card.locator('input').fill('20');
      await card.locator('.q-actions .btn.primary').click();
      await expect(card.locator('.q-verdict')).toHaveText(L.correct);
    });
  });
}

test('the two languages render lesson 3.1 the same, part for part', async ({ page }) => {
  const shape = async (lang: string) => {
    await page.goto(`/${lang}/lessons/3-1/`);
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
