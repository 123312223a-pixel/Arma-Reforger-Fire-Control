import { formatMapTileUrl } from './map-url.mjs';
import { mapRadius,insideMinimum } from './map-range.mjs';
import {FALLBACK_REFORGER_MAPS,normalizeMapListing,validateMapDimensions} from './map-catalog.mjs';
import { EVERON_HEIGHT_URL, packHeightGrid, getTerrainHeight, sampleElevationProfile } from './heightmap.mjs';
import { fetch as nativeHttpFetch } from '@tauri-apps/plugin-http';
/* v3.7.2 map aiming. No ballistics here; use existing calculateCoords(). */
(()=>{'use strict';
let S=12800;const B=800,N='http://www.w3.org/2000/svg', $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fresh=()=>({mapSlug:'everon',worldSize:S,tool:'gun',layer:'topo',zoom:1,cx:400,cy:400,image:'',refs:[{px:0,py:0,x:0,y:S},{px:800,py:800,x:S,y:0}]});
let ready=false,drag=null,onlineInfo=null,onlineState='loading',onlineRequest=0;
let tileProbeToken=-1, tileProbe=null, tileWatchdog=null, offlineReason='';
const mapEndpoint='https://enfumap.com';

const mapCatalogue=new Map(FALLBACK_REFORGER_MAPS.map(item=>[item.slug,{...item,online:null}]));
mapCatalogue.set('ultrv-chasov-yar',{slug:'ultrv-chasov-yar',name:'ULTRV · Chasov Yar',worldSize:6144,online:false,checked:true,manual:true});
const CHASOV_YAR_ASSET='./maps/chasov-yar.jpg';
let chasovAssetAvailable=false;
function checkChasovAsset(){const test=new Image();test.onload=()=>{chasovAssetAvailable=true;render();onlineLabel();};test.onerror=()=>{chasovAssetAvailable=false;onlineLabel();};test.src=CHASOV_YAR_ASSET;}
let catalogVerified=false;
const mapMeta=slug=>mapCatalogue.get(slug)||FALLBACK_REFORGER_MAPS[0];
const selectedMap=()=>mapMeta(st().mapSlug);
function isGridOnlyMap(slug){
 const item=mapCatalogue.get(slug);
 return item?.online===false && (catalogVerified||item.manual===true||item.checked===true);
}
function updateMapMenu(){
 const field=$('mapWorldSelect');if(!field)return;
 const active=st().mapSlug;
 const items=Array.from(mapCatalogue.values()).sort((a,b)=>{
  if(a.slug==='everon')return -1;if(b.slug==='everon')return 1;
  if(a.slug==='arland')return -1;if(b.slug==='arland')return 1;
  if(a.online===true&&b.online!==true)return -1;
  if(a.online!==true&&b.online===true)return 1;
  return a.name.localeCompare(b.name,'ru');
 });
 const groups=[
  {text:'🗺️ Карты серверов',filter:m=>m.slug==='ultrv-chasov-yar'},
  {text:'🌐 Онлайн-подложки Enfumap',filter:m=>m.online===true&&m.slug!=='ultrv-chasov-yar'},
  {text:'▦ Только GRID / изображение пользователя',filter:m=>m.online===false&&m.slug!=='ultrv-chasov-yar'},
  {text:'? Доступность пока не проверена',filter:m=>m.online===null}
 ];
 const nodes=[];
 for(const group of groups){
  const list=items.filter(group.filter);
  if(!list.length)continue;
  const optgroup=document.createElement('optgroup');optgroup.label=group.text;
  for(const item of list){
   const option=document.createElement('option');
   option.value=item.slug;
   option.textContent=item.name+' · '+Math.round(item.worldSize).toLocaleString('ru-RU')+' м'+
    (item.slug==='ultrv-chasov-yar'?' · локальная':item.online===true?' · онлайн':item.online===false?' · GRID':' · проверить');
   optgroup.append(option);
  }
  nodes.push(optgroup);
 }
 field.replaceChildren(...nodes);field.value=active;
 const label=$('mapWorldInfo'),meta=mapMeta(active);
 if(label)label.textContent=meta.name+' · '+Math.round(S).toLocaleString('ru-RU')+
  ' × '+Math.round(S).toLocaleString('ru-RU')+' м'+
  (active==='ultrv-chasov-yar'?' · встроенная подложка':meta.online===true?' · подложка Enfumap':meta.online===false?' · только GRID':' · доступность подложки не проверена')+
  (meta.author?' · автор: '+meta.author:'')+'.';
 const count=$('mapCatalogStatus');
 const countOnline=items.filter(m=>m.online===true).length;
 if(count)count.textContent=catalogVerified
  ?countOnline+' онлайн · '+(items.length-countOnline)+' GRID / свои карты'
  :'Не удалось проверить онлайн-каталог · карты GRID доступны';
}
async function discoverMaps(){
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let response;
  try{response=await fetch(mapEndpoint+'/api/v1/maps',{cache:'no-cache',signal:controller.signal});}
  finally{clearTimeout(timer);}
  if(!response.ok)throw Error('HTTP '+response.status);
  const maps=normalizeMapListing(await response.json());
  if(maps.length<2)throw Error('Список карт пуст');
  catalogVerified=true;
  for(const [slug,item] of mapCatalogue){
   mapCatalogue.set(slug,{...item,online:item.manual?false:false});
  }
  for(const item of maps){
   mapCatalogue.set(item.slug,{...mapCatalogue.get(item.slug),...item,online:true,checked:true});
  }
  // Keep saved selections from older builds aligned with Enfumap's real slugs.
  const aliases={kolguev:'kolguyev',kunar:'kunar-province',serhiivka:'wcs-serhiivka'};
  for(const [legacy,canonical] of Object.entries(aliases)){
   if(mapCatalogue.get(canonical)?.online===true){
    const a=st();
    if(a.mapSlug===legacy){
     a.mapSlug=canonical;a.worldSize=mapMeta(canonical).worldSize;
     S=a.worldSize;opPersist();
    }
    mapCatalogue.delete(legacy);
   }
  }
  updateMapMenu();
  if(isGridOnlyMap(st().mapSlug)&&st().layer!=='grid'&&!st().image){
   const a=st();a.preferredOnlineLayer=a.layer;a.mapAutoOffline=true;a.layer='grid';
   offlineReason='У '+selectedMap().name+' нет опубликованной онлайн-подложки в Enfumap';
   onlineState='offline';++onlineRequest;finishTileProbe();
   $('mapAimLayer').value='grid';opPersist();render();onlineLabel();
  }
 }catch(error){
  catalogVerified=false;updateMapMenu();
 }
}
function installServerPresets(){
 const select=$('mapServerPreset');if(!select)return;
 const names=[
  ['','Выбрать карту сервера…'],
  ['ultrv-chasov-yar','ULTRV · Chasov Yar (локальная подложка; Z вручную)'],
  ['ahs-sergeevka','AHS · WCS_Serhiivka (онлайн-подложка местности)'],
  ['ahs-strelechye','AHS · Strelechye (свой размер / GRID)'],
 ];
 select.replaceChildren(...names.map(([v,label])=>{
  const option=document.createElement('option');option.value=v;option.textContent=label;return option;
 }));
}
window.mapAimSelectServerPreset=key=>{
 const input=$('mapCustomWorldSize'),name=$('mapCustomWorldName');
 const onlinePresets={
  'ahs-sergeevka':{slug:'wcs-serhiivka',title:'WCS_Serhiivka',size:10240}
 };
 const preset=onlinePresets[key];
 if(preset){
  if(!mapCatalogue.has(preset.slug))mapCatalogue.set(preset.slug,{
   slug:preset.slug,name:preset.title,worldSize:preset.size,online:null
  });
  updateMapMenu();window.mapAimChangeMap(preset.slug);
  status('Подложка '+preset.title+' загружается с Enfumap при доступности сервиса. Название пресета не подтверждает текущую ротацию серверов.','mapAimInstruction');
  return;
 }
 if(key==='ultrv-chasov-yar'){
  const slug='ultrv-chasov-yar',worldSize=6144;
  if(!mapCatalogue.has(slug))mapCatalogue.set(slug,{
   slug,name:'ULTRV · Chasov Yar',worldSize,online:false,checked:true,manual:true
  });
  if(st().mapSlug!==slug)window.mapAimChangeMap(slug);
  const state=st();
  state.manualMap={slug,name:'ULTRV · Chasov Yar',worldSize,online:false,checked:true,manual:true};
  state.layer='grid';state.mapAutoOffline=true;
  $('mapAimLayer').value='grid';
  opPersist();updateMapMenu();render();onlineLabel();
  status('Chasov Yar · масштаб 6144 м · координаты подтверждены пользователем · Z вручную.','mapAimInstruction');
  return;
 }
 const descriptions={
  'ahs-strelechye':'AHS · Strelechye'
 };
 if(descriptions[key]){
  name.value=descriptions[key];input.value='';
  status('Для '+descriptions[key]+' введите проверенную длину стороны мира в метрах, затем добавьте карту через поле своей карты. Ресурсы Enfusion .edds/.topo/.terr нельзя загружать как изображения напрямую.','mapAimInstruction');
 }
};
window.mapAimAddCustomWorld=()=>{
 const title=$('mapCustomWorldName')?.value.trim();
 const raw=$('mapCustomWorldSize')?.value.trim();
 const feedback=$('mapCustomWorldStatus');
 if(!title||!raw){feedback.textContent='Введите название и размер игрового мира (в метрах).';return;}
 let size;try{size=validateMapDimensions(raw);}catch{feedback.textContent='Укажите реальную длину стороны карты в игровых метрах (1000–100000).';return;}
 const slug='custom-'+Date.now().toString(36);
 const entry={slug,name:title.slice(0,64),worldSize:size,online:false,checked:true,manual:true};
 mapCatalogue.set(slug,entry);
 window.mapAimChangeMap(slug);
 const state=st();state.manualMap=entry;state.layer='grid';state.mapAutoOffline=true;
 offlineReason='Серверная карта без опубликованной онлайн-подложки';
 offlineReason='Серверная карта · собственная GRID-сетка';
 onlineState='offline';
 $('mapAimLayer').value='grid';opPersist();updateMapMenu();onlineLabel();render();
 feedback.textContent='Карта '+entry.name+' создана · '+size+' м. При необходимости импортируйте своё изображение карты и откалибруйте по GRID.';
};

function clearWorldCoordinates(){
 for(const id of ['artX','artY','tgtX','tgtY','artZ','tgtZ']){
  const input=$(id);
  if(input){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}
 }
 for(const id of ['mapResultElev','mapResultCharge','mapResultTof'])if($(id))$(id).textContent='—';
 if(typeof markResultsStale==='function')markResultsStale('coords');
}
window.mapAimChangeMap=slug=>{
 if(!mapCatalogue.has(slug))return;
 const a=st();if(a.mapSlug===slug)return;
 if(a.mapAutoOffline===true&&mapMeta(slug).online!==false){
  a.layer=a.preferredOnlineLayer||'topo';a.mapAutoOffline=false;
 }
 if(isGridOnlyMap(slug)&&a.layer!=='grid'){
  a.preferredOnlineLayer=a.layer;a.layer='grid';a.mapAutoOffline=true;
 }
 // Never carry positions or elevations from one world into another.
 ++onlineRequest;++terrainToken;finishTileProbe();
 terrainGrid=null;terrainStatus='idle';terrainError='';onlineInfo=null;offlineReason='';
 a.mapSlug=slug;a.image='';a.zoom=1;a.cx=400;a.cy=400;a.tool='gun';
 S=validateMapDimensions(mapMeta(slug).worldSize);
 a.worldSize=S;a.refs=fresh().refs;
 $('mapAimImage').value='';
 for(const [i,r] of a.refs.entries()){
  $('mapRef'+(i+1)+'X').value=r.x;
  $('mapRef'+(i+1)+'Y').value=r.y;
 }
 clearWorldCoordinates();
 if(typeof opCapture==='function')opState.inputs=opCapture();
 opPersist();updateMapMenu();terrainUi();render();solve();
 if(slug==='everon')void terrainFetch();
 $('mapAimLayer').value=a.layer;
 if(isGridOnlyMap(slug)){
  offlineReason='Для '+mapMeta(slug).name+' онлайн-подложка недоступна';
  onlineState='offline';onlineLabel();render();
 }else if(a.layer==='grid'){onlineState='offline';onlineLabel();}
 else void loadOnlineMap(true);
 status('Выбрана '+mapMeta(slug).name+'. Старые метки и высоты очищены.','mapAimInstruction');
};

function onlineLabel(){
 const label=$('mapAimTileState');if(!label)return;
 const state=st();
 if(state.image)label.textContent='Своя карта · сохранена локально';
 else if(state.mapSlug==='ultrv-chasov-yar')label.textContent=chasovAssetAvailable?'Chasov Yar · встроенная подложка · Z вручную':'Chasov Yar · подложка не найдена, доступна GRID / загрузите своё изображение';
 else if(state.layer==='grid')label.textContent=(offlineReason||'GRID · офлайн')+' · сетка доступна';
 else if(onlineState==='ready')label.textContent=selectedMap().name+' · карта подключена · Enfumap';
 else if(onlineState==='loading'||onlineState==='tiles')label.textContent='Загрузка карты… · GRID доступна';
 else label.textContent='Онлайн-карта недоступна · включите GRID';
}
function finishTileProbe(){if(tileWatchdog!==null)clearTimeout(tileWatchdog);tileWatchdog=null;tileProbe=null;}
function failOnline(reason){
 finishTileProbe();onlineState='error';offlineReason=reason;
 const state=st();state.mapAutoOffline=true;state.preferredOnlineLayer=state.layer;
 if(st().image){onlineLabel();render();return;}
 st().layer='grid';const select=$('mapAimLayer');if(select)select.value='grid';
 try{opPersist();}catch(error){console.warn('Сохранение слоя не удалось:',error);}
 onlineLabel();render();
 status(reason+' Переключено на GRID: отметки и расчёт продолжают работать.','mapAimInstruction');
}
function onlineTiles(svg,a,v){
 if(a.image||a.layer==='grid'||!['tiles','ready'].includes(onlineState)||!onlineInfo?.tiles)return;
 const tiles=onlineInfo.tiles;
 const layer=a.layer==='topo'?(tiles.layers?.topo||tiles.url):tiles.layers?.[a.layer];
 if(typeof layer!=='string'||!layer.includes('{z}')||!layer.includes('{x}')||!layer.includes('{y}')){
  queueMicrotask(()=>failOnline('У выбранного слоя нет доступных тайлов.'));return;
 }
 try{formatMapTileUrl(layer,0,0,0,mapEndpoint);}catch{
  queueMicrotask(()=>failOnline('Некорректный или небезопасный адрес тайлов.'));return;
 }
 const native=a.layer==='topo'?tiles.maxNativeZoom:(tiles.satelliteMaxNativeZoom??tiles.maxNativeZoom);
 const maxNative=Number.isInteger(native)?Math.min(7,native):5;
 const z=clamp(Math.round(Math.log2(a.zoom))+2,0,maxNative),n=2**z,size=800/n;
 const left=clamp(Math.floor(v.x/size),0,n-1),right=clamp(Math.floor((v.x+v.size)/size),0,n-1);
 const top=clamp(Math.floor(v.y/size),0,n-1),bottom=clamp(Math.floor((v.y+v.size)/size),0,n-1);
 let firstUrl='';
 for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
  const href=formatMapTileUrl(layer,z,col,row,mapEndpoint);
  if(!firstUrl)firstUrl=href;
  svg.append(el('image',{x:col*size,y:row*size,width:size+.08,height:size+.08,href,preserveAspectRatio:'none','pointer-events':'none'}));
 }
 // Metadata can load successfully while WebView2 blocks actual image tiles.
 // Probe a visible tile, not only the JSON API. Preserve the GRID overlay while loading.
 if(firstUrl && onlineState==='tiles' && tileProbeToken!==onlineRequest){
  const token=onlineRequest;tileProbeToken=token;finishTileProbe();
  const probe=new Image();tileProbe=probe;
  probe.decoding='async';
  probe.onload=()=>{if(token!==onlineRequest)return;finishTileProbe();onlineState='ready';offlineReason='';onlineLabel();};
  probe.onerror=()=>{if(token===onlineRequest)failOnline('Сервер ответил, но изображения карты не загружаются.');};
  tileWatchdog=setTimeout(()=>{if(token===onlineRequest && onlineState!=='ready')failOnline('Тайлы не загрузились за 9 секунд.');},9000);
  probe.src=firstUrl;
 }
}
async function loadOnlineMap(force=false){
 const a=st();
 if(a.image){offlineReason='';onlineLabel();render();return;}
 if(isGridOnlyMap(a.mapSlug)){
  offlineReason='Для '+selectedMap().name+' у Enfumap нет доступной онлайн-подложки';
  a.mapAutoOffline=true;a.layer='grid';$('mapAimLayer').value='grid';
  onlineState='offline';onlineLabel();render();return;
 }
 if(a.layer==='grid'&&!force){onlineState='offline';onlineLabel();render();return;}
 const token=++onlineRequest;tileProbeToken=-1;finishTileProbe();onlineInfo=null;
 onlineState='loading';offlineReason='';onlineLabel();render();
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  let response;try{response=await fetch(mapEndpoint+'/api/v1/maps/'+encodeURIComponent(a.mapSlug),{cache:'no-cache',signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok){
   if(response.status===404){
    const meta=mapCatalogue.get(a.mapSlug);
    if(meta){mapCatalogue.set(a.mapSlug,{...meta,online:false,checked:true});updateMapMenu();}
    throw Error('HTTP 404: для '+selectedMap().name+' нет онлайн-подложки');
   }
   throw Error('HTTP '+response.status);
  }
  const json=await response.json();
  if(json?.ok!==true||!json.data?.tiles)throw Error('Неверные данные карты');
  const newWorldSize=validateMapDimensions(json.data.worldSize);
  if(token!==onlineRequest||a.mapSlug!==st().mapSlug)return;
  if(newWorldSize!==S){
   S=newWorldSize;a.worldSize=S;a.refs=fresh().refs;
   mapCatalogue.set(a.mapSlug,{...mapMeta(a.mapSlug),worldSize:S});
   updateMapMenu();opPersist();
  }
  if(a.layer!=='topo'&&a.layer!=='grid'&&!json.data.tiles.layers?.[a.layer]){
   a.layer='topo';$('mapAimLayer').value='topo';
  }
  if(token!==onlineRequest||a.mapSlug!==st().mapSlug)return;
  mapCatalogue.set(a.mapSlug,{...mapCatalogue.get(a.mapSlug),online:true,checked:true});
  updateMapMenu();
  onlineInfo=json.data;onlineState='tiles';onlineLabel();render();
 }catch(e){if(token!==onlineRequest)return;console.warn('Enfumap недоступен:',e.message);failOnline('Нет доступа к онлайн-карте ('+e.message+').');}
}


// Optional terrain-height channel: independent of map imagery and ballistic tables.
// The GeNeFRAG CDN file is fetched once, converted to Float32 and cached in IndexedDB.
const TERRAIN_DB='fire-control-terrain-v1',TERRAIN_KEY='everon-height-grid';
let terrainGrid=null,terrainStatus='idle',terrainToken=0,terrainError='';
function terrainFlags() {
  const state=st();
  if (!state.autoZ || typeof state.autoZ!=='object') state.autoZ={gun:true,target:true};
  if (typeof state.autoZ.gun!=='boolean') state.autoZ.gun=true;
  if (typeof state.autoZ.target!=='boolean') state.autoZ.target=true;
  return state.autoZ;
}
function terrainMessage() {
  const label=$('mapHeightState');if(!label)return;
  if (st().image) label.textContent='Своя карта: автоматическая высота отключена (доступна ручная Z).';
  else if (st().mapSlug!=='everon')label.textContent='Для '+selectedMap().name+' высоты пока не подключены. Вводите Z вручную; рельеф Эверона не применяется.';
  else if (terrainStatus==='ready'&&terrainGrid) label.textContent='Рельеф Эверона подключён · шаг ≈'+
    Math.round(S/terrainGrid.cols)+' м · сохранён локально · Z поверхности';
  else if (terrainStatus==='loading') label.textContent='Загружаем высоты Эверона… ручные Z пока сохранены.';
  else if (terrainStatus==='error') label.textContent='Рельеф недоступен: '+terrainError+
    '. Введите Z вручную или загрузите JSON.';
  else label.textContent='Высоты не загружены. Можно использовать ручные Z.';
}
function terrainUi() {
  for (const kind of ['gun','target']) {
    const id=kind==='gun'?'mapGunZ':'mapTargetZ';
    const check=$(kind==='gun'?'mapAutoGunZ':'mapAutoTargetZ');
    if(check){check.checked=terrainFlags()[kind];check.disabled=st().mapSlug!=='everon';}
    const input=$(id);if(input)input.readOnly=!!(st().mapSlug==='everon'&&terrainFlags()[kind]&&terrainGrid&&!st().image);
  }
  terrainMessage();
}
function autoHeight(kind) {
  if (st().mapSlug!=='everon'||!terrainGrid||st().image||!terrainFlags()[kind])return false;
  const p=xy(kind);if(!p)return false;
  const z=getTerrainHeight(terrainGrid,p.x,p.y,S);
  if(z===null||!Number.isFinite(z))return false;
  const value=String(Math.round(z*10)/10);
  const field=$(kind==='gun'?'artZ':'tgtZ');
  if(field.value===value)return false;
  field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));
  field.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
}
function syncAutoTerrain(){
  const changed=autoHeight('gun')|autoHeight('target');
  terrainUi();
  return !!changed;
}
function openTerrainDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(Error('Локальный кэш недоступен'));
    const request=indexedDB.open(TERRAIN_DB,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('maps'))request.result.createObjectStore('maps');};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Ошибка кэша'));
  });
}
async function terrainCacheRead(){
  let db;try{
    db=await openTerrainDb();
    const result=await new Promise((resolve,reject)=>{
      const transaction=db.transaction('maps','readonly');
      const request=transaction.objectStore('maps').get(TERRAIN_KEY);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||Error('Ошибка чтения кэша'));
    });
    if(!result || !Number.isInteger(result.cols)||!Number.isInteger(result.rows)||
       result.cols<100||result.rows<100||!(result.data instanceof Float32Array)||
       result.data.length!==result.cols*result.rows)return null;
    return result;
  }catch(error){console.info('Не удалось прочитать кэш высот:',error.message);return null;}
  finally{db?.close();}
}
async function terrainCacheWrite(grid){
  let db;try{
    db=await openTerrainDb();
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction('maps','readwrite');
      transaction.objectStore('maps').put(grid,TERRAIN_KEY);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error||Error('Ошибка записи'));
    });
  }catch(error){console.info('Не удалось сохранить рельеф локально:',error.message);}
  finally{db?.close();}
}
function setTerrain(grid,reason){
  terrainGrid=grid;terrainStatus='ready';terrainError='';terrainUi();
  const changed=syncAutoTerrain();
  if(changed&&xy('gun')&&xy('target'))solve();else stats();
  status('Высоты Эверона доступны ('+reason+'). Автоматическое Z можно выключить отдельно для каждой точки.','mapAimInstruction');
}
async function terrainFetch(force=false){
  if(st().mapSlug!=='everon'){terrainGrid=null;terrainStatus='idle';terrainUi();return;}
  const token=++terrainToken;
  if(terrainGrid&&!force){terrainUi();return;}
  terrainStatus='loading';terrainError='';terrainUi();
  if(!force){
    const cached=await terrainCacheRead();
    if(token!==terrainToken)return;
    if(cached){setTerrain(cached,'локальный кэш');return;}
  }
  let timer;
  try{
    const controller=new AbortController();
    timer=setTimeout(()=>controller.abort(),60000);
    // This native plugin bypasses WebView2 CORS. Scope is restricted to Everon height JSON.
    let response,transport='браузерный HTTPS',nativeError='';
    if(window.__TAURI_INTERNALS__?.invoke){
      try{
        response=await nativeHttpFetch(EVERON_HEIGHT_URL,{
          method:'GET',connectTimeout:15000,signal:controller.signal
        });
        transport='нативный HTTPS (без CORS)';
      }catch(error){
        nativeError=String(error?.message||error);
        console.warn('Нативная загрузка рельефа не удалась, пробуем WebView2:',nativeError);
      }
    }
    if(!response){
      try{
        response=await fetch(EVERON_HEIGHT_URL,{cache:'force-cache',signal:controller.signal});
      }catch(error){
        if(nativeError)throw Error('Нативный HTTPS: '+nativeError+'; браузер: '+String(error?.message||error));
        throw error;
      }
    }
    if(!response.ok)throw Error('HTTP '+response.status+' ('+transport+')');
    const length=Number(response.headers.get('content-length')||0);
    if(length>90000000)throw Error('Файл больше 90 МБ');
    const raw=await response.json();
    const grid=packHeightGrid(raw);
    if(token!==terrainToken)return;
    setTerrain(grid,'с сервера · '+transport);void terrainCacheWrite(grid);
  }catch(error){
    if(token!==terrainToken)return;
    terrainStatus='error';terrainError=error.name==='AbortError'?'превышено время ожидания':String(error.message||error);
    terrainUi();
  }finally{clearTimeout(timer);}
}
window.mapAimLoadTerrain=()=>void terrainFetch(true);
window.mapAimImportTerrain=async input=>{
  const file=input.files?.[0];if(!file)return;
  if(st().mapSlug!=='everon'){status('Импорт высот Эверона доступен только на карте Эверон.');input.value='';return;}
  try{
    if(file.size>90000000)throw Error('Файл высот больше 90 МБ');
    const parsed=JSON.parse(await file.text());
    const grid=packHeightGrid(parsed);
    ++terrainToken;setTerrain(grid,'импорт файла');void terrainCacheWrite(grid);
  }catch(error){
    terrainStatus='error';terrainError=error.message;terrainUi();
  }finally{input.value='';}
};
window.mapAimToggleAutoHeight=(kind,checked)=>{
  if(!['gun','target'].includes(kind))return;
  terrainFlags()[kind]=!!checked;
  if(checked)autoHeight(kind);
  terrainUi();opPersist();
  if(xy('gun')&&xy('target'))solve();else stats();
};

