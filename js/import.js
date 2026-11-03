/* Dalala Commerce — import data from a previous system (2.4).
   Readers (no external libraries): Excel xlsx/xlsm, ODS, CSV/TSV/TXT, JSON, HTML tables, XML and
   Excel-XML (SpreadsheetML), dBase DBF, SQLite databases. Every reader returns tables:
   [{ name, headers: [..], rows: [[..]], total }]. */
'use strict';

const IMP_MAX_ROWS = 30000;
const IMP = (() => {
  const dec = (bytes, enc = 'utf-8') => new TextDecoder(enc).decode(bytes);
  const clean = v => (v == null ? '' : String(v)).replace(/\u0000/g, '').trim();

  /* ---------- ZIP (xlsx, ods) ---------- */
  async function unzip(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let e = bytes.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error(t('impBadZip'));
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec(bytes.subarray(p + 46, p + 46 + nl)); files[name] = { method, csize, off }; p += 46 + nl + xl + cl;
    }
    const read = async name => {
      const f = files[name]; if (!f) return null;
      const lnl = dv.getUint16(f.off + 26, true), lxl = dv.getUint16(f.off + 28, true); const start = f.off + 30 + lnl + lxl; const raw = bytes.subarray(start, start + f.csize);
      if (f.method === 0) return raw;
      if (f.method !== 8) throw new Error(t('impBadZip'));
      const out = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer(); return new Uint8Array(out);
    };
    return { files, read, text: async name => { const b = await read(name); return b ? dec(b) : null; } };
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const kids = (el, name) => [...el.children].filter(c => c.localName === name);
  const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

  async function xlsx(bytes) {
    const z = await unzip(bytes); const wb = await z.text('xl/workbook.xml'); if (!wb) throw new Error(t('impBadXlsx'));
    const rels = xml(await z.text('xl/_rels/workbook.xml.rels') || '<r/>'); const relMap = {}; [...rels.getElementsByTagName('*')].filter(e => e.localName === 'Relationship').forEach(r => { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const ss = []; const sst = await z.text('xl/sharedStrings.xml');
    if (sst) [...xml(sst).getElementsByTagName('*')].filter(e => e.localName === 'si').forEach(si => ss.push([...si.getElementsByTagName('*')].filter(e => e.localName === 't').map(x => x.textContent).join('')));
    const out = [];
    for (const sh of [...xml(wb).getElementsByTagName('*')].filter(e => e.localName === 'sheet')) {
      const rid = sh.getAttribute('r:id') || [...sh.attributes].find(a => a.localName === 'id')?.value; let target = relMap[rid] || ''; target = target.replace(/^\/?xl\//, ''); const path = 'xl/' + target.replace(/^\//, '');
      const doc = await z.text(path); if (!doc) continue; const rows = [];
      [...xml(doc).getElementsByTagName('*')].filter(e => e.localName === 'row').forEach(row => {
        const r = []; kids(row, 'c').forEach((c, k) => {
          const ix = c.hasAttribute('r') ? colIndex(c.getAttribute('r')) : k; const ty = c.getAttribute('t'); const v = kids(c, 'v')[0]?.textContent ?? '';
          let val = v; if (ty === 's') val = ss[+v] ?? ''; else if (ty === 'inlineStr') val = [...c.getElementsByTagName('*')].filter(e => e.localName === 't').map(x => x.textContent).join(''); else if (ty === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
          r[ix] = val;
        });
        rows.push(Array.from(r, x => clean(x)));
      });
      out.push({ name: sh.getAttribute('name') || 'Sheet', rows });
    }
    return out;
  }
  async function ods(bytes) {
    const z = await unzip(bytes); const c = await z.text('content.xml'); if (!c) throw new Error(t('impBadXlsx')); const d = xml(c); const out = [];
    [...d.getElementsByTagName('*')].filter(e => e.localName === 'table').forEach(tb => {
      const rows = [];
      [...tb.getElementsByTagName('*')].filter(e => e.localName === 'table-row').forEach(tr => {
        const rep = Math.min(+(tr.getAttribute('table:number-rows-repeated') || 1), 50); const r = [];
        kids(tr, 'table-cell').concat(kids(tr, 'covered-table-cell')).forEach(cell => {
          const n = Math.min(+(cell.getAttribute('table:number-columns-repeated') || 1), 200); const v = cell.getAttribute('office:date-value') || cell.getAttribute('office:value') || [...cell.getElementsByTagName('*')].filter(e => e.localName === 'p').map(x => x.textContent).join('\n');
          for (let i = 0; i < n; i++) r.push(clean(v));
        });
        for (let i = 0; i < rep; i++) rows.push(r.slice());
      });
      out.push({ name: tb.getAttribute('table:name') || 'Sheet', rows });
    });
    return out;
  }

  /* ---------- CSV ---------- */
  function csv(text) {
    const lines = text.split(/\r?\n/).slice(0, 10).join('\n'); const cands = [',', ';', '\t', '|'];
    const delim = cands.map(d => [d, lines.split('\n').map(l => l.split(d).length - 1)]).filter(([, c]) => c[0] > 0).sort((a, b) => (Math.min(...b[1]) - Math.min(...a[1])) || (b[1][0] - a[1][0]))[0]?.[0] || ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"' && cur === '') { q = true; continue; }
      if (ch === delim) { row.push(cur); cur = ''; continue; }
      if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row.map(clean)); row = []; cur = ''; if (rows.length > IMP_MAX_ROWS + 50) break; continue; }
      cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row.map(clean)); }
    return [{ name: t('impData'), rows }];
  }

  /* ---------- JSON ---------- */
  function json(text) {
    let o; try { o = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new Error(t('impBadJson')); }
    const out = [];
    const fromArray = (name, arr) => {
      if (!Array.isArray(arr) || !arr.length) return;
      if (Array.isArray(arr[0])) { out.push({ name, rows: arr.map(r => r.map(clean)) }); return; }
      if (typeof arr[0] !== 'object' || arr[0] === null) return;
      const heads = []; arr.slice(0, 500).forEach(r => Object.keys(r || {}).forEach(k => { if (!heads.includes(k)) heads.push(k); }));
      out.push({ name, rows: [heads, ...arr.map(r => heads.map(h => { const v = r ? r[h] : ''; return clean(v && typeof v === 'object' ? JSON.stringify(v) : v); }))] });
    };
    if (Array.isArray(o)) fromArray(t('impData'), o); else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => fromArray(k, v));
    return out;
  }
  /* ---------- HTML / XML ---------- */
  function html(text) {
    const d = new DOMParser().parseFromString(text, 'text/html');
    return [...d.querySelectorAll('table')].map((tb, i) => ({ name: (tb.querySelector('caption')?.textContent || '').trim() || `${t('impTable')} ${i + 1}`, rows: [...tb.querySelectorAll('tr')].map(tr => [...tr.children].filter(c => /^(TD|TH)$/.test(c.tagName)).map(c => clean(c.textContent))) }));
  }
  function xmlTables(text) {
    const d = xml(text); if (d.getElementsByTagName('parsererror').length) throw new Error(t('impBadXml'));
    const ws = [...d.getElementsByTagName('*')].filter(e => e.localName === 'Worksheet');
    if (ws.length) return ws.map(w => ({ name: w.getAttribute('ss:Name') || [...w.attributes].find(a => a.localName === 'Name')?.value || 'Sheet',
      rows: [...w.getElementsByTagName('*')].filter(e => e.localName === 'Row').map(r => { const out = []; kids(r, 'Cell').forEach(c => { const ix = c.getAttribute('ss:Index'); if (ix) while (out.length < +ix - 1) out.push(''); out.push(clean(c.textContent)); }); return out; }) }));
    // generic XML: the element that repeats most, with simple children, is a row
    const counts = {}; [...d.getElementsByTagName('*')].forEach(e => { if (e.children.length && [...e.children].every(c => !c.children.length)) counts[e.localName] = (counts[e.localName] || 0) + 1; });
    const tag = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]; if (!tag) return [];
    const recs = [...d.getElementsByTagName('*')].filter(e => e.localName === tag); const heads = [];
    recs.slice(0, 300).forEach(r => { [...r.attributes].forEach(a => { if (!heads.includes(a.name)) heads.push(a.name); }); [...r.children].forEach(c => { if (!heads.includes(c.localName)) heads.push(c.localName); }); });
    return [{ name: tag, rows: [heads, ...recs.map(r => heads.map(h => clean(r.getAttribute(h) ?? [...r.children].find(c => c.localName === h)?.textContent ?? '')))] }];
  }
  /* ---------- dBase DBF ---------- */
  function dbf(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true);
    const fields = []; for (let p = 32; p + 32 <= hl && bytes[p] !== 0x0D; p += 32) fields.push({ name: dec(bytes.subarray(p, p + 11)).replace(/\0.*$/, '').trim(), len: bytes[p + 16] });
    const encOk = (() => { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(hl, Math.min(bytes.length, hl + rl * 50))); return 'utf-8'; } catch (e) { return 'windows-1256'; } })();
    const rows = [fields.map(f => f.name)];
    for (let i = 0; i < n && i < IMP_MAX_ROWS; i++) { const o = hl + i * rl; if (o + rl > bytes.length) break; if (bytes[o] === 0x2A) continue; let p = o + 1; rows.push(fields.map(f => { const v = clean(dec(bytes.subarray(p, p + f.len), encOk)); p += f.len; return v; })); }
    return [{ name: 'DBF', rows }];
  }
  /* ---------- SQLite (read-only table b-tree reader) ---------- */
  function sqlite(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let ps = dv.getUint16(16); if (ps === 1) ps = 65536; const U = ps - bytes[20]; const encNo = dv.getUint32(56); const tenc = encNo === 2 ? 'utf-16le' : encNo === 3 ? 'utf-16be' : 'utf-8';
    const varint = p => { let v = 0; for (let i = 0; i < 9; i++) { const b = bytes[p + i]; if (i === 8) return [v * 256 + b, p + 9]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return [v, p + i + 1]; } return [v, p + 9]; };
    const pageOff = n => (n - 1) * ps;
    const payload = (p, P) => { // returns the full payload bytes (follows overflow pages)
      const X = U - 35; if (P <= X) return bytes.subarray(p, p + P);
      const M = Math.floor((U - 12) * 32 / 255) - 23; const K = M + ((P - M) % (U - 4)); const local = K <= X ? K : M;
      const out = new Uint8Array(P); out.set(bytes.subarray(p, p + local)); let got = local; let next = dv.getUint32(p + local);
      while (next && got < P) { const o = pageOff(next); const take = Math.min(U - 4, P - got); out.set(bytes.subarray(o + 4, o + 4 + take), got); got += take; next = dv.getUint32(o); }
      return out;
    };
    const record = buf => {
      const bv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); const vi = q => { let v = 0; for (let i = 0; i < 9; i++) { const b = buf[q + i]; if (i === 8) return [v * 256 + b, q + 9]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return [v, q + i + 1]; } return [v, q + 9]; };
      let [hs, q] = vi(0); const types = []; while (q < hs) { const [st, nq] = vi(q); types.push(st); q = nq; }
      let d = hs; const vals = [];
      for (const st of types) {
        let v = null;
        if (st === 0) v = null; else if (st === 1) { v = bv.getInt8(d); d += 1; } else if (st === 2) { v = bv.getInt16(d); d += 2; } else if (st === 3) { v = (bv.getInt8(d) << 16) | (buf[d + 1] << 8) | buf[d + 2]; d += 3; }
        else if (st === 4) { v = bv.getInt32(d); d += 4; } else if (st === 5) { v = bv.getInt16(d) * 4294967296 + bv.getUint32(d + 2); d += 6; } else if (st === 6) { v = Number(bv.getBigInt64(d)); d += 8; } else if (st === 7) { v = bv.getFloat64(d); d += 8; }
        else if (st === 8) v = 0; else if (st === 9) v = 1;
        else if (st >= 12) { const len = Math.floor((st - (st % 2 ? 13 : 12)) / 2); v = st % 2 ? new TextDecoder(tenc).decode(buf.subarray(d, d + len)) : `[${len} bytes]`; d += len; }
        vals.push(v);
      }
      return vals;
    };
    const walk = (page, cb, depth = 0) => {
      if (depth > 40 || !page) return; const base = pageOff(page); const h = page === 1 ? base + 100 : base; const type = bytes[h]; const cells = dv.getUint16(h + 3);
      const ptrs = h + (type === 0x05 ? 12 : 8);
      for (let i = 0; i < cells; i++) {
        const c = base + dv.getUint16(ptrs + i * 2);
        if (type === 0x05) walk(dv.getUint32(c), cb, depth + 1);
        else if (type === 0x0D) { const [P, p1] = varint(c); const [rowid, p2] = varint(p1); cb(rowid, record(payload(p2, P))); }
      }
      if (type === 0x05) walk(dv.getUint32(h + 8), cb, depth + 1);
    };
    const master = []; walk(1, (rid, v) => master.push(v));
    const out = [];
    for (const [type, name, , root, sql] of master) {
      if (type !== 'table' || /^sqlite_/.test(name) || !root || /WITHOUT\s+ROWID/i.test(sql || '')) continue;
      const body = String(sql || '').replace(/^[^(]*\(/, '').replace(/\)[^)]*$/, ''); const parts = []; let depth = 0, cur = '';
      for (const ch of body) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur);
      const cols = parts.map(s => s.trim()).filter(s => s && !/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)\b/i.test(s)).map(s => ({ name: s.split(/\s+/)[0].replace(/^["`[]|["`\]]$/g, ''), ipk: /\bINTEGER\s+PRIMARY\s+KEY\b/i.test(s) }));
      const rows = [cols.map(c => c.name)];
      try { walk(root, (rid, v) => { if (rows.length > IMP_MAX_ROWS) return; rows.push(cols.map((c, i) => clean(c.ipk && v[i] == null ? rid : v[i]))); }); } catch (e) { /* damaged table */ }
      out.push({ name, rows });
    }
    return out;
  }

  /* ---------- read any file ---------- */
  async function read(file) {
    const bytes = new Uint8Array(await file.arrayBuffer()); if (bytes.length < 4) throw new Error(t('impEmpty'));
    const ext = (file.name.split('.').pop() || '').toLowerCase(); let tables = [], format = ext.toUpperCase();
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4B, ole = bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11;
    const isSqlite = dec(bytes.subarray(0, 15)) === 'SQLite format 3';
    if (isSqlite) { tables = sqlite(bytes); format = 'SQLite'; }
    else if (ole || ['xls', 'mdb', 'accdb'].includes(ext)) throw new Error(t('impOldFormat'));
    else if (zip && ext === 'ods') { tables = await ods(bytes); format = 'ODS'; }
    else if (zip) { tables = await xlsx(bytes); format = 'Excel'; }
    else if (ext === 'dbf' || [0x02, 0x03, 0x30, 0x83, 0x8B, 0xF5].includes(bytes[0]) && ext === 'dbf') { tables = dbf(bytes); format = 'DBF'; }
    else {
      let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { text = dec(bytes, 'windows-1256'); }
      const tr = text.replace(/^﻿/, '').trimStart();
      if (ext === 'json' || tr.startsWith('{') || tr.startsWith('[')) { tables = json(text); format = 'JSON'; }
      else if (/^<\?xml/i.test(tr) || ext === 'xml') { tables = /urn:schemas-microsoft-com:office:spreadsheet/.test(tr) ? xmlTables(text) : xmlTables(text); format = 'XML'; }
      else if (/^(<!doctype html|<html|<table|<meta|<head|<body)/i.test(tr) || ['htm', 'html'].includes(ext)) { tables = html(text); format = 'HTML'; }
      else { tables = csv(text.replace(/^﻿/, '')); format = 'CSV'; }
    }
    // first non-empty row = headers
    const res = tables.map(tb => {
      const rows = tb.rows.filter(r => r && r.some(v => v !== '' && v != null)); if (!rows.length) return null;
      const width = Math.max(1, ...rows.slice(0, 500).map(r => { let n = r.length; while (n > 0 && (r[n - 1] === '' || r[n - 1] == null)) n--; return n; })); /* ignore empty trailing columns */ const heads = Array.from({ length: width }, (_, i) => clean(rows[0][i]) || `${t('impColumn')} ${i + 1}`);
      const data = rows.slice(1).map(r => Array.from({ length: width }, (_, i) => clean(r[i])));
      return { name: tb.name, headers: heads, rows: data.slice(0, IMP_MAX_ROWS), total: data.length, truncated: data.length > IMP_MAX_ROWS };
    }).filter(Boolean);
    if (!res.length) throw new Error(t('impNoTables'));
    return { format, tables: res };
  }
  return { read, csv, json, xlsx, dbf, sqlite };
})();

/* ================= fields & automatic column matching ================= */
const IMPF = {
  products: { fields: [
    ['name', 1, 'اسم الصنف|الصنف|اسم المنتج|المنتج|اسم المادة|المادة|البيان|الوصف|الاسم|name|item name|itemname|product name|product|item|title|description'],
    ['sku', 0, 'الكود|كود الصنف|رمز الصنف|رقم الصنف|رقم المادة|الرمز|كود|sku|code|item code|itemcode|item no|itemno|product code|id'],
    ['barcode', 0, 'الباركود|باركود|barcode|bar code|ean|upc|gtin'],
    ['category', 0, 'الفئة|التصنيف|المجموعة|القسم|النوع|category|group|department|class|type'],
    ['unit', 0, 'الوحدة|unit|uom'],
    ['cost_price', 0, 'سعر الشراء|سعر التكلفة|التكلفة|سعر الجملة|الشراء|cost|purchase price|buy price|cost price|wholesale|buying price'],
    ['sale_price', 0, 'سعر البيع|السعر|سعر المفرق|البيع|price|sale price|selling price|sell price|retail|unit price'],
    ['stock', 0, 'الكمية|الرصيد|المخزون|الكميه|الرصيد الحالي|الموجود|quantity|qty|stock|balance|on hand|onhand'],
    ['min_stock', 0, 'حد الطلب|حد التنبيه|الحد الادنى|min|minimum|reorder|min stock'],
    ['expiry_date', 0, 'تاريخ الانتهاء|تاريخ الصلاحية|الصلاحية|انتهاء|expiry|expire|expiration|exp date|exp']] },
  customers: { fields: [
    ['name', 1, 'اسم العميل|العميل|الاسم|اسم الحساب|الحساب|اسم|name|customer|client|customer name'],
    ['phone', 0, 'الهاتف|رقم الهاتف|الجوال|موبايل|تلفون|phone|mobile|tel|cell'],
    ['address', 0, 'العنوان|المدينة|address|location'],
    ['notes', 0, 'ملاحظات|ملاحظة|notes|note|remarks'],
    ['balance', 0, 'الرصيد|المديونية|الدين|المستحق|الرصيد الحالي|الباقي|مدين|balance|debt|due|outstanding|amount']] },
  suppliers: { fields: [
    ['name', 1, 'اسم المورد|المورد|الاسم|اسم الحساب|الحساب|اسم|name|supplier|vendor|supplier name'],
    ['phone', 0, 'الهاتف|رقم الهاتف|الجوال|موبايل|تلفون|phone|mobile|tel|cell'],
    ['address', 0, 'العنوان|المدينة|address|location'],
    ['notes', 0, 'ملاحظات|ملاحظة|notes|note|remarks'],
    ['balance', 0, 'الرصيد|المديونية|الدين|المستحق|الرصيد الحالي|الباقي|دائن|balance|debt|due|outstanding|amount']] },
  sales: { fields: [
    ['invoice_no', 1, 'رقم الفاتورة|الفاتورة|رقم السند|رقم المستند|رقم|invoice|invoice no|invoice number|inv no|bill no|receipt|number'],
    ['date', 0, 'تاريخ الفاتورة|التاريخ|تاريخ|date|invoice date|bill date'],
    ['customer', 0, 'اسم العميل|العميل|الزبون|customer|client|customer name'],
    ['product', 0, 'اسم الصنف|الصنف|اسم المنتج|المنتج|اسم المادة|المادة|البيان|item|item name|product|product name|description'],
    ['sku', 0, 'كود الصنف|الكود|رقم الصنف|رقم المادة|sku|item code|code'],
    ['barcode', 0, 'الباركود|باركود|barcode'],
    ['qty', 0, 'الكمية|الكميه|العدد|quantity|qty'],
    ['unit_price', 0, 'سعر البيع|السعر|سعر الوحدة|سعر المفرق|price|unit price|sale price|selling price'],
    ['unit_cost', 0, 'تكلفة الوحدة|سعر الشراء|سعر التكلفة|التكلفة|cost|unit cost|cost price|purchase price'],
    ['line_total', 0, 'إجمالي السطر|اجمالي السطر|المجموع|الاجمالي|الإجمالي|line total|amount|total price|subtotal'],
    ['discount', 0, 'الخصم|خصم|discount'],
    ['total', 0, 'إجمالي الفاتورة|اجمالي الفاتورة|صافي الفاتورة|قيمة الفاتورة|invoice total|net total|grand total|total'],
    ['profit', 0, 'الربح|ربح|صافي الربح|profit|margin']] },
  purchases: { fields: [
    ['invoice_no', 1, 'رقم الفاتورة|الفاتورة|رقم السند|رقم المستند|رقم|invoice|invoice no|invoice number|bill no|number'],
    ['date', 0, 'تاريخ الفاتورة|التاريخ|تاريخ|date|invoice date|bill date'],
    ['supplier', 0, 'اسم المورد|المورد|supplier|vendor|supplier name'],
    ['product', 0, 'اسم الصنف|الصنف|اسم المنتج|المنتج|اسم المادة|المادة|البيان|item|item name|product|product name|description'],
    ['sku', 0, 'كود الصنف|الكود|رقم الصنف|رقم المادة|sku|item code|code'],
    ['barcode', 0, 'الباركود|باركود|barcode'],
    ['qty', 0, 'الكمية|الكميه|العدد|quantity|qty'],
    ['unit_cost', 0, 'سعر الشراء|سعر الوحدة|التكلفة|السعر|cost|unit cost|price|unit price|purchase price'],
    ['line_total', 0, 'إجمالي السطر|اجمالي السطر|المجموع|الاجمالي|الإجمالي|line total|amount|total price|subtotal'],
    ['total', 0, 'إجمالي الفاتورة|اجمالي الفاتورة|قيمة الفاتورة|invoice total|net total|grand total|total']] },
};
const IMP_SAMPLE = { name: 'سكر ناعم 1 كجم', sku: '1001', barcode: '6221001', category: 'مواد غذائية', unit: 'كيس', cost_price: '2.500', sale_price: '3.250', stock: '40', min_stock: '5', expiry_date: '2027-05-01', phone: '0912345678', address: 'طرابلس', notes: '', balance: '150.500', invoice_no: '1001', date: '2026-03-05', customer: 'أحمد علي', supplier: 'شركة النور', product: 'سكر ناعم 1 كجم', qty: '2', unit_price: '3.250', unit_cost: '2.500', line_total: '6.500', discount: '0', total: '', profit: '' };
const impNorm = s => String(s == null ? '' : s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\s_\-./()]+/g, '');
function impAutoMap(kind, headers) {
  const F = IMPF[kind].fields, map = {}, used = {}, H = headers.map(impNorm);
  [0, 1].forEach(pass => F.forEach(f => {
    if (map[f[0]] != null) return; const syn = f[2].split('|').map(impNorm);
    for (let i = 0; i < H.length; i++) { if (used[i]) continue; const ok = pass === 0 ? syn.includes(H[i]) : syn.some(s => s.length >= 4 && H[i].includes(s)); if (ok) { map[f[0]] = i; used[i] = 1; break; } }
  }));
  return map;
}
/* values: Arabic-Indic digits, thousands separators, Excel serial dates, d/m/y dates */
function impNum(v) {
  if (v == null) return null; let s = String(v).trim(); if (!s) return null;
  s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/٬/g, ',');
  let neg = /^\(.*\)$/.test(s) || /-$/.test(s); s = s.replace(/[^\d.,-]/g, ''); if (s.startsWith('-')) neg = true; s = s.replace(/-/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.'); // 1,250,000 → thousands · 28,500 or 12,5 → decimal comma (as written in Libya)
  if (!s || isNaN(+s)) return NaN; return neg ? -s : +s;
}
function impDate(v) {
  const s = String(v || '').trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); if (!s) return '';
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return iso(new Date(+m[1], +m[2] - 1, +m[3]));
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s))) { let d = +m[1], mo = +m[2]; if (mo > 12 && d <= 12) [d, mo] = [mo, d]; return iso(new Date(+m[3], mo - 1, d)); }
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5); return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  const d = new Date(s); return isNaN(d) ? '' : iso(d);
}
const IMP_UNITS = { piece: 'قطعة|حبة|حبه|عدد|pcs|pc|piece|unit|ea', box: 'علبة|علبه|box', carton: 'كرتون|كرتونة|كرتونه|carton|ctn', pack: 'باكيت|باكو|ربطة|pack|pkt', bag: 'كيس|شوال|bag|sack', bottle: 'زجاجة|زجاجه|قارورة|قنينة|bottle', can: 'علبة معدنية|كانز|can|tin', jar: 'برطمان|مرطبان|jar', set: 'طقم|set', kg: 'كجم|كغ|كيلو|كيلوجرام|كيلوغرام|kg|kilo', liter: 'لتر|ليتر|l|liter|litre', meter: 'متر|m|meter|metre', dozen: 'درزن|دزينة|dozen|dz', service: 'خدمة|service' };
function impUnit(v) { const n = impNorm(v); if (!n) return 'piece'; for (const [k, s] of Object.entries(IMP_UNITS)) if (s.split('|').map(impNorm).includes(n)) return k; return null; }
