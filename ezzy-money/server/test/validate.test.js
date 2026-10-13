'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { validateMod } = require('../src/validate');
const { makeZip, goodMod, goodManifest } = require('./helpers');

function errorsOf(buf) {
  const r = validateMod(buf);
  assert.strictEqual(r.ok, false, 'expected the mod to be rejected');
  return r.errors.join('\n');
}

test('accepts a valid mod', () => {
  const r = validateMod(goodMod({ 'data/vehicles.json': '{}', 'preview.png': Buffer.from([1, 2, 3]) }));
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.manifest.id, 'ezzy.jetpack');
});

test('accepts stored (uncompressed) entries', () => {
  const buf = makeZip({ 'mod.json': JSON.stringify(goodManifest), 'scripts/main.lua': 'x' }, { deflate: false });
  assert.strictEqual(validateMod(buf).ok, true);
});

test('accepts the sample jetpack mod', () => {
  const dir = path.join(__dirname, '..', '..', 'examples', 'mods', 'jetpack');
  const files = {};
  for (const rel of ['mod.json', 'scripts/main.lua', 'data/vehicles.json']) files[rel] = fs.readFileSync(path.join(dir, rel));
  assert.deepStrictEqual(validateMod(makeZip(files)).errors, []);
});

test('rejects non-zip data', () => {
  assert.match(errorsOf(Buffer.from('hello world, definitely not a zip file')), /not a zip/);
});

test('rejects native code and executables', () => {
  for (const name of ['lib/hack.dll', 'libhack.so', 'game.apk', 'run.exe', 'scripts/x.sh']) {
    assert.match(errorsOf(goodMod({ [name]: 'x' })), /file type not allowed/, name);
  }
});

test('rejects path traversal and absolute paths', () => {
  assert.match(errorsOf(goodMod({ '../evil.json': '{}' })), /unsafe path/);
  assert.match(errorsOf(goodMod({ 'data/../../evil.json': '{}' })), /unsafe path/);
  assert.match(errorsOf(goodMod({ '/etc/evil.json': '{}' })), /unsafe path/);
  assert.match(errorsOf(goodMod({ 'C:/evil.json': '{}' })), /unsafe path/);
  assert.match(errorsOf(goodMod({ 'data\\evil.json': '{}' })), /unsafe path/);
});

test('rejects encrypted entries', () => {
  const buf = makeZip({ 'mod.json': JSON.stringify(goodManifest), 'scripts/main.lua': 'x' }, { encrypted: 'scripts/main.lua' });
  assert.match(errorsOf(buf), /encrypted/);
});

test('rejects zip bombs by declared unpacked size', () => {
  const buf = goodMod({ 'data/big.json': '{}' });
  const bomb = makeZip(
    { 'mod.json': JSON.stringify(goodManifest), 'scripts/main.lua': 'x', 'data/big.json': '{}' },
    { fakeSize: { 'data/big.json': 300 * 1024 * 1024 } },
  );
  assert.strictEqual(validateMod(buf).ok, true);
  assert.match(errorsOf(bomb), /200 MB/);
});

test('rejects an oversized mod.json even if it lies about its size', () => {
  const huge = JSON.stringify({ ...goodManifest, description: 'a'.repeat(200 * 1024) });
  const buf = makeZip({ 'mod.json': huge, 'scripts/main.lua': 'x' }, { fakeSize: { 'mod.json': 100 } });
  assert.match(errorsOf(buf), /mod.json could not be read/);
});

test('rejects Lua outside scripts/', () => {
  assert.match(errorsOf(goodMod({ 'data/sneaky.lua': 'x' })), /scripts must be in scripts/);
});

test('rejects a missing mod.json', () => {
  assert.match(errorsOf(makeZip({ 'scripts/main.lua': 'x' })), /mod.json is missing/);
});

test('rejects invalid JSON in mod.json', () => {
  assert.match(errorsOf(makeZip({ 'mod.json': '{ nope', 'scripts/main.lua': 'x' })), /could not be read/);
});

test('checks manifest fields', () => {
  const bad = (patch) => errorsOf(goodMod({}, { ...goodManifest, ...patch }));
  assert.match(bad({ id: 'Bad Id!' }), /"id"/);
  assert.match(bad({ version: 'v1' }), /"version"/);
  assert.match(bad({ name: '' }), /"name"/);
  assert.match(bad({ author: 42 }), /"author"/);
  assert.match(bad({ permissions: ['spawn', 'filesystem'] }), /unknown permission "filesystem"/);
  assert.match(bad({ permissions: 'spawn' }), /must be a list/);
  assert.match(bad({ entry: 'main.lua' }), /under scripts/);
  assert.match(bad({ entry: 'scripts/missing.lua' }), /is missing/);
});

test('rejects a manifest that is not an object', () => {
  assert.match(errorsOf(makeZip({ 'mod.json': '[1,2]' })), /JSON object/);
});
