import fs from 'node:fs';

const repo = String(process.env.FIRE_CONTROL_REPOSITORY || process.env.GITHUB_REPOSITORY || '').trim();
let supplied = String(process.env.TAURI_UPDATER_PUBLIC_KEY || '').trim();
if (!supplied && process.env.TAURI_UPDATER_PUBLIC_KEY_FILE) {
  supplied = fs.readFileSync(process.env.TAURI_UPDATER_PUBLIC_KEY_FILE, 'utf8').trim();
}
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('Provide FIRE_CONTROL_REPOSITORY=owner/repository');
if (!supplied) throw Error('TAURI_UPDATER_PUBLIC_KEY is missing');

function validMinisign(raw) {
  const lines = raw.replace(/\r\n/g, '\n').trim().split('\n');
  return lines.length === 2 &&
    lines[0].startsWith('untrusted comment: minisign public key:') &&
    /^[A-Za-z0-9+/=]+$/.test(lines[1]);
}

// Tauri CLI writes .pub as ONE base64-encoded line. Its decoded text is
// a two-line minisign key. Older documentation sometimes shows these
// decoded lines instead, so accept either representation.
let pubkey;
if (!supplied.includes('\n') && /^[A-Za-z0-9+/=]+$/.test(supplied)) {
  const bytes = Buffer.from(supplied, 'base64');
  if (bytes.toString('base64') !== supplied || !validMinisign(bytes.toString('utf8'))) {
    throw Error('Invalid base64-encoded Tauri public key');
  }
  pubkey = supplied;
} else if (validMinisign(supplied)) {
  pubkey = Buffer.from(supplied.replace(/\r\n/g, '\n').trim() + '\n').toString('base64');
} else {
  throw Error('Expected the Tauri .pub value (base64) or two-line minisign key');
}

fs.writeFileSync('src-tauri/tauri.updater.conf.json', JSON.stringify({
  bundle: {createUpdaterArtifacts: true},
  plugins: {updater: {
    pubkey,
    endpoints: ['https://github.com/' + repo + '/releases/latest/download/latest.json'],
    windows: {installMode: 'passive'}
  }}
}, null, 2) + '\n');
fs.writeFileSync('src-tauri/capabilities/updater.json', JSON.stringify({
  '$schema': '../gen/schemas/desktop-schema.json',
  identifier: 'signed-updates',
  description: 'Signed updater commands',
  windows: ['main'],
  permissions: ['updater:default']
}, null, 2) + '\n');
console.log('Signed-updates channel configured for', repo, '(public key validated; key contents not logged).');
