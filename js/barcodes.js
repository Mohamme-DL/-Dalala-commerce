/* Dalala Commerce — barcode engine: Code 128 (B/C) and QR Code (ECC level M, byte mode, versions 1–10).
   JavaScript port of the Dlala Commercial engine (DlalaCodes, C#). Output is SVG, so it prints sharp at any size. */
'use strict';

const Code128 = (() => {
  const P = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
  const START_B = 104, START_C = 105, CODE_C = 99, STOP = 106;
  function encode(text) {
    text = String(text || ''); if (!text) throw new Error('empty');
    const values = []; let allDigits = text.length >= 2;
    for (const ch of text) { const c = ch.charCodeAt(0); if (c < 32 || c > 126) throw new Error('ascii'); if (c < 48 || c > 57) allDigits = false; }
    if (allDigits) {
      let pos = 0;
      if (text.length % 2 === 0) values.push(START_C); else { values.push(START_B, text.charCodeAt(0) - 32, CODE_C); pos = 1; }
      for (; pos < text.length; pos += 2) values.push(+text[pos] * 10 + +text[pos + 1]);
    } else { values.push(START_B); for (const ch of text) values.push(ch.charCodeAt(0) - 32); }
    let s = values[0]; for (let i = 1; i < values.length; i++) s += values[i] * i;
    values.push(s % 103, STOP);
    const mods = []; values.forEach(v => { let bar = true; for (const w of P[v]) { for (let m = 0; m < +w; m++) mods.push(bar); bar = !bar; } });
    return mods;
  }
  function svg(text, { height = 50, module = 1 } = {}) {
    const m = encode(text); const q = 10; const w = (m.length + q * 2) * module; let x = q * module, d = '';
    for (let i = 0; i < m.length;) { if (!m[i]) { i++; x += module; continue; } let j = i; while (j < m.length && m[j]) j++; d += `M${x} 0h${(j - i) * module}v${height}h-${(j - i) * module}z`; x += (j - i) * module; i = j; }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="${w}" height="${height}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  return { encode, svg, modules: t => encode(t).length + 20 };
})();

const QrCode = (() => {
  const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5], MAXV = 10;
  const rawMods = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = v => Math.floor(rawMods(v) / 8) - ECC[v] * BLOCKS[v];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
  function rsDiv(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
  function rsRem(data, div) { const r = new Array(div.length).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < r.length; i++) r[i] ^= mul(div[i], f); } return r; }
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function encode(text) {
    const data = [...new TextEncoder().encode(String(text || ''))]; if (!data.length) throw new Error('empty');
    let ver = 0; for (let v = 1; v <= MAXV; v++) { if (4 + (v <= 9 ? 8 : 16) + data.length * 8 <= dataCw(v) * 8) { ver = v; break; } }
    if (!ver) throw new Error('too long');
    const cap = dataCw(ver) * 8; const bits = []; const app = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    app(4, 4); app(data.length, ver <= 9 ? 8 : 16); data.forEach(b => app(b, 8));
    app(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) app(pad, 8);
    const dcw = new Array(bits.length / 8).fill(0); bits.forEach((b, i) => { dcw[i >>> 3] |= b << (7 - (i & 7)); });
    // ECC + interleave
    const nb = BLOCKS[ver], el = ECC[ver], raw = Math.floor(rawMods(ver) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDiv(el);
    const blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const dl = shortLen - el + (i < nShort ? 0 : 1); const dat = dcw.slice(k, k + dl); k += dl; const blk = dat.concat(new Array(shortLen + 1 - dl).fill(0)); const ecc = rsRem(dat, div); for (let j = 0; j < el; j++) blk[blk.length - el + j] = ecc[j]; blocks.push(blk); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < blocks.length; j++) if (i !== shortLen - el || j >= nShort) all.push(blocks[j][i]);
    const size = ver * 4 + 17; const M = [...Array(size)].map(() => new Array(size).fill(false)); const F = [...Array(size)].map(() => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    let align = []; if (ver > 1) { const n = Math.floor(ver / 7) + 2; const step = Math.floor((ver * 4 + n * 2 + 1) / (n * 2 - 2)) * 2; align = new Array(n); align[0] = 6; for (let i = n - 1, pos = size - 7; i >= 1; i--, pos -= step) align[i] = pos; }
    const na = align.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) if (!((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0))) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    const fmt = mask => { const d = mask; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); const b = ((d << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i)); set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i)); set(8, size - 8, true); };
    fmt(0);
    if (ver >= 7) { let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const b = (ver << 12) | rem; for (let i = 0; i < 18; i++) { const bt = bit(b, i), a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bt); set(c, a, bt); } }
    let idx = 0; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!F[y][x] && idx < all.length * 8) { M[y][x] = bit(all[idx >>> 3], 7 - (idx & 7)); idx++; } } }
    const inv = (mask, x, y) => [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x * y) % 2 + (x * y) % 3 === 0, ((x * y) % 2 + (x * y) % 3) % 2 === 0, ((x + y) % 2 + (x * y) % 3) % 2 === 0][mask];
    const applyMask = mask => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && inv(mask, x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => { let r = 0;
      for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (M[y][x] === M[y][x - 1]) { run++; if (run === 5) r += 3; else if (run > 5) r++; } else run = 1; } }
      for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (M[y][x] === M[y - 1][x]) { run++; if (run === 5) r += 3; else if (run > 5) r++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) r += 3;
      let dark = 0; M.forEach(row => row.forEach(c => { if (c) dark++; })); const tot = size * size; r += (Math.floor((Math.abs(dark * 20 - tot * 10) + tot - 1) / tot) - 1) * 10; return r; };
    let best = 0, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) { applyMask(mask); fmt(mask); const p = penalty(); if (p < bestP) { bestP = p; best = mask; } applyMask(mask); }
    applyMask(best); fmt(best);
    return M;
  }
  function svg(text) {
    const M = encode(text); const n = M.length, q = 4, s = n + q * 2; let d = '';
    M.forEach((row, y) => row.forEach((c, x) => { if (c) d += `M${x + q} ${y + q}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  return { encode, svg, maxBytes: 213 };
})();
