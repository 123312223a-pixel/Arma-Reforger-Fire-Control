import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const expected = fs.readFileSync(new URL('./core.sha256', import.meta.url), 'utf8').trim().split(/\s+/)[0];
const a = html.indexOf('const ballisticData = {');
const b = html.indexOf('// ===== Operational extensions:');
assert.ok(a > 0 && b > a, 'Calculation core must be present');
const actual = crypto.createHash('sha256').update(html.slice(a, b)).digest('hex');
assert.equal(actual, expected, 'Ballistic data or calculation core changed');
for (const name of ['desktopBootAndSetup', 'load_state', 'store_state', 'tacRecalculateBattery', 'milsPerCircle']) {
  assert.ok(html.includes(name), `Missing expected integration: ${name}`);
}
const config=JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
assert.equal(config.app.withGlobalTauri, true);
assert.ok(config.bundle.targets.includes('nsis'));
assert.match(config.version, /^\d+\.\d+\.\d+$/, 'app version must be SemVer');
assert.equal(config.bundle.createUpdaterArtifacts, false);
const cap=JSON.parse(fs.readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url),'utf8'));
assert.ok(!cap.permissions.includes('updater:default'),'Unsigned builds must not expose updater permission');
const manager=fs.readFileSync(new URL('../src/update-manager.js', import.meta.url),'utf8');
for(const required of ['downloadAndInstall', 'backupBeforeUpdate', 'getVersion', 'updater_available']) {
 assert.ok(manager.includes(required) || html.includes(required), `Missing update-manager component: ${required}`);
}
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url),'utf8'));
assert.equal(pkg.version,config.version);
const cargo=fs.readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url),'utf8');
assert.ok(cargo.includes(`version = "${pkg.version}"`));
console.log('OK: original calculation core SHA-256',actual);
console.log('OK: Windows installer, signed-update preparation, native-state bridge');
