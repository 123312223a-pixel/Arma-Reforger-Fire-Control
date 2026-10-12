import assert from 'node:assert/strict';
import { sampleElevationProfile } from '../src/heightmap.mjs';
import {checkHeightGrid,packHeightGrid,getTerrainHeight,EVERON_SIZE_METRES} from '../src/heightmap.mjs';

const grid=Array.from({length:128},(_,x)=>Array.from({length:128},(_,y)=>x*2+y));
assert.equal(checkHeightGrid(grid).cols,128);
const packed=packHeightGrid(grid);
assert.equal(packed.data.length,16384);
for (const matrix of [grid,packed]) {
  assert.equal(getTerrainHeight(matrix,0,EVERON_SIZE_METRES),0);
  assert.equal(getTerrainHeight(matrix,0,0),127);
  assert.equal(getTerrainHeight(matrix,6400,6400),192);
  assert.equal(getTerrainHeight(matrix,EVERON_SIZE_METRES,0),381);
  assert.equal(getTerrainHeight(matrix,-1,0),null);
  assert.equal(getTerrainHeight(matrix,0,EVERON_SIZE_METRES+1),null);
}
assert.throws(()=>checkHeightGrid([[1]]));
const missing=grid.map(row=>row.slice());missing[0][0]=null;
assert.equal(getTerrainHeight(missing,0,EVERON_SIZE_METRES),null);
console.log('OK: Everon heightmap axes, north inversion, interpolation, missing data, boundaries.');


const hill=Array.from({length:128},(_,x)=>Array.from({length:128},(_,y)=>x*2+y));
const sample=sampleElevationProfile(hill,{x:0,y:12800},{x:12800,y:0});
assert.ok(sample);
assert.equal(sample.points[0].height,0);
assert.equal(sample.points.at(-1).height,381);
assert.equal(sample.min,0);
assert.equal(sample.max,381);
assert.equal(sample.known,sample.points.length);
assert.ok(sample.points.length>=100);
assert.ok(sample.sampleSpacing<=11);
assert.ok(Math.abs(sample.length-Math.hypot(12800,12800))<.001);
const reverse=sampleElevationProfile(hill,{x:12800,y:0},{x:0,y:12800});
assert.equal(reverse.points[0].height,381);
assert.equal(reverse.points.at(-1).height,0);
assert.equal(sampleElevationProfile(hill,{x:0,y:0},{x:0,y:0}),null);
assert.equal(sampleElevationProfile(hill,{x:-1,y:0},{x:500,y:500}),null);
const hole=hill.map(col=>col.slice());
hole[0][0]=null;
const withMissing=sampleElevationProfile(hole,{x:0,y:12800},{x:12800,y:0});
assert.equal(withMissing.points[0].height,null);
assert.ok(!withMissing.complete);
console.log('OK: terrain profile samples north/east coordinates, missing cells, endpoints and length.');