function st(){if(!opState.mapAim||typeof opState.mapAim!=='object')opState.mapAim=fresh();const a=opState.mapAim;
 if(!a.mapSlug||!/^[a-z0-9_-]+$/.test(a.mapSlug))a.mapSlug='everon';
 if(a.manualMap?.slug===a.mapSlug&&!mapCatalogue.has(a.mapSlug)){
  const size=Number(a.manualMap.worldSize);
  if(Number.isFinite(size)&&size>=1000&&size<=100000){
   mapCatalogue.set(a.mapSlug,{...a.manualMap,online:false,checked:true,manual:true});
  }
 }
 if(!mapCatalogue.has(a.mapSlug)&&!Number.isFinite(Number(a.worldSize)))a.mapSlug='everon';
 S=validateMapDimensions(a.worldSize||mapMeta(a.mapSlug).worldSize);
 a.worldSize=S;
 if(!Array.isArray(a.refs)||a.refs.length!==2)a.refs=fresh().refs;
 if(typeof a.image!=='string'||a.image.length>1800000||a.image&&!a.image.startsWith('data:image/jpeg;base64,'))a.image='';
 if(!['topo','satellite','fogless','grid'].includes(a.layer))a.layer='topo';
 if(typeof a.showRangeRings!=='boolean')a.showRangeRings=true;
 a.zoom=clamp(+a.zoom||1,1,16);a.cx=clamp(+a.cx||400,0,800);a.cy=clamp(+a.cy||400,0,800);
 return a;}
