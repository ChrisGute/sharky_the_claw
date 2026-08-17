import lighthouse from 'lighthouse';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['scripts/serve-dist.js'], { stdio: 'ignore' });
const chrome = spawn(
  chromium.executablePath(),
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9222',
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready within 15 seconds`);
}

await Promise.all([
  waitFor('http://127.0.0.1:4173/sharky_the_claw/', 'Production server'),
  waitFor('http://127.0.0.1:9222/json/version', 'Headless Chromium'),
]);
try {
  const report = await lighthouse('http://127.0.0.1:4173/sharky_the_claw/', {
    onlyCategories: ['accessibility', 'performance', 'best-practices'],
  });
  const categories = report.lhr.categories;
  const scores = Object.fromEntries(
    Object.entries(categories).map(([key, value]) => [key, Math.round(value.score * 100)]),
  );
  console.log(
    `Lighthouse: accessibility ${scores.accessibility}, performance ${scores.performance}, best-practices ${scores['best-practices']}`,
  );
  if (scores.accessibility < 95 || scores.performance < 85 || scores['best-practices'] < 95)
    throw new Error('Lighthouse thresholds failed');
} finally {
  chrome.kill();
  server.kill();
}
