import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };

function serveVideo(req, res, content) {
  const headers = { 'Content-Type': types['.mp4'], 'Accept-Ranges': 'bytes' };
  if (!req.headers.range) {
    res.writeHead(200, { ...headers, 'Content-Length': content.length }).end(req.method === 'HEAD' ? undefined : content);
    return;
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  let start = 0;
  let end = content.length - 1;
  if (range?.[1]) {
    start = Number(range[1]);
    if (range[2]) end = Math.min(end, Number(range[2]));
  } else if (range?.[2]) {
    start = Math.max(0, content.length - Number(range[2]));
  }
  if (!range || (!range[1] && !range[2]) || start > end) {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${content.length}` }).end();
    return;
  }
  res.writeHead(206, {
    ...headers,
    'Content-Range': `bytes ${start}-${end}/${content.length}`,
    'Content-Length': end - start + 1
  }).end(req.method === 'HEAD' ? undefined : content.subarray(start, end + 1));
}

const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
  try {
    let content = await readFile(path);
    if (extname(path) === '.mp4') {
      serveVideo(req, res, content);
      return;
    }
    // Trial fonts stay ignored and local: the production Pages artifact never includes them.
    if (extname(path) === '.html' && url.searchParams.get('font') !== 'compatible' && existsSync(resolve(root, '.local-assets/franie/FranieTest-Regular.otf'))) {
      const previewFonts = `<style>@font-face{font-family:'Franie Test';font-weight:400;font-display:swap;src:url('/.local-assets/franie/FranieTest-Regular.otf')}@font-face{font-family:'Franie Test';font-weight:600 900;font-display:swap;src:url('/.local-assets/franie/FranieTest-SemiBold.otf')}</style>`;
      content = content.toString().replace('</head>', previewFonts + '</head>');
    } res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(content); }
  catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Unable to serve this file.'); }
}).listen(port, '127.0.0.1', () => console.log(`SpecEngineeringBench: http://localhost:${port}`));
