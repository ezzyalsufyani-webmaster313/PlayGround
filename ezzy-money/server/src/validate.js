'use strict';

// Validates an Ezzy Money mod package. The game runs the same rules
// (ModValidator.cs) again after download, so neither side trusts the other.
const path = require('node:path');
const { listEntries, readEntry } = require('./zip');

const LIMITS = {
  zipBytes: 50 * 1024 * 1024,
  unzippedBytes: 200 * 1024 * 1024,
  files: 500,
  manifestBytes: 64 * 1024,
};

const ALLOWED_EXTENSIONS = new Set(['.json', '.lua', '.bundle', '.png', '.jpg', '.ogg', '.wav', '.txt', '.md']);
const PERMISSIONS = new Set(['spawn', 'hud', 'input', 'world', 'player', 'missions']);
const ID_RE = /^[a-z0-9._-]{3,64}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function isSafePath(name) {
  if (name.includes('\\') || name.includes('\0')) return false;
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').some((part) => part === '..');
}

function checkString(m, key, max, errors) {
  if (typeof m[key] !== 'string' || m[key].length < 1 || m[key].length > max) {
    errors.push(`mod.json: "${key}" must be text of 1-${max} characters`);
  }
}

function validateManifest(m, fileNames) {
  const errors = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['mod.json must be a JSON object'];
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) {
    errors.push('mod.json: "id" must be 3-64 lowercase letters, digits, ".", "_" or "-"');
  }
  checkString(m, 'name', 64, errors);
  checkString(m, 'author', 64, errors);
  checkString(m, 'gameVersion', 16, errors);
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    errors.push('mod.json: "version" must look like 1.0.0');
  }
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) errors.push('mod.json: "permissions" must be a list');
    else for (const p of m.permissions) if (!PERMISSIONS.has(p)) errors.push(`mod.json: unknown permission "${p}"`);
  }
  if (m.entry !== undefined) {
    if (typeof m.entry !== 'string' || !m.entry.startsWith('scripts/') || !m.entry.endsWith('.lua')) {
      errors.push('mod.json: "entry" must be a .lua file under scripts/');
    } else if (!fileNames.has(m.entry)) {
      errors.push(`mod.json: entry script ${m.entry} is missing`);
    }
  }
  return errors;
}

/** Returns { ok, errors, manifest }. Never throws on bad input. */
function validateMod(buf) {
  if (buf.length > LIMITS.zipBytes) return fail('mod is larger than 50 MB');
  let entries;
  try {
    entries = listEntries(buf);
  } catch (e) {
    return fail(e.message);
  }

  const files = entries.filter((e) => !e.name.endsWith('/'));
  if (files.length > LIMITS.files) return fail(`mod has more than ${LIMITS.files} files`);

  const errors = [];
  let total = 0;
  for (const e of entries) {
    if (!isSafePath(e.name)) errors.push(`unsafe path: ${e.name}`);
    if (e.encrypted) errors.push(`encrypted file: ${e.name}`);
    total += e.size;
  }
  for (const e of files) {
    const ext = path.posix.extname(e.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) errors.push(`file type not allowed: ${e.name}`);
    if (ext === '.lua' && !e.name.startsWith('scripts/')) errors.push(`scripts must be in scripts/: ${e.name}`);
  }
  if (total > LIMITS.unzippedBytes) errors.push('mod unpacks to more than 200 MB');
  if (errors.length) return { ok: false, errors, manifest: null };

  const manifestEntry = files.find((e) => e.name === 'mod.json');
  if (!manifestEntry) return fail('mod.json is missing from the root of the zip');

  let manifest;
  try {
    manifest = JSON.parse(readEntry(buf, manifestEntry, LIMITS.manifestBytes).toString('utf8'));
  } catch (e) {
    return fail(`mod.json could not be read: ${e.message}`);
  }

  const manifestErrors = validateManifest(manifest, new Set(files.map((e) => e.name)));
  if (manifestErrors.length) return { ok: false, errors: manifestErrors, manifest: null };
  return { ok: true, errors: [], manifest };
}

function fail(msg) {
  return { ok: false, errors: [msg], manifest: null };
}

module.exports = { validateMod, validateManifest, LIMITS };
