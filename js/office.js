/* Dalala Commerce — Excel (.xlsx) and Word (.docx) export without external libraries.
   Both formats are ZIP packages of XML files; files are stored uncompressed (valid ZIP, opens in
   Excel / Word / LibreOffice / Google Docs). Arabic is written right-to-left. */
'use strict';

const OFFICE = (() => {
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) { // files: [{ name, data: string }]
    const parts = [], central = []; let offset = 0;
    const d = new Date(); const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const isNum = v => typeof v === 'number' && isFinite(v);
  const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const rtl = () => LANG === 'ar';
  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

  /* sheets: [{ name, title?, headers: [...], rows: [[...]], totals?: [...] }] */
  function xlsx(fileName, sheets) {
    sheets = sheets.filter(Boolean); if (!sheets.length) return;
    const sheetXml = sh => {
      const cols = Math.max(sh.headers.length, ...sh.rows.map(r => r.length), 1); const last = colName(cols - 1);
      const widths = Array.from({ length: cols }, (_, i) => Math.min(55, Math.max(9, ...[sh.headers[i], ...sh.rows.slice(0, 500).map(r => r[i])].map(v => Math.ceil(String(v ?? '').length * 1.15) + 3))));
      let r = 0; const rowsXml = [], merges = [];
      // styles: 0 text · 1 header · 2 number · 3 total number · 4 business name · 5 zebra text · 6 zebra number · 7 subtitle · 8 total text · 9 report title
      const row = (vals, text, num, ht) => { r++; rowsXml.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${vals.map((v, i) => { const ref = colName(i) + r; return isNum(v) ? `<c r="${ref}" s="${num}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr" s="${text}"><is><t xml:space="preserve">${x(v)}</t></is></c>`; }).join('')}</row>`); };
      const banner = (v, st, ht) => { row([v, ...Array(cols - 1).fill('')], st, st, ht); if (cols > 1) merges.push(`A${r}:${last}${r}`); };
      banner(loc(S(), 'businessName'), 4, 28);
      banner(sh.title || sh.name || '', 9, 22);
      banner(`${fmtDate(today())} · ${sh.rows.length} ${LANG === 'ar' ? 'سجل' : 'rows'}${sh.sub ? ' · ' + sh.sub : ''}`, 7, 18);
      r++; // empty spacer row
      row(sh.headers, 1, 1, 26); const headRow = r;
      sh.rows.forEach((v, k) => (k % 2 ? row(v, 5, 6) : row(v, 0, 2)));
      if (sh.totals) row(sh.totals, 8, 3, 22);
      const land = cols > 6;
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0" ${rtl() ? 'rightToLeft="1"' : ''}><pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18" customHeight="1"/>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml.join('')}</sheetData>
${sh.rows.length ? `<autoFilter ref="A${headRow}:${last}${headRow + sh.rows.length}"/>` : ''}${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.2" footer="0.3"/>
<pageSetup paperSize="9" orientation="${land ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
    };
    const safe = (n, i) => (String(n || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet' + (i + 1));
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${x(safe(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: (() => {
        const ac = 'FF' + String(S().accent || '#059669').replace('#', '').toUpperCase().slice(0, 6); const dec = Math.max(0, Math.min(3, +(S().decimals ?? 3)));
        const fmt = dec ? '#,##0.' + '0'.repeat(dec) : '#,##0';
        const bd = c => `<border><left style="thin"><color rgb="${c}"/></left><right style="thin"><color rgb="${c}"/></right><top style="thin"><color rgb="${c}"/></top><bottom style="thin"><color rgb="${c}"/></bottom><diagonal/></border>`;
        const xf = (num, font, fill, border, h, extra = '') => `<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="${border}" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="center" ${extra}/></xf>`;
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="${fmt}"/></numFmts>
<fonts count="6"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="17"/><color rgb="${ac}"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="13"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="${ac}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F7F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3F1EC"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>${bd('FFDDE3E8')}${bd(ac)}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">${xf(0, 0, 0, 1, 'general')}${xf(0, 1, 2, 2, 'center', 'wrapText="1"')}${xf(164, 0, 0, 1, 'center')}${xf(164, 2, 4, 2, 'center')}${xf(0, 3, 0, 0, 'center')}${xf(0, 0, 3, 1, 'general')}${xf(164, 0, 3, 1, 'center')}${xf(0, 4, 0, 0, 'center')}${xf(0, 2, 4, 2, 'general')}${xf(0, 5, 0, 0, 'center')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
      })() },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
    ];
    save(zip(files), `${fileName}-${today()}.xlsx`);
  }

  /* Word: a title, an optional subtitle and a table; landscape when the table has many columns */
  function docx(fileName, { title, sub = '', headers, rows, totals }) {
    const bidi = rtl() ? '<w:bidi/>' : ''; const rtlRun = rtl() ? '<w:rtl/>' : ''; const land = headers.length > 7;
    const run = (v, b, sz) => `<w:r><w:rPr>${b ? '<w:b/><w:bCs/>' : ''}${sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : ''}${rtlRun}<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:t xml:space="preserve">${x(v)}</w:t></w:r>`;
    const para = (v, b, sz, jc) => `<w:p><w:pPr>${bidi}${jc ? `<w:jc w:val="${jc}"/>` : ''}<w:spacing w:after="80"/></w:pPr>${run(v, b, sz)}</w:p>`;
    const cell = (v, b, fill) => `<w:tc><w:tcPr>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}</w:tcPr><w:p><w:pPr>${bidi}<w:spacing w:after="0"/></w:pPr>${run(isNum(v) ? fmtNum(v, 3) : v, b, 18)}</w:p></w:tc>`;
    const bd = '<w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>';
    const usable = (land ? 16838 : 11906) - 1440; const colW = Math.floor(usable / Math.max(1, headers.length));
    const table = `<w:tbl><w:tblPr>${rtl() ? '<w:bidiVisual/>' : ''}<w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="autofit"/></w:tblPr><w:tblGrid>${headers.map(() => `<w:gridCol w:w="${colW}"/>`).join('')}</w:tblGrid>
<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map(h => cell(h, true, 'D1FAE5')).join('')}</w:tr>${rows.map(r => `<w:tr>${headers.map((_, i) => cell(r[i] ?? '')).join('')}</w:tr>`).join('')}${totals ? `<w:tr>${headers.map((_, i) => cell(totals[i] ?? '', true, 'F3F4F6')).join('')}</w:tr>` : ''}</w:tbl>`;
    const st = S(); const biz = loc(st, 'businessName');
    const body = `${para(biz, true, 28, 'center')}${para(title, true, 26, 'center')}${sub ? para(sub, false, 20, 'center') : ''}${para(fmtDate(today()), false, 18, 'center')}${table}
<w:sectPr><w:pgSz w:w="${land ? 16838 : 11906}" w:h="${land ? 11906 : 16838}" ${land ? 'w:orient="landscape"' : ''}/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>${rtl() ? '<w:bidi/>' : ''}</w:sectPr>`;
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>` },
    ];
    save(zip(files), `${fileName}-${today()}.docx`);
  }
  return { xlsx, docx, zip, crc32 };
})();

/* the old CSV entry point now produces a formatted Excel file */
function exportCSV(name, headers, rows, opts = {}) { OFFICE.xlsx(name, [{ name: opts.sheet || name, title: opts.title || opts.sheet || name, sub: opts.sub, headers, rows: rows.map(r => r.map(v => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && v.length < 12 && !/^0\d/.test(v) ? +v : v))), totals: opts.totals }]); }
function exportWord(name, title, headers, rows, opts = {}) { OFFICE.docx(name, { title, sub: opts.sub, headers, rows, totals: opts.totals }); }
