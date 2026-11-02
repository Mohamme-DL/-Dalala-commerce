/* Dalala Commerce — extra modules: held invoices, expiry lots, stock count, barcode labels,
   daily sales & financial position, start a new year, print any list. */
'use strict';

/* =============== Held (suspended) invoices =============== */
function posHold() {
  if (!POS.items.length) return;
  DB.d.held.push({ id: uid(), at: Date.now(), user: USER.username, customerId: POS.customerId, discount: POS.discount, items: POS.items.map(i => ({ ...i })) });
  DB.save(); Object.assign(POS, { items: [], discount: 0, paid: '', method: 'cash', customerId: '' }); toast(t('heldSaved')); render();
}
function posHeldList() {
  const list = DB.all('held').slice().sort((a, b) => b.at - a.at);
  const root = modal({ title: `${t('heldInvoices')} (${fmtNum(list.length)})`,
    body: list.length ? `<ul class="list">${list.map(h => `<li><span class="dot" style="background:var(--warn)"></span><div><b>${esc(partyName('customers', h.customerId))}</b><small>${new Date(h.at).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })} · ${fmtNum(h.items.length)} ${t('itemsLbl')} · ${esc(h.user)}</small></div>
      <b>${fmtMoney(docTotal({ items: h.items, discount: h.discount, taxRate: S().taxRate }))}</b><button class="btn primary sm" data-resume="${h.id}">${t('resume')}</button><button class="icon-btn danger" data-hdel="${h.id}">${icon('trash')}</button></li>`).join('')}</ul>` : emptyState(t('noData')) });
  root.querySelectorAll('[data-resume]').forEach(b => { b.onclick = () => {
    const go = () => { const h = DB.get('held', b.dataset.resume); Object.assign(POS, { items: h.items, customerId: h.customerId, discount: h.discount, paid: '', method: 'cash' }); DB.remove('held', h.id); closeModal(); render(); };
    if (POS.items.length) confirmBox(t('replaceCartQ'), go, { danger: false }); else go(); }; });
  root.querySelectorAll('[data-hdel]').forEach(b => { b.onclick = () => { DB.remove('held', b.dataset.hdel); closeModal(); posHeldList(); }; });
}

/* =============== Expiry lots (FEFO) ===============
   Lots come from the opening quantity (product.openingExpiry) and purchase lines (item.expiry).
   Whatever left the stock is taken from the earliest-expiring lots first, so the remaining lots
   are the ones still on the shelf. Stock above the lots (e.g. positive adjustments) has no expiry. */
