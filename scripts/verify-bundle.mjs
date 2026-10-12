import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('dist');
const files=[];
function visit(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) visit(file);
    else files.push(file);
  }
}
assert.ok(fs.existsSync(root),'Vite dist folder is missing');
visit(root);
const jsFiles=files.filter(file=>file.endsWith('.js'));
assert.ok(jsFiles.length>0,'No compiled Javascript emitted');
const js=jsFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
assert.ok(js.includes('mapAimInit')&&js.includes('mapAimSetTool')&&js.includes('mapAimSelectLayer'),
 'Compiled Windows frontend is missing interactive map logic! Check module script in src/index.html');
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert.ok(!html.includes('<script src="./map-mode.js"></script>'),
 'An unbundled classic map-mode.js script survived the Vite build');
console.log('OK: interactive map module is present in compiled assets ('+jsFiles.length+' JS files)');
