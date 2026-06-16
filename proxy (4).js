const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3777;
const API_KEY = process.env.BITGET_API_KEY || '';
const SECRET_KEY = process.env.BITGET_SECRET_KEY || '';
const PASSPHRASE = process.env.BITGET_PASSPHRASE || '';

function sign(timestamp, method, path, body) {
  const msg = timestamp + method.toUpperCase() + path + (body || '');
  return crypto.createHmac('sha256', SECRET_KEY).update(msg).digest('base64');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve o dashboard HTML
  if (req.url === '/' || req.url === '/dashboard') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'bitget-dashboard-FINAL.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(404);
      res.end('Dashboard não encontrado');
    }
    return;
  }

  // Endpoint especial: retorna credenciais para o dashboard conectar automaticamente
  if (req.url === '/auto-creds') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      apiKey: API_KEY,
      passphrase: PASSPHRASE,
      hasSecret: !!SECRET_KEY
    }));
    return;
  }

  // Proxy para a API Bitget
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const timestamp = Date.now().toString();
    const urlPath = req.url.split('?')[0];

    const headers = {};
    const allowed = ['access-key', 'access-sign', 'access-timestamp', 'access-passphrase', 'content-type', 'locale'];
    for (const [k, v] of Object.entries(req.headers)) {
      if (allowed.includes(k.toLowerCase())) headers[k] = v;
    }

    // Se não tiver credenciais no header, injeta as do servidor
    if (!headers['access-key'] && API_KEY) {
      headers['access-key'] = API_KEY;
      headers['access-passphrase'] = PASSPHRASE;
      headers['access-timestamp'] = timestamp;
      headers['access-sign'] = sign(timestamp, req.method, req.url, body);
      headers['content-type'] = headers['content-type'] || 'application/json';
    }
    headers['host'] = 'api.bitget.com';

    const options = {
      hostname: 'api.bitget.com',
      path: req.url,
      method: req.method,
      headers
    };

    const proxy = https.request(options, (bitgetRes) => {
      res.writeHead(bitgetRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      bitgetRes.pipe(res);
    });

    proxy.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    if (body) proxy.write(body);
    proxy.end();
  });
});

server.listen(PORT, () => {
  console.log('\n✅ Proxy Bitget rodando na porta ' + PORT);
  console.log('📊 Dashboard em /dashboard\n');
});