const isxy=q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.x>=0&&q.y>=0&&q.x<=S&&q.y<=S;
function refs(){const [a,b]=st().refs,dp=b.px-a.px,dq=b.py-a.py,dx=b.x-a.x,dy=b.y-a.y;
 if([dp,dq,dx,dy].some(v=>!Number.isFinite(v))||Math.abs(dp)<15||Math.abs(dq)<15||Math.abs(dx)<50||Math.abs(dy)<50||dx/dp<=0||dy/dq>=0)return null;
 return {a,sx:dx/dp,sy:dy/dq};}
function toWorld(p){const r=refs();return r?{x:r.a.x+(p.x-r.a.px)*r.sx,y:r.a.y+(p.y-r.a.py)*r.sy}:null;}
function toPixel(p){const r=refs();return r?{x:r.a.px+(p.x-r.a.x)/r.sx,y:r.a.py+(p.y-r.a.y)/r.sy}:null;}
function el(tag,atts={},text){const n=document.createElementNS(N,tag);Object.entries(atts).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;return n;}
function xy(kind){const ids=kind==='gun'?['artX','artY']:['tgtX','tgtY'];if(!$(ids[0])?.value.trim()||!$(ids[1])?.value.trim())return null;const x=Number($(ids[0]).value),y=Number($(ids[1]).value);return isxy({x,y})?{x,y}:null;}
const fmt=q=>q?`${Math.round(q.x).toString().padStart(5,'0')} / ${Math.round(q.y).toString().padStart(5,'0')}`:'—';
function status(message,id='mapAimInstruction'){const x=$(id);if(x)x.textContent=message;}
function viewport(){const a=st(),size=B/a.zoom;a.cx=clamp(a.cx,size/2,B-size/2);a.cy=clamp(a.cy,size/2,B-size/2);return {x:a.cx-size/2,y:a.cy-size/2,size};}
function render(){const svg=$('mapAimSvg');if(!svg)return;const a=st(),z=a.zoom,v=viewport();svg.setAttribute('viewBox',`${v.x} ${v.y} ${v.size} ${v.size}`);
 svg.replaceChildren(el('rect',{x:0,y:0,width:B,height:B,fill:'#1b3129'}));
 onlineTiles(svg,a,v);
 if(a.mapSlug==='ultrv-chasov-yar'&&!a.image&&chasovAssetAvailable)svg.append(el('image',{x:0,y:0,width:B,height:B,href:CHASOV_YAR_ASSET,preserveAspectRatio:'none','pointer-events':'none'}));
 if(a.image)svg.append(el('image',{x:0,y:0,width:B,height:B,href:a.image,preserveAspectRatio:'none'}));
 drawMinimumRange(svg);
 const tick=z>=8?250:z>=4?500:1000;
 for(let n=0;n<=S;n+=tick){const px=toPixel({x:n,y:0}),py=toPixel({x:0,y:n});if(!px||!py)continue;
 const major=n%1000===0,attrs={stroke:'#d8e9c1','stroke-opacity':major?.32:.13,'stroke-width':1/z};
 svg.append(el('line',{x1:px.x,y1:0,x2:px.x,y2:800,...attrs}),el('line',{x1:0,y1:py.y,x2:800,y2:py.y,...attrs}));
 if(major){if(px.x>=v.x&&px.x<=v.x+v.size)svg.append(el('text',{x:px.x+5/z,y:v.y+16/z,fill:'#e9f2d5','font-size':11/z,'paint-order':'stroke',stroke:'#182720','stroke-width':2.5/z},String(n)));
 if(py.y>=v.y&&py.y<=v.y+v.size)svg.append(el('text',{x:v.x+5/z,y:py.y-4/z,fill:'#e9f2d5','font-size':11/z,'paint-order':'stroke',stroke:'#182720','stroke-width':2.5/z},String(n)));}}
 svg.append(el('rect',{x:0,y:0,width:B,height:B,fill:'none',stroke:'#e1f1ce','stroke-opacity':.5,'stroke-width':2/z}));
 drawRangeCircles(svg);
 const gun=xy('gun'),target=xy('target'),p=gun&&toPixel(gun),q=target&&toPixel(target);
 if(p&&q)svg.append(el('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#70c7f7','stroke-width':2.6/z,'stroke-dasharray':`${7/z} ${5/z}`}));
 for(const [name,point,color] of [['ОРУДИЕ',p,'#96e7a4'],['ЦЕЛЬ',q,'#ff957e']]){if(!point)continue;
 svg.append(el('circle',{cx:point.x,cy:point.y,r:11/z,fill:color,stroke:'#10251b','stroke-width':2/z,'pointer-events':'none'}));
 svg.append(el('circle',{cx:point.x,cy:point.y,r:17/z,fill:'none',stroke:color,'stroke-width':2/z,'pointer-events':'none'}));
 svg.append(el('text',{x:point.x+20/z,y:point.y-8/z,fill:color,'font-size':16/z,'font-weight':'bold',stroke:'#0b150e','stroke-width':3/z,'paint-order':'stroke','pointer-events':'none'},name));}
 svg.append(el('text',{x:v.x+v.size-12/z,y:v.y+35/z,fill:'#eff8e2','font-size':13/z,'text-anchor':'end','paint-order':'stroke',stroke:'#132017','stroke-width':3/z},'СЕВЕР ↑'));
 $('mapZoomLabel').textContent=z+'×';svg.classList.toggle('is-pan',a.tool==='pan');
 for(const [tool,id] of [['gun','mapModeGun'],['target','mapModeTarget'],['pan','mapModePan']]){$(id).classList.toggle('is-selected',a.tool===tool);$(id).setAttribute('aria-pressed',String(a.tool===tool));}
}

