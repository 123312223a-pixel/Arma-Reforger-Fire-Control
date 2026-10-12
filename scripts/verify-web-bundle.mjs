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
assert.ok(js.includes('mapAimSettingChanged'),'Map weapon settings controller missing in bundle');
assert.ok(js.includes('mapQuickElevation') && js.includes('mapRangeStatus'),
 'Map pinned status/range display missing in bundle');
assert.ok(js.includes('mapAimToggleRings'),'Range ring visibility control missing in bundle');
assert.ok(js.includes('mapAimChangeMap'),'Map selector missing from Vite bundle');
assert.ok(js.includes('mapWorldSelect')&&js.includes('mapCatalogStatus'),'Multi-world interface missing');
assert.ok(js.includes('drawMinimumRange')||js.includes('Красная заливка'),
 'Minimum firing range zone missing from Vite bundle');
assert.ok(js.includes('mapAimAddCustomWorld')&&js.includes('mapCustomWorldSize'),
 'Manual server world-size mode missing');
assert.ok(js.includes('mapServerPreset')&&js.includes('mapAimChangeMap'),
 'ULTRV/AHS map preset controls missing');
console.log('OK: interactive map code is present in Vite bundle');
