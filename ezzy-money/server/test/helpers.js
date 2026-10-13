'use strict';
const zlib = require('node:zlib');

// Builds a zip in memory. files: { name: string | Buffer }, options per name: { deflate, encrypted }
function makeZip(files, opts = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const deflate = opts.deflate !== false;
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const flags = opts.encrypted === name ? 1 : 0;
    const crc = zlib.crc32(raw);

    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(flags, 6);
    loc.writeUInt16LE(deflate ? 8 : 0, 8);
    loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(data.length, 18);
    loc.writeUInt32LE(raw.length, 22);
    loc.writeUInt16LE(nameBuf.length, 26);
    locals.push(loc, nameBuf, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(flags, 8);
    cen.writeUInt16LE(deflate ? 8 : 0, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(opts.fakeSize?.[name] ?? raw.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    centrals.push(cen, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  const count = Object.keys(files).length;
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const goodManifest = {
  id: 'ezzy.jetpack',
  name: 'Jetpack',
  version: '1.0.0',
  author: 'Ezzy',
  gameVersion: '0.1',
  permissions: ['spawn', 'hud'],
  entry: 'scripts/main.lua',
};

function goodMod(extra = {}, manifest = goodManifest) {
  return makeZip({ 'mod.json': JSON.stringify(manifest), 'scripts/main.lua': 'log("hi")', ...extra });
}

module.exports = { makeZip, goodMod, goodManifest };
