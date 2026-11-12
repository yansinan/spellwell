/**
 * @layer tools
 * @phase P0
 * @doc §3.1 技术选型
 *
 * 零依赖静态服务器。ES Modules 不能通过 file:// 加载，开发时必须走 HTTP。
 * 用法：node tools/serve.mjs  （PORT=4173 可覆盖）
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {string} message
 */
function sendText(response, status, message) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(message);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    sendText(response, 400, 'Bad Request');
    return;
  }

  if (pathname === '/admin') pathname = '/src/admin/index.html';
  else if (pathname.startsWith('/admin/')) pathname = `/src/admin/${pathname.slice('/admin/'.length)}`;
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = path.resolve(root, `.${pathname}`);

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      sendText(response, 404, 'Not Found');
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': body.byteLength,
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch {
    sendText(response, 404, 'Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`SpellWell dev server → http://${host}:${port}`);
  console.log(`Admin → http://${host}:${port}/admin`);
  console.log('Press Ctrl+C to stop.');
});

server.on('error', (error) => {
  console.error(`[serve] ${error.message}`);
  process.exitCode = 1;
});
