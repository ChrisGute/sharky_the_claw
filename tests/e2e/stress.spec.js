import { expect, test } from '@playwright/test';
test('ten completed rounds retain a usable scene', async ({ page, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'Lifecycle stress runs once in Chromium; Firefox/WebKit retain smoke coverage.',
  );
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
  await page.evaluate(() => window.__sharkyTest?.startActive());
  for (let round = 0; round < 10; round += 1) {
    await expect
      .poll(() => page.evaluate(() => window.__sharkyTest?.state().round?.phase))
      .toBe('active');
    await page.evaluate(() => window.__sharkyTest?.advance(20_000));
    if (round < 9) {
      await page.evaluate(() => window.__sharkyTest?.startActive());
    }
  }
  expect(await page.evaluate(() => window.__sharkyTest?.state().round.settled)).toBe(true);
});