function updateMapTrajectory() {
  const main=$('trajectory'),control=$('mapTrajectory'),hint=$('mapTrajectoryHint');
  if(!main||!control)return;
  const mortar=$('weaponType').value!=='m777';
  control.disabled=mortar;
  control.value=mortar?'high':main.value;
  if(hint)hint.textContent=mortar
    ? 'Для M252 и 2Б14 доступна только High Angle. Выбор заблокирован.'
    : 'Траектория связана с режимом «По координатам»; таблицы и заряды используются те же.';
}
function formatHeightDelta(){
  const gun=$('artZ'),target=$('tgtZ'),label=$('mapHeightDelta');
  if(!label)return;
  const z1=Number(gun?.value),z2=Number(target?.value);
  if(!gun?.value?.trim()||!target?.value?.trim()||!Number.isFinite(z1)||!Number.isFinite(z2)){
    label.textContent='—';return;
  }
  const diff=z2-z1,amount=Math.round(diff*10)/10;
  label.textContent=(amount>0?'+':'')+amount.toLocaleString('ru-RU')+
    ' м'+(amount>0?' · цель выше':amount<0?' · цель ниже':' · одна высота');
}
function terrainProfileMessage(message,summary){
  const svg=$('mapTerrainProfile');
  if(!svg)return;
  svg.replaceChildren(
    el('rect',{x:0,y:0,width:660,height:252,fill:'#142820'}),
    el('text',{x:330,y:124,fill:'#c8d8c0','font-size':15,'text-anchor':'middle'},message)
  );
  $('mapTerrainProfileStatus').textContent=message;
  $('mapTerrainProfileSummary').textContent=summary||
    'Профиль показывает землю, а не траекторию полёта снаряда.';
}
function drawTerrainProfile(){
  const gun=xy('gun'),target=xy('target');
  if(!gun||!target||Math.hypot(target.x-gun.x,target.y-gun.y)<1){
    terrainProfileMessage('Укажите орудие и цель.');return;
  }
  if(st().mapSlug!=='everon'){
    terrainProfileMessage('Профиль рельефа для '+selectedMap().name+' пока недоступен.',
      'В этом режиме высоты Z вводятся вручную.');return;
  }
  if(st().image){
    terrainProfileMessage('Собственная подложка: профиль Эверона отключён.',
      'Для собственных изображений привязка к рельефу Эверона не гарантирована.');return;
  }
  if(!terrainGrid){
    terrainProfileMessage(terrainStatus==='loading'?'Карта высот загружается…':'Нет данных рельефа.',
      'Дождитесь карты высот или импортируйте JSON; поля Z остаются доступны вручную.');return;
  }
  const profile=sampleElevationProfile(terrainGrid,gun,target);
  if(!profile||!profile.known){
    terrainProfileMessage('Нет доступных высот вдоль выбранной линии.');return;
  }
  const svg=$('mapTerrainProfile');
  const W=660,H=252,L=55,R=18,T=18,BOT=33,iw=W-L-R,ih=H-T-BOT;
  const gunZ=Number($('artZ').value),tgtZ=Number($('tgtZ').value);
  const endpoints=[
    $('artZ').value!==''&&Number.isFinite(gunZ)?gunZ:null,
    $('tgtZ').value!==''&&Number.isFinite(tgtZ)?tgtZ:null
  ].filter(v=>v!==null);
  let low=Math.min(profile.min,...endpoints), high=Math.max(profile.max,...endpoints);
  const margin=Math.max(8,(high-low)*.13);
  low-=margin;high+=margin;
  const X=d=>L+(d/profile.length)*iw,Y=h=>T+ih-(h-low)/(high-low)*ih;
  svg.replaceChildren(el('rect',{x:0,y:0,width:W,height:H,fill:'#142820'}));
  for(let i=0;i<=4;i++){
    const elevation=low+(high-low)*i/4,y=Y(elevation);
    svg.append(el('line',{x1:L,y1:y,x2:W-R,y2:y,stroke:'#8cae96','stroke-opacity':.20,'stroke-width':1}));
    svg.append(el('text',{x:L-7,y:y+4,fill:'#c4d8c6','font-size':11,'text-anchor':'end'},
      Math.round(elevation).toString()));
  }
  const knownSegments=[];let part=[];
  for(const q of profile.points){
    if(q.height===null){if(part.length)knownSegments.push(part);part=[];continue;}
    part.push([X(q.distance),Y(q.height)]);
  }
  if(part.length)knownSegments.push(part);
  for(const segment of knownSegments){
    const points=segment.map(v=>v[0].toFixed(2)+','+v[1].toFixed(2)).join(' ');
    if(segment.length>1){
      const closed=points+' '+segment.at(-1)[0].toFixed(2)+','+(T+ih)+' '+
        segment[0][0].toFixed(2)+','+(T+ih);
      svg.append(el('polygon',{points:closed,fill:'#417857','fill-opacity':.42}));
    }
    svg.append(el('polyline',{points,stroke:'#a6e4aa','stroke-width':2.5,fill:'none',
      'stroke-linejoin':'round','stroke-linecap':'round'}));
  }
  // Dashed line joins the entered elevations only; never depict it as shell flight.
  if(endpoints.length===2){
    svg.append(el('line',{x1:L,y1:Y(gunZ),x2:W-R,y2:Y(tgtZ),stroke:'#ffd27b',
      'stroke-width':1.5,'stroke-dasharray':'8 5','stroke-opacity':.9}));
    for(const [x,z,fill] of [[L,gunZ,'#7bd7a2'],[W-R,tgtZ,'#ff997b']]){
      svg.append(el('circle',{cx:x,cy:Y(z),r:4.5,fill,stroke:'#142820','stroke-width':1.5}));
    }
  }
  svg.append(el('line',{x1:L,y1:T+ih,x2:W-R,y2:T+ih,stroke:'#a2bba7','stroke-width':1}));
  for(const [x,textValue,anchor] of [[L,'0 м','start'],[W-R,Math.round(profile.length).toLocaleString('ru-RU')+' м','end']]){
    svg.append(el('text',{x,y:H-11,fill:'#d0e3d1','font-size':12,'text-anchor':anchor},textValue));
  }
  const incomplete=profile.known!==profile.points.length;
  $('mapTerrainProfileStatus').textContent=
    'Рельеф: '+profile.known+'/'+profile.points.length+' отсчётов · шаг ~'+
    Math.round(profile.sampleSpacing)+' м'+(incomplete?' · есть пропуски':'');
  $('mapTerrainProfileSummary').textContent=
    'Земля: мин. '+Math.round(profile.min)+' м, макс. '+Math.round(profile.max)+
    ' м. Зелёная линия — рельеф, жёлтый пунктир — прямая между введёнными Z.'+
    ' Не является траекторией снаряда или проверкой препятствий.';
}


