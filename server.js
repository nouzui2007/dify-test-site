const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT         = process.env.PORT || 3000;
const DIFY_API_URL = 'https://api.dify.ai/v1/chat-messages';

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

  // ── Proxy: POST /api/chat ──
  if (req.method === 'POST' && urlPath === '/api/chat') {
    const env    = loadEnv();
    const apiKey = env.DIFY_API_KEY || '';

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const buf     = Buffer.from(body);
      const target  = new URL(DIFY_API_URL);
      const options = {
        hostname: target.hostname,
        path:     target.pathname,
        method:   'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
          'Content-Length': buf.length,
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type':  proxyRes.headers['content-type'] || 'text/event-stream',
          'Cache-Control': 'no-cache',
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', err => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(buf);
      proxyReq.end();
    });
    return;
  }

  // ── Root ──
  const isRoot = urlPath === '/' || urlPath === '/index.html';
  if (isRoot) {
    let html;
    try {
      html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    } catch {
      res.writeHead(500);
      res.end('Failed to read index.html');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // ── Static files ──
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
