// GeNeFRAG Everon terrain dataset: grid[x][row], row 0 is north.
export const EVERON_HEIGHT_URL = 'https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/height_data/everon_height.json';
export const EVERON_SIZE_METRES = 12800;

export function checkHeightGrid(grid) {
  if (!Array.isArray(grid) || grid.length < 100 || grid.length > 2500) {
    throw Error('Ожидается двумерная карта высот Эверона');
  }
  const rows = grid[0]?.length;
  if (!Array.isArray(grid[0]) || !Number.isInteger(rows) || rows < 100 || rows > 2500) {
    throw Error('Некорректные строки карты высот');
  }
  for (const col of [0, Math.floor(grid.length / 2), grid.length - 1]) {
    if (!Array.isArray(grid[col]) || grid[col].length !== rows) {
      throw Error('Размерность карты высот нарушена');
    }
  }
  const values = [grid[0][0],grid[grid.length - 1][0],grid[0][rows - 1],
    grid[grid.length - 1][rows - 1],grid[Math.floor(grid.length / 2)][Math.floor(rows / 2)]];
  if (values.filter(v => v !== null && v !== '' && Number.isFinite(Number(v))).length < 3) {
    throw Error('Карта высот не содержит числовых отметок');
  }
  return {cols:grid.length, rows};
}
function numberAt(grid, x, y) {
  const v = grid[x]?.[y];
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 12000 ? n : null;
}
export function packHeightGrid(grid) {
  const {cols,rows} = checkHeightGrid(grid);
  const data = new Float32Array(cols * rows);
  for (let x=0;x<cols;x++) {
    if (!Array.isArray(grid[x]) || grid[x].length !== rows) throw Error('Неравномерная сетка высот');
    for (let y=0;y<rows;y++) {
      const n = numberAt(grid,x,y);
      data[x*rows+y] = n === null ? NaN : n;
    }
  }
  return {cols,rows,data};
}
export function getTerrainHeight(grid,east,north,worldSize=EVERON_SIZE_METRES) {
  const packed = grid && Number.isInteger(grid.cols) && Number.isInteger(grid.rows) && grid.data instanceof Float32Array;
  if (!packed && (!Array.isArray(grid) || !Array.isArray(grid[0]))) return null;
  const cols = packed ? grid.cols : grid.length, rows=packed ? grid.rows : grid[0].length;
  if (cols<2 || rows<2 || !Number.isFinite(east) || !Number.isFinite(north) ||
      east<0 || north<0 || east>worldSize || north>worldSize) return null;
  // x increases east; source rows run north to south.
  const x=Math.min(cols-1,east/worldSize*cols);
  const y=Math.min(rows-1,(worldSize-north)/worldSize*rows);
  const x0=Math.floor(x), y0=Math.floor(y),x1=Math.min(cols-1,x0+1),y1=Math.min(rows-1,y0+1);
  const get=(i,j)=>{
    if (!packed) return numberAt(grid,i,j);
    const n=grid.data[i*rows+j];return Number.isFinite(n)?n:null;
  };
  const a=get(x0,y0), b=get(x1,y0), c=get(x0,y1), d=get(x1,y1);
  if ([a,b,c,d].some(v=>v===null)) return get(Math.round(x),Math.round(y));
  const tx=x-x0,ty=y-y0;
  return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty;
}

/** Read a north-up/east-right ground elevation section along a straight GRID line. 
 *  No ballistic predictions are produced here. */
export function sampleElevationProfile(grid, start, finish, spacing=10) {
  if (!start || !finish) return null;
  const {x:x0,y:y0}=start,{x:x1,y:y1}=finish;
  if (![x0,y0,x1,y1].every(Number.isFinite)) return null;
  if ([x0,y0,x1,y1].some(v=>v<0||v>EVERON_SIZE_METRES)) return null;
  const length=Math.hypot(x1-x0,y1-y0);
  if(length<1) return null;
  const step=Number.isFinite(spacing)&&spacing>0?spacing:10;
  const segments=Math.min(1600,Math.max(40,Math.ceil(length/step)));
  const points=[];let min=Infinity,max=-Infinity,known=0;
  for(let i=0;i<=segments;i++){
    const fraction=i/segments,x=x0+(x1-x0)*fraction,y=y0+(y1-y0)*fraction;
    const height=getTerrainHeight(grid,x,y);
    if(height!==null&&Number.isFinite(height)){min=Math.min(min,height);max=Math.max(max,height);known++;}
    points.push({distance:length*fraction,x,y,height:height!==null&&Number.isFinite(height)?height:null});
  }
  return {length,points,min:known?min:null,max:known?max:null,known,
    complete:known===points.length,sampleSpacing:length/segments};
}