function mapSourceShellId(){
 const weapon=$('weaponType').value;
 return weapon==='m777'?'m777ShellType':weapon==='m252'?'shellType':'shellType2b14';
}
function syncMapSelect(controlId,sourceId){
 const control=$(controlId),source=$(sourceId);
 if(!control||!source)return;
 const stamp=Array.from(source.options,o=>o.value+'\u0000'+o.textContent).join('\u0001');
 if(control.dataset.syncStamp!==stamp){
  control.replaceChildren(...Array.from(source.options,o=>o.cloneNode(true)));
  control.dataset.syncStamp=stamp;
 }
 control.value=source.value;
}
function syncMapWeapons(){
 if(!$('mapWeaponType'))return;
 const weapon=$('weaponType').value;
 $('mapWeaponType').value=weapon;
 updateMapTrajectory();
 syncMapSelect('mapShellSelect',mapSourceShellId());
 syncMapSelect('mapChargeSelect','chargeSelect');
 $('mapShellLabel').textContent='Снаряд · '+(weapon==='m777'?'M777':weapon==='m252'?'M252':'2Б14');
 $('mapChargeLabel').textContent=weapon==='m252'?'Кольца':'Заряд';
 const vt=weapon==='m777'&&$('m777ShellType').value==='vt';
 $('mapBurstHeightGroup').hidden=!vt;
 for(const [mapId,src] of [
  ['mapBurstHeight','burstHeight'],['mapWindSpeed','cWindSpd'],['mapWindDir','cWindDir'],
  ['mapCorrEast','cCorrEast'],['mapCorrNorth','cCorrNorth']]){
  const field=$(mapId),original=$(src);
  if(field&&original&&document.activeElement!==field)field.value=original.value;
 }
 syncMapSelect('mapCorrStep','cCorrStep');
 $('mapRangeRings').checked=st().showRangeRings!==false;
}
function tableRange(){
 const weapon=$('weaponType')?.value||'m777';
 const shell=$(mapSourceShellId())?.value||'he';
 const trajectory=weapon==='m777'?$('trajectory').value:'high';
 const charge=$('chargeSelect')?.value||'auto';
 const envelope=window.mapAimGetRangeEnvelope?.(weapon,shell,trajectory,charge);
 return envelope && Array.isArray(envelope.ranges)?envelope:{ranges:[],min:null,max:null};
}
function rangeUi(){
 const label=$('mapRangeStatus');if(!label)return;
 const range=tableRange(),gun=xy('gun'),target=xy('target');
 if(range.max===null){label.textContent='Нет таблицы дальностей для этих параметров.';return;}
 const fmtMeters=v=>Math.round(v).toLocaleString('ru-RU')+' м';
 let statement='Табличная дальность: '+fmtMeters(range.min)+' — '+fmtMeters(range.max)+
  '. '+($('chargeSelect').value==='auto'?'Авто: все допустимые заряды.':'Выбранный заряд: '+$('chargeSelect').value+'.');
 if(gun&&target){
  const distance=Math.hypot(target.x-gun.x,target.y-gun.y);
  const valid=range.ranges.some(a=>distance>=a.min&&distance<=a.max);
  statement+=' '+(insideMinimum(distance,range.min)?'Цель в КРАСНОЙ ЗОНЕ: ближе минимальной табличной дальности.':('Цель '+(valid?'в табличном интервале.':'вне доступных интервалов.')));
 }
 statement+=' Красная заливка — ближе минимальной табличной дальности. Линии и круги показывают горизонтальную дальность, не гарантируют решение.';
 label.textContent=statement;
}

