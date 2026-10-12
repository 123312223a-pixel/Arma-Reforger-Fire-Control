import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
const expected=fs.readFileSync(new URL('./core.sha256',import.meta.url),'utf8').trim().split(/\s+/)[0];
const a=html.indexOf('const ballisticData = {'),b=html.indexOf('// ===== Operational extensions:');
assert.ok(a>0&&b>a,'Ballistic data and calculation core missing');
const actual=crypto.createHash('sha256').update(html.slice(a,b).replace(/\r\n/g,'\n')).digest('hex');
assert.equal(actual,expected,'Ballistic calculation core differs from tested 3.5 version');
for(const word of ['desktopBootAndSetup','load_state','store_state','tacRecalculateBattery','milsPerCircle']){
 assert.ok(html.includes(word),'Missing '+word);
}
const config=JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
assert.equal(config.app.withGlobalTauri,true);
assert.ok(config.bundle.targets.includes('nsis'));
assert.equal(config.bundle.createUpdaterArtifacts,false);
const cap=JSON.parse(fs.readFileSync(new URL('../src-tauri/capabilities/default.json',import.meta.url),'utf8'));
assert.ok(!cap.permissions.includes('updater:default'),'Unsigned build exposes updater permission');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,config.version);
const cargo=fs.readFileSync(new URL('../src-tauri/Cargo.toml',import.meta.url),'utf8');
assert.ok(cargo.includes('version = "'+pkg.version+'"'));
console.log('Verified calculation core SHA-256:',actual);
