'use strict';

// Pairing + upload server.
//
//   1. Game:    POST /api/pair                 -> { code, token }      (code shown on screen)
//   2. Browser: POST /api/upload?code=123456   body = mod .zip         (validated here)
//   3. Game:    GET  /api/pending              header x-pair-token     -> [{ id, manifest }]
//   4. Game:    GET  /api/download/:id         header x-pair-token     -> the .zip
//
// Codes and uploads live in memory and expire after 10 minutes.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateMod, LIMITS } = require('./validate');

const PAIR_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 20;

function createServer() {
  const pairs = new Map(); // code -> { token, expires, uploads: Map<id, { manifest, data }> }
  const byToken = new Map(); // token -> code

  function sweep() {
    const now = Date.now();
    for (const [code, p] of pairs) {
      if (p.expires < now) {
        pairs.delete(code);
        byToken.delete(p.token);
      }
    }
  }

  function newCode() {
    for (;;) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      if (!pairs.has(code)) return code;
    }
  }

  function pairFromToken(req) {
    const code = byToken.get(req.headers['x-pair-token']);
    return code ? pairs.get(code) : undefined;
  }

  const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'));

  return http.createServer((req, res) => {
    sweep();
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page);
    }

    if (req.method === 'POST' && url.pathname === '/api/pair') {
      const code = newCode();
      const token = crypto.randomBytes(24).toString('hex');
      pairs.set(code, { token, expires: Date.now() + PAIR_TTL_MS, uploads: new Map() });
      byToken.set(token, code);
      return json(res, 200, { code, token, expiresInSeconds: PAIR_TTL_MS / 1000 });
    }

    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const pair = pairs.get(url.searchParams.get('code') || '');
      if (!pair) return json(res, 404, { ok: false, errors: ['That code is wrong or has expired. Get a new one in the game.'] });
      if (pair.uploads.size >= MAX_PENDING) return json(res, 429, { ok: false, errors: ['Too many mods waiting. Install some in the game first.'] });
      return readBody(req, LIMITS.zipBytes, (err, data) => {
        if (err) return json(res, 413, { ok: false, errors: [err.message] });
        const result = validateMod(data);
        if (!result.ok) return json(res, 422, result);
        const id = crypto.randomUUID();
        pair.uploads.set(id, { manifest: result.manifest, data });
        return json(res, 200, { ok: true, id, manifest: result.manifest });
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/pending') {
      const pair = pairFromToken(req);
      if (!pair) return json(res, 401, { error: 'unknown token' });
      return json(res, 200, [...pair.uploads].map(([id, u]) => ({ id, manifest: u.manifest })));
    }

    const dl = url.pathname.match(/^\/api\/download\/([0-9a-f-]{36})$/);
    if (req.method === 'GET' && dl) {
      const pair = pairFromToken(req);
      const upload = pair && pair.uploads.get(dl[1]);
      if (!upload) return json(res, 404, { error: 'not found' });
      pair.uploads.delete(dl[1]); // one download per upload
      res.writeHead(200, { 'content-type': 'application/zip', 'content-length': upload.data.length });
      return res.end(upload.data);
    }

    json(res, 404, { error: 'not found' });
  });
}

function readBody(req, max, cb) {
  const chunks = [];
  let size = 0;
  let done = false;
  req.on('data', (c) => {
    if (done) return;
    size += c.length;
    if (size > max) {
      done = true;
      req.destroy();
      return cb(new Error('mod is larger than 50 MB'));
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (!done) {
      done = true;
      cb(null, Buffer.concat(chunks));
    }
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8787;
  createServer().listen(port, () => console.log(`Ezzy Money mod upload: http://localhost:${port}`));
}

module.exports = { createServer };
