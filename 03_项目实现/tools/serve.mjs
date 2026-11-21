// 零依赖静态服务器： node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const args = process.argv.slice(2);
const lan = args.includes('--lan');
const PORT = Number(args.find(arg => arg !== '--lan') || 8123);
const HOST = lan ? '0.0.0.0' : '127.0.0.1';
let preview;
if (lan) {
  const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  try {
    preview = await readFile(join(ROOT, 'release', 'SEVENTH-WOUND-' + version + '.html'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    console.error('请先运行 node tools/pack.mjs 打包，再启动局域网预览。');
    process.exit(1);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    if (preview) {
      if (path !== '/index.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }).end(preview);
      return;
    }
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(full);
    if (info.isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const data = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SEVENTH WOUND  →  http://127.0.0.1:${PORT}/`);
  console.log('按 Ctrl+C 结束');
});
