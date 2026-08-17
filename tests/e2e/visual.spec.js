import { expect, test } from '@playwright/test';

/** Deterministic visual smoke coverage: captures every release state without committing platform-specific PNG baselines. */
test.describe('visual states', () => {
  test('levels, tiers, boost, pause, results, and shop render pixels', async ({
    page,
  }, testInfo) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    const capture = async (name) => {
      const image = await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
      expect(image.byteLength, `${name} screenshot`).toBeGreaterThan(25_000);
    };
    await capture('title');
    await page.getByRole('button', { name: 'Shark Shop' }).click();
    await capture('shop');
    await page.getByRole('button', { name: 'Back to title' }).click();
    await page.getByRole('button', { name: 'Dive in' }).click();
    await page.getByRole('button', { name: 'Sunny Lagoon' }).click();
    await page.getByRole('button', { name: 'Start dive' }).click();
    await page.waitForTimeout(2400);
    await capture('lagoon-tier-one');
    await page.evaluate(() => window.__sharkyTest?.pause());
    await capture('pause');
    await page.evaluate(() => window.__sharkyTest?.resume());
    await page.evaluate(() => window.__sharkyTest?.advance(20_000));
    await expect(page.getByRole('heading', { name: 'Fin-tastic!' })).toBeVisible();
    await capture('results');
    await page.getByRole('button', { name: 'Shark Shop' }).click();
    await page.evaluate(() => {
      window.__sharkyTest?.grant(50);
      window.__sharkyTest?.buy('growth');
    });
    await capture('shop-growth-tier-two');
    await page.evaluate(() => window.__sharkyTest?.level('coral-reef'));
    await page.evaluate(() => window.__sharkyTest?.start());
    await page.waitForTimeout(2500);
    await capture('reef-tier-two-boost-ready');
    await page.evaluate(() => window.__sharkyTest?.boost());
    await capture('reef-boost-active');
  });
});
