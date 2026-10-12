import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { formatMapTileUrl } from '../src/map-url.mjs';

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
const mapJs=fs.readFileSync(new URL('../src/map-mode.js',import.meta.url),'utf8');
assert.match(html,/<script\s+type="module"\s+src="\.\/map-mode\.js"><\/script>/,
  'Map code must be a Vite module or it will not be packaged into the Windows app');
assert.ok(mapJs.includes('window.mapAimInit='),'Missing map initialization');
console.log('OK: map is linked as a Vite module');
assert.ok(html.includes('mapAutoGunZ')&&html.includes('mapAutoTargetZ'),'Missing automatic terrain-height controls');
console.log('OK: terrain-height controls and independent manual overrides present');
assert.ok(fs.readFileSync(new URL('../src/map-mode.js',import.meta.url),'utf8')
  .includes("import { fetch as nativeHttpFetch } from '@tauri-apps/plugin-http'"),
  'Native HTTPS transport must be present in bundled map');
assert.ok(cargo.includes('tauri-plugin-http = "2"') &&
  fs.readFileSync(new URL('../src-tauri/src/lib.rs',import.meta.url),'utf8')
    .includes('.plugin(tauri_plugin_http::init())'),
  'Rust HTTP plugin setup missing');
const nativeHttpScope=cap.permissions.find(x=>typeof x==='object' && x.identifier==='http:default');
assert.deepEqual(nativeHttpScope?.allow,[{url:'https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/everon_height.json'}],
  'HTTP scope must allow only the Everon height JSON URL');
assert.equal(pkg.dependencies['@tauri-apps/plugin-http'],'^2.0.0');
console.log('OK: restricted native HTTPS transport for Everon height JSON');
console.log('OK: original calculation core SHA-256',actual);
console.log('OK: Windows installer, signed-update preparation, native-state bridge');

assert.equal(
 formatMapTileUrl('/tiles/everon/topo/{z}/{x}/{y}.webp',3,1,2),
 'https://enfumap.com/tiles/everon/topo/3/1/2.webp'
);
assert.equal(
 formatMapTileUrl('/tiles/everon/{z}/{x}/{y}.webp?v=4',2,0,3),
 'https://enfumap.com/tiles/everon/2/0/3.webp?v=4'
);
assert.throws(()=>formatMapTileUrl('https://evil.example/{z}/{x}/{y}',2,0,0));
assert.throws(()=>formatMapTileUrl('http://enfumap.com/{z}/{x}/{y}',2,0,0));
const mapSource = fs.readFileSync(new URL('../src/map-mode.js',import.meta.url),'utf8');
assert.ok(mapSource.includes('formatMapTileUrl(layer,z,col,row,mapEndpoint)'), 'Map module must use safe URL expansion');
console.log('OK: Enfumap tile URL expansion uses real numeric coordinates before URL parsing.');
