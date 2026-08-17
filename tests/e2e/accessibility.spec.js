import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('semantic title, shop, and pause UI have no serious axe violations', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'axe-core is audited in Chromium; Firefox/WebKit retain smoke coverage.',
  );
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
  for (const state of ['title', 'shop', 'pause']) {
    if (state === 'shop') await page.getByRole('button', { name: 'Shark Shop' }).click();
    if (state === 'pause') {
      await page.getByRole('button', { name: 'Back to title' }).click();
      await page.getByRole('button', { name: 'Dive in' }).click();
      await page.getByRole('button', { name: 'Sunny Lagoon' }).click();
      await page.getByRole('button', { name: 'Start dive' }).click();
      await page.waitForTimeout(2400);
      await page.evaluate(() => window.__sharkyTest?.pause());
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact || ''),
      ),
    ).toEqual([]);
  }
});
