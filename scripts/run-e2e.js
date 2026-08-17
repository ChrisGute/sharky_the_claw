import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const value = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
    server.close(() => resolve(value));
  });
});
const child = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PW_PORT: String(port) },
});
child.on('exit', (code) => process.exit(code ?? 1));
