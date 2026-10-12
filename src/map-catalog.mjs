// Offline fallback atlas based on GeNeFRAG/ArmaReforger maps_core/all_arma_maps.json.
// Enfumap online /api/v1/maps is authoritative for supported slugs and size.
export const FALLBACK_REFORGER_MAPS = [
  {
    "slug": "everon",
    "name": "Everon",
    "worldSize": 12800,
    "heightAvailable": true
  },
  {
    "slug": "arland",
    "name": "Arland",
    "worldSize": 4095,
    "heightAvailable": true
  },
  {
    "slug": "kolguev",
    "name": "Kolguev",
    "worldSize": 12800,
    "heightAvailable": true
  },
  {
    "slug": "anizay",
    "name": "Anizay",
    "worldSize": 10240,
    "heightAvailable": true
  },
  {
    "slug": "badorb",
    "name": "Bad Orb",
    "worldSize": 5120,
    "heightAvailable": false
  },
  {
    "slug": "belleau",
    "name": "Belleau Wood",
    "worldSize": 12032,
    "heightAvailable": false
  },
  {
    "slug": "fallujah",
    "name": "Fallujah",
    "worldSize": 4095,
    "heightAvailable": false
  },
  {
    "slug": "gogland",
    "name": "Gogland",
    "worldSize": 12286,
    "heightAvailable": true
  },
  {
    "slug": "khanh_trung",
    "name": "Khanh Trung",
    "worldSize": 4095,
    "heightAvailable": false
  },
  {
    "slug": "kunar",
    "name": "Kunar",
    "worldSize": 4000,
    "heightAvailable": true
  },
  {
    "slug": "myccano",
    "name": "Myccano",
    "worldSize": 6655,
    "heightAvailable": false
  },
  {
    "slug": "nizla",
    "name": "Nizla Island",
    "worldSize": 17150,
    "heightAvailable": false
  },
  {
    "slug": "novka",
    "name": "Novka",
    "worldSize": 2900,
    "heightAvailable": false
  },
  {
    "slug": "rooikat",
    "name": "Rooikat 89",
    "worldSize": 5120,
    "heightAvailable": false
  },
  {
    "slug": "rostov",
    "name": "Rostov",
    "worldSize": 7935,
    "heightAvailable": false
  },
  {
    "slug": "ruha",
    "name": "Ruha",
    "worldSize": 8150,
    "heightAvailable": false
  },
  {
    "slug": "saigon",
    "name": "Saigon",
    "worldSize": 17150,
    "heightAvailable": true
  },
  {
    "slug": "seitenbuch",
    "name": "Seitenbuch",
    "worldSize": 2000,
    "heightAvailable": false
  },
  {
    "slug": "serhiivka",
    "name": "Serhiivka",
    "worldSize": 10240,
    "heightAvailable": false
  },
  {
    "slug": "takistan",
    "name": "Takistan",
    "worldSize": 12900,
    "heightAvailable": true
  },
  {
    "slug": "udachne",
    "name": "Udachne",
    "worldSize": 5120,
    "heightAvailable": false
  },
  {
    "slug": "zarichne",
    "name": "Zarichne",
    "worldSize": 4095,
    "heightAvailable": true
  },
  {
    "slug": "zimnitrita",
    "name": "Zimnitrita",
    "worldSize": 16384,
    "heightAvailable": true
  }
];
export function normalizeMapListing(payload) {
 const data=payload?.ok===true?payload.data:payload;
 const list=Array.isArray(data)?data:Array.isArray(data?.maps)?data.maps:Array.isArray(data?.items)?data.items:[];
 return list.flatMap(item=>{
  const slug=String(item?.slug||item?.namespace||item?.id||'').trim().toLowerCase();
  const raw=item?.worldSize??item?.size??item?.world_size??item?.width;
  const size=Number(Array.isArray(raw)?raw[0]:raw);
  const name=String(item?.title||item?.name||item?.displayName||slug).trim();
  if(!/^[a-z0-9_-]{2,64}$/.test(slug)||!Number.isFinite(size)||size<1000||size>100000)return [];
  return [{slug,name:name||slug,worldSize:size,author:String(item.author||'').slice(0,100),official:!!item.official}];
 });
}
export function validateMapDimensions(value){
 const size=Number(value);
 if(!Number.isFinite(size)||size<1000||size>100000)throw Error('Некорректные размеры игровой карты');
 return size;
}
