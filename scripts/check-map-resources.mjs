import assert from 'node:assert/strict';
import {MAP_RESOURCES} from '../src/map-resources.mjs';
import {FALLBACK_REFORGER_MAPS} from '../src/map-catalog.mjs';
const httpsOrigin='https://pub-65310bd5bcd44d68b30addfbacb31e51.r2.dev/';
const names=FALLBACK_REFORGER_MAPS.map(m=>m.slug);
assert.equal(names.length,23,'Expected 23 catalogue maps');
assert.deepEqual(Object.keys(MAP_RESOURCES).sort(),[...names].sort(),'Manifest/catalogue mismatch');
const heights=Object.entries(MAP_RESOURCES).filter(([,r])=>r.height);
assert.equal(heights.length,10,'Expected 10 height datasets');
for(const [slug,r] of Object.entries(MAP_RESOURCES)){
 for(const [kind,url] of Object.entries(r)){
  if(!url)continue;
  assert.ok(url.startsWith(httpsOrigin),slug+': unexpected '+kind+' origin');
  assert.equal(new URL(url).protocol,'https:');
  assert.ok(url.endsWith(kind==='image'?'.png':'.json'),slug+': invalid extension');
 }
 assert.ok(r.image,slug+': missing image');
}
console.log('Resource manifest OK: 23 PNG, 10 height datasets');
if(!process.argv.includes('--network'))process.exit(0);
let bad=0;
for(const [slug,r] of Object.entries(MAP_RESOURCES)){
 for(const [kind,url] of Object.entries(r)){
  if(!url)continue;
  let controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(url,{method:'GET',headers:{Range:'bytes=0-1023'},signal:controller.signal});
   const mime=response.headers.get('content-type')||'';
   const reader=response.body?.getReader();
   const part=reader?await reader.read():{value:new Uint8Array()};
   const body=part.value||new Uint8Array();
   await reader?.cancel();
   const png=body.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>body[i]===n);
   const json=body.length>=1&&(body[0]===91||body[0]===123);
   const pass=response.ok&&(kind==='image'?png:json);
   console.log((pass?'OK':'FAIL')+' '+slug+' '+kind+' HTTP '+response.status+' '+mime+' '+body.length+' bytes');
   if(!pass)bad++;
  }catch(e){bad++;console.log('FAIL '+slug+' '+kind+' '+e.message);}
  finally{clearTimeout(timeout);}
 }
}
if(bad)process.exitCode=1;
