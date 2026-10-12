import fs from 'node:fs';
import assert from 'node:assert/strict';

const cfg = 'src-tauri/tauri.updater.conf.json';
const cap = 'src-tauri/capabilities/updater.json';
assert.ok(fs.existsSync(cfg) && fs.existsSync(cap), 'Updater not configured: run npm run configure:updates');
const conf = JSON.parse(fs.readFileSync(cfg, 'utf8'));
assert.equal(conf.bundle.createUpdaterArtifacts, true);
const base64 = conf.plugins.updater.pubkey;
assert.match(base64, /^[A-Za-z0-9+/=]+$/);
const decoded = Buffer.from(base64, 'base64').toString('utf8').trim().split(/\r?\n/);
assert.equal(decoded.length, 2);
assert.ok(decoded[0].startsWith('untrusted comment: minisign public key:'));
assert.match(decoded[1], /^[A-Za-z0-9+/=]+$/);
assert.ok(conf.plugins.updater.endpoints.every(url =>
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/latest\/download\/latest\.json$/.test(url)
));
console.log('Signed update configuration verified (public key and HTTPS release endpoint).');
