import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const root = resolve('dist');
const prefix = '/sharky_the_claw/';
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
};
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith(prefix)) return response.writeHead(404).end();
  const relativePath = url.pathname.slice(prefix.length) || 'index.html';
  const file = resolve(root, relativePath);
  if (!file.startsWith(root) || !existsSync(file)) return response.writeHead(404).end();
  const extension = file.slice(file.lastIndexOf('.'));
  response.writeHead(200, { 'Content-Type': mimeTypes[extension] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1');
