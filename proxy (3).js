const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3777;

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

  // Proxy para a API Bitget
  const headers = {};
  const allowed = ['access-key', 'access-sign', 'access-timestamp', 'access-passphrase', 'content-type', 'locale'];
  for (const [k, v] of Object.entries(req.headers)) {
    if (allowed.includes(k.toLowerCase())) headers[k] = v;
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

  req.pipe(proxy);
});

server.listen(PORT, () => {
  console.log('\n✅ Proxy Bitget rodando na porta ' + PORT);
  console.log('📊 Dashboard em /dashboard\n');
});
