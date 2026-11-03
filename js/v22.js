/* Dalala Commerce 2.2 — the rest of the Dlala Commercial 2.0.0 feature set:
   debt payments allocated to the oldest invoices, returns / paid-debts / adjustments logs,
   double-entry journal and trial balance, yearly closing records, movements blocked during an
   open stock count, quick item buttons, thermal / silent printing, finer permissions,
   automatic backups, product soft delete and a configurable invoice prefix. */
'use strict';

/* ================= Debts: allocate payments to the oldest invoices ================= */
const partyKey = d => (d.supplierId !== undefined && d.customerId === undefined ? 's' : 'c');
function partyRemaining(kind) { // kind 'c' | 's' → { docId: remaining }
  return memo('alloc-' + kind, () => {
    const isC = kind === 'c', pk = isC ? 'customerId' : 'supplierId';
    const groups = {}; const g = id => (groups[id] = groups[id] || { docs: [], credit: 0, vouchers: [] });
    liveDocs(isC ? 'sales' : 'purchases').forEach(d => { if (!d[pk]) return; if (d.type === 'return') { const c = docDue(d); if (c > 0) g(d[pk]).credit += c; } else if (docDue(d) > 0.0005) g(d[pk]).docs.push(d); });
    DB.all(isC ? 'receipts' : 'disbursements').forEach(v => { if (v[pk]) g(v[pk]).vouchers.push(v); });
    const res = {};
    for (const [pid, x] of Object.entries(groups)) {
      x.docs.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.number).localeCompare(String(b.number)));
      const rem = new Map(x.docs.map(d => [d.id, docDue(d)])); let pool = x.credit;
      x.vouchers.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(v => {
        let amt = +v.amount || 0;
        (v.alloc || []).forEach(a => { if (!rem.has(a.docId)) return; const take = Math.min(rem.get(a.docId), +a.amount || 0, amt); rem.set(a.docId, round(rem.get(a.docId) - take)); amt = round(amt - take); });
        pool += amt;
      });
      const party = DB.get(isC ? 'customers' : 'suppliers', pid); const ob = +(party && party.openingBalance) || 0;
      if (ob < 0) pool += -ob; else pool -= Math.min(ob, pool); // the opening balance is the oldest debt
      for (const d of x.docs) { if (pool <= 0.0005) break; const take = Math.min(rem.get(d.id), pool); rem.set(d.id, round(rem.get(d.id) - take)); pool = round(pool - take); }
      x.docs.forEach(d => { res[d.id] = rem.get(d.id); });
    }
    return res;
  });
}
function docRemaining(d) {
  if (!d || d.type === 'return') return 0;
  const k = partyKey(d); const pid = k === 'c' ? d.customerId : d.supplierId;
  if (!pid || !d.id || !DB.get(k === 'c' ? 'sales' : 'purchases', d.id)) return Math.max(0, docDue(d));
  const r = partyRemaining(k)[d.id]; return r === undefined ? 0 : Math.max(0, r);
}
docStatus = function (d) { // eslint-disable-line no-global-assign
  if (d.type === 'return') { const due = docDue(d); return due <= 0.0005 ? 'paid' : (+d.paid || 0) > 0 ? 'partial' : 'credit'; }
  const rem = docRemaining(d); return rem <= 0.0005 ? 'paid' : ((+d.paid || 0) > 0 || rem < docDue(d) - 0.0005) ? 'partial' : 'credit';
};
function openDocs(kind, pid) {
  const rem = partyRemaining(kind); const col = kind === 'c' ? 'sales' : 'purchases'; const pk = kind === 'c' ? 'customerId' : 'supplierId';
  return liveDocs(col).filter(d => d[pk] === pid && d.type !== 'return' && (rem[d.id] || 0) > 0.0005).map(d => ({ d, rem: rem[d.id] }))
    .sort((a, b) => (a.d.date || '').localeCompare(b.d.date || '') || String(a.d.number).localeCompare(String(b.d.number)));
}
function payDebtDialog(kind, pid, docId) {
  if (!hasPerm('collect')) return toast(t('noPermission'), 'err');
  const isC = kind === 'c'; const party = DB.get(isC ? 'customers' : 'suppliers', pid); if (!party) return;
  const bal = isC ? customerBalance(pid) : supplierBalance(pid); let list = openDocs(kind, pid);
  if (docId) { const i = list.findIndex(x => x.d.id === docId); if (i > 0) list.unshift(list.splice(i, 1)[0]); }
  const other = round(Math.max(0, bal - sum(list, x => x.rem)));
  const def = docId ? (list.find(x => x.d.id === docId) || { rem: 0 }).rem : Math.max(0, bal);
  const root = modal({ title: `${t('payDebt')} — ${esc(loc(party))}`, size: 'lg',
    body: `<div class="info-grid"><div><span>${t('currentBalance')}</span><b>${balanceFmt(bal, isC ? 'c' : 's')}</b></div><div><span>${t('openInvoices')}</span><b>${fmtNum(list.length)}</b></div></div>
      <div class="table-wrap pd-wrap"><table class="table compact"><thead><tr><th>${t('f_number')}</th><th>${t('f_date')}</th><th>${t('total')}</th><th>${t('remainingLbl')}</th><th>${t('allocated')}</th></tr></thead><tbody id="pd-rows">
        ${other > 0.0005 ? `<tr><td colspan="3">${t('openingOrOther')}</td><td>${fmtMoney(other)}</td><td class="pd-a" data-i="-1">—</td></tr>` : ''}
        ${list.map((x, i) => `<tr><td class="ltr">${esc(x.d.number)}</td><td>${fmtDate(x.d.date)}</td><td>${fmtMoney(docTotal(x.d))}</td><td>${fmtMoney(x.rem)}</td><td class="pd-a" data-i="${i}">—</td></tr>`).join('') || `<tr><td colspan="5">${emptyState(t('noOpenInvoices'), 'check')}</td></tr>`}</tbody></table></div>
      <form id="pd-form" class="form-grid three">
        <label class="field"><span>${t('f_amount')} <i class="req">*</i></span><input class="input" name="amount" type="number" step="any" min="0" value="${round(def)}" dir="ltr" required></label>
        <label class="field"><span>${t('f_method')}</span><select class="input" name="method">${METHODS.map(m => `<option value="${m}" ${m === (isC ? 'cash' : 'transfer') ? 'selected' : ''}>${t('opt_' + m)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('f_date')}</span><input class="input" name="date" type="date" value="${today()}"></label>
        <label class="field full"><span>${t('f_notes')}</span><input class="input" name="notes"></label>
        <label class="field row full"><input type="checkbox" name="print" checked><span>${t('printPaymentReceipt')}</span></label><div class="form-err full" hidden></div></form>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn primary" type="submit" form="pd-form">${icon('check')}<span>${t('payDebt')}</span></button>` });
  $('[data-x2]', root).onclick = closeModal;
  const f = $('#pd-form', root);
  const plan = amt => { // oldest first (the chosen invoice first); what is left goes to the opening balance / advance
    let left = Math.max(0, +amt || 0); const alloc = [];
    if (other > 0.0005 && !docId) { const take = Math.min(other, left); left = round(left - take); }
    list.forEach(x => { const take = round(Math.min(x.rem, left)); if (take > 0) { alloc.push({ docId: x.d.id, number: x.d.number, amount: take }); left = round(left - take); } });
    return { alloc, left };
  };
  const paint = () => { const { alloc } = plan(f.amount.value); $$('.pd-a', root).forEach(td => { const i = +td.dataset.i; const a = i >= 0 ? alloc.find(z => z.docId === list[i].d.id) : null; td.innerHTML = a ? `<b class="pos">${fmtMoney(a.amount)}</b>` : '—'; }); };
  f.amount.addEventListener('input', paint); paint();
  f.addEventListener('submit', e => {
    e.preventDefault(); const amt = round(+f.amount.value || 0); const err = m => { const b = $('.form-err', f); b.hidden = false; b.textContent = m; };
    if (!(amt > 0)) return err(t('errAmount'));
    const save = () => {
      const { alloc } = plan(amt); const col = isC ? 'receipts' : 'disbursements';
      const v = DB.insert(col, { number: DB.nextCode(col, 'number', isC ? 'RV' : 'PV'), date: f.date.value || today(), [isC ? 'customerId' : 'supplierId']: pid, amount: amt, method: f.method.value,
        notes: f.notes.value.trim(), alloc: alloc.map(a => ({ docId: a.docId, amount: a.amount })), user: USER.username });
      closeModal(); toast(t('debtPaid')); render(); if (f.print.checked) printVoucher(col, v);
    };
    if (amt > Math.max(0, bal) + 0.0005) confirmBox(t('overpayAdvanceQ'), save, { danger: false, okLabel: t('continue') }); else save();
  });
}
/* voucher print shows which invoices the payment settled */
renderPrintVoucher = function (kind, r) { // eslint-disable-line no-global-assign
  const isR = kind === 'receipts'; const party = DB.get(isR ? 'customers' : 'suppliers', isR ? r.customerId : r.supplierId); const col = isR ? 'sales' : 'purchases';
  const alloc = (r.alloc || []).map(a => ({ d: DB.get(col, a.docId), amount: a.amount })).filter(a => a.d);
  printHTML(`${printHeader(t(isR ? 'receiptVoucher' : 'paymentVoucher'), `<span class="ltr">${esc(r.number)}</span>`)}
    <div class="pbox"><div class="kv"><span>${t('f_date')}</span><b>${fmtDate(r.date)}</b></div><div class="kv"><span>${t(isR ? 'receivedFrom' : 'paidTo')}</span><b>${esc(party ? loc(party) : '—')}</b></div>
      <div class="kv"><span>${t('f_method')}</span><b>${t('opt_' + r.method)}</b></div><div class="kv"><span>${t('balanceAfter')}</span><b>${moneyText(Math.abs(isR ? customerBalance(r.customerId) : supplierBalance(r.supplierId)))}</b></div></div>
    <div class="pamount">${t('f_amount')}: <b>${moneyText(r.amount)}</b></div>
    ${alloc.length ? `<table class="ptable small"><thead><tr><th>${t('f_number')}</th><th>${t('f_date')}</th><th>${t('total')}</th><th>${t('allocated')}</th><th>${t('remainingLbl')}</th></tr></thead><tbody>${alloc.map(a => `<tr><td class="ltr">${esc(a.d.number)}</td><td>${fmtDate(a.d.date)}</td><td>${money(docTotal(a.d))}</td><td>${money(a.amount)}</td><td>${money(docRemaining(a.d))}</td></tr>`).join('')}</tbody></table>` : ''}
    ${r.notes ? `<p><b>${t('f_notes')}:</b> ${esc(r.notes)}</p>` : ''}${r.user ? `<p class="muted">${t('byUser')}: ${esc(r.user)}</p>` : ''}
    <div class="psign"><div>${t(isR ? 'payerSign' : 'receiverSign')}</div><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div>`);
};

/* ================= Logs: returns, paid debts, stock adjustments, yearly closings ================= */
const LOG = { q: '' };
function logRows(tab, from, to) {
  const inR = d => (!from || (d.date || '') >= from) && (!to || (d.date || '') <= to);
  if (tab === 'returns') {
    const rows = [];
    [['sales', 'customers', 'customerId'], ['purchases', 'suppliers', 'supplierId']].forEach(([col, pc, pk]) => DB.all(col).filter(d => d.type === 'return' && inR(d)).forEach(d => {
      const ref = d.refId ? DB.get(col, d.refId) : null;
      d.items.forEach((it, i) => rows.push({ date: d.date, kind: t(col === 'sales' ? 'salesReturn' : 'purchaseReturn'), number: d.number, ref: ref ? ref.number : '', party: partyName(pc, d[pk]), product: prodName(it.productId), qty: +it.qty, value: lineTotal(it), refund: i === 0 ? +d.paid || 0 : '', user: d.user || '', link: `#/doc/${col}/${d.id}` }));
    }));
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }
  if (tab === 'debts') {
    const rows = [];
    [['receipts', 'customers', 'customerId', 'sales'], ['disbursements', 'suppliers', 'supplierId', 'purchases']].forEach(([col, pc, pk, dc]) => DB.all(col).filter(inR).forEach(v => rows.push({
      date: v.date, kind: t(col === 'receipts' ? 'receiptVoucher' : 'paymentVoucher'), number: v.number, party: partyName(pc, v[pk]), amount: +v.amount || 0, method: t('opt_' + v.method),
      invoices: (v.alloc || []).map(a => { const d = DB.get(dc, a.docId); return d ? `${d.number} (${money(a.amount)})` : ''; }).filter(Boolean).join('، ') || t('oldestFirst'), user: v.user || '', col, id: v.id })));
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  if (tab === 'adjustments') return DB.all('adjustments').filter(inR).map(a => ({ date: a.date, number: a.number, product: prodName(a.productId), qty: +a.qty, dir: t(+a.qty > 0 ? 'adjIn' : 'adjOut'), reason: t('opt_' + a.reason), value: round(Math.abs(+a.qty) * (+DB.get('products', a.productId)?.cost || 0)), notes: a.notes || '', user: a.user || '' })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (tab === 'closings') return DB.all('closings').slice().sort((a, b) => b.date.localeCompare(a.date)).map(c => ({ date: c.date, number: c.number, year: c.year, stock: c.stockValue, recv: c.receivables, pay: c.payables, cash: c.cash, bank: c.bank, user: c.user || '' }));
  return [];
}
const LOG_COLS = {
  returns: [['date', 'f_date'], ['kind', 'f_type'], ['number', 'f_number'], ['ref', 'returnOf'], ['party', 'partyLbl'], ['product', 'f_productId'], ['qty', 'f_qty'], ['value', 'f_amount'], ['refund', 'refundAmount'], ['user', 'byUser']],
  debts: [['date', 'f_date'], ['kind', 'f_type'], ['number', 'f_number'], ['party', 'partyLbl'], ['amount', 'f_amount'], ['method', 'f_method'], ['invoices', 'settledInvoices'], ['user', 'byUser']],
  adjustments: [['date', 'f_date'], ['number', 'f_number'], ['product', 'f_productId'], ['dir', 'f_type'], ['qty', 'f_qty'], ['reason', 'f_reason'], ['value', 'valueAtCost'], ['notes', 'f_notes'], ['user', 'byUser']],
  closings: [['date', 'f_date'], ['number', 'f_number'], ['year', 'yearLbl'], ['stock', 'fpInventory'], ['recv', 'fpReceivable'], ['pay', 'fpPayable'], ['cash', 'acc_cash'], ['bank', 'acc_bank'], ['user', 'byUser']],
};
const LOG_MONEY = ['value', 'refund', 'amount', 'stock', 'recv', 'pay', 'cash', 'bank'];
function logCell(k, v) { if (v === '' || v == null) return ''; if (LOG_MONEY.includes(k)) return fmtMoney(v); if (k === 'qty') return `<b class="${v < 0 ? 'neg' : 'pos'}">${v > 0 && LOG._tab === 'adjustments' ? '+' : ''}${fmtNum(v, 3)}</b>`; if (k === 'date') return v ? fmtDate(v) : '—'; return esc(v); }
function logData(p) {
  const tab = LOG_COLS[p.tab] ? p.tab : 'returns'; const per = p.period || 'year';
  const [from, to] = per === 'all' ? ['', ''] : per === 'custom' ? [p.from || '', p.to || ''] : periodRange(per);
  let rows = logRows(tab, from, to); const q = norm(LOG.q).trim();
  if (q) rows = rows.filter(r => Object.values(r).some(v => norm(String(v ?? '')).includes(q)));
  return { tab, per, from, to, rows, cols: LOG_COLS[tab] };
}
function renderLogs(p) {
  const { tab, per, from, to, rows, cols } = logData(p); LOG._tab = tab;
  const tabs = ['returns', 'debts', 'adjustments', 'closings'];
  const tot = tab === 'returns' ? [[t('total'), sum(rows, r => r.value)], [t('refundAmount'), sum(rows, r => +r.refund || 0)]] : tab === 'debts' ? [[t('total'), sum(rows, r => r.amount)]] : tab === 'adjustments' ? [[t('adjIn'), sum(rows.filter(r => r.qty > 0), r => r.value)], [t('adjOut'), sum(rows.filter(r => r.qty < 0), r => r.value)]] : [];
  return `${pageHead(t('nav_logs'), t('sub_logs'), `<button class="btn ghost" data-act="log-print" data-tab="${tab}">${icon('printer')}<span>${t('print')}</span></button>
      <button class="btn ghost" data-act="log-xlsx" data-tab="${tab}">${icon('download')}<span>Excel</span></button><button class="btn ghost" data-act="log-docx" data-tab="${tab}">${icon('file')}<span>Word</span></button>
      ${tab === 'closings' && USER.role === 'admin' ? `<button class="btn primary" data-act="year-close">${icon('vault')}<span>${t('yearClose')}</span></button>` : ''}`)}
    <div class="card"><div class="toolbar"><div class="tabs">${tabs.map(x => `<a class="tab ${tab === x ? 'on' : ''}" href="#/logs?tab=${x}&period=${per}">${t('log_' + x)}</a>`).join('')}</div></div>
      <div class="toolbar"><div class="search">${icon('search')}<input class="input" placeholder="${t('search')}…" value="${esc(LOG.q)}" data-inp="log-search"></div>
        <select class="input sm" data-chg="nav-param" data-param="period">${['today', 'week', 'month', 'lastMonth', 'year', 'all', 'custom'].map(x => `<option value="${x}" ${per === x ? 'selected' : ''}>${t('per_' + x)}</option>`).join('')}</select>
        ${per === 'custom' ? `<input class="input sm" type="date" value="${from}" data-chg="nav-param" data-param="from"><input class="input sm" type="date" value="${to}" data-chg="nav-param" data-param="to">` : ''}</div>
      ${tot.length ? `<div class="summary">${tot.map(([l, v]) => `<div class="sum-item"><span>${esc(l)}</span><b>${fmtMoney(v)}</b></div>`).join('')}<div class="sum-item"><span>${t('count')}</span><b>${fmtNum(rows.length)}</b></div></div>` : ''}
      <div id="log-table">${rows.length ? `<div class="table-wrap"><table class="table compact"><thead><tr>${cols.map(([, l]) => `<th>${t(l)}</th>`).join('')}</tr></thead><tbody>
        ${rows.slice(0, 1000).map(r => `<tr>${cols.map(([k]) => `<td class="${['number', 'ref'].includes(k) ? 'ltr' : ''}">${k === 'number' && r.link ? `<a class="link" href="${r.link}">${esc(r.number)}</a>` : k === 'number' && r.col ? `<a class="link" href="#" data-act="voucher-print" data-col="${r.col}" data-id="${r.id}">${esc(r.number)}</a>` : logCell(k, r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : emptyState(t('noData'))}</div></div>`;
}
function logExport(tab, how) {
  const { rows, cols } = logData({ ...parseHash().params, tab });
  const heads = cols.map(([, l]) => t(l)); const data = rows.map(r => cols.map(([k]) => (k === 'date' ? (r.date ? fmtDate(r.date) : '') : r[k] ?? '')));
  if (how === 'xlsx') exportCSV('log-' + tab, heads, data, { sheet: t('log_' + tab), title: t('log_' + tab) });
  else if (how === 'docx') exportWord('log-' + tab, t('log_' + tab), heads, data);
  else printHTML(`${printHeader(t('log_' + tab), `${fmtNum(rows.length)} ${t('records')}`)}<table class="ptable small"><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(([k]) => `<td>${logCell(k, r[k]).replace(/<[^>]+>/g, '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`, cols.length > 6 ? 'land-mode' : '');
}

/* ================= Double-entry journal & trial balance ================= */
const ACCOUNTS = [['cash', 'asset'], ['bank', 'asset'], ['ar', 'asset'], ['inventory', 'asset'], ['ap', 'liability'], ['tax', 'liability'], ['capital', 'equity'], ['sales', 'revenue'], ['salesDisc', 'revenue'], ['cogs', 'expense'], ['expenses', 'expense'], ['invDiff', 'expense']];
function journal() {
  return memo('journal', () => {
    const J = []; const st = S();
    const E = (date, ref, desc, lines, link) => { const ls = lines.filter(l => Math.abs(l[1]) > 0.0005 || Math.abs(l[2]) > 0.0005).map(([acc, dr, cr]) => ({ acc, dr: round(dr), cr: round(cr) })); if (ls.length) J.push({ date, ref, desc, lines: ls, link }); };
    const acc = m => accountOf(m);
    // opening balances
    E('', '', t('openingBalance') + ' — ' + t('acc_cash'), [['cash', +st.openingCash || 0, 0], ['capital', 0, +st.openingCash || 0]]);
    E('', '', t('openingBalance') + ' — ' + t('acc_bank'), [['bank', +st.openingBank || 0, 0], ['capital', 0, +st.openingBank || 0]]);
    const inv0 = round(sum(DB.all('products').filter(isStock), p => (+p.openingQty || 0) * (+p.cost || 0)));
    E('', '', t('openingBalance') + ' — ' + t('jacc_inventory'), [['inventory', inv0, 0], ['capital', 0, inv0]]);
    DB.all('customers').forEach(c => { const b = +c.openingBalance || 0; if (b) E('', c.code || '', `${t('openingBalance')} — ${loc(c)}`, b > 0 ? [['ar', b, 0], ['capital', 0, b]] : [['capital', -b, 0], ['ar', 0, -b]]); });
    DB.all('suppliers').forEach(c => { const b = +c.openingBalance || 0; if (b) E('', c.code || '', `${t('openingBalance')} — ${loc(c)}`, b > 0 ? [['capital', b, 0], ['ap', 0, b]] : [['ap', -b, 0], ['capital', 0, -b]]); });
    liveDocs('sales').forEach(d => {
      const tt = docTotals(d), C = docCost(d), P = +d.paid || 0, who = partyName('customers', d.customerId), link = `#/doc/sales/${d.id}`;
      if (d.type === 'return') {
        E(d.date, d.number, `${t('salesReturn')} — ${who}`, [['sales', tt.sub, 0], ['salesDisc', 0, tt.disc], ['tax', tt.tax, 0], ['ar', 0, tt.total], ['inventory', C, 0], ['cogs', 0, C]], link);
        E(d.date, d.number, `${t('refund')} — ${who}`, [['ar', P, 0], [acc(d.method), 0, P]], link);
      } else {
        E(d.date, d.number, `${t('salesInvoice')} — ${who}`, [['ar', tt.total, 0], ['salesDisc', tt.disc, 0], ['sales', 0, tt.sub], ['tax', 0, tt.tax], ['cogs', C, 0], ['inventory', 0, C]], link);
        E(d.date, d.number, `${t('paidOnInvoice')} — ${who}`, [[acc(d.method), P, 0], ['ar', 0, P]], link);
      }
    });
    liveDocs('purchases').forEach(d => {
      const tt = docTotals(d), P = +d.paid || 0, who = partyName('suppliers', d.supplierId), link = `#/doc/purchases/${d.id}`;
      if (d.type === 'return') {
        E(d.date, d.number, `${t('purchaseReturn')} — ${who}`, [['ap', tt.total, 0], ['inventory', 0, tt.after], ['tax', 0, tt.tax]], link);
        E(d.date, d.number, `${t('refund')} — ${who}`, [[acc(d.method), P, 0], ['ap', 0, P]], link);
      } else {
        E(d.date, d.number, `${t('purchaseInvoice')} — ${who}`, [['inventory', tt.after, 0], ['tax', tt.tax, 0], ['ap', 0, tt.total]], link);
        E(d.date, d.number, `${t('paidOnInvoice')} — ${who}`, [['ap', P, 0], [acc(d.method), 0, P]], link);
      }
    });
    DB.all('receipts').forEach(r => E(r.date, r.number, `${t('receiptVoucher')} — ${partyName('customers', r.customerId)}`, [[acc(r.method), +r.amount || 0, 0], ['ar', 0, +r.amount || 0]]));
    DB.all('disbursements').forEach(r => E(r.date, r.number, `${t('paymentVoucher')} — ${partyName('suppliers', r.supplierId)}`, [['ap', +r.amount || 0, 0], [acc(r.method), 0, +r.amount || 0]]));
    DB.all('expenses').forEach(e => E(e.date, e.number, `${t('expense')} — ${t('opt_' + e.category)}${e.description ? ' — ' + e.description : ''}`, [['expenses', +e.amount || 0, 0], [acc(e.method), 0, +e.amount || 0]]));
    DB.all('cashMoves').forEach(c => { const a = +c.amount || 0; E(c.date, c.number, `${t('opt_move_' + c.type)}${c.notes ? ' — ' + c.notes : ''}`, c.type === 'in' ? [[c.account, a, 0], ['capital', 0, a]] : [['capital', a, 0], [c.account, 0, a]]); });
    DB.all('adjustments').forEach(a => { const v = round(Math.abs(+a.qty || 0) * (+DB.get('products', a.productId)?.cost || 0)); E(a.date, a.number, `${t('ent_adjustments')} — ${prodName(a.productId)}`, +a.qty > 0 ? [['inventory', v, 0], ['invDiff', 0, v]] : [['invDiff', v, 0], ['inventory', 0, v]]); });
    return J.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  });
}
function trialBalance(to) {
  const tb = Object.fromEntries(ACCOUNTS.map(([k]) => [k, { dr: 0, cr: 0 }]));
  journal().filter(e => !to || (e.date || '') <= to).forEach(e => e.lines.forEach(l => { tb[l.acc].dr += l.dr; tb[l.acc].cr += l.cr; }));
  return ACCOUNTS.map(([k, type]) => ({ k, type, dr: round(tb[k].dr), cr: round(tb[k].cr), bal: round(tb[k].dr - tb[k].cr) }));
}
function renderAccounts(p) {
  const tab = p.tab === 'journal' ? 'journal' : 'trial'; const per = p.period || 'year';
  const [from, to] = per === 'all' ? ['', ''] : per === 'custom' ? [p.from || '', p.to || today()] : periodRange(per);
  const tabs = `<div class="tabs"><a class="tab ${tab === 'trial' ? 'on' : ''}" href="#/accounts?tab=trial">${t('trialBalance')}</a><a class="tab ${tab === 'journal' ? 'on' : ''}" href="#/accounts?tab=journal&period=${per}">${t('journalBook')}</a></div>`;
  if (tab === 'trial') {
    const asOf = p.to || today(); const rows = trialBalance(asOf); const dr = round(sum(rows, r => r.dr)), cr = round(sum(rows, r => r.cr)); const ok = Math.abs(dr - cr) < 0.01;
    return `${pageHead(t('nav_accounts'), t('sub_accounts'), `<button class="btn ghost" data-act="acc-export" data-how="print">${icon('printer')}<span>${t('print')}</span></button><button class="btn ghost" data-act="acc-export" data-how="xlsx">${icon('download')}<span>Excel</span></button><button class="btn ghost" data-act="acc-export" data-how="docx">${icon('file')}<span>Word</span></button>`)}
      <div class="card"><div class="toolbar">${tabs}<span class="grow"></span><label class="sel"><span>${t('asOf')}</span><input class="input sm" type="date" value="${asOf}" data-chg="nav-param" data-param="to"></label></div>
      <div class="table-wrap"><table class="table compact"><thead><tr><th>${t('fpAccount')}</th><th>${t('accType')}</th><th>${t('debitTotal')}</th><th>${t('creditTotal')}</th><th>${t('f_balance')}</th><th>${t('fpDirection')}</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${t('jacc_' + r.k)}</b></td><td><small class="muted">${t('acct_' + r.type)}</small></td><td>${fmtMoney(r.dr)}</td><td>${fmtMoney(r.cr)}</td><td><b>${fmtMoney(Math.abs(r.bal))}</b></td><td>${Math.abs(r.bal) < 0.0005 ? '—' : badge(r.bal > 0 ? 'active' : 'partial', t(r.bal > 0 ? 'debit' : 'credit'))}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="2">${t('total')}</td><td>${fmtMoney(dr)}</td><td>${fmtMoney(cr)}</td><td colspan="2">${ok ? badge('paid', '✓ ' + t('balancedTB')) : badge('overdue', t('unbalancedTB'))}</td></tr></tbody></table></div>
      <p class="hint">${t('trialHint')}</p></div>`;
  }
  const all = journal().filter(e => (!from || (e.date || '') >= from) && (!to || (e.date || '') <= to)).reverse(); const pg = Math.max(1, +p.page || 1); const per100 = 60; const pages = Math.max(1, Math.ceil(all.length / per100));
  const list = all.slice((pg - 1) * per100, pg * per100);
  return `${pageHead(t('nav_accounts'), t('sub_accounts'), `<button class="btn ghost" data-act="acc-export" data-how="xlsx">${icon('download')}<span>Excel</span></button>`)}
    <div class="card"><div class="toolbar">${tabs}<span class="grow"></span><select class="input sm" data-chg="nav-param" data-param="period">${['today', 'week', 'month', 'lastMonth', 'year', 'all'].map(x => `<option value="${x}" ${per === x ? 'selected' : ''}>${t('per_' + x)}</option>`).join('')}</select></div>
    ${list.length ? `<div class="table-wrap"><table class="table compact jr"><thead><tr><th>${t('f_date')}</th><th>${t('ref')}</th><th>${t('f_description')}</th><th>${t('fpAccount')}</th><th>${t('debit')}</th><th>${t('credit')}</th></tr></thead><tbody>
      ${list.map(e => e.lines.map((l, i) => `<tr class="${i === 0 ? 'jr-first' : 'jr-next'}">${i === 0 ? `<td>${e.date ? fmtDate(e.date) : '—'}</td><td class="ltr">${e.link ? `<a class="link" href="${e.link}">${esc(e.ref)}</a>` : esc(e.ref)}</td><td>${esc(e.desc)}</td>` : '<td></td><td></td><td></td>'}<td class="${l.cr ? 'jr-cr' : ''}">${t('jacc_' + l.acc)}</td><td>${l.dr ? fmtMoney(l.dr) : ''}</td><td>${l.cr ? fmtMoney(l.cr) : ''}</td></tr>`).join('')).join('')}</tbody></table></div>
      <div class="pager"><span>${fmtNum(all.length)} ${t('entriesLbl')}</span><div>${pages > 1 ? `<a class="icon-btn" href="#/accounts?tab=journal&period=${per}&page=${Math.max(1, pg - 1)}">${icon(LANG === 'ar' ? 'chevR' : 'chevL')}</a><b>${fmtNum(pg)} / ${fmtNum(pages)}</b><a class="icon-btn" href="#/accounts?tab=journal&period=${per}&page=${Math.min(pages, pg + 1)}">${icon(LANG === 'ar' ? 'chevL' : 'chevR')}</a>` : ''}</div></div>` : emptyState(t('noData'))}</div>`;
}
function accountsExport(how) {
  const p = parseHash().params;
  if (p.tab === 'journal') {
    const per = p.period || 'year'; const [from, to] = per === 'all' ? ['', ''] : periodRange(per); const rows = [];
    journal().filter(e => (!from || (e.date || '') >= from) && (!to || (e.date || '') <= to)).forEach(e => e.lines.forEach(l => rows.push([e.date ? fmtDate(e.date) : '', e.ref, e.desc, t('jacc_' + l.acc), l.dr || '', l.cr || ''])));
    return exportCSV('journal', [t('f_date'), t('ref'), t('f_description'), t('fpAccount'), t('debit'), t('credit')], rows, { sheet: t('journalBook') });
  }
  const rows = trialBalance(p.to || today()); const heads = [t('fpAccount'), t('accType'), t('debitTotal'), t('creditTotal'), t('f_balance'), t('fpDirection')];
  const data = rows.map(r => [t('jacc_' + r.k), t('acct_' + r.type), r.dr, r.cr, Math.abs(r.bal), Math.abs(r.bal) < 0.0005 ? '' : t(r.bal > 0 ? 'debit' : 'credit')]); const totals = [t('total'), '', round(sum(rows, r => r.dr)), round(sum(rows, r => r.cr)), '', ''];
  if (how === 'xlsx') exportCSV('trial-balance', heads, data, { sheet: t('trialBalance'), title: `${t('trialBalance')} — ${fmtDate(p.to || today())}`, totals });
  else if (how === 'docx') exportWord('trial-balance', t('trialBalance'), heads, data, { sub: fmtDate(p.to || today()), totals });
  else printHTML(`${printHeader(t('trialBalance'), fmtDate(p.to || today()))}<table class="ptable"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${data.map(r => `<tr>${r.map(v => `<td>${typeof v === 'number' ? money(v) : esc(v)}</td>`).join('')}</tr>`).join('')}<tr><td><b>${t('total')}</b></td><td></td><td><b>${money(totals[2])}</b></td><td><b>${money(totals[3])}</b></td><td></td><td></td></tr></tbody></table>`);
}

/* ================= Yearly closing + no movements while a stock count is open ================= */
function movementBlocked() { return openCount() ? t('errCountOpen') : ''; }
function yearCloseDialog() {
  if (movementBlocked()) return toast(movementBlocked(), 'err');
  const v = { stockValue: round(sum(DB.all('products').filter(isStock), p => Math.max(0, stockOf(p.id)) * (+p.cost || 0))), receivables: round(sum(DB.all('customers'), c => Math.max(0, customerBalance(c.id)))),
    payables: round(sum(DB.all('suppliers'), c => Math.max(0, supplierBalance(c.id)))), cash: accountBalance('cash'), bank: accountBalance('bank') };
  const lastCount = DB.all('stockCounts').filter(c => c.status === 'posted').sort((a, b) => b.date.localeCompare(a.date))[0];
  const root = modal({ title: t('yearClose'), size: 'sm',
    body: `<form id="yc-form" class="form-grid one"><p class="hint">${t('yearCloseHint')}</p>${lastCount ? '' : `<p class="note-warn">${t('yearCloseNoCount')}</p>`}
      <div class="info-grid"><div><span>${t('fpInventory')}</span><b>${fmtMoney(v.stockValue)}</b></div><div><span>${t('fpReceivable')}</span><b>${fmtMoney(v.receivables)}</b></div><div><span>${t('fpPayable')}</span><b>${fmtMoney(v.payables)}</b></div><div><span>${t('acc_cash')}</span><b>${fmtMoney(v.cash)}</b></div><div><span>${t('acc_bank')}</span><b>${fmtMoney(v.bank)}</b></div></div>
      <label class="field"><span>${t('yearLbl')}</span><input class="input" name="year" value="${today().slice(0, 4)}" dir="ltr" required></label>${pwField('pw', t('adminPassword'), 'required')}<div class="form-err" hidden></div></form>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn primary" type="submit" form="yc-form">${icon('vault')}<span>${t('yearClose')}</span></button>` });
  $('[data-x2]', root).onclick = closeModal;
  $('#yc-form', root).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    if (!(await checkPassword(USER, f.pw.value))) { const b = $('.form-err', f); b.hidden = false; b.textContent = t('wrongPassword'); return; }
    DB.insert('closings', { number: DB.nextCode('closings', 'number', 'CLS'), date: today(), year: f.year.value.trim(), ...v, countId: lastCount ? lastCount.id : '', user: USER.username });
    closeModal(); toast(t('yearClosed')); location.hash = '#/logs?tab=closings&period=all';
  });
}

/* ================= Quick item buttons (for items without a barcode) ================= */
function quickGroupsDialog(sel) {
  const groups = DB.all('quickGroups'); let cur = sel || (groups[0] && groups[0].id) || ''; let q = '';
  const root = modal({ title: t('quickButtons'), size: 'xl', body: '<div id="qg-body"></div>', footer: `<button class="btn primary" data-x2>${icon('check')}<span>${t('closeLbl')}</span></button>` });
  $('[data-x2]', root).onclick = () => { closeModal(); render(); };
  const paint = () => {
    const g = DB.get('quickGroups', cur); const prods = DB.all('products').filter(p => p.active !== false && (!q || norm(loc(p)).includes(norm(q)) || String(p.code).toLowerCase().includes(q.toLowerCase())));
    $('#qg-body', root).innerHTML = `<div class="qg-wrap"><div class="qg-groups"><b>${t('mainButtons')}</b>${DB.all('quickGroups').map(x => `<button type="button" class="qg-g ${x.id === cur ? 'on' : ''}" data-g="${x.id}" style="--c:${x.color || '#059669'}">${esc(x.name)} <small>(${fmtNum((x.items || []).length)})</small></button>`).join('')}
        <button type="button" class="btn ghost sm" data-qa="add">${icon('plus')}<span>${t('addButton')}</span></button></div>
      <div class="qg-items">${g ? `<div class="form-grid three"><label class="field"><span>${t('buttonName')}</span><input class="input" data-qf="name" value="${esc(g.name)}"></label><label class="field"><span>${t('f_accent')}</span><input class="input color" type="color" data-qf="color" value="${esc(g.color || '#059669')}"></label>
          <div class="field"><span>&nbsp;</span><button type="button" class="btn ghost danger-t" data-qa="del">${icon('trash')}<span>${t('delete')}</span></button></div></div>
        <div class="search">${icon('search')}<input class="input" data-qf="q" placeholder="${t('search')}…" value="${esc(q)}"></div>
        <div class="qg-pick">${prods.slice(0, 300).map(p => `<label class="qg-p ${(g.items || []).includes(p.id) ? 'on' : ''}"><input type="checkbox" data-p="${p.id}" ${(g.items || []).includes(p.id) ? 'checked' : ''}><span>${esc(loc(p))}</span><small>${fmtMoney(p.price)}</small></label>`).join('')}</div>` : emptyState(t('noQuickButtons'), 'grid')}</div></div>`;
  };
  root.addEventListener('click', e => {
    const gb = e.target.closest('[data-g]'); if (gb) { cur = gb.dataset.g; paint(); return; }
    const a = e.target.closest('[data-qa]'); if (!a) return;
    if (a.dataset.qa === 'add') { const g = DB.insert('quickGroups', { name: `${t('buttonName')} ${DB.all('quickGroups').length + 1}`, color: PALETTE[DB.all('quickGroups').length % PALETTE.length], items: [] }); cur = g.id; paint(); }
    if (a.dataset.qa === 'del') confirmBox(t('deleteButtonQ'), () => { DB.remove('quickGroups', cur); cur = (DB.all('quickGroups')[0] || {}).id || ''; quickGroupsDialog(cur); });
  });
  root.addEventListener('change', e => {
    const g = DB.get('quickGroups', cur); if (!g) return;
    if (e.target.dataset.p) { const id = e.target.dataset.p; g.items = (g.items || []).filter(x => x !== id); if (e.target.checked) g.items.push(id); e.target.closest('label').classList.toggle('on', e.target.checked); DB.save(); const b = $(`[data-g="${cur}"] small`, root); if (b) b.textContent = `(${fmtNum(g.items.length)})`; }
    else if (e.target.dataset.qf === 'name') { g.name = e.target.value.trim() || g.name; DB.save(); paint(); }
    else if (e.target.dataset.qf === 'color') { g.color = e.target.value; DB.save(); paint(); }
  });
  root.addEventListener('input', e => { if (e.target.dataset.qf === 'q') { q = e.target.value; const pos = e.target.selectionStart; paint(); const i = $('[data-qf="q"]', root); i.focus(); i.setSelectionRange(pos, pos); } });
  paint();
}
function salesPrefix() { const p = String(S().invoicePrefix || 'S').toUpperCase().replace(/[^A-Z]/g, ''); return p || 'S'; }

/* ================= Printing: chosen printers, silent printing =================
   printer choices belong to this computer (not the shared database): each computer has its own printers */
const PP_KEY = 'dalala_print_prefs';
function PP() { try { return JSON.parse(localStorage.getItem(PP_KEY) || '{}'); } catch (e) { return {}; } }
function savePP(o) { try { localStorage.setItem(PP_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } }
const _printHTMLv22 = printHTML;
printHTML = function (html, mode = '') { // eslint-disable-line no-global-assign
  const st = PP(); const dev = mode === 'rcpt-mode' ? st.receiptPrinter : mode === 'labels-mode' ? st.labelPrinter : st.a4Printer;
  if (window.dalalaPrint && st.silentPrint && dev) { silentPrint(html, mode, dev); return; }
  _printHTMLv22(html, mode);
};
async function silentPrint(html, mode, deviceName) {
  const pa = $('#print-area'); pa.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr'); pa.innerHTML = html;
  document.body.classList.add('printing'); if (mode) document.body.classList.add(mode);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let res = { ok: false }; try { const ps = window.__pageSize; res = await window.dalalaPrint.run({ deviceName, silent: true, receipt: mode === 'rcpt-mode', pageSize: ps ? { width: Math.round(ps.W * 1000), height: Math.round(ps.H * 1000) } : (mode ? undefined : 'A4') }); } catch (e) { res = { ok: false, error: e.message }; }
  document.body.classList.remove('printing'); if (mode) document.body.classList.remove(mode); pa.innerHTML = '';
  if (res.ok) toast(`${t('printedOn')} ${deviceName}`); else { toast(`${t('printFailed')}: ${res.error || deviceName}`, 'err'); _printHTMLv22(html, mode); }
}
function printSettingsCard() {
  const st = { ...PP(), invoicePrefix: S().invoicePrefix }; const desk = !!window.dalalaPrint;
  const sel = (k, label) => `<label class="field"><span>${label}</span><select class="input" id="pr-${k}" data-cur="${esc(st[k] || '')}"><option value="">${t('systemDialog')}</option>${st[k] ? `<option selected>${esc(st[k])}</option>` : ''}</select></label>`;
  return card(`${icon('printer')} ${t('printingSettings')}`, `<div class="form-grid">
      ${desk ? `${sel('receiptPrinter', t('receiptPrinter'))}${sel('a4Printer', t('a4Printer'))}${sel('labelPrinter', t('labelPrinter'))}
      <label class="field row"><input type="checkbox" id="pr-silent" ${st.silentPrint ? 'checked' : ''}><span>${t('silentPrint')}</span></label>` : ''}
      <label class="field"><span>${t('paperWidth')}</span><select class="input" id="pr-paper">${[80, 58].map(w => `<option value="${w}" ${(+st.paperWidth || 80) === w ? 'selected' : ''}>${w} ${t('mmLbl')}</option>`).join('')}</select></label>
      <label class="field row"><input type="checkbox" id="pr-auto" ${st.autoPrintReceipt ? 'checked' : ''}><span>${t('autoPrintReceipt')}</span></label>
      <label class="field row"><input type="checkbox" id="pr-open" ${st.openAfterSale ? 'checked' : ''}><span>${t('openAfterSale')}</span></label>
      <label class="field"><span>${t('f_invoicePrefix')}</span><input class="input" id="pr-prefix" value="${esc(st.invoicePrefix || 'S')}" maxlength="5" dir="ltr" pattern="[A-Za-z]{1,5}"></label></div>
    <p class="hint">${t('printingHint')}</p><div class="form-actions"><button class="btn primary" type="button" data-act="print-save">${icon('check')}<span>${t('save')}</span></button></div>`);
}
async function fillPrinters() {
  if (!window.dalalaPrint || !$('#pr-receiptPrinter')) return;
  let list = []; try { list = await window.dalalaPrint.list(); } catch (e) { list = []; }
  ['receiptPrinter', 'a4Printer', 'labelPrinter'].forEach(k => { const s = $('#pr-' + k); if (!s) return; const cur = s.dataset.cur;
    s.innerHTML = `<option value="">${t('systemDialog')}</option>${list.map(p => `<option ${p.name === cur ? 'selected' : ''} value="${esc(p.name)}">${esc(p.displayName || p.name)}${p.isDefault ? ` (${t('defaultLbl')})` : ''}</option>`).join('')}${cur && !list.some(p => p.name === cur) ? `<option selected value="${esc(cur)}">${esc(cur)}</option>` : ''}`; });
}

/* ================= Automatic backups (desktop) ================= */
async function backupNow(tag) {
  if (!window.dalalaBackup || !DB.d || DB.fresh) return false;
  try { return await window.dalalaBackup.save(tag, JSON.stringify(DB.d)); } catch (e) { return false; }
}
function autoBackup() {
  if (!window.dalalaBackup || DB.fresh || (typeof NETCFG !== 'undefined' && NETCFG.mode === 'client')) return;
  const k = 'dalala_last_autobackup'; let last = ''; try { last = localStorage.getItem(k) || ''; } catch (e) { /* ignore */ }
  if (last === today()) return;
  backupNow('auto-' + today()).then(ok => { if (ok) try { localStorage.setItem(k, today()); } catch (e) { /* ignore */ } });
}
setInterval(autoBackup, 30 * 60000);
function backupsCard() {
  if (!window.dalalaBackup || USER.role !== 'admin') return '';
  return card(`${icon('download')} ${t('autoBackups')}`, `<p class="hint">${t('autoBackupsHint')}</p><div id="bk-list">${t('loading')}…</div>
    <div class="btn-row"><button class="btn ghost" data-act="bk-now">${icon('download')}<span>${t('backupNowDisk')}</span></button><button class="btn ghost" data-act="bk-open">${icon('file')}<span>${t('openFolder')}</span></button></div>`);
}
async function fillBackups() {
  const box = $('#bk-list'); if (!box || !window.dalalaBackup) return;
  let list = []; try { list = await window.dalalaBackup.list(); } catch (e) { list = []; }
  box.innerHTML = list.length ? `<ul class="list">${list.slice(0, 15).map(b => `<li>${icon('file')}<div><b class="ltr">${esc(b.name)}</b><small>${new Date(b.mtime).toLocaleString(locale())} · ${fmtNum(b.size / 1024, 0)} KB</small></div><button class="btn ghost sm" data-act="bk-restore" data-name="${esc(b.name)}">${icon('upload')}<span>${t('restore')}</span></button></li>`).join('')}</ul>` : emptyState(t('noBackups'), 'file');
}
function restoreData(d) { // shared by file restore and automatic-backup restore
  backupNow('before-restore-' + Date.now()).finally(() => { DB.d = d; DB.save(); DB.load(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); });
}

/* ================= Wrappers around existing actions ================= */
(function () {
  const _posPay = posPay; posPay = function () { const b = movementBlocked(); if (b) return toast(b, 'err'); return _posPay(); }; // eslint-disable-line no-global-assign
  const _saveDoc = saveDoc; saveDoc = function (root) { const b = movementBlocked(); if (b) { const e = $('.form-err', root); e.hidden = false; e.textContent = b; return; } return _saveDoc(root); }; // eslint-disable-line no-global-assign
  const _wo = writeOffExpired; writeOffExpired = function (pid) { const b = movementBlocked(); if (b) return toast(b, 'err'); return _wo(pid); }; // eslint-disable-line no-global-assign
  const _ny = newYearDialog; newYearDialog = function () { const b = movementBlocked(); if (b) return toast(b, 'err'); backupNow('before-new-year-' + Date.now()); return _ny(); }; // eslint-disable-line no-global-assign
  const _sr = startReturn; startReturn = function (kind, d) { // eslint-disable-line no-global-assign
    if (d && d.items.some(it => DB.get('products', it.productId)?.deleted)) { const live = { ...d, items: d.items.filter(it => !DB.get('products', it.productId)?.deleted) }; toast(t('deletedFromStock'), 'err'); if (!live.items.length) return; return _sr(kind, live); }
    return _sr(kind, d);
  };
  const _posAdd = posAdd; posAdd = function (pid, qty = 1) { if (!POS.items.some(i => i.productId === pid) && POS.items.length >= 500) return toast(t('errMaxLines'), 'err'); return _posAdd(pid, qty); }; // eslint-disable-line no-global-assign
})();

/* entity changes: product soft delete, adjustments permission + note, debts columns */
(function () {
  const P = ENT.products;
  P.blockDelete = id => { const p = DB.get('products', id); return p && isStock(p) && Math.abs(stockOf(id)) > 0.0005 ? t('errDeleteHasStock') : null; };
  P.softDelete = id => usedInDocs(id); P.hidden = r => r.deleted; P.editPerm = 'editProducts';
  P.actions.find(a => a.label === 'adjustStock').show = r => isStock(r) && hasPerm('adjustStock');
  const A = ENT.adjustments; A.editPerm = 'adjustStock';
  A.fields.find(f => f.k === 'productId').refFilter = p => isStock(p) && !p.deleted;
  const nf = A.fields.find(f => f.k === 'notes'); nf.req = 1;
  const av = A.validate; A.validate = r => movementBlocked() || av(r);
  A.tools = [{ icon: 'clipboard', label: 'log_adjustments', roles: ['admin', 'storekeeper', 'accountant'], fn: () => { location.hash = '#/logs?tab=adjustments'; } }];
  const prevAfter = A.afterSave; A.afterSave = (r, isNew) => { if (isNew && !r.user) DB.update('adjustments', r.id, { user: USER.username }); if (prevAfter) prevAfter(r, isNew); };
  ENT.receipts.editPerm = 'collect'; ENT.disbursements.editPerm = 'collect';
  ['receipts', 'disbursements'].forEach(k => { const prev = ENT[k].afterSave; ENT[k].afterSave = (r, isNew) => { if (isNew && !r.user) DB.update(k, r.id, { user: USER.username }); if (prev) prev(r, isNew); }; });
  // sales & purchases: remaining after payments, returned / net / refunded
  const returnsOf = (col, d) => DB.all(col).filter(x => x.refId === d.id);
  ['sales', 'purchases'].forEach(col => {
    const E = ENT[col]; const due = E.fields.find(f => f.k === 'due'); due.get = r => docRemaining(r);
    E.filters.find(f => f.k === 'status').opts = ['paid', 'partial', 'credit', 'debt']; E.filters.find(f => f.k === 'status').test = (r, v) => (v === 'debt' ? r.type !== 'return' && docRemaining(r) > 0.0005 : docStatus(r) === v);
    E.summary = ((prev) => rows => prev(rows).map(s => (s.label === t('f_due') ? { ...s, value: moneyText(sum(rows, d => docRemaining(d))) } : s)))(E.summary);
    E.actions.push({ icon: 'money', label: 'payDebt', show: r => r.type !== 'return' && (col === 'sales' ? r.customerId : r.supplierId) && docRemaining(r) > 0.0005 && hasPerm('collect'), fn: r => payDebtDialog(col === 'sales' ? 'c' : 's', col === 'sales' ? r.customerId : r.supplierId, r.id) });
    E.tools = [{ icon: 'undo', label: 'log_returns', roles: ['admin', 'cashier', 'accountant', 'storekeeper'], fn: () => { location.hash = '#/logs?tab=returns'; } }, { icon: 'money', label: 'log_debts', roles: ['admin', 'cashier', 'accountant', 'storekeeper'], fn: () => { location.hash = '#/logs?tab=debts'; } }];
  });
  const PU = ENT.purchases; const ti = PU.fields.findIndex(f => f.k === 'total');
  PU.fields.splice(ti + 1, 0,
    { k: 'returnedAmt', type: 'calc', money: 1, list: 1, get: r => (r.type === 'return' ? 0 : round(sum(returnsOf('purchases', r), docTotal))) },
    { k: 'netAmt', type: 'calc', money: 1, list: 1, get: r => (r.type === 'return' ? 0 : round(docTotal(r) - sum(returnsOf('purchases', r), docTotal))) },
    { k: 'refundedAmt', type: 'calc', money: 1, list: 1, get: r => (r.type === 'return' ? 0 : round(sum(returnsOf('purchases', r), x => +x.paid || 0))) });
  PU.actions.find(a => a.label === 'makeReturn').show = r => r.type === 'purchase' && hasPerm('purchaseReturns');
  ['customers', 'suppliers'].forEach(col => ENT[col].actions = [...(ENT[col].actions || []), { icon: 'money', label: 'payDebt', show: r => (col === 'customers' ? customerBalance(r.id) : supplierBalance(r.id)) > 0.0005 && hasPerm('collect'), fn: r => payDebtDialog(col === 'customers' ? 'c' : 's', r.id) }]);
})();

const ACT_V22 = {
  'pos-full': () => { POS.paid = String(posTotals().total); if (POS.method === 'credit') POS.method = 'cash'; refreshPOS(false); },
  'pos-qg-edit': () => quickGroupsDialog(),
  'pos-recent': el => { location.hash = `#/doc/sales/${el.dataset.id}`; },
  'pos-recent-edit': el => startEdit('sales', DB.get('sales', el.dataset.id)),
  'pay-debt': el => payDebtDialog(el.dataset.k, el.dataset.pid, el.dataset.doc),
  'voucher-print': el => printVoucher(el.dataset.col, DB.get(el.dataset.col, el.dataset.id)),
  'log-print': el => logExport(el.dataset.tab, 'print'), 'log-xlsx': el => logExport(el.dataset.tab, 'xlsx'), 'log-docx': el => logExport(el.dataset.tab, 'docx'),
  'acc-export': el => accountsExport(el.dataset.how),
  'year-close': () => yearCloseDialog(),
  'crud-word': el => { const k = el.dataset.key; const cols = ENT[k].fields.filter(f => f.list); exportWord(k, t('nav_' + k), cols.map(fieldLabel), crudRows(k).map(r => cols.map(f => cellText(f, r))), { sub: typeof crudInfo === 'function' ? crudInfo(k).join(' · ') : '' }); },
  'rep-xlsx': el => reportWorkbook(el.dataset.from, el.dataset.to),
  'print-save': () => {
    const pp = PP(); ['receiptPrinter', 'a4Printer', 'labelPrinter'].forEach(k => { const s = $('#pr-' + k); if (s) pp[k] = s.value; });
    if ($('#pr-silent')) pp.silentPrint = $('#pr-silent').checked; pp.autoPrintReceipt = $('#pr-auto').checked; pp.paperWidth = +$('#pr-paper').value || 80; pp.openAfterSale = $('#pr-open').checked;
    const px = $('#pr-prefix').value.trim().toUpperCase(); if (!/^[A-Z]{1,5}$/.test(px)) return toast(t('errPrefix'), 'err');
    savePP(pp); if (S().invoicePrefix !== px) { S().invoicePrefix = px; DB.save(); } toast(t('saved')); render();
  },
  'bk-now': async () => { toast((await backupNow('manual-' + today() + '-' + Date.now().toString(36))) ? t('backupSaved') : t('backupFailed'), 'ok'); fillBackups(); },
  'bk-open': () => window.dalalaBackup && window.dalalaBackup.open(),
  'bk-restore': el => confirmBox(t('restoreConfirm'), async () => { try { const d = JSON.parse(await window.dalalaBackup.read(el.dataset.name)); if (!d.version || !Array.isArray(d.products)) throw new Error('bad'); restoreData(d); } catch (e) { toast(t('invalidFile'), 'err'); } }),
};
const INP_V22 = { 'log-search': el => { LOG.q = el.value; clearTimeout(LOG.t); LOG.t = setTimeout(() => { const pos = el.selectionStart; render(); const i = $('[data-inp="log-search"]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 250); } };

/* formatted Excel report: summary, days, invoices & profit, products */
function reportWorkbook(from, to) {
  const pr = profitFor(from, to); const sales = salesIn(from, to);
  const days = {}; sales.forEach(d => { const o = days[d.date] = days[d.date] || { n: 0, total: 0, paid: 0, due: 0, profit: 0 }; const s = sign(d); if (d.type === 'sale') o.n++; o.total += s * docTotal(d); o.paid += s * (+d.paid || 0); o.due += d.type === 'sale' ? docRemaining(d) : 0; o.profit += s * (docTotals(d).after - docCost(d)); });
  const prod = {}; sales.forEach(d => d.items.forEach(it => { const o = prod[it.productId] = prod[it.productId] || { qty: 0, rev: 0, cost: 0 }; o.qty += sign(d) * it.qty; o.rev += sign(d) * lineTotal(it); o.cost += sign(d) * it.qty * (it.cost || 0); }));
  const purch = DB.all('purchases').filter(d => d.date >= from && d.date <= to);
  OFFICE.xlsx(`report-${from}-${to}`, [
    { name: t('summaryLbl'), title: `${t('nav_reports')} ${fmtDate(from)} → ${fmtDate(to)}`, headers: [t('item'), t('f_amount')], rows: [[t('revenue'), pr.revenue], [t('cogs'), pr.cogs], [t('grossProfit'), pr.gross], [t('nav_expenses'), pr.expenses], [t('netProfit'), pr.net], [t('invoicesCount'), pr.count], [t('collected'), round(sum(sales, d => sign(d) * (+d.paid || 0)))], [t('remainingUncollected'), round(sum(sales, d => docRemaining(d)))], [t('netPurchases'), round(sum(purch, d => sign(d) * docTotal(d)))], [t('stockValueCost'), round(sum(DB.all('products').filter(isStock), p => Math.max(0, stockOf(p.id)) * (+p.cost || 0)))]] },
    { name: t('daysLbl'), headers: [t('f_date'), t('invoicesCount'), t('total'), t('collected'), t('remainingLbl'), t('profit')], rows: Object.keys(days).sort().map(k => [fmtDate(k), days[k].n, round(days[k].total), round(days[k].paid), round(days[k].due), round(days[k].profit)]), totals: [t('total'), sum(Object.values(days), o => o.n), round(sum(Object.values(days), o => o.total)), round(sum(Object.values(days), o => o.paid)), round(sum(Object.values(days), o => o.due)), round(sum(Object.values(days), o => o.profit))] },
    { name: t('invoicesProfit'), headers: [t('f_number'), t('f_date'), t('f_type'), t('f_customerId'), t('total'), t('f_paid'), t('remainingLbl'), t('profit')], rows: sales.map(d => [d.number, fmtDate(d.date), t('opt_' + d.type), partyName('customers', d.customerId), sign(d) * docTotal(d), sign(d) * (+d.paid || 0), docRemaining(d), round(sign(d) * (docTotals(d).after - docCost(d)))]) },
    { name: t('topProducts'), headers: [t('f_code'), t('f_productId'), t('f_qty'), t('revenue'), t('cogs'), t('profit')], rows: Object.entries(prod).sort((a, b) => b[1].rev - a[1].rev).map(([pid, o]) => [DB.get('products', pid)?.code || '', prodName(pid), round(o.qty), round(o.rev), round(o.cost), round(o.rev - o.cost)]) },
  ]);
}

/* ================= Barcode scanner: add the item without pressing Enter =================
   A scanner "types" the whole code in a few milliseconds (or pastes it at once). When the field
   was filled that fast and the text is exactly an item's barcode / code, it is added right away.
   Normal typing is slower, so a half-typed code never adds the wrong item (Enter still works). */
const SCAN_FIELDS = ['pos-q', 'ed-pick', 'ed-scan'];
const scanState = new WeakMap();
function scanMatch(v) { const c = String(v || '').trim(); if (c.length < 3) return null; return DB.all('products').find(x => x.active !== false && (x.barcode === c || String(x.code).toLowerCase() === c.toLowerCase())) || null; }
document.addEventListener('input', e => {
  const el = e.target; if (!el || !SCAN_FIELDS.includes(el.id)) return;
  const now = performance.now(); let st = scanState.get(el);
  if (!st || el.value.length <= 1 || now - st.last > 300) st = { first: now, last: now, len: el.value.length, jump: el.value.length > 1 }; // a new entry starts
  else { if (el.value.length - st.len > 1) st.jump = true; st.last = now; st.len = el.value.length; }
  scanState.set(el, st); clearTimeout(st.t);
  st.t = setTimeout(() => {
    const v = el.value.trim(); if (!v || !document.body.contains(el)) return;
    const fast = st.jump || (v.length >= 3 && (st.last - st.first) / Math.max(1, v.length - 1) < 35);
    if (!fast || !scanMatch(v)) return;
    scanState.delete(el);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); // same path as pressing Enter
  }, 90);
});
