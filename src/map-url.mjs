/** Turn an Enfumap tile template into a usable HTTPS image URL. */
export function formatMapTileUrl(template, z, x, y, base = 'https://enfumap.com') {
  if (typeof template !== 'string' || !['{z}', '{x}', '{y}'].every(t => template.includes(t))) {
    throw new Error('Tile address has no {z}/{x}/{y} placeholders');
  }
  if (![z, x, y].every(n => Number.isInteger(n) && n >= 0)) {
    throw new Error('Invalid tile coordinates');
  }
  // Replace placeholders BEFORE parsing via URL(): otherwise they become %7Bz%7D.
  const expanded = template.replaceAll('{z}', String(z))
    .replaceAll('{x}', String(x)).replaceAll('{y}', String(y));
  const trustedOrigin = new URL(base).origin;
  const url = new URL(expanded, trustedOrigin);
  if (url.protocol !== 'https:' || url.origin !== trustedOrigin) {
    throw new Error('Tile URL must remain on Enfumap over HTTPS');
  }
  return url.href;
}
