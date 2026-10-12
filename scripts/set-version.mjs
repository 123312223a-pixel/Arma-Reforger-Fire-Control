import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const v=process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v||'')) throw Error('Укажите SemVer: npm run version:set -- 3.6.1');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const rel of ['package.json','src-tauri/tauri.conf.json']) {
 const filename=path.join(root,rel), obj=JSON.parse(fs.readFileSync(filename,'utf8'));
 obj.version=v; fs.writeFileSync(filename,JSON.stringify(obj,null,2)+'\n');
}
const cargoPath=path.join(root,'src-tauri/Cargo.toml');
const cargo=fs.readFileSync(cargoPath,'utf8').replace(/^(\[package\]\s*(?:[^\[]|\[(?!))*)version\s*=\s*"[^"]+"/m,(match,section)=>section+`version = "${v}"`);
if(!cargo.includes(`version = "${v}"`))throw Error('Не удалось обновить Cargo.toml');
fs.writeFileSync(cargoPath,cargo);
const htmlPath=path.join(root,'src/index.html');
const html=fs.readFileSync(htmlPath,'utf8').replace(/<title>Arma Reforger Fire Control [^<]+<\/title>/,'<title>Arma Reforger Fire Control '+v+' — Desktop</title>');
fs.writeFileSync(htmlPath,html);
console.log('Version set:',v,'— run npm run check and add CHANGELOG.md notes.');