function drawMinimumRange(svg) {
 const gun=xy('gun');if(!gun||st().showRangeRings===false)return;
 const rmin=tableRange().min;
 if(!Number.isFinite(rmin)||rmin<=0)return;
 const p=toPixel(gun),z=st().zoom,r=mapRadius(rmin,S,B);
 if(!p||r===null)return;
 // Solid red disc means ALL table charge options reject ranges below rmin.
 // This is not a simulated physical blast or obstruction region.
 svg.append(el('circle',{cx:p.x,cy:p.y,r,fill:'#ed3848','fill-opacity':.27,
   stroke:'#ff7880','stroke-width':2.4/z,'pointer-events':'none'}));
 svg.append(el('text',{x:p.x+10/z,y:p.y-r+18/z,
   fill:'#fff0eb','font-size':12/z,'font-weight':'bold',
   stroke:'#3a111b','stroke-width':3/z,'paint-order':'stroke','pointer-events':'none'},
   'МИН '+Math.round(rmin).toLocaleString('ru-RU')+' м'));
}

function drawRangeCircles(svg){
 const gun=xy('gun');
 if(!gun||st().showRangeRings===false)return;
 const envelope=tableRange();
 if(!Number.isFinite(envelope.max)||envelope.max<=0)return;
 const pixel=toPixel(gun),zoom=st().zoom;
 if(!pixel)return;
 // World SVG spans 800 units; game metres are normalized by the selected map size.
 // Rings reflect horizontal ranges of the ORIGINAL source tables.
 const scales=[.25,.5,.75,1];
 for(const fraction of scales){
  const metres=Math.round(envelope.max*fraction),r=mapRadius(metres,S,B);
  svg.append(el('circle',{cx:pixel.x,cy:pixel.y,r,
   stroke:fraction===1?'#f8d27a':'#9fd3a6',
   'stroke-width':(fraction===1?2.5:1.1)/zoom,
   'stroke-dasharray':fraction===1?'none':String(6/zoom)+' '+String(5/zoom),
   'stroke-opacity':fraction===1?.95:.68,'fill':'none','pointer-events':'none'}));
  const ty=pixel.y-r;
  // Labels always align with the world map and zoom consistently.
  svg.append(el('text',{x:pixel.x+8/zoom,y:ty-5/zoom,
   fill:fraction===1?'#ffe89c':'#e3f5d6',
   'font-size':(fraction===1?14:12)/zoom,'font-weight':fraction===1?700:500,
   stroke:'#0a1b12','stroke-width':3/zoom,'paint-order':'stroke',
   'pointer-events':'none'},
   (metres/1000).toLocaleString('ru-RU',{maximumFractionDigits:2})+' км'+(fraction===1?' МАКС':'')
  ));
 }
}
function quickSolution(valid){
 const map={
  mapQuickDistance:$('mapDistance').textContent,
  mapQuickAzimuth:$('mapBearingMils').textContent,
  mapQuickElevation:valid?$('mapResultElev').textContent:'—',
  mapQuickCharge:valid?$('mapResultCharge').textContent:'—',
  mapQuickTime:valid?$('mapResultTof').textContent:'—'
 };
 for(const [id,value] of Object.entries(map))if($(id))$(id).textContent=value;
 $('mapQuickState').textContent=valid
  ?$('mapWeaponType').selectedOptions[0]?.textContent+' · '+$('mapTrajectory').value.toUpperCase()+
    ' · '+$('mapAimStatus').textContent
  :$('mapAimStatus').textContent;
}
window.mapAimSettingChanged=(field,value)=>{
 const sourceId=field==='shell'?mapSourceShellId():field,control=$(sourceId);
 if(!control)return;
 control.value=String(value);
 if(control.value!==String(value)){syncMapWeapons();return;}
 control.dispatchEvent(new Event('input',{bubbles:true}));
 control.dispatchEvent(new Event('change',{bubbles:true}));
 if(field==='shell'&&typeof updateBurstVisibility==='function')updateBurstVisibility();
 syncMapWeapons();
 render();solve();
};
window.mapAimCorrectionInput=(field,value)=>{
 const control=$(field);if(!control)return;
 control.value=value;
 control.dispatchEvent(new Event('input',{bubbles:true}));
 control.dispatchEvent(new Event('change',{bubbles:true}));
};
function finishCorrection(label){
 syncAutoTerrain();syncMapWeapons();render();solve();
 $('mapCorrectionStatus').textContent=label;
}
window.mapAimCorrectTarget=()=>{
 corrApply('coords');
 finishCorrection($('cCorrFeedback')?.textContent||'Корректировка обработана.');
};
window.mapAimUndoCorrection=()=>{
 corrUndo('coords');
 finishCorrection($('cCorrFeedback')?.textContent||'Поправка отменена.');
};
window.mapAimClearCorrection=()=>{
 corrClearInput('coords');syncMapWeapons();
 $('mapCorrectionStatus').textContent='Ожидающее смещение очищено.';
};
window.mapAimToggleRings=show=>{st().showRangeRings=!!show;opPersist();render();rangeUi();};