function lotsOf(pid) {
  return memo('lots', () => {
    const lots = {}; const add = (id, qty, expiry, ref, date) => { if (qty > 0) (lots[id] = lots[id] || []).push({ qty, expiry: expiry || '', ref, date }); };
    DB.all('products').forEach(p => add(p.id, +p.openingQty || 0, p.openingExpiry, t('openingQty'), ''));
    DB.all('purchases').filter(d => d.type !== 'return').forEach(d => d.items.forEach(it => add(it.productId, +it.qty || 0, it.expiry, d.number, d.date)));
    const out = {};
    for (const [id, list] of Object.entries(lots)) {
      if (!list.some(l => l.expiry)) continue;
      const total = sum(list, l => l.qty); let left = Math.max(0, stockOf(id)); let consumed = Math.max(0, total - left);
      const sorted = list.slice().sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999') || (a.date || '').localeCompare(b.date || ''));
      const rem = sorted.map(l => { const take = Math.min(l.qty, consumed); consumed -= take; return { ...l, qty: round(l.qty - take) }; }).filter(l => l.qty > 0);
      const lotsTotal = sum(rem, l => l.qty); if (left > lotsTotal + 0.0005) rem.push({ qty: round(left - lotsTotal), expiry: '', ref: '—' });
      out[id] = rem;
    }
    return out;
  })[pid] || null;
}
function expiredQty(pid) { const l = lotsOf(pid); return l ? round(sum(l.filter(x => x.expiry && x.expiry < today()), x => x.qty)) : 0; }
function sellableQty(pid) { return round(stockOf(pid) - expiredQty(pid)); }
function expiryRows() {
  const T = today(), soon = addDays(T, +S().expiryAlertDays || 30); const rows = [];
  DB.all('products').forEach(p => (lotsOf(p.id) || []).filter(l => l.expiry).forEach(l => rows.push({ p, ...l, state: l.expiry < T ? 'expired' : l.expiry <= soon ? 'soon' : 'ok', days: Math.round((parseISO(l.expiry) - parseISO(T)) / 864e5) })));
  return rows.sort((a, b) => a.expiry.localeCompare(b.expiry));
}
function renderExpiry(p) {
  const st = ['expired', 'soon', 'ok'].includes(p.state) ? p.state : 'all'; const all = expiryRows(); const rows = all.filter(r => st === 'all' || r.state === st);
  const cnt = k => all.filter(r => r.state === k).length;
  return `${pageHead(t('nav_expiry'), t('sub_expiry'), `<button class="btn ghost" data-act="crud-print-html" data-title="${t('nav_expiry')}" data-target="#exp-table">${icon('printer')}<span>${t('print')}</span></button>`)}
    <div class="kpis three">${kpi({ ic: 'alert', label: t('exp_expired'), val: fmtNum(cnt('expired')), c: 'c5', href: '#/expiry?state=expired' })}${kpi({ ic: 'clock', label: `${t('exp_soon')} (${fmtNum(+S().expiryAlertDays || 30)} ${t('days')})`, val: fmtNum(cnt('soon')), c: 'c4', href: '#/expiry?state=soon' })}${kpi({ ic: 'check', label: t('exp_ok'), val: fmtNum(cnt('ok')), c: 'c3', href: '#/expiry?state=ok' })}</div>
    <div class="card"><div class="tabs">${['all', 'expired', 'soon', 'ok'].map(k => `<a class="tab ${st === k ? 'on' : ''}" href="#/expiry?state=${k}">${t(k === 'all' ? 'all' : 'exp_' + k)}</a>`).join('')}</div>
    <div id="exp-table">${rows.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_productId')}</th><th>${t('f_qty')}</th><th>${t('f_expiry')}</th><th>${t('daysLeft')}</th><th>${t('ref')}</th><th>${t('f_status')}</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><a class="link" href="#/item/${r.p.id}">${esc(loc(r.p))}</a></td><td>${fmtNum(r.qty, 3)}</td><td>${fmtDate(r.expiry)}</td><td>${fmtNum(r.days)}</td><td class="ltr">${esc(r.ref)}</td>
        <td>${badge(r.state === 'expired' ? 'overdue' : r.state === 'soon' ? 'partial' : 'active', t('exp_' + r.state))}</td>
        <td>${r.state === 'expired' && can(['admin', 'storekeeper']) ? `<button class="btn ghost sm" data-act="exp-writeoff" data-id="${r.p.id}">${icon('trash')}<span>${t('writeOff')}</span></button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : emptyState(t('noExpiryData'), 'check')}</div>
    <p class="hint">${t('expiryHint')}</p></div>`;
}
function writeOffExpired(pid) {
  const q = expiredQty(pid); if (!q) return;
  confirmBox(`${t('writeOffQ')} ${fmtNum(q, 3)} — ${esc(prodName(pid))}`, () => {
    DB.insert('adjustments', { number: DB.nextCode('adjustments', 'number', 'ADJ'), date: today(), productId: pid, qty: -q, reason: 'expired', notes: t('writeOffNote') });
    toast(t('saved')); render();
  });
}

/* =============== Stock count (جرد) =============== */
function openCount() { return DB.all('stockCounts').find(c => c.status === 'open'); }
function renderStockCount(p) {
  const c = openCount(); const past = DB.all('stockCounts').filter(x => x.status === 'posted').sort((a, b) => b.date.localeCompare(a.date));
  if (!c) return `${pageHead(t('nav_stockcount'), t('sub_stockcount'), `${USER.role === 'admin' ? `<button class="btn ghost" data-act="year-close">${icon('vault')}<span>${t('yearClose')}</span></button>` : ''}<a class="btn ghost" href="#/logs?tab=closings&period=all">${icon('clipboard')}<span>${t('log_closings')}</span></a>
      ${can(['admin', 'storekeeper']) ? `<button class="btn primary" data-act="count-start">${icon('plus')}<span>${t('countStart')}</span></button>` : ''}`)}
    <div class="card"><p class="hint">${t('countHint')}</p></div>
    ${card(t('countHistory'), past.length ? `<ul class="list">${past.map(x => `<li>${icon('clipboard')}<div><b class="ltr">${esc(x.number)}</b><small>${fmtDate(x.date)} → ${fmtDate(x.postedAt)} · ${fmtNum(x.diffs || 0)} ${t('countDiffs')} · ${esc(x.user || '')}</small></div><b>${fmtMoney(x.diffValue || 0)}</b><button class="btn ghost sm" data-act="count-print" data-id="${x.id}">${icon('printer')}</button></li>`).join('')}</ul>` : emptyState(t('noData')))}`;
  const q = norm(p.q || ''); const cat = p.cat || '';
  const prods = DB.all('products').filter(x => isStock(x) && c.lines[x.id] && (!cat || x.categoryId === cat) && (!q || norm(loc(x)).includes(q) || String(x.code).toLowerCase().includes(q) || String(x.barcode || '').includes(q)));
  const counted = Object.values(c.lines).filter(l => l.counted !== '' && l.counted != null).length;
  const diffs = DB.all('products').filter(x => c.lines[x.id] && c.lines[x.id].counted !== '' && c.lines[x.id].counted != null && Math.abs(+c.lines[x.id].counted - stockOf(x.id)) > 0.0005);
  return `${pageHead(`${t('nav_stockcount')} <span class="ltr muted">${esc(c.number)}</span>`, `${t('countOpenSince')} ${fmtDate(c.date)}`, `
      <button class="btn ghost" data-act="count-print" data-id="${c.id}">${icon('printer')}<span>${t('countSheet')}</span></button>
      <button class="btn ghost danger-t" data-act="count-cancel">${icon('x')}<span>${t('countCancel')}</span></button>
      <button class="btn primary" data-act="count-post">${icon('check')}<span>${t('countPost')} (${fmtNum(diffs.length)})</span></button>`)}
    <div class="card"><div class="summary"><div class="sum-item"><span>${t('itemsCount')}</span><b>${fmtNum(Object.keys(c.lines).length)}</b></div><div class="sum-item s-P"><span>${t('countCounted')}</span><b>${fmtNum(counted)}</b></div>
      <div class="sum-item s-A"><span>${t('countDiffs')}</span><b>${fmtNum(diffs.length)}</b></div><div class="sum-item"><span>${t('countDiffValue')}</span><b>${fmtMoney(sum(diffs, x => (+c.lines[x.id].counted - stockOf(x.id)) * (+x.cost || 0)))}</b></div></div>
    <div class="toolbar"><div class="search">${icon('search')}<input class="input" placeholder="${t('search')}…" value="${esc(p.q || '')}" data-chg="nav-param" data-param="q"></div>
      <label class="sel"><span>${t('f_categoryId')}</span><select class="input sm" data-chg="nav-param" data-param="cat"><option value="">${t('all')}</option>${DB.all('categories').map(x => `<option value="${x.id}" ${cat === x.id ? 'selected' : ''}>${esc(loc(x))}</option>`).join('')}</select></label></div>
    <div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_code')}</th><th>${t('f_productId')}</th><th>${t('countSystem')}</th><th>${t('countActual')}</th><th>${t('countDiff')}</th></tr></thead><tbody>
      ${prods.map(x => { const l = c.lines[x.id]; const has = l.counted !== '' && l.counted != null; const d = has ? round(+l.counted - stockOf(x.id)) : null;
        return `<tr><td class="ltr">${esc(x.code)}</td><td>${esc(loc(x))}</td><td>${fmtNum(stockOf(x.id), 3)}</td>
          <td><input class="input sm num-in" type="number" step="any" min="0" value="${has ? l.counted : ''}" data-chg="count-set" data-id="${x.id}" placeholder="—"></td>
          <td class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}"><b>${d == null ? '' : (d > 0 ? '+' : '') + fmtNum(d, 3)}</b></td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">${t('countHint2')}</p></div>`;
}
function countStart() {
  const lines = {}; DB.all('products').filter(x => isStock(x) && x.active !== false).forEach(x => { lines[x.id] = { system: stockOf(x.id), counted: '' }; });
  DB.insert('stockCounts', { number: DB.nextCode('stockCounts', 'number', 'CNT'), date: today(), status: 'open', user: USER.username, lines }); render();
}
function countPost() {
  const c = openCount(); if (!c) return;
  const diffs = DB.all('products').filter(x => c.lines[x.id] && c.lines[x.id].counted !== '' && c.lines[x.id].counted != null).map(x => ({ x, d: round(+c.lines[x.id].counted - stockOf(x.id)) })).filter(r => Math.abs(r.d) > 0.0005);
  confirmBox(`${t('countPostQ')} (${fmtNum(diffs.length)})`, () => {
    diffs.forEach(r => DB.d.adjustments.push({ id: uid(), createdAt: Date.now(), number: DB.nextCode('adjustments', 'number', 'ADJ'), date: today(), productId: r.x.id, qty: r.d, reason: 'count', notes: `${t('nav_stockcount')} ${c.number}` }));
    Object.assign(c, { status: 'posted', postedAt: today(), diffs: diffs.length, diffValue: round(sum(diffs, r => r.d * (+r.x.cost || 0))), result: diffs.map(r => ({ id: r.x.id, d: r.d })) });
    DB.save(); toast(t('countPosted')); render();
  }, { danger: false, okLabel: t('countPost') });
}
function countPrint(id) {
  const c = DB.get('stockCounts', id); if (!c) return; const open = c.status === 'open';
  const prods = DB.all('products').filter(x => c.lines[x.id]).sort((a, b) => String(a.categoryId).localeCompare(String(b.categoryId)) || loc(a).localeCompare(loc(b), LANG));
  printHTML(`${printHeader(t('countSheet'), `<span class="ltr">${esc(c.number)}</span> · ${fmtDate(c.date)}`)}
    <table class="ptable small"><thead><tr><th>#</th><th>${t('f_code')}</th><th>${t('f_productId')}</th><th>${t('f_categoryId')}</th><th>${t('f_unit')}</th><th>${t('countSystem')}</th><th>${t('countActual')}</th>${open ? '' : `<th>${t('countDiff')}</th>`}</tr></thead>
    <tbody>${prods.map((x, i) => { const r = (c.result || []).find(z => z.id === x.id); return `<tr><td>${i + 1}</td><td>${esc(x.code)}</td><td>${esc(loc(x))}</td><td>${esc(refLabel('categories', x.categoryId))}</td><td>${t('opt_' + x.unit)}</td><td>${fmtNum(open ? stockOf(x.id) : c.lines[x.id].system, 3)}</td><td>${c.lines[x.id].counted === '' ? '' : fmtNum(c.lines[x.id].counted, 3)}</td>${open ? '' : `<td>${r ? fmtNum(r.d, 3) : ''}</td>`}</tr>`; }).join('')}</tbody></table>
    <div class="psign"><div>${t('countedBy')}</div><div>${t('storekeeperSign')}</div><div>${t('stamp')}</div></div>`);
}

/* =============== Barcode labels =============== */
const LABEL_SHEETS = { a21: { cols: 3, rows: 7, w: 63.5, h: 38.1 }, a24: { cols: 3, rows: 8, w: 64, h: 33.9 }, a40: { cols: 4, rows: 10, w: 48.5, h: 25.4 }, a65: { cols: 5, rows: 13, w: 38.1, h: 21.2 } };
const LBL = { sel: {}, type: 'code128', name: true, price: true, text: true, mode: 'roll', w: 50, h: 30, sheet: 'a24', q: '' };
function labelValue(p) { return String(p.barcode || p.code || ''); }
function labelProblem(p) {
  const v = labelValue(p); if (!v) return t('lblNoCode');
  if (LBL.type === 'code128') { if (/[^\x20-\x7e]/.test(v)) return t('lblNotAscii'); const w = LBL.mode === 'roll' ? +LBL.w : LABEL_SHEETS[LBL.sheet].w; if (Code128.modules(v) * 0.25 > w - 4) return t('lblTooLong'); }
  else if (new TextEncoder().encode(v).length > QrCode.maxBytes) return t('lblTooLong');
  return '';
}
function labelHtml(p) {
  const v = labelValue(p); let code = ''; try { code = LBL.type === 'qr' ? QrCode.svg(v) : Code128.svg(v); } catch (e) { code = ''; }
  return `<div class="lbl ${LBL.type}">${LBL.name ? `<div class="lbl-name">${esc(loc(p))}</div>` : ''}<div class="lbl-code">${code}</div>${LBL.text ? `<div class="lbl-txt">${esc(v)}</div>` : ''}${LBL.price ? `<div class="lbl-price">${moneyText(p.price)}</div>` : ''}</div>`;
}
function renderLabels() {
  const q = norm(LBL.q); const prods = DB.all('products').filter(p => p.active !== false && isStock(p) && (!q || norm(loc(p)).includes(q) || String(p.code).toLowerCase().includes(q) || String(p.barcode || '').includes(q)));
  const chosen = Object.entries(LBL.sel).filter(([, n]) => +n > 0); const total = sum(chosen, ([, n]) => +n);
  const first = DB.get('products', chosen[0]?.[0]) || prods[0];
  return `${pageHead(t('nav_labels'), t('sub_labels'), `<button class="btn primary" data-act="lbl-print" ${total ? '' : 'disabled'}>${icon('printer')}<span>${t('print')} (${fmtNum(total)})</span></button>`)}
    <div class="grid-lbl"><div class="card">
      <div class="toolbar"><div class="search">${icon('barcode')}<input class="input" id="lbl-q" placeholder="${t('lblSearch')}" value="${esc(LBL.q)}" data-chg="lbl-q"></div>
        <button class="btn ghost sm" data-act="lbl-all">${t('lblSelectShown')}</button><button class="btn ghost sm" data-act="lbl-none">${t('clear')}</button></div>
      <div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_productId')}</th><th>${t('f_barcode')}</th><th>${t('f_stock')}</th><th>${t('lblCount')}</th><th></th></tr></thead><tbody>
        ${prods.slice(0, 300).map(p => { const prob = labelProblem(p); return `<tr><td>${esc(loc(p))}</td><td class="ltr">${esc(labelValue(p))}</td><td>${fmtNum(Math.max(0, stockOf(p.id)), 3)}</td>
          <td><input class="input sm num-in" type="number" min="0" step="1" value="${LBL.sel[p.id] || ''}" placeholder="0" data-chg="lbl-n" data-id="${p.id}"></td><td>${prob ? `<small class="neg">${esc(prob)}</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="card"><h3>${t('lblOptions')}</h3><div class="form-grid one">
      <label class="field"><span>${t('lblType')}</span><select class="input" data-chg="lbl-opt" data-k="type"><option value="code128" ${LBL.type === 'code128' ? 'selected' : ''}>Code 128 (${t('lblLinear')})</option><option value="qr" ${LBL.type === 'qr' ? 'selected' : ''}>QR Code (${t('lblArabicOk')})</option></select></label>
      <div class="days">${['name', 'price', 'text'].map(k => `<label class="day"><input type="checkbox" data-chg="lbl-opt" data-k="${k}" ${LBL[k] ? 'checked' : ''}><span>${t('lblShow_' + k)}</span></label>`).join('')}</div>
      <label class="field"><span>${t('lblMode')}</span><select class="input" data-chg="lbl-opt" data-k="mode"><option value="roll" ${LBL.mode === 'roll' ? 'selected' : ''}>${t('lblRoll')}</option><option value="sheet" ${LBL.mode === 'sheet' ? 'selected' : ''}>${t('lblSheet')}</option></select></label>
      ${LBL.mode === 'roll' ? `<div class="form-grid"><label class="field"><span>${t('lblWidth')} (mm)</span><input class="input" type="number" min="20" max="120" value="${LBL.w}" data-chg="lbl-opt" data-k="w"></label><label class="field"><span>${t('lblHeight')} (mm)</span><input class="input" type="number" min="15" max="100" value="${LBL.h}" data-chg="lbl-opt" data-k="h"></label></div>`
      : `<label class="field"><span>${t('lblTemplate')}</span><select class="input" data-chg="lbl-opt" data-k="sheet">${Object.entries(LABEL_SHEETS).map(([k, v]) => `<option value="${k}" ${LBL.sheet === k ? 'selected' : ''}>A4 — ${v.cols * v.rows} (${v.w}×${v.h} mm)</option>`).join('')}</select></label>`}
      <div class="lbl-preview-wrap"><span class="muted">${t('lblPreview')}</span><div class="lbl-preview" style="--w:${LBL.mode === 'roll' ? LBL.w : LABEL_SHEETS[LBL.sheet].w}mm;--h:${LBL.mode === 'roll' ? LBL.h : LABEL_SHEETS[LBL.sheet].h}mm">${first ? labelHtml(first) : ''}</div></div>
      <p class="hint">${t('lblHint')}</p></div></div></div>`;
}
function labelsPrint() {
  const items = []; Object.entries(LBL.sel).forEach(([id, n]) => { const p = DB.get('products', id); if (p && !labelProblem(p)) for (let i = 0; i < +n; i++) items.push(p); });
  if (!items.length) return toast(t('lblNothing'), 'err');
  let css, body;
  if (LBL.mode === 'roll') {
    css = `@page { size: ${LBL.w}mm ${LBL.h}mm; margin: 0 } .lbl-page { width: ${LBL.w}mm; height: ${LBL.h}mm; page-break-after: always; break-after: page; overflow: hidden; }`;
    body = items.map(p => `<div class="lbl-page">${labelHtml(p)}</div>`).join('');
  } else {
    const s = LABEL_SHEETS[LBL.sheet]; const mx = (210 - s.cols * s.w) / 2, my = (297 - s.rows * s.h) / 2; const per = s.cols * s.rows; const pages = [];
    for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
    css = `@page { size: A4; margin: 0 } .lbl-sheet { width: 210mm; height: 297mm; padding: ${my}mm ${mx}mm; display: grid; grid-template-columns: repeat(${s.cols}, ${s.w}mm); grid-auto-rows: ${s.h}mm; direction: ltr; page-break-after: always; break-after: page; } .lbl-sheet > div { overflow: hidden; }`;
    body = pages.map(pg => `<div class="lbl-sheet">${pg.map(p => `<div>${labelHtml(p)}</div>`).join('')}</div>`).join('');
  }
  printHTML(`<style>${css}</style><div class="lbl-print">${body}</div>`, 'labels-mode');
}

/* =============== Reports: daily sales (drill-down) and financial position =============== */
function dailyTable(from, to) {
  const days = {}; salesIn(from, to).forEach(d => { const o = days[d.date] = days[d.date] || { n: 0, sales: 0, paid: 0, profit: 0, due: 0 }; const s = sign(d); if (d.type === 'sale') o.n++; o.sales += s * docTotal(d); o.paid += s * (+d.paid || 0); o.profit += s * (docTotals(d).after - docCost(d)); o.due += d.type === 'sale' ? Math.max(0, docDue(d)) : 0; });
  const rows = Object.entries(days).sort((a, b) => b[0].localeCompare(a[0])); if (!rows.length) return emptyState(t('noData'));
  return `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_date')}</th><th>${t('invoicesCount')}</th><th>${t('nav_sales')}</th><th>${t('collected')}</th><th>${t('grossProfit')}</th><th>${t('f_due')}</th><th></th></tr></thead><tbody>
    ${rows.map(([d, o]) => `<tr class="click-row" data-act="day-open" data-date="${d}"><td>${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>${fmtNum(o.n)}</td><td>${fmtMoney(o.sales)}</td><td>${fmtMoney(o.paid)}</td><td>${fmtMoney(o.profit)}</td><td>${fmtMoney(o.due)}</td><td>${icon(LANG === 'ar' ? 'chevL' : 'chevR')}</td></tr>`).join('')}
    <tr class="total-row"><td>${t('total')}</td><td>${fmtNum(sum(rows, r => r[1].n))}</td><td>${fmtMoney(sum(rows, r => r[1].sales))}</td><td>${fmtMoney(sum(rows, r => r[1].paid))}</td><td>${fmtMoney(sum(rows, r => r[1].profit))}</td><td>${fmtMoney(sum(rows, r => r[1].due))}</td><td></td></tr></tbody></table></div>`;
}
function dayOpen(date) {
  const list = salesIn(date, date).sort((a, b) => String(a.number).localeCompare(String(b.number)));
  modal({ title: `${t('dayInvoices')} — ${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, size: 'lg',
    body: `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_number')}</th><th>${t('f_customerId')}</th><th>${t('total')}</th><th>${t('f_paid')}</th><th>${t('grossProfit')}</th><th>${t('f_due')}</th><th></th></tr></thead><tbody>
      ${list.map(d => `<tr><td class="ltr"><a class="link" href="#/doc/sales/${d.id}">${esc(d.number)}</a></td><td>${esc(partyName('customers', d.customerId))}</td><td>${fmtMoney(sign(d) * docTotal(d))}</td><td>${fmtMoney(sign(d) * d.paid)}</td><td>${fmtMoney(sign(d) * (docTotals(d).after - docCost(d)))}</td><td>${fmtMoney(d.type === 'sale' ? Math.max(0, docDue(d)) : 0)}</td><td>${badge(d.type)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="2">${t('total')}</td><td>${fmtMoney(sum(list, d => sign(d) * docTotal(d)))}</td><td>${fmtMoney(sum(list, d => sign(d) * d.paid))}</td><td>${fmtMoney(sum(list, d => sign(d) * (docTotals(d).after - docCost(d))))}</td><td>${fmtMoney(sum(list.filter(d => d.type === 'sale'), d => Math.max(0, docDue(d))))}</td><td></td></tr></tbody></table></div>` });
}
function financialPosition() {
  const recv = sum(DB.all('customers'), c => customerBalance(c.id)); const pay = sum(DB.all('suppliers'), c => supplierBalance(c.id));
  const inv = sum(DB.all('products').filter(isStock), p => Math.max(0, stockOf(p.id)) * (+p.cost || 0));
  const rows = [[t('acc_cash'), accountBalance('cash')], [t('acc_bank'), accountBalance('bank')], [t('fpReceivable'), recv], [t('fpInventory'), inv], [t('fpPayable'), -pay]];
  const net = sum(rows, r => r[1]);
  return `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('fpAccount')}</th><th>${t('debit')}</th><th>${t('credit')}</th><th>${t('fpDirection')}</th></tr></thead><tbody>
    ${rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v > 0 ? fmtMoney(v) : ''}</td><td>${v < 0 ? fmtMoney(-v) : ''}</td><td>${badge(v >= 0 ? 'active' : 'partial', t(v >= 0 ? 'debit' : 'credit'))}</td></tr>`).join('')}
    <tr class="total-row"><td>${t('fpNetWorth')}</td><td colspan="2">${fmtMoney(net)}</td><td></td></tr></tbody></table></div><p class="hint">${t('fpHint')}</p>`;
}

/* =============== Start a new year (reset transactions) =============== */
function newYearDialog() {
  const root = modal({ title: t('newYear'), size: 'sm',
    body: `<form id="ny-form" class="form-grid one"><p class="note-warn">${t('newYearWarn')}</p>
      <label class="field row"><input type="checkbox" name="keepStock" checked><span>${t('nyKeepStock')}</span></label>
      <label class="field row"><input type="checkbox" name="keepBalances" checked><span>${t('nyKeepBalances')}</span></label>
      <label class="field row"><input type="checkbox" name="all"><span class="neg">${t('nyResetAll')}</span></label>
      ${pwField('pw', t('adminPassword'), 'required')}
      <label class="field"><span>${t('nyTypeWord')} «${t('nyWord')}»</span><input class="input" name="word" required></label><div class="form-err" hidden></div></form>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn danger" type="submit" form="ny-form">${icon('refresh')}<span>${t('newYearGo')}</span></button>` });
  $('[data-x2]', root).onclick = closeModal;
  $('#ny-form', root).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; const err = m => { const b = $('.form-err', f); b.hidden = false; b.textContent = m; };
    if (f.word.value.trim() !== t('nyWord')) return err(t('nyWordWrong'));
    if (!(await checkPassword(USER, f.pw.value))) return err(t('wrongPassword'));
    downloadFile(`dalala-commerce-before-new-year-${today()}.json`, JSON.stringify(DB.d, null, 1), 'application/json');
    const d = DB.d; const st = d.settings;
    const stock = Object.fromEntries(d.products.map(p => [p.id, stockOf(p.id)])); const cb = Object.fromEntries(d.customers.map(c => [c.id, customerBalance(c.id)])); const sb = Object.fromEntries(d.suppliers.map(c => [c.id, supplierBalance(c.id)]));
    st.openingCash = accountBalance('cash'); st.openingBank = accountBalance('bank');
    ['sales', 'purchases', 'receipts', 'disbursements', 'expenses', 'cashMoves', 'adjustments', 'held', 'stockCounts'].forEach(k => { d[k] = []; });
    if (f.all.checked) { d.products = []; d.customers = []; d.suppliers = []; st.openingCash = 0; st.openingBank = 0; }
    else {
      d.products.forEach(p => { p.openingQty = f.keepStock.checked ? round(Math.max(0, stock[p.id])) : 0; p.openingExpiry = ''; });
      d.customers.forEach(c => { c.openingBalance = f.keepBalances.checked ? round(cb[c.id]) : 0; });
      d.suppliers.forEach(c => { c.openingBalance = f.keepBalances.checked ? round(sb[c.id]) : 0; });
    }
    st.yearStarted = today(); st.isDemo = false; DB.save(); closeModal(); toast(t('newYearDone')); location.hash = '#/dashboard'; render();
  });
}

/* =============== Print any list (A4) =============== */
function printCrud(key) {
  const cfg = ENT[key]; const cols = cfg.fields.filter(f => f.list); const rows = crudRows(key);
  printHTML(`${printHeader(t('nav_' + key), `${fmtNum(rows.length)} ${t('records')}`)}<table class="ptable small"><thead><tr><th>#</th>${cols.map(f => `<th>${esc(fieldLabel(f))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(f => `<td>${esc(cellText(f, r))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
}
