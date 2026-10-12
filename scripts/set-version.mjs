import fs from 'node:fs';
const v=process.argv[2];
if(!/^\d+\.\d+\.\d+$/.test(v||''))throw Error('Use npm run version:set -- 3.6.1');
for(const f of ['package.json','src-tauri/tauri.conf.json']){
 const data=JSON.parse(fs.readFileSync(f,'utf8'));data.version=v;fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n');
}
const f='src-tauri/Cargo.toml';let cargo=fs.readFileSync(f,'utf8');
cargo=cargo.replace(/^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,(_,p)=>p+'"'+v+'"');
fs.writeFileSync(f,cargo);
const h='src/index.html';let html=fs.readFileSync(h,'utf8');
html=html.replace(/<title>Arma Reforger Fire Control [^<]+<\/title>/,'<title>Arma Reforger Fire Control '+v+' — Desktop</title>');
fs.writeFileSync(h,html);
console.log('Version:',v);
