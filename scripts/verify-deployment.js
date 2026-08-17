import { chromium } from 'playwright';

const [deploymentUrl, expectedSha] = process.argv.slice(2);
if (!deploymentUrl || !expectedSha)
  throw new Error('Usage: npm run verify:deployment -- <deployment-url> <expected-sha>');

const target = new URL(deploymentUrl);
target.searchParams.set('build', expectedSha);
const expectedOrigin = target.origin;
const browser = await chromium.launch({ headless: true });
let lastError;

try {
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    const page = await browser.newPage();
    const failures = [];
    const externalRequests = [];
    const badResponses = [];
    const badMimeTypes = [];

    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(`console: ${message.text()}`);
    });
    page.on('requestfailed', (request) =>
      failures.push(`${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`),
    );
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && url.origin !== expectedOrigin)
        externalRequests.push(request.url());
    });
    page.on('response', (response) => {
      const request = response.request();
      const url = new URL(response.url());
      if (url.origin !== expectedOrigin) return;
      if (!response.ok()) badResponses.push(`${response.status()} ${response.url()}`);
      const contentType = response.headers()['content-type'] ?? '';
      const expectedMime = {
        script: 'javascript',
        stylesheet: 'text/css',
        image: 'image/',
      }[request.resourceType()];
      if (expectedMime && !contentType.includes(expectedMime))
        badMimeTypes.push(`${request.resourceType()} ${contentType} ${response.url()}`);
    });

    try {
      const response = await page.goto(target.href, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if (!response?.ok()) throw new Error(`HTML returned ${response?.status() ?? 'no response'}`);
      await page.locator('html[data-game-ready="true"]').waitFor({ timeout: 10_000 });
      await page.getByRole('heading', { name: /Sharky/ }).waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: 'Dive in' }).click();
      await page.getByRole('button', { name: 'Sunny Lagoon' }).click();
      await page.getByRole('button', { name: 'Start dive' }).click();
      await page.locator('canvas').waitFor({ state: 'visible', timeout: 10_000 });

      const scriptUrls = await page
        .locator('script[src]')
        .evaluateAll((scripts) =>
          scripts.map((script) => /** @type {HTMLScriptElement} */ (script).src),
        );
      const bundles = await Promise.all(
        scriptUrls.map(async (url) => {
          const bundleResponse = await fetch(url);
          if (!bundleResponse.ok)
            throw new Error(`Bundle returned ${bundleResponse.status}: ${url}`);
          return bundleResponse.text();
        }),
      );
      if (!bundles.some((bundle) => bundle.includes(expectedSha)))
        throw new Error(`Deployed bundles do not contain build SHA ${expectedSha}`);
      if (failures.length) throw new Error(`Runtime failures: ${failures.join('; ')}`);
      if (externalRequests.length)
        throw new Error(`Unexpected external requests: ${externalRequests.join('; ')}`);
      if (badResponses.length) throw new Error(`Bad asset responses: ${badResponses.join('; ')}`);
      if (badMimeTypes.length) throw new Error(`Bad asset MIME types: ${badMimeTypes.join('; ')}`);

      console.log(
        `Verified deployed game readiness and build SHA ${expectedSha} at ${deploymentUrl}`,
      );
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      console.warn(
        `Deployment verification attempt ${attempt}/15 failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (attempt < 15) await new Promise((resolve) => setTimeout(resolve, 4000));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (lastError) throw lastError;
