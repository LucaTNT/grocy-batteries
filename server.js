const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

loadEnvFile();

const port = Number(process.env.PORT || 3000);
const grocyUrl = (process.env.GROCY_URL || '').replace(/\/$/, '');
const grocyApiKey = process.env.GROCY_API_KEY || '';
const publicDir = path.join(__dirname, 'public');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function grocyRequest(req, res) {
  if (!grocyUrl || !grocyApiKey) {
    return sendJson(res, 500, { error: 'GROCY_URL and GROCY_API_KEY must be configured in .env.' });
  }
  const upstream = new URL(req.url.replace(/^\/api/, '/api'), grocyUrl);
  const client = upstream.protocol === 'https:' ? https : http;
  const headers = { 'GROCY-API-KEY': grocyApiKey };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers['content-length']) headers['Content-Length'] = req.headers['content-length'];
  const proxy = client.request(upstream, { method: req.method, headers }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, { 'Content-Type': upstreamRes.headers['content-type'] || 'application/json; charset=utf-8' });
    upstreamRes.pipe(res);
  });
  proxy.on('error', (error) => sendJson(res, 502, { error: `Could not reach Grocy: ${error.message}` }));
  req.pipe(proxy);
}

function serveStatic(req, res) {
  const requested = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const safePath = path.resolve(publicDir, `.${requested}`);
  if (!safePath.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });
  fs.readFile(safePath, (error, content) => {
    if (error) return sendJson(res, 404, { error: 'Not found' });
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[path.extname(safePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

http.createServer((req, res) => req.url.startsWith('/api/') ? grocyRequest(req, res) : serveStatic(req, res))
  .listen(port, () => console.log(`Grocy Batteries is running at http://localhost:${port}`));
