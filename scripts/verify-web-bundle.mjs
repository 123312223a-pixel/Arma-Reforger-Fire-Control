import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=new URL('../dist/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const dir=fileURLToPath(new URL('assets/',root));
const js=fs.readdirSync(dir).filter(f=>f.endsWith('.js'))
 .map(f=>fs.readFileSync(new URL('assets/'+f,root),'utf8')).join('\n');
assert.ok(html.includes('assets/'),'Vite HTML must reference JS assets');
assert.ok(js.includes('mapAimInit'),'Interactive map module missing from Vite output');
assert.ok(js.includes('mapAimRefresh'),'Map API missing from Vite output');
assert.ok(js.includes('enfumap.com'),'Enfumap integration missing from Vite output');
assert.ok(js.includes('mapAimChangeTrajectory'),'M777 map trajectory selection missing from Vite output');
assert.ok(js.includes('mapTerrainProfileStatus') && js.includes('mapTerrainProfileSummary'),
 'Terrain profile DOM renderer missing from Vite output');
assert.ok(js.includes('sampleElevationProfile') || js.includes('sampleSpacing'),
 'Terrain sampling missing from Vite output');
console.log('OK: interactive map code is present in Vite bundle');
