import assert from 'node:assert/strict';
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
