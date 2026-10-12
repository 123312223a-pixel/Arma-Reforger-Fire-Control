import fs from 'node:fs';
const repo=String(process.env.FIRE_CONTROL_REPOSITORY||process.env.GITHUB_REPOSITORY||'').trim();
let key=String(process.env.TAURI_UPDATER_PUBLIC_KEY||'').trim();
if(!key && process.env.TAURI_UPDATER_PUBLIC_KEY_FILE) key=fs.readFileSync(process.env.TAURI_UPDATER_PUBLIC_KEY_FILE,'utf8').trim();
if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('Provide FIRE_CONTROL_REPOSITORY=owner/repository');
const lines=key.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
if(lines.length!==2||!lines[0].startsWith('untrusted comment: minisign public key:')||!/^[A-Za-z0-9+/=]+$/.test(lines[1]))throw Error('Provide an authentic Tauri minisign public key file (2 lines)');
const pubkey=key;
fs.writeFileSync('src-tauri/tauri.updater.conf.json',JSON.stringify({
 bundle:{createUpdaterArtifacts:true},plugins:{updater:{
  pubkey,
  endpoints:['https://github.com/'+repo+'/releases/latest/download/latest.json'],
  windows:{installMode:'passive'}
 }}},null,2)+'\n');
fs.writeFileSync('src-tauri/capabilities/updater.json',JSON.stringify({
 '$schema':'../gen/schemas/desktop-schema.json',
 identifier:'signed-updates',description:'Signed updater commands',windows:['main'],permissions:['updater:default']
},null,2)+'\n');
console.log('Signed-updates channel configured for',repo);