function stats(){const gun=xy('gun'),target=xy('target');$('mapGunGrid').textContent=fmt(gun);$('mapTargetGrid').textContent=fmt(target);
 syncMapWeapons();rangeUi();
 updateMapTrajectory();formatHeightDelta();drawTerrainProfile();
 $('mapWeaponType').value=$('weaponType').value;$('mapGunZ').value=$('artZ').value;$('mapTargetZ').value=$('tgtZ').value;
 if(!gun||!target){for(const id of ['mapDistance','mapBearingDegrees','mapBearingMils'])$(id).textContent='—';return;}
 const dx=target.x-gun.x,dy=target.y-gun.y,deg=((Math.atan2(dx,dy)*180/Math.PI)+360)%360,weapon=$('weaponType').value;
 $('mapDistance').textContent=Math.round(Math.hypot(dx,dy))+' м';$('mapBearingDegrees').textContent=deg.toFixed(2)+'°';$('mapBearingMils').textContent=degreesToMils(deg,weapon)+' / '+milsPerCircle(weapon);
}
function solve(){const a=xy('gun'),b=xy('target');stats();if(!a||!b||Math.hypot(b.x-a.x,b.y-a.y)<1){status('Выберите две разные позиции на карте.','mapAimStatus');quickSolution(false);return;}
 window.calculateCoords();const valid=opValid('coords');$('mapResultElev').textContent=valid?$('cResElev').textContent.trim()+' тыс.':'—';
 $('mapResultCharge').textContent=valid?$('cResCharge').textContent.trim():'—';$('mapResultTof').textContent=valid?$('cResTof').textContent.trim()+' с':'—';
 status(valid?'✓ Решение рассчитано по проверенной таблице.':'Для выбранного расстояния и орудия табличное решение не найдено.','mapAimStatus');
 quickSolution(valid);
}
function pointAt(e){const svg=$('mapAimSvg'),ctm=svg.getScreenCTM();if(!ctm)return null;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const r=point.matrixTransform(ctm.inverse());return {x:r.x,y:r.y};}
function calibrate(tool,p){if(!st().image){status('Для онлайн-слоя калибровка не требуется. Загрузите свою карту.','mapCalibrationStatus');return;}const i=tool==='ref1'?0:1,x=Number($(`mapRef${i+1}X`).value),y=Number($(`mapRef${i+1}Y`).value),a=st();
 if(!isxy({x,y})){status('Укажите координаты GRID от 0 до '+S+'.','mapCalibrationStatus');return;}
 const prev=a.refs[i];a.refs[i]={px:p.x,py:p.y,x,y};
 if(!refs()){a.refs[i]=prev;status('Точки не подошли. Нужны разные X/Y, север должен быть вверху.','mapCalibrationStatus');return;}
 opPersist();render();stats();status(`Точка ${i+1} привязана. Сетка обновлена.`,'mapCalibrationStatus');window.mapAimSetTool(i===0?'ref2':'gun');
}
function place(tool,p){const xyValue=toWorld(p);if(!isxy(xyValue)){status('Точка вне игровых координат. Проверьте калибровку.');return;}
 const ids=tool==='gun'?['artX','artY']:['tgtX','tgtY'];ids.forEach((id,index)=>{const control=$(id);control.value=Math.round(index?xyValue.y:xyValue.x).toString().padStart(5,'0');control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));});
 syncAutoTerrain();render();solve();if(tool==='gun')window.mapAimSetTool('target');status(tool==='gun'?'Орудие отмечено. Кликните по цели.':'Цель отмечена. Решение рассчитано автоматически, можно переместить любую метку.');
}
function down(e){
 if(![0,1].includes(e.button))return;
 const p=pointAt(e),a=st();if(!p)return;
 drag={x:e.clientX,y:e.clientY,cx:a.cx,cy:a.cy,pan:e.button===1||a.tool==='pan',moved:false,button:e.button};
 $('mapAimSvg').setPointerCapture?.(e.pointerId);
 if(drag.pan)$('mapAimSvg').classList.add('is-moving');
 e.preventDefault();
}
function move(e){
 const p=pointAt(e);
 if(p){const r=toWorld(p);$('mapPointerCoords').textContent=isxy(r)?'GRID '+fmt(r):'Вне карты';}
 if(!drag)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.hypot(dx,dy)>5)drag.moved=true;
 if(drag.pan&&drag.moved){
  const a=st(),box=$('mapAimSvg').getBoundingClientRect(),size=B/a.zoom;
  a.cx=clamp(drag.cx-dx/box.width*size,size/2,B-size/2);
  a.cy=clamp(drag.cy-dy/box.height*size,size/2,B-size/2);
  render();
 }
}
function up(e){
 if(!drag)return;
 const had=drag;drag=null;$('mapAimSvg').classList.remove('is-moving');
 if(had.pan){if(had.moved)opPersist();return;}
 if(had.moved)return;
 const p=pointAt(e);if(!p||p.x<0||p.y<0||p.x>B||p.y>B)return;
 const tool=st().tool;
 if(tool==='ref1'||tool==='ref2')calibrate(tool,p);
 else if(tool==='gun'||tool==='target')place(tool,p);
}
function zoomAt(factor,clientX,clientY){
 const a=st(),svg=$('mapAimSvg'),box=svg.getBoundingClientRect();
 if(!box.width||!box.height)return;
 const oldSize=B/a.zoom;
 const relativeX=clamp((clientX-box.left)/box.width,0,1);
 const relativeY=clamp((clientY-box.top)/box.height,0,1);
 const anchorX=a.cx+(relativeX-.5)*oldSize;
 const anchorY=a.cy+(relativeY-.5)*oldSize;
 const newZoom=clamp(Math.round(a.zoom*factor*100)/100,1,16);
 if(newZoom===a.zoom)return;
 a.zoom=newZoom;
 const size=B/newZoom;
 a.cx=clamp(anchorX-(relativeX-.5)*size,size/2,B-size/2);
 a.cy=clamp(anchorY-(relativeY-.5)*size,size/2,B-size/2);
 render();opPersist();
}
window.mapAimSetTool=tool=>{if(!['gun','target','pan','ref1','ref2'].includes(tool))return; if((tool==='ref1'||tool==='ref2')&&!st().image){status('Сначала загрузите свою карту, для онлайн-карты привязка уже известна.');return;}st().tool=tool;opPersist();render();
 status(({gun:'Кликните по месту расположения орудия.',target:'Кликните по месту расположения цели.',pan:'Зажмите левую кнопку и сдвигайте карту.',ref1:'Отметьте на изображении первую известную точку.',ref2:'Отметьте на изображении вторую известную точку.'})[tool]);
 if(tool==='ref1'||tool==='ref2')$('mapAimSvg')?.scrollIntoView({behavior:'instant',block:'center'});
};
window.mapAimZoom=factor=>{const box=$('mapAimSvg').getBoundingClientRect();zoomAt(factor,box.left+box.width/2,box.top+box.height/2);};
window.mapAimResetView=()=>{const a=st();a.zoom=1;a.cx=400;a.cy=400;opPersist();render();};
window.mapAimChangeWeapon=type=>{if(!['m777','m252','2b14'].includes(type))return;$('weaponType').value=type;updateWeaponUI('weaponType');$('weaponType').dispatchEvent(new Event('change',{bubbles:true}));syncMapWeapons();render();solve();};
window.mapAimChangeTrajectory=value=>{
  if(!['low','high'].includes(value))return;
  if($('weaponType').value!=='m777'){updateMapTrajectory();return;}
  const source=$('trajectory');
  source.value=value;
  source.dispatchEvent(new Event('input',{bubbles:true}));
  source.dispatchEvent(new Event('change',{bubbles:true}));
  updateMapTrajectory();syncMapWeapons();render();
  solve();
};
window.mapAimSetHeight=(which,z)=>{if(!['gun','target'].includes(which))return;terrainFlags()[which]=false;const field=$(which==='gun'?'artZ':'tgtZ');field.value=z;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));terrainUi();opPersist();solve();};
window.mapAimRecalculate=solve;window.mapAimRefresh=()=>{if(!ready)return window.mapAimInit();st();syncAutoTerrain();render();stats();onlineLabel();};
window.mapAimGoOffline=()=>{++onlineRequest;finishTileProbe();offlineReason='';onlineState='offline';const a=st();a.layer='grid';a.mapAutoOffline=false;$('mapAimLayer').value='grid';opPersist();render();onlineLabel();status('GRID-сетка включена. Можно работать без интернета.','mapAimInstruction');};
window.mapAimRetryOnline=()=>{
 if(st().image){status('Сначала удалите загруженное изображение карты.');return;}
 if(isGridOnlyMap(st().mapSlug)){
  status('Для '+selectedMap().name+' нет доступной онлайн-подложки. Воспользуйтесь GRID или своим изображением.');return;
 }
 if(st().layer==='grid'){st().layer='topo';$('mapAimLayer').value='topo';}
 st().mapAutoOffline=false;opPersist();void loadOnlineMap(true);
};
window.mapAimSelectLayer=layer=>{
 if(!['topo','satellite','fogless','grid'].includes(layer))return;
 if(layer==='grid')return window.mapAimGoOffline();
 if(isGridOnlyMap(st().mapSlug)){
  $('mapAimLayer').value='grid';
  status('Онлайн-слой для '+selectedMap().name+' отсутствует. Можно загрузить свою картинку.');return;
 }
 st().layer=layer;st().mapAutoOffline=false;st().preferredOnlineLayer=layer;opPersist();
 onlineState='tiles';tileProbeToken=-1;finishTileProbe();
 if(onlineInfo){render();onlineLabel();}else void loadOnlineMap(true);
};
window.mapAimSaveTarget=()=>{if(!xy('target')){status('Сначала отметьте цель.');return;}solve();if(typeof window.tacSaveCurrentTarget==='function'){window.tacSaveCurrentTarget();status('Цель передана в библиотеку.','mapAimStatus');}};
window.mapAimSaveWeapon=()=>{if(!xy('gun')){status('Сначала отметьте орудие.');return;}solve();if(typeof window.tacSaveCurrentWeapon==='function'){window.tacSaveCurrentWeapon();status('Орудие передано в батарею.','mapAimStatus');}};
window.mapAimClearImage=()=>{st().image='';st().refs=fresh().refs;$('mapAimImage').value='';opPersist();syncAutoTerrain();render();onlineLabel();status('Изображение удалено. GRID продолжает работать.');};
window.mapAimClearCalibration=()=>{st().refs=fresh().refs;for(const [i,r] of st().refs.entries()){$(`mapRef${i+1}X`).value=r.x;$(`mapRef${i+1}Y`).value=r.y;}opPersist();render();stats();status('Стандартная привязка 0…'+S+' м восстановлена.','mapCalibrationStatus');};
window.mapAimLoadImage=async input=>{const file=input.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000){status('Нужен JPG, PNG или WebP до 20 МБ.');input.value='';return;}
 const url=URL.createObjectURL(file);try{const pic=new Image();await new Promise((resolve,reject)=>{pic.onload=resolve;pic.onerror=()=>reject(Error('Невозможно открыть изображение'));pic.src=url;});
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1600;canvas.getContext('2d').drawImage(pic,0,0,1600,1600);
 let data='';for(const quality of [.82,.7,.55,.4]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<1200000)break;}if(data.length>=1200000)throw Error('Файл изображения слишком велик');
 const a=st();a.image=data;a.refs=fresh().refs;for(const [i,r] of a.refs.entries()){$(`mapRef${i+1}X`).value=r.x;$(`mapRef${i+1}Y`).value=r.y;}
 opPersist();terrainUi();render();stats();onlineLabel();status(Math.abs(pic.width/pic.height-1)>.1?'Изображение растянуто до квадрата: необходима проверка калибровки.':'Изображение сохранено локально. Для полного снимка поля совпадают с сеткой.');
 }catch(err){status('Ошибка карты: '+err.message);}finally{URL.revokeObjectURL(url);input.value='';}
};
window.mapAimInit=()=>{if(ready)return;const svg=$('mapAimSvg');if(!svg)return;ready=true;
 svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',up);
 svg.addEventListener('pointercancel',()=>{drag=null;svg.classList.remove('is-moving');});svg.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});svg.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});svg.addEventListener('contextmenu',e=>e.preventDefault());
 svg.addEventListener('wheel',e=>{if(!svg.closest('.tab-content.active'))return;e.preventDefault();zoomAt(e.deltaY<0?1.25:.8,e.clientX,e.clientY);},{passive:false});
 ['input','change'].forEach(ev=>$('coords').addEventListener(ev,event=>{if($('mapaim').classList.contains('active')){if(['artX','artY','tgtX','tgtY'].includes(event.target?.id))syncAutoTerrain();render();stats();}},true));
 st().refs.forEach((r,i)=>{$(`mapRef${i+1}X`).value=r.x;$(`mapRef${i+1}Y`).value=r.y;});$('mapAimLayer').value=st().layer;updateMapMenu();installServerPresets();checkChasovAsset();void discoverMaps();syncMapWeapons();render();stats();terrainUi();void terrainFetch();loadOnlineMap();
};
function ensureMapStarted(){
 try{window.mapAimInit();}catch(error){
  console.error('Не удалось инициализировать карту:',error);
  const label=$('mapAimTileState');if(label)label.textContent='Ошибка запуска карты · GRID-сетка доступна';
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureMapStarted,{once:true});
else queueMicrotask(ensureMapStarted);
window.addEventListener('load',ensureMapStarted,{once:true});
})();
