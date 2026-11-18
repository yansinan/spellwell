/**
 * @layer tools
 * @phase P0
 * @doc §3.1 技术选型
 *
 * 零依赖静态服务器。ES Modules 不能通过 file:// 加载，开发时必须走 HTTP。
 * 用法：node tools/serve.mjs  （PORT=4173 可覆盖）
 */

import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '0.0.0.0';
const syncServer = process.env.SYNC_SERVER_URL ?? 'http://helix:4010';

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
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    sendText(response, 400, 'Bad Request');
    return;
  }

  if (pathname === '/admin') pathname = '/src/admin/index.html';
  else if (pathname.startsWith('/admin/')) pathname = `/src/admin/${pathname.slice('/admin/'.length)}`;
  if (pathname === '/sync-setup' || pathname === '/sync-setup/') pathname = '/src/sync/setup.html';
  if (pathname === '/sync' || pathname.startsWith('/sync/')) {
    const search = new URL(request.url ?? '/', 'http://localhost').search;
    const target = new URL(syncServer);
    const targetPath = `${pathname.slice('/sync'.length) || '/'}${search}`;
    const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const upstream = transport({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: request.method,
      path: targetPath,
      headers: { ...request.headers, host: target.host },
      timeout: 10000,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('sync server timeout')));
    upstream.on('error', (error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'sync_unavailable', message: String(error.message ?? error) }));
    });
    request.pipe(upstream);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed');
    return;
  }
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
  console.log(`Sync proxy → ${syncServer}`);
  console.log('Press Ctrl+C to stop.');
});

server.on('error', (error) => {
  console.error(`[serve] ${error.message}`);
  process.exitCode = 1;
});
