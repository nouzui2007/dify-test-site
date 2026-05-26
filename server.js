const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const isRoot  = urlPath === '/' || urlPath === '/index.html';

  if (isRoot) {
    const env = loadEnv();
    let html;
    try {
      html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    } catch {
      res.writeHead(500);
      res.end('Failed to read index.html');
      return;
    }

    const exposed = { DIFY_API_KEY: env.DIFY_API_KEY || '' };
    const inject  = `<script>window.__ENV__ = ${JSON.stringify(exposed)};</script>`;
    html = html.replace('</head>', inject + '\n</head>');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const filePath = path.join(__dirname, urlPath);
  const ext      = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Dev server: http://localhost:${PORT}`);
});
