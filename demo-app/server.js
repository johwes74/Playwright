// Simple static file server for the Playwright demo app.
// Started automatically by Playwright via the webServer config.
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = 3000;
const HTML     = path.join(__dirname, 'index.html');
const HOSTNAME = '127.0.0.1';

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(HTML).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, HOSTNAME, () => {
  // Playwright watches stdout for the URL to know the server is ready.
  console.log(`Demo app running at http://localhost:${PORT}`);
});
