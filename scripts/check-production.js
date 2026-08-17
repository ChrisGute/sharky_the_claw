import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)],
  );
}
const text = files('dist')
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const html = readFileSync('dist/index.html', 'utf8');
for (const forbidden of ['__sharkyTest', 'test-bridge', 'sourceMappingURL=', 'google-analytics'])
  if (text.includes(forbidden))
    throw new Error(`Production output contains forbidden token: ${forbidden}`);
if (/\b(?:src|href)=["']https?:\/\//.test(html))
  throw new Error('Production HTML contains an external request.');
console.log('Production output has no test bridge, source maps, analytics, or external URLs.');
