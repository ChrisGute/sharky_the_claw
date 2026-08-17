import { expect, test } from '@playwright/test';

test('nested-path production build becomes ready without failed or external requests', async ({
  page,
}, testInfo) => {
  const localOrigin = new URL(testInfo.project.use.baseURL).origin;
  const failures = [];
  const externalRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('requestfailed', (request) =>
    failures.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== localOrigin) externalRequests.push(request.url());
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  expect(failures).toEqual([]);
  expect(externalRequests).toEqual([]);
});
