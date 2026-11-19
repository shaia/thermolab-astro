import { expect, type Locator, type Page } from '@playwright/test';

export const progress = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('thermolab:v1') ?? 'null'));

/** Count of inked pixels (sampled) on a canvas: zero means the figure drew nothing. */
export const inked = (c: Locator) =>
  c.evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
    let n = 0;
    for (let k = 3; k < d.length; k += 4 * 7) if (d[k] > 0) n++;
    return n;
  });

/**
 * Wait until the island around `el` has hydrated (Astro then drops its `ssr` attribute). Text typed
 * or a choice clicked before that lands in the static HTML and never reaches the component.
 */
export const hydrated = (el: Locator) => expect(el.locator('xpath=ancestor-or-self::astro-island[1]')).not.toHaveAttribute('ssr');

/**
 * Walk every text step in the page, top to bottom: scroll it to the middle instantly, give the
 * IntersectionObserver two frames to announce it, then click it (a click re-announces its state).
 */
export const walkSteps = (page: Page) =>
  page.evaluate(async () => {
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-step]'))) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      await frame();
      await frame();
      el.click();
    }
    return document.querySelectorAll('[data-step]').length;
  });

/**
 * Stop text steps from driving the figures. Scrolling to a figure can bring a step to mid-screen, and
 * the step then resets the figure mid-test (by design: it is scrollytelling). The step is dropped at
 * dispatch, which is where steps.ts announces it.
 */
export const freezeSteps = (page: Page) =>
  page.evaluate(() => {
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (e: Event) => (e.type === 'thermolab:step' ? true : dispatch(e));
  });

/** The page scrolls sideways by this many pixels; a layout that fits the screen gives 0. */
export const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
