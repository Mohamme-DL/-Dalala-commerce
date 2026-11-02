/* Dalala Commerce — custom pages */
'use strict';

function pageHead(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub && !String(sub).startsWith('sub_') ? `<p>${sub}</p>` : ''}</div><div class="head-actions">${actions}</div></div>`;
}
const kpi = k => `<a class="kpi ${k.c || ''}" ${k.href ? `href="${k.href}"` : ''}><div class="kpi-ic">${icon(k.ic)}</div><div class="kpi-body"><span>${k.label}</span><b>${k.val}</b>${k.sub ? `<small>${k.sub}</small>` : ''}</div></a>`;
const card = (title, body, extra = '', cls = '') => `<section class="card ${cls}"><div class="card-head"><h3>${title}</h3>${extra}</div><div class="card-body">${body}</div></section>`;
const docLabel = (kind, d) => t(kind === 'sales' ? (d.type === 'return' ? 'salesReturn' : 'salesInvoice') : (d.type === 'return' ? 'purchaseReturn' : 'purchaseInvoice'));
const prodName = id => { const p = DB.get('products', id); return p ? loc(p) : '—'; };

/* ================= Dashboard ================= */
function salesIn(from, to) { return DB.all('sales').filter(d => d.date >= from && d.date <= to); }
function renderDashboard() {
  const T = today(); const [mf] = periodRange('month');
  const todaySales = salesIn(T, T), month = salesIn(mf, T);
  const net = arr => sum(arr, d => sign(d) * docTotal(d));
  const pm = profitFor(mf, T);
  const receivable = sum(DB.all('customers'), c => Math.max(0, customerBalance(c.id)));
  const payable = sum(DB.all('suppliers'), c => Math.max(0, supplierBalance(c.id)));
  const low = lowStock();
  const kpis = [
    { ic: 'cart', label: t('salesToday'), val: moneyText(net(todaySales)), sub: `${fmtNum(todaySales.filter(d => d.type === 'sale').length)} ${t('invoicesLbl')}`, c: 'c1', href: '#/sales?period=today' },
    { ic: 'chart', label: t('salesMonth'), val: moneyText(net(month)), sub: `${fmtNum(month.filter(d => d.type === 'sale').length)} ${t('invoicesLbl')}`, c: 'c2', href: '#/reports' },
    { ic: 'sparkle', label: t('netProfitMonth'), val: moneyText(pm.net), sub: `${t('grossProfit')}: ${moneyText(pm.gross)}`, c: pm.net >= 0 ? 'c3' : 'c5', href: '#/reports' },
    { ic: 'vault', label: t('cashBalance'), val: moneyText(accountBalance('cash')), sub: `${t('acc_bank')}: ${moneyText(accountBalance('bank'))}`, c: 'c4', href: '#/treasury' },
  ];
  const minis = [
    { ic: 'arrowDown', l: t('totalReceivable'), v: moneyText(receivable), href: '#/customers' },
    { ic: 'arrowUp', l: t('totalPayable'), v: moneyText(payable), href: '#/suppliers' },
    { ic: 'alert', l: t('lowStockCount'), v: fmtNum(low.length), href: '#/products' },
    { ic: 'box', l: t('nav_products'), v: fmtNum(DB.all('products').length), href: '#/products' },
    { ic: 'users', l: t('nav_customers'), v: fmtNum(DB.all('customers').length), href: '#/customers' },
    { ic: 'truck', l: t('purchasesMonth'), v: moneyText(sum(DB.all('purchases').filter(d => d.date >= mf), d => sign(d) * docTotal(d))), href: '#/purchases' },
  ];
  const days = range(0, 13).map(i => addDays(T, i - 13));
  const trend = days.map(d => ({ label: fmtDate(d, { day: 'numeric', month: 'short' }), value: net(salesIn(d, d)) }));
  const byCat = {}; month.forEach(d => d.items.forEach(it => { const c = DB.get('products', it.productId)?.categoryId || ''; byCat[c] = (byCat[c] || 0) + sign(d) * lineTotal(it); }));
  const catItems = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: loc(DB.get('categories', c)), value: Math.round(v), color: catColor(c) }));
  const latest = DB.all('sales').slice().sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number)).slice(0, 7);
  const quick = [
    { ic: 'cart', l: t('nav_pos'), href: '#/pos', roles: ['admin', 'cashier'] },
    { ic: 'truck', l: t('newPurchase'), act: 'new-purchase', roles: ['admin', 'storekeeper', 'accountant'] },
    { ic: 'arrowDown', l: t('newReceipt'), act: 'quick-add', key: 'receipts', roles: ['admin', 'accountant', 'cashier'] },
    { ic: 'wallet', l: t('newExpense'), act: 'quick-add', key: 'expenses', roles: ['admin', 'accountant'] },
    { ic: 'box', l: t('newProduct'), act: 'quick-add', key: 'products', roles: ['admin', 'storekeeper'] },
  ].filter(q => can(q.roles));
  const hour = new Date().getHours();
  return `<div class="hero"><div><h1>${t(hour < 12 ? 'goodMorning' : 'goodEvening')}${t('comma')} ${esc(loc(USER))} 👋</h1><p>${fmtDate(T, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${esc(loc(S(), 'businessName'))}</p></div>
      <div class="quick">${quick.map(q => q.href ? `<a class="qbtn" href="${q.href}">${icon(q.ic)}<span>${q.l}</span></a>` : `<button class="qbtn" data-act="${q.act}" data-key="${q.key || ''}">${icon(q.ic)}<span>${q.l}</span></button>`).join('')}</div></div>
    <div class="kpis">${kpis.map(kpi).join('')}</div>
    <div class="minis">${minis.map(m => `<a class="mini" href="${m.href}">${icon(m.ic)}<b>${m.v}</b><span>${m.l}</span></a>`).join('')}</div>
    <div class="grid-3">${card(t('salesLast14'), barChart(trend), `<a class="link" href="#/reports">${t('viewAll')}</a>`, 'span-2')}${card(t('salesByCategoryMonth'), catItems.length ? donut(catItems, { center: fmtNum(net(month) / 1000, 1) + 'k', sub: curLabel() }) : emptyState(t('noData')))}</div>
    <div class="grid-2">
      ${card(t('latestInvoices'), latest.length ? `<ul class="list">${latest.map(d => `<li>${badge(d.type)}<div><a class="link ltr" href="#/doc/sales/${d.id}">${esc(d.number)}</a><small>${fmtDate(d.date)} · ${esc(partyName('customers', d.customerId))}</small></div><b>${fmtMoney(docTotal(d))}</b></li>`).join('')}</ul>` : emptyState(t('noData')), `<a class="link" href="#/sales">${t('viewAll')}</a>`)}
      ${card(`${t('lowStock')} (${fmtNum(low.length)})`, low.length ? `<ul class="list">${low.slice(0, 7).map(p => `<li><span class="dot" style="background:${catColor(p.categoryId)}"></span><div><a class="link" href="#/item/${p.id}">${esc(loc(p))}</a><small>${t('f_minQty')}: ${fmtNum(p.minQty)}</small></div>${stockBadge(p)}</li>`).join('')}</ul>` : emptyState(t('allStocked'), 'check'), can(['admin', 'storekeeper']) ? `<button class="btn ghost sm" data-act="reorder">${icon('truck')}<span>${t('createReorder')}</span></button>` : '')}
    </div>`;
}

/* ================= Point of sale ================= */
const POS = { items: [], customerId: '', discount: 0, method: 'cash', paid: '', cat: '', q: '' };
function posTotals() { return docTotals({ items: POS.items, discount: POS.discount, taxRate: S().taxRate }); }
function renderPOS() {
  const cats = DB.all('categories');
  return `<div class="pos-wrap">
    <section class="pos-left card">
      <div class="pos-search">${icon('barcode')}<input id="pos-q" class="input" placeholder="${t('posSearch')}" value="${esc(POS.q)}" data-inp="pos-search" autocomplete="off"><kbd>F2</kbd></div>
      <div class="chips"><button class="chip-b ${!POS.cat ? 'on' : ''}" data-act="pos-cat" data-c="">${t('all')}</button>${cats.map(c => `<button class="chip-b ${POS.cat === c.id ? 'on' : ''}" data-act="pos-cat" data-c="${c.id}" style="--c:${catColor(c.id)}">${esc(loc(c))}</button>`).join('')}</div>
      <div id="pos-grid" class="pos-grid">${posGrid()}</div>
    </section>
    <section class="pos-right card" id="pos-cart">${posCart()}</section>
  </div>`;
}
function posProducts() {
  const q = norm(POS.q).trim();
  return DB.all('products').filter(p => p.active !== false && (!POS.cat || p.categoryId === POS.cat) && (!q || norm(p.name).includes(q) || norm(p.nameEn).includes(q) || String(p.code).toLowerCase().includes(q) || String(p.barcode || '').includes(q)));
}
function posGrid() {
  const list = posProducts();
  if (!list.length) return emptyState(t('noResults'), 'search');
  return list.slice(0, 120).map(p => { const st = isStock(p) ? stockOf(p.id) : null;
    return `<button class="tile ${st !== null && st <= 0 ? 'out' : ''}" data-act="pos-add" data-id="${p.id}" style="--c:${catColor(p.categoryId)}"><b>${esc(loc(p))}</b><span class="price">${fmtMoney(p.price)}</span>
      <small>${st === null ? t('opt_service') : `${t('f_stock')}: ${fmtNum(st, 3)}`}</small></button>`; }).join('');
}
function posCart() {
  const tt = posTotals(); const cust = DB.get('customers', POS.customerId);
  const paid = POS.paid === '' ? (POS.method === 'credit' ? 0 : tt.total) : +POS.paid;
  const change = round(paid - tt.total);
  return `<div class="cart-head"><label class="sel grow"><span>${icon('user')}</span><select class="input sm grow" data-chg="pos-customer"><option value="">${t('walkIn')}</option>${DB.all('customers').filter(c => c.active !== false).map(c => `<option value="${c.id}" ${POS.customerId === c.id ? 'selected' : ''}>${esc(loc(c))}</option>`).join('')}</select></label>
      ${POS.items.length ? `<button class="icon-btn danger" data-act="pos-clear" title="${t('clear')}">${icon('trash')}</button>` : ''}</div>
    ${cust ? `<div class="cust-bal">${t('f_balance')}: ${balanceFmt(customerBalance(cust.id), 'c')}${+cust.creditLimit ? ` · ${t('f_creditLimit')}: ${fmtMoney(cust.creditLimit)}` : ''}</div>` : ''}
    <div class="cart-lines">${POS.items.length ? POS.items.map((it, i) => `<div class="cl">
        <div class="cl-name"><b>${esc(prodName(it.productId))}</b><small>${fmtMoney(it.price)} × ${fmtNum(it.qty, 3)}</small></div>
        <div class="qty"><button data-act="pos-qty" data-i="${i}" data-d="-1">${icon('minus')}</button><input class="input" type="number" step="any" min="0" value="${it.qty}" data-chg="pos-setqty" data-i="${i}"><button data-act="pos-qty" data-i="${i}" data-d="1">${icon('plus')}</button></div>
        <b class="cl-total">${money(lineTotal(it))}</b><button class="icon-btn danger" data-act="pos-del" data-i="${i}">${icon('x')}</button></div>`).join('') : emptyState(t('cartEmpty'), 'cart')}</div>
    <div class="cart-foot">
      <div class="trow"><span>${t('subtotal')}</span><b>${fmtMoney(tt.sub)}</b></div>
      <div class="trow"><span>${t('f_discount')}</span><input class="input sm" type="number" step="any" min="0" value="${POS.discount || ''}" placeholder="0" data-chg="pos-discount" dir="ltr"></div>
      ${+S().taxRate ? `<div class="trow"><span>${t('tax')} (${fmtNum(S().taxRate, 2)}%)</span><b>${fmtMoney(tt.tax)}</b></div>` : ''}
      <div class="trow total"><span>${t('total')}</span><b>${fmtMoney(tt.total)}</b></div>
      <div class="seg methods">${[...METHODS.filter(m => m !== 'cheque'), 'credit'].map(m => `<button class="seg-m ${POS.method === m ? 'on' : ''}" data-act="pos-method" data-m="${m}">${t('opt_' + m)}</button>`).join('')}</div>
      <div class="trow"><span>${t('paidAmount')}</span><input class="input sm" type="number" step="any" min="0" value="${POS.paid}" placeholder="${money(POS.method === 'credit' ? 0 : tt.total)}" data-chg="pos-paid" dir="ltr"></div>
      <div class="trow ${change < 0 ? 'neg' : 'pos'}"><span>${change < 0 ? t('remainingCredit') : t('change')}</span><b>${fmtMoney(Math.abs(change))}</b></div>
      <button class="btn primary block pay" data-act="pos-pay" ${POS.items.length ? '' : 'disabled'}>${icon('check')}<span>${t('payNow')}</span><kbd>F9</kbd></button>
    </div>`;
}
function refreshPOS(grid) { const c = $('#pos-cart'); if (c) c.innerHTML = posCart(); if (grid) { const g = $('#pos-grid'); if (g) g.innerHTML = posGrid(); } }
function posAdd(pid, qty = 1) {
  const p = DB.get('products', pid); if (!p) return;
  const line = POS.items.find(i => i.productId === pid);
  const want = (line ? +line.qty : 0) + qty;
  if (isStock(p) && !S().allowNegativeStock && want > stockOf(pid)) { toast(`${t('errNoStock')}: ${loc(p)} (${fmtNum(stockOf(pid), 3)})`, 'err'); return; }
  if (line) line.qty = round(want); else POS.items.push({ productId: pid, qty, price: +p.price, discount: 0 });
  refreshPOS(false);
}
function posScan(code) {
  const c = String(code).trim(); if (!c) return;
  const p = DB.all('products').find(x => x.barcode === c || String(x.code).toLowerCase() === c.toLowerCase());
  if (p) { posAdd(p.id); POS.q = ''; const i = $('#pos-q'); if (i) i.value = ''; refreshPOS(true); return; }
  const list = posProducts(); if (list.length === 1) { posAdd(list[0].id); POS.q = ''; $('#pos-q').value = ''; refreshPOS(true); }
}
function posPay() {
  if (!POS.items.length) return;
  const tt = posTotals(); const method = POS.method;
  let paid = POS.paid === '' ? (method === 'credit' ? 0 : tt.total) : +POS.paid;
  if (paid > tt.total) paid = tt.total; // change is given back
  if (paid < tt.total - 0.0005 && !POS.customerId) { toast(t('errCreditNeedsCustomer'), 'err'); return; }
  const doSave = () => {
    const d = DB.insert('sales', { number: DB.nextCode('sales', 'number', 'S'), type: 'sale', date: today(), customerId: POS.customerId, discount: +POS.discount || 0, taxRate: +S().taxRate || 0,
      items: POS.items.map(it => ({ ...it, cost: +DB.get('products', it.productId)?.cost || 0 })), paid: round(paid), method: paid < tt.total - 0.0005 && paid === 0 ? 'credit' : method, notes: '', user: USER.username });
    const given = POS.paid === '' ? paid : +POS.paid; const change = round(given - tt.total);
    Object.assign(POS, { items: [], discount: 0, paid: '', method: 'cash', customerId: '' });
    render();
    const root = modal({ title: `${t('saleDone')} — ${d.number}`, size: 'sm',
      body: `<div class="done"><div class="done-ic">${icon('check')}</div><div class="trow total"><span>${t('total')}</span><b>${fmtMoney(docTotal(d))}</b></div>
        ${change > 0 ? `<div class="trow pos"><span>${t('change')}</span><b>${fmtMoney(change)}</b></div>` : ''}${docDue(d) > 0 ? `<div class="trow neg"><span>${t('remainingCredit')}</span><b>${fmtMoney(docDue(d))}</b></div>` : ''}</div>`,
      footer: `${printLangSelect('pr-lang')}<button class="btn ghost" data-pr="A4">${icon('printer')}<span>A4</span></button><button class="btn ghost" data-pr="80mm">${icon('receipt')}<span>${t('receipt80')}</span></button><span class="grow"></span><button class="btn primary" data-new>${icon('plus')}<span>${t('newSale')}</span></button>` });
    $$('[data-pr]', root).forEach(b => { b.onclick = () => { closeModal(); printDoc('sales', d, b.dataset.pr); }; });
    $('[data-new]', root).onclick = () => { closeModal(); setTimeout(() => $('#pos-q')?.focus(), 50); };
  };
  const cust = DB.get('customers', POS.customerId);
  const newBal = cust ? customerBalance(cust.id) + tt.total - paid : 0;
  if (cust && +cust.creditLimit && newBal > +cust.creditLimit) confirmBox(`${t('creditLimitWarn')} (${moneyText(newBal)} > ${moneyText(cust.creditLimit)})`, doSave, { danger: false, okLabel: t('continue') });
  else doSave();
}

/* ================= Document editor (purchases, returns) ================= */
let ED = null;
function docEditor(kind, preset = {}) {
  const isSales = kind === 'sales';
  ED = { kind, type: isSales ? 'sale' : 'purchase', date: today(), partyId: '', supplierRef: '', items: [], discount: 0, taxRate: +S().taxRate || 0, paid: 0, method: isSales ? 'cash' : 'transfer', notes: '', ...preset };
  const parties = DB.all(isSales ? 'customers' : 'suppliers').filter(p => p.active !== false || p.id === ED.partyId);
  const title = `${t('new')} — ${t(isSales ? (ED.type === 'return' ? 'salesReturn' : 'salesInvoice') : (ED.type === 'return' ? 'purchaseReturn' : 'purchaseInvoice'))}${ED.refNumber ? ` (${t('for')} ${ED.refNumber})` : ''}`;
  const root = modal({ title, size: 'xl',
    body: `<div class="form-grid three">
        <label class="field"><span>${t(isSales ? 'f_customerId' : 'f_supplierId')}${isSales ? '' : ' <i class="req">*</i>'}</span><select class="input" id="ed-party" ${ED.refId ? 'disabled' : ''}><option value="">${isSales ? t('walkIn') : '—'}</option>${parties.map(p => `<option value="${p.id}" ${ED.partyId === p.id ? 'selected' : ''}>${esc(loc(p))}</option>`).join('')}</select></label>
        <label class="field"><span>${t('f_date')}</span><input class="input" type="date" id="ed-date" value="${ED.date}"></label>
        ${isSales ? '<span></span>' : `<label class="field"><span>${t('f_supplierRef')}</span><input class="input" id="ed-ref" value="${esc(ED.supplierRef)}" dir="ltr"></label>`}
      </div>
      ${ED.refId ? '' : `<div class="ed-add"><div class="pos-search">${icon('barcode')}<input class="input" id="ed-pick" list="dl-prod" placeholder="${t('posSearch')}" autocomplete="off"></div>
        <datalist id="dl-prod">${DB.all('products').filter(p => p.active !== false).map(p => `<option value="${esc(p.code)} | ${esc(loc(p))}">`).join('')}</datalist>
        <button class="btn ghost" type="button" data-ed="add">${icon('plus')}<span>${t('add')}</span></button></div>`}
      <div class="table-wrap"><table class="table compact ed-table"><thead><tr><th>${t('f_productId')}</th><th>${t('f_qty')}</th><th>${t(isSales ? 'f_price' : 'f_cost')}</th><th>${t('f_discount')}</th><th>${t('total')}</th><th></th></tr></thead><tbody id="ed-lines"></tbody></table></div>
      <div class="ed-bottom"><label class="field"><span>${t('f_notes')}</span><textarea class="input" id="ed-notes" rows="3">${esc(ED.notes)}</textarea></label><div id="ed-totals" class="ed-totals"></div></div>
      <div class="form-err" hidden></div>`,
    footer: `<button class="btn ghost" data-ed="cancel">${t('cancel')}</button><button class="btn primary" data-ed="save">${icon('check')}<span>${t('save')}</span></button>` });
  const box = $('.modal', root);
  const paint = () => {
    $('#ed-lines', root).innerHTML = ED.items.length ? ED.items.map((it, i) => `<tr><td>${esc(prodName(it.productId))}${ED.maxQty ? `<small class="muted d-block">${t('maxReturn')}: ${fmtNum(ED.maxQty[it.productId] || 0, 3)}</small>` : ''}</td>
      <td><input class="input sm num-in" type="number" step="any" min="0" value="${it.qty}" data-i="${i}" data-f="qty"></td>
      <td><input class="input sm num-in" type="number" step="any" min="0" value="${it.price}" data-i="${i}" data-f="price" ${ED.refId ? 'readonly' : ''}></td>
      <td><input class="input sm num-in" type="number" step="any" min="0" value="${it.discount || 0}" data-i="${i}" data-f="discount" ${ED.refId ? 'readonly' : ''}></td>
      <td class="lt">${money(lineTotal(it))}</td><td><button class="icon-btn danger" type="button" data-ed="del" data-i="${i}">${icon('x')}</button></td></tr>`).join('') : `<tr><td colspan="6">${emptyState(t('noItems'), 'box')}</td></tr>`;
    paintTotals();
  };
  const paintTotals = () => {
    const tt = docTotals(ED);
    $('#ed-totals', root).innerHTML = `<div class="trow"><span>${t('subtotal')}</span><b>${fmtMoney(tt.sub)}</b></div>
      <div class="trow"><span>${t('f_discount')}</span><input class="input sm" type="number" step="any" min="0" id="ed-disc" value="${ED.discount || 0}" ${ED.refId ? 'readonly' : ''}></div>
      <div class="trow"><span>${t('tax')} %</span><input class="input sm" type="number" step="any" min="0" id="ed-tax" value="${ED.taxRate || 0}" ${ED.refId ? 'readonly' : ''}></div>
      <div class="trow total"><span>${t('total')}</span><b>${fmtMoney(tt.total)}</b></div>
      <div class="trow"><span>${t(ED.type === 'return' ? 'refundAmount' : 'paidAmount')}</span><input class="input sm" type="number" step="any" min="0" id="ed-paid" value="${ED.paid}"></div>
      <div class="trow"><span>${t('f_method')}</span><select class="input sm" id="ed-method">${METHODS.map(m => `<option value="${m}" ${ED.method === m ? 'selected' : ''}>${t('opt_' + m)}</option>`).join('')}</select></div>
      <div class="trow ${docDue(ED) > 0 ? 'neg' : ''}"><span>${t(ED.type === 'return' ? 'creditToAccount' : 'f_due')}</span><b>${fmtMoney(Math.max(0, docDue(ED)))}</b></div>`;
  };
  const addPicked = () => {
    const inp = $('#ed-pick', root); const v = inp.value.trim(); if (!v) return;
    const code = v.split('|')[0].trim().toLowerCase();
    const p = DB.all('products').find(x => String(x.code).toLowerCase() === code || x.barcode === v) || DB.all('products').find(x => norm(loc(x)) === norm(v));
    if (!p) { toast(t('notFound'), 'err'); return; }
    const line = ED.items.find(i => i.productId === p.id);
    if (line) line.qty = round(+line.qty + 1); else ED.items.push({ productId: p.id, qty: 1, price: isSales ? +p.price : +p.cost, discount: 0 });
    inp.value = ''; paint(); inp.focus();
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-ed]'); if (!b) return;
    const a = b.dataset.ed;
    if (a === 'cancel') closeModal();
    else if (a === 'add') addPicked();
    else if (a === 'del') { ED.items.splice(+b.dataset.i, 1); paint(); }
    else if (a === 'save') saveDoc(root);
  });
  box.addEventListener('keydown', e => { if (e.target.id === 'ed-pick' && e.key === 'Enter') { e.preventDefault(); addPicked(); } });
  box.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.f) { const it = ED.items[+el.dataset.i]; it[el.dataset.f] = el.value === '' ? 0 : +el.value; el.closest('tr').querySelector('.lt').textContent = money(lineTotal(it));
      if (ED.type === 'return' && !ED.partyId) ED.paid = docTotal(ED);
      const keep = document.activeElement; paintTotals(); keep.focus(); }
    else if (['ed-disc', 'ed-tax', 'ed-paid'].includes(el.id)) { ED[{ 'ed-disc': 'discount', 'ed-tax': 'taxRate', 'ed-paid': 'paid' }[el.id]] = +el.value || 0;
      const due = $('#ed-totals .trow:last-child b', root); if (due) due.innerHTML = fmtMoney(Math.max(0, docDue(ED))); const tot = $('#ed-totals .total b', root); if (tot) tot.innerHTML = fmtMoney(docTotal(ED)); }
  });
  box.addEventListener('change', e => { if (e.target.id === 'ed-method') ED.method = e.target.value; });
  paint();
}
function saveDoc(root) {
  const isSales = ED.kind === 'sales'; const err = m => { const b = $('.form-err', root); b.hidden = false; b.textContent = m; };
  ED.partyId = $('#ed-party', root).value; ED.date = $('#ed-date', root).value || today(); ED.notes = $('#ed-notes', root).value.trim();
  if (!isSales) ED.supplierRef = $('#ed-ref', root).value.trim();
  ED.items = ED.items.filter(it => +it.qty > 0);
  if (!ED.items.length) return err(t('errNoItems'));
  if (!isSales && !ED.partyId) return err(`${t('errRequired')}: ${t('f_supplierId')}`);
  if (ED.maxQty) for (const it of ED.items) if (+it.qty > (ED.maxQty[it.productId] || 0) + 0.0005) return err(`${t('errReturnQty')}: ${prodName(it.productId)}`);
  const tt = docTotals(ED);
  if (+ED.paid > tt.total + 0.0005) return err(t('errOverpay'));
  if (ED.paid < tt.total - 0.0005 && !ED.partyId) return err(t(ED.type === 'return' ? 'errRefundNeedsCustomer' : 'errCreditNeedsCustomer'));
  // stock leaves on sales and on purchase returns
  const out = (isSales && ED.type === 'sale') || (!isSales && ED.type === 'return');
  if (out && !S().allowNegativeStock) for (const it of ED.items) { const p = DB.get('products', it.productId); if (isStock(p) && +it.qty > stockOf(p.id)) return err(`${t('errNoStock')}: ${loc(p)} (${fmtNum(stockOf(p.id), 3)})`); }
  if (!isSales && ED.type === 'purchase') ED.items.forEach(it => { // weighted average cost
    const p = DB.get('products', it.productId); if (!p) return; const q0 = Math.max(0, stockOf(p.id)), c0 = +p.cost || 0, net = +it.qty ? lineTotal(it) / +it.qty : +it.price;
    p.cost = round((q0 * c0 + +it.qty * net) / (q0 + +it.qty || 1));
  });
  const prefix = isSales ? (ED.type === 'return' ? 'SR' : 'S') : (ED.type === 'return' ? 'PR' : 'P');
  const doc = { number: DB.nextCode(ED.kind, 'number', prefix), type: ED.type, refId: ED.refId || '', date: ED.date, items: ED.items.map(it => ({ productId: it.productId, qty: +it.qty, price: +it.price, discount: +it.discount || 0, cost: it.cost ?? (+DB.get('products', it.productId)?.cost || 0) })),
    discount: +ED.discount || 0, taxRate: +ED.taxRate || 0, paid: round(+ED.paid || 0), method: ED.method, notes: ED.notes, user: USER.username };
  if (isSales) doc.customerId = ED.partyId; else { doc.supplierId = ED.partyId; doc.supplierRef = ED.supplierRef; }
  const saved = DB.insert(ED.kind, doc); closeModal(); toast(t('saved'));
  location.hash = `#/doc/${ED.kind}/${saved.id}`; render();
}
function startReturn(kind, d) {
  const returned = {}; DB.all(kind).filter(x => x.refId === d.id).forEach(x => x.items.forEach(it => { returned[it.productId] = (returned[it.productId] || 0) + +it.qty; }));
  const maxQty = {}; d.items.forEach(it => { maxQty[it.productId] = (maxQty[it.productId] || 0) + +it.qty - (returned[it.productId] || 0); });
  const items = d.items.filter(it => maxQty[it.productId] > 0).map(it => ({ ...it, qty: maxQty[it.productId] }));
  if (!items.length) { toast(t('fullyReturned'), 'err'); return; }
  const party = kind === 'sales' ? d.customerId : d.supplierId;
  // invoice-level discount is spread over the lines so a return refunds what was actually charged
  const gross = sum(d.items, lineTotal); const ratio = gross ? Math.max(0, gross - (+d.discount || 0)) / gross : 1;
  items.forEach(it => { it.price = round(+it.price * ratio); it.discount = round((+it.discount || 0) * ratio); });
  const total = round(sum(items, lineTotal) * (1 + (+d.taxRate || 0) / 100));
  docEditor(kind, { type: 'return', refId: d.id, refNumber: d.number, partyId: party, items, maxQty, taxRate: +d.taxRate || 0, discount: 0, paid: party ? 0 : total, method: d.method === 'credit' ? 'cash' : d.method });
}

/* ================= Document view ================= */
function renderDoc(p) {
  const kind = p.id && ['sales', 'purchases'].includes(p.sub) ? p.sub : null; const d = kind && DB.get(kind, p.id);
  if (!d) return emptyState(t('notFound'));
  const tt = docTotals(d); const isSales = kind === 'sales'; const partyCol = isSales ? 'customers' : 'suppliers'; const pid = isSales ? d.customerId : d.supplierId;
  const ref = d.refId ? DB.get(kind, d.refId) : null; const returns = DB.all(kind).filter(x => x.refId === d.id);
  return `${pageHead(`${docLabel(kind, d)} <span class="ltr muted">${esc(d.number)}</span>`, `${fmtDate(d.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, `
      <a class="btn ghost" href="#/${kind}">${icon(LANG === 'ar' ? 'chevR' : 'chevL')}<span>${t('back')}</span></a>
      ${printLangSelect()}
      <button class="btn ghost" data-act="doc-print" data-kind="${kind}" data-id="${d.id}" data-size="A4">${icon('printer')}<span>A4</span></button>
      ${isSales ? `<button class="btn ghost" data-act="doc-print" data-kind="${kind}" data-id="${d.id}" data-size="80mm">${icon('receipt')}<span>${t('receipt80')}</span></button>` : ''}
      ${isSales ? `<button class="btn wa" data-act="wa-doc" data-id="${d.id}">${icon('whatsapp')}<span>${t('waSendShort')}</span></button>` : ''}
      ${d.type !== 'return' && can(ENT[kind].edit) ? `<button class="btn ghost" data-act="doc-return" data-kind="${kind}" data-id="${d.id}">${icon('undo')}<span>${t('makeReturn')}</span></button>` : ''}
      ${can(['admin']) ? `<button class="btn ghost danger-t" data-act="crud-del" data-key="${kind}" data-id="${d.id}">${icon('trash')}<span>${t('delete')}</span></button>` : ''}`)}
    <div class="grid-3">
      ${card(t(isSales ? 'f_customerId' : 'f_supplierId'), `<div class="info-grid one"><div><span>${t('f_name')}</span><b>${pid ? `<a class="link" href="#/statement/${isSales ? 'customer' : 'supplier'}/${pid}">${esc(partyName(partyCol, pid))}</a>` : esc(t('walkIn'))}</b></div>
        ${pid ? `<div><span>${t('f_phone')}</span><b class="ltr">${esc(DB.get(partyCol, pid)?.phone || '—')}</b></div><div><span>${t('f_balance')}</span><b>${balanceFmt(isSales ? customerBalance(pid) : supplierBalance(pid), isSales ? 'c' : 's')}</b></div>` : ''}
        ${d.supplierRef ? `<div><span>${t('f_supplierRef')}</span><b class="ltr">${esc(d.supplierRef)}</b></div>` : ''}</div>`)}
      ${card(t('payment'), `<div class="info-grid one"><div><span>${t('f_status')}</span><b>${badge(docStatus(d))}</b></div><div><span>${t('f_method')}</span><b>${t('opt_' + d.method)}</b></div>
        <div><span>${t(d.type === 'return' ? 'refundAmount' : 'f_paid')}</span><b>${fmtMoney(d.paid)}</b></div><div><span>${t('f_due')}</span><b>${fmtMoney(Math.max(0, docDue(d)))}</b></div></div>`)}
      ${card(t('details'), `<div class="info-grid one"><div><span>${t('f_type')}</span><b>${badge(d.type)}</b></div>${ref ? `<div><span>${t('returnOf')}</span><b><a class="link ltr" href="#/doc/${kind}/${ref.id}">${esc(ref.number)}</a></b></div>` : ''}
        ${returns.length ? `<div><span>${t('returnsLbl')}</span><b>${returns.map(r => `<a class="link ltr" href="#/doc/${kind}/${r.id}">${esc(r.number)}</a>`).join(' · ')}</b></div>` : ''}<div><span>${t('byUser')}</span><b>${esc(d.user || '—')}</b></div>${d.notes ? `<div><span>${t('f_notes')}</span><b>${esc(d.notes)}</b></div>` : ''}</div>`)}
    </div>
    ${card(t('items'), `<div class="table-wrap"><table class="table compact"><thead><tr><th>#</th><th>${t('f_productId')}</th><th>${t('f_qty')}</th><th>${t(isSales ? 'f_price' : 'f_cost')}</th><th>${t('f_discount')}</th><th>${t('total')}</th>${isSales && can(['admin', 'accountant']) ? `<th>${t('profit')}</th>` : ''}</tr></thead><tbody>
      ${d.items.map((it, i) => `<tr><td>${i + 1}</td><td><a class="link" href="#/item/${it.productId}">${esc(prodName(it.productId))}</a></td><td>${fmtNum(it.qty, 3)}</td><td>${fmtMoney(it.price)}</td><td>${fmtMoney(it.discount || 0)}</td><td><b>${fmtMoney(lineTotal(it))}</b></td>
        ${isSales && can(['admin', 'accountant']) ? `<td>${fmtMoney(lineTotal(it) - it.qty * (it.cost || 0))}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <div class="doc-totals"><div class="trow"><span>${t('subtotal')}</span><b>${fmtMoney(tt.sub)}</b></div>${tt.disc ? `<div class="trow"><span>${t('f_discount')}</span><b>- ${fmtMoney(tt.disc)}</b></div>` : ''}
      ${tt.tax ? `<div class="trow"><span>${t('tax')} (${fmtNum(d.taxRate, 2)}%)</span><b>${fmtMoney(tt.tax)}</b></div>` : ''}<div class="trow total"><span>${t('total')}</span><b>${fmtMoney(tt.total)}</b></div></div>`)}`;
}

/* ================= Printing ================= */
function printDoc(kind, d, size, lang) { return withPrintLang(lang, () => renderPrintDoc(kind, d, size)); }
function renderPrintDoc(kind, d, size) {
  size = size || (kind === 'sales' ? S().receiptSize : 'A4');
  const tt = docTotals(d); const isSales = kind === 'sales'; const party = DB.get(isSales ? 'customers' : 'suppliers', isSales ? d.customerId : d.supplierId);
  if (size === '80mm') {
    const st = S();
    printHTML(`<div class="rcpt"><div class="rc-head">${LOGO.replace(/lg1/g, 'lgr')}<b>${esc(loc(st, 'businessName'))}</b><span>${esc(loc(st, 'address'))}</span><span class="ltr">${esc(st.phone)}</span>${st.taxNo ? `<span>${t('f_taxNo')}: ${esc(st.taxNo)}</span>` : ''}</div>
      <div class="rc-meta"><span>${docLabel(kind, d)}</span><b class="ltr">${esc(d.number)}</b><span>${fmtDate(d.date)} ${new Date(d.createdAt || Date.now()).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span>${party ? `<span>${t('f_customerId')}: ${esc(loc(party))}</span>` : ''}</div>
      <table><thead><tr><th>${t('f_productId')}</th><th>${t('f_qty')}</th><th>${t('total')}</th></tr></thead><tbody>${d.items.map(it => `<tr><td>${esc(prodName(it.productId))}<br><small>${money(it.price)}</small></td><td>${fmtNum(it.qty, 3)}</td><td>${money(lineTotal(it))}</td></tr>`).join('')}</tbody></table>
      <div class="rc-tot"><div><span>${t('subtotal')}</span><b>${money(tt.sub)}</b></div>${tt.disc ? `<div><span>${t('f_discount')}</span><b>-${money(tt.disc)}</b></div>` : ''}${tt.tax ? `<div><span>${t('tax')}</span><b>${money(tt.tax)}</b></div>` : ''}
        <div class="big"><span>${t('total')}</span><b>${money(tt.total)} ${esc(curLabel())}</b></div><div><span>${t('f_paid')} (${t('opt_' + d.method)})</span><b>${money(d.paid)}</b></div>${docDue(d) > 0 ? `<div><span>${t('f_due')}</span><b>${money(docDue(d))}</b></div>` : ''}</div>
      <div class="rc-foot">${esc(receiptFooterText())}<br><span class="ltr">*${esc(d.number)}*</span></div></div>`, 'rcpt-mode');
    return;
  }
  printHTML(`${printHeader(docLabel(kind, d), `<span class="ltr">${esc(d.number)}</span>`)}
    <div class="pbox"><div class="kv"><span>${t(isSales ? 'f_customerId' : 'f_supplierId')}</span><b>${esc(party ? loc(party) : t('walkIn'))}</b></div><div class="kv"><span>${t('f_date')}</span><b>${fmtDate(d.date)}</b></div>
      ${party?.phone ? `<div class="kv"><span>${t('f_phone')}</span><b class="ltr">${esc(party.phone)}</b></div>` : ''}${party?.taxNo ? `<div class="kv"><span>${t('f_taxNo')}</span><b>${esc(party.taxNo)}</b></div>` : ''}
      ${d.supplierRef ? `<div class="kv"><span>${t('f_supplierRef')}</span><b>${esc(d.supplierRef)}</b></div>` : ''}<div class="kv"><span>${t('f_method')}</span><b>${t('opt_' + d.method)}</b></div></div>
    <table class="ptable"><thead><tr><th>#</th><th>${t('f_productId')}</th><th>${t('f_unit')}</th><th>${t('f_qty')}</th><th>${t(isSales ? 'f_price' : 'f_cost')}</th><th>${t('f_discount')}</th><th>${t('total')}</th></tr></thead>
    <tbody>${d.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(prodName(it.productId))}</td><td>${t('opt_' + (DB.get('products', it.productId)?.unit || 'piece'))}</td><td>${fmtNum(it.qty, 3)}</td><td>${money(it.price)}</td><td>${money(it.discount || 0)}</td><td>${money(lineTotal(it))}</td></tr>`).join('')}</tbody></table>
    <div class="ptotals"><div><span>${t('subtotal')}</span><b>${moneyText(tt.sub)}</b></div>${tt.disc ? `<div><span>${t('f_discount')}</span><b>${moneyText(tt.disc)}</b></div>` : ''}${tt.tax ? `<div><span>${t('tax')} ${fmtNum(d.taxRate, 2)}%</span><b>${moneyText(tt.tax)}</b></div>` : ''}
      <div><span>${t('total')}</span><b>${moneyText(tt.total)}</b></div><div><span>${t('f_paid')}</span><b>${moneyText(d.paid)}</b></div><div><span>${t('f_due')}</span><b>${moneyText(Math.max(0, docDue(d)))}</b></div></div>
    ${d.notes ? `<p><b>${t('f_notes')}:</b> ${esc(d.notes)}</p>` : ''}${isSales && receiptFooterText() ? `<p class="muted">${esc(receiptFooterText())}</p>` : ''}
    <div class="psign"><div>${t('receiverSign')}</div><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div>`);
}
function printVoucher(kind, r, lang) { return withPrintLang(lang, () => renderPrintVoucher(kind, r)); }
function renderPrintVoucher(kind, r) {
  const isR = kind === 'receipts'; const party = DB.get(isR ? 'customers' : 'suppliers', isR ? r.customerId : r.supplierId);
  printHTML(`${printHeader(t(isR ? 'receiptVoucher' : 'paymentVoucher'), `<span class="ltr">${esc(r.number)}</span>`)}
    <div class="pbox"><div class="kv"><span>${t('f_date')}</span><b>${fmtDate(r.date)}</b></div><div class="kv"><span>${t(isR ? 'receivedFrom' : 'paidTo')}</span><b>${esc(party ? loc(party) : '—')}</b></div>
      <div class="kv"><span>${t('f_method')}</span><b>${t('opt_' + r.method)}</b></div><div class="kv"><span>${t('balanceAfter')}</span><b>${moneyText(Math.abs(isR ? customerBalance(r.customerId) : supplierBalance(r.supplierId)))}</b></div></div>
    <div class="pamount">${t('f_amount')}: <b>${moneyText(r.amount)}</b></div>${r.notes ? `<p><b>${t('f_notes')}:</b> ${esc(r.notes)}</p>` : ''}
    <div class="psign"><div>${t(isR ? 'payerSign' : 'receiverSign')}</div><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div>`);
}

/* ================= Statement ================= */
function renderStatement(p) {
  const kind = p.sub === 'supplier' ? 'supplier' : 'customer'; const col = kind === 'customer' ? 'customers' : 'suppliers';
  const party = DB.get(col, p.id); if (!party) return emptyState(t('notFound'));
  const lines = statement(kind, party.id); const bal = kind === 'customer' ? customerBalance(party.id) : supplierBalance(party.id);
  return `${pageHead(`${t('statement')} — ${esc(loc(party))}`, `${esc(party.code)} · <span class="ltr">${esc(party.phone || '')}</span>`, `
      <a class="btn ghost" href="#/${col}">${icon(LANG === 'ar' ? 'chevR' : 'chevL')}<span>${t('back')}</span></a>
      <button class="btn ghost" data-act="stmt-export" data-kind="${kind}" data-id="${party.id}">${icon('download')}<span>${t('export')}</span></button>
      <button class="btn ghost" data-act="stmt-print" data-kind="${kind}" data-id="${party.id}">${icon('printer')}<span>${t('print')}</span></button>
      ${kind === 'customer' ? `<button class="btn wa" data-act="wa-customer" data-id="${party.id}">${icon('whatsapp')}<span>${t('waSendShort')}</span></button>` : ''}
      ${kind === 'customer' ? `<button class="btn primary" data-act="quick-add" data-key="receipts" data-preset='${JSON.stringify({ customerId: party.id })}'>${icon('arrowDown')}<span>${t('newReceipt')}</span></button>`
      : `<button class="btn primary" data-act="quick-add" data-key="disbursements" data-preset='${JSON.stringify({ supplierId: party.id })}'>${icon('arrowUp')}<span>${t('newPayment')}</span></button>`}`)}
    <div class="kpis three">${kpi({ ic: 'scale', label: t('currentBalance'), val: moneyText(Math.abs(bal)), sub: bal > 0.0005 ? t(kind === 'customer' ? 'owesUs' : 'weOwe') : bal < -0.0005 ? t(kind === 'customer' ? 'creditFor' : 'advance') : t('settled'), c: bal > 0.0005 ? 'c5' : 'c3' })}
      ${kpi({ ic: 'receipt', label: t('totalDebit'), val: moneyText(sum(lines, l => l.debit)), c: 'c1' })}${kpi({ ic: 'check', label: t('totalCredit'), val: moneyText(sum(lines, l => l.credit)), c: 'c2' })}</div>
    ${card(t('movements'), stmtTable(lines))}`;
}
function stmtTable(lines) {
  return lines.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_date')}</th><th>${t('ref')}</th><th>${t('f_description')}</th><th>${t('debit')}</th><th>${t('credit')}</th><th>${t('f_balance')}</th></tr></thead><tbody>
    ${lines.map(l => `<tr><td>${l.date ? fmtDate(l.date) : '—'}</td><td class="ltr">${l.link ? `<a class="link" href="${l.link}">${esc(l.ref)}</a>` : esc(l.ref)}</td><td>${esc(l.desc)}</td><td>${l.debit ? money(l.debit) : ''}</td><td>${l.credit ? money(l.credit) : ''}</td><td><b>${money(l.balance)}</b></td></tr>`).join('')}</tbody></table></div>` : emptyState(t('noData'));
}

/* ================= Item card ================= */
function renderItem(p) {
  const it = DB.get('products', p.id); if (!it) return emptyState(t('notFound'));
  const mv = [];
  if (+it.openingQty) mv.push({ date: '', ref: '', desc: t('openingQty'), qty: +it.openingQty });
  DB.all('purchases').forEach(d => d.items.forEach(x => { if (x.productId === it.id) mv.push({ date: d.date, ref: d.number, link: `#/doc/purchases/${d.id}`, desc: `${docLabel('purchases', d)} — ${partyName('suppliers', d.supplierId)}`, qty: sign(d) * x.qty, price: x.price }); }));
  DB.all('sales').forEach(d => d.items.forEach(x => { if (x.productId === it.id) mv.push({ date: d.date, ref: d.number, link: `#/doc/sales/${d.id}`, desc: `${docLabel('sales', d)} — ${partyName('customers', d.customerId)}`, qty: -sign(d) * x.qty, price: x.price }); }));
  DB.all('adjustments').filter(a => a.productId === it.id).forEach(a => mv.push({ date: a.date, ref: a.number, desc: `${t('adjustment')} — ${t('opt_' + a.reason)}`, qty: +a.qty }));
  mv.sort((a, b) => (a.date || '').localeCompare(b.date || '')); let bal = 0; mv.forEach(m => { bal = round(bal + m.qty); m.bal = bal; });
  const [f30] = [addDays(today(), -29)]; const sold30 = sum(mv.filter(m => m.date >= f30 && m.ref?.startsWith('S')), m => -m.qty);
  return `${pageHead(`${esc(loc(it))}`, `<span class="ltr">${esc(it.code)}${it.barcode ? ' · ' + esc(it.barcode) : ''}</span> · ${esc(refLabel('categories', it.categoryId))}`, `
      <a class="btn ghost" href="#/products">${icon(LANG === 'ar' ? 'chevR' : 'chevL')}<span>${t('back')}</span></a>
      ${can(ENT.products.edit) ? `<button class="btn ghost" data-act="crud-edit" data-key="products" data-id="${it.id}">${icon('edit')}<span>${t('edit')}</span></button>
      ${isStock(it) ? `<button class="btn primary" data-act="quick-add" data-key="adjustments" data-preset='${JSON.stringify({ productId: it.id })}'>${icon('scale')}<span>${t('adjustStock')}</span></button>` : ''}` : ''}`)}
    <div class="kpis">${kpi({ ic: 'box', label: t('f_stock'), val: isStock(it) ? `${fmtNum(stockOf(it.id), 3)} ${t('opt_' + it.unit)}` : t('opt_service'), sub: `${t('f_minQty')}: ${fmtNum(it.minQty)}`, c: isStock(it) && stockState(it) !== 'ok' ? 'c5' : 'c3' })}
      ${kpi({ ic: 'tag', label: t('f_price'), val: moneyText(it.price), sub: `${t('f_cost')}: ${moneyText(it.cost)}`, c: 'c1' })}
      ${kpi({ ic: 'chart', label: t('soldLast30'), val: fmtNum(sold30, 3), sub: t('opt_' + it.unit), c: 'c2' })}
      ${kpi({ ic: 'vault', label: t('stockValueCost'), val: moneyText(Math.max(0, stockOf(it.id)) * (+it.cost || 0)), c: 'c4' })}</div>
    ${card(t('movements'), mv.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_date')}</th><th>${t('ref')}</th><th>${t('f_description')}</th><th>${t('in')}</th><th>${t('out')}</th><th>${t('f_balance')}</th></tr></thead><tbody>
      ${mv.slice().reverse().slice(0, 200).map(m => `<tr><td>${m.date ? fmtDate(m.date) : '—'}</td><td class="ltr">${m.link ? `<a class="link" href="${m.link}">${esc(m.ref)}</a>` : esc(m.ref || '')}</td><td>${esc(m.desc)}</td><td class="pos">${m.qty > 0 ? fmtNum(m.qty, 3) : ''}</td><td class="neg">${m.qty < 0 ? fmtNum(-m.qty, 3) : ''}</td><td><b>${fmtNum(m.bal, 3)}</b></td></tr>`).join('')}</tbody></table></div>` : emptyState(t('noData')))}`;
}

/* ================= Treasury ================= */
function renderTreasury(p) {
  const acc = p.acc === 'bank' ? 'bank' : 'cash'; const T = today();
  const moves = moneyMoves().filter(m => m.account === acc); let bal = 0; const withBal = moves.map(m => { bal = round(bal + m.amount); return { ...m, bal }; });
  const todayM = moneyMoves().filter(m => m.date === T);
  return `${pageHead(t('nav_treasury'), t('sub_treasury'), can(ENT.cashMoves.edit) ? `<button class="btn primary" data-act="quick-add" data-key="cashMoves">${icon('plus')}<span>${t('newCashMove')}</span></button>` : '')}
    <div class="kpis">${kpi({ ic: 'vault', label: t('acc_cash'), val: moneyText(accountBalance('cash')), c: 'c3', href: '#/treasury?acc=cash' })}${kpi({ ic: 'store', label: t('acc_bank'), val: moneyText(accountBalance('bank')), c: 'c1', href: '#/treasury?acc=bank' })}
      ${kpi({ ic: 'arrowDown', label: t('inToday'), val: moneyText(sum(todayM.filter(m => m.amount > 0), m => m.amount)), c: 'c2' })}${kpi({ ic: 'arrowUp', label: t('outToday'), val: moneyText(-sum(todayM.filter(m => m.amount < 0), m => m.amount)), c: 'c5' })}</div>
    <div class="card"><div class="toolbar"><div class="tabs"><a class="tab ${acc === 'cash' ? 'on' : ''}" href="#/treasury?acc=cash">${t('acc_cash')}</a><a class="tab ${acc === 'bank' ? 'on' : ''}" href="#/treasury?acc=bank">${t('acc_bank')}</a></div>
      <span class="grow"></span><button class="btn ghost sm" data-act="treasury-export" data-acc="${acc}">${icon('download')}<span>${t('export')}</span></button></div>
    ${withBal.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_date')}</th><th>${t('ref')}</th><th>${t('f_description')}</th><th>${t('in')}</th><th>${t('out')}</th><th>${t('f_balance')}</th></tr></thead><tbody>
      ${withBal.slice().reverse().slice(0, 300).map(m => `<tr><td>${m.date ? fmtDate(m.date) : '—'}</td><td class="ltr">${m.link ? `<a class="link" href="${m.link}">${esc(m.ref)}</a>` : esc(m.ref || '')}</td><td>${esc(m.desc)}</td><td class="pos">${m.amount > 0 ? money(m.amount) : ''}</td><td class="neg">${m.amount < 0 ? money(-m.amount) : ''}</td><td><b>${money(m.bal)}</b></td></tr>`).join('')}</tbody></table></div>` : emptyState(t('noData'))}</div>
    <div class="card">${renderCrud('cashMoves', { embedded: true })}</div>`;
}

/* ================= Reports ================= */
function renderReports(p) {
  const per = p.period || 'month'; let [from, to] = per === 'custom' ? [p.from || today().slice(0, 8) + '01', p.to || today()] : periodRange(per);
  const pr = profitFor(from, to); const sales = salesIn(from, to);
  const days = Math.round((parseISO(to) - parseISO(from)) / 864e5) + 1;
  let trend;
  if (days <= 62) trend = range(0, days - 1).map(i => { const d = addDays(from, i); return { label: fmtDate(d, { day: 'numeric', month: 'short' }), value: Math.round(sum(salesIn(d, d), x => sign(x) * docTotal(x))) }; });
  else { const months = {}; sales.forEach(d => { const k = d.date.slice(0, 7); months[k] = (months[k] || 0) + sign(d) * docTotal(d); }); trend = Object.keys(months).sort().map(k => ({ label: fmtDate(k + '-01', { month: 'short', year: '2-digit' }), value: Math.round(months[k]) })); }
  const prod = {}; sales.forEach(d => d.items.forEach(it => { const o = prod[it.productId] = prod[it.productId] || { qty: 0, rev: 0, cost: 0 }; o.qty += sign(d) * it.qty; o.rev += sign(d) * lineTotal(it); o.cost += sign(d) * it.qty * (it.cost || 0); }));
  const top = Object.entries(prod).sort((a, b) => b[1].rev - a[1].rev).slice(0, 10);
  const byCat = {}; Object.entries(prod).forEach(([pid, o]) => { const c = DB.get('products', pid)?.categoryId || ''; byCat[c] = (byCat[c] || 0) + o.rev; });
  const catItems = Object.entries(byCat).filter(([, v]) => v > 0).map(([c, v]) => ({ label: loc(DB.get('categories', c)), value: Math.round(v), color: catColor(c) }));
  const methods = [...METHODS, 'credit'].map((m, i) => ({ label: t('opt_' + m), value: Math.round(sum(sales.filter(d => d.method === m && d.type === 'sale'), docTotal)), color: PALETTE[i] })).filter(x => x.value);
  const exp = {}; DB.all('expenses').filter(e => e.date >= from && e.date <= to).forEach(e => { exp[e.category] = (exp[e.category] || 0) + +e.amount; });
  const expItems = Object.entries(exp).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ label: t('opt_' + k), value: v, color: PALETTE[(i + 4) % PALETTE.length] }));
  const stockByCat = DB.all('categories').map(c => { const ps = DB.all('products').filter(p2 => p2.categoryId === c.id && isStock(p2)); return { c, n: ps.length, qty: sum(ps, p2 => Math.max(0, stockOf(p2.id))), cost: sum(ps, p2 => Math.max(0, stockOf(p2.id)) * (+p2.cost || 0)), retail: sum(ps, p2 => Math.max(0, stockOf(p2.id)) * (+p2.price || 0)) }; });
  const debtors = DB.all('customers').map(c => ({ c, b: customerBalance(c.id) })).filter(x => x.b > 0.0005).sort((a, b) => b.b - a.b).slice(0, 8);
  const periods = ['today', 'week', 'month', 'lastMonth', 'year', 'custom'];
  return `${pageHead(t('nav_reports'), t('sub_reports'), `<button class="btn ghost" data-act="rep-export" data-what="sales" data-from="${from}" data-to="${to}">${icon('download')}<span>${t('nav_sales')}</span></button>
      <button class="btn ghost" data-act="rep-export" data-what="products" data-from="${from}" data-to="${to}">${icon('download')}<span>${t('topProducts')}</span></button>
      <button class="btn ghost" data-act="rep-export" data-what="stock">${icon('download')}<span>${t('stockReport')}</span></button>`)}
    <div class="card"><div class="toolbar"><div class="tabs">${periods.map(x => `<a class="tab ${per === x ? 'on' : ''}" href="#/reports?period=${x}">${t('per_' + x)}</a>`).join('')}</div>
      ${per === 'custom' ? `<label class="sel"><span>${t('from')}</span><input class="input sm" type="date" value="${from}" data-chg="nav-param" data-param="from"></label><label class="sel"><span>${t('to')}</span><input class="input sm" type="date" value="${to}" data-chg="nav-param" data-param="to"></label>` : `<span class="pill">${fmtDate(from)} → ${fmtDate(to)}</span>`}</div>
    <div class="pl">${[['revenue', pr.revenue, ''], ['cogs', -pr.cogs, ''], ['grossProfit', pr.gross, 'b'], ['nav_expenses', -pr.expenses, ''], ['netProfit', pr.net, 'big']].map(([k, v, c]) => `<div class="pl-row ${c} ${v < 0 ? 'neg' : ''}"><span>${t(k)}</span><b>${fmtMoney(v)}</b></div>`).join('')}
      <div class="pl-row"><span>${t('grossMargin')}</span><b>${fmtNum(pct(pr.gross, pr.revenue), 1)}%</b></div><div class="pl-row"><span>${t('invoicesCount')}</span><b>${fmtNum(pr.count)}</b></div><div class="pl-row"><span>${t('avgInvoice')}</span><b>${fmtMoney(pr.count ? pr.revenue / pr.count : 0)}</b></div></div></div>
    <div class="grid-3">${card(t('salesTrend'), barChart(trend), '', 'span-2')}${card(t('salesByCategory'), catItems.length ? donut(catItems, { center: fmtNum(pr.revenue / 1000, 1) + 'k', sub: curLabel() }) : emptyState(t('noData')))}</div>
    <div class="grid-3">${card(t('topProducts'), top.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_productId')}</th><th>${t('f_qty')}</th><th>${t('revenue')}</th><th>${t('profit')}</th></tr></thead><tbody>
      ${top.map(([pid, o]) => `<tr><td><a class="link" href="#/item/${pid}">${esc(prodName(pid))}</a></td><td>${fmtNum(o.qty, 3)}</td><td>${fmtMoney(o.rev)}</td><td>${fmtMoney(o.rev - o.cost)}</td></tr>`).join('')}</tbody></table></div>` : emptyState(t('noData')), '', 'span-2')}
      ${card(t('paymentMethods'), methods.length ? donut(methods, { center: fmtNum(sales.filter(d => d.type === 'sale').length), sub: t('invoicesLbl') }) : emptyState(t('noData')))}</div>
    <div class="grid-2">${card(t('expensesByCategory'), expItems.length ? hbars(expItems) : emptyState(t('noData')))}
      ${card(t('topDebtors'), debtors.length ? `<ul class="list">${debtors.map(x => `<li>${avatar(x.c)}<div><a class="link" href="#/statement/customer/${x.c.id}">${esc(loc(x.c))}</a><small class="ltr">${esc(x.c.phone || '')}</small></div><b>${fmtMoney(x.b)}</b></li>`).join('')}</ul>` : emptyState(t('noData')))}</div>
    ${card(t('stockReport'), `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_categoryId')}</th><th>${t('itemsCount')}</th><th>${t('f_qty')}</th><th>${t('stockValueCost')}</th><th>${t('stockValueRetail')}</th></tr></thead><tbody>
      ${stockByCat.map(r => `<tr><td><span class="dot" style="background:${catColor(r.c.id)}"></span> ${esc(loc(r.c))}</td><td>${fmtNum(r.n)}</td><td>${fmtNum(r.qty, 3)}</td><td>${fmtMoney(r.cost)}</td><td>${fmtMoney(r.retail)}</td></tr>`).join('')}
      <tr class="total-row"><td>${t('total')}</td><td>${fmtNum(sum(stockByCat, r => r.n))}</td><td>${fmtNum(sum(stockByCat, r => r.qty), 3)}</td><td>${fmtMoney(sum(stockByCat, r => r.cost))}</td><td>${fmtMoney(sum(stockByCat, r => r.retail))}</td></tr></tbody></table></div>`)}`;
}
function reportExport(el) {
  const { what, from, to } = el.dataset;
  if (what === 'sales') exportCSV(`sales-${from}-${to}`, [t('f_number'), t('f_date'), t('f_type'), t('f_customerId'), t('subtotal'), t('f_discount'), t('tax'), t('total'), t('f_paid'), t('f_due'), t('f_method')],
    salesIn(from, to).map(d => { const tt = docTotals(d); return [d.number, d.date, t('opt_' + d.type), partyName('customers', d.customerId), tt.sub, tt.disc, tt.tax, tt.total, d.paid, docDue(d), t('opt_' + d.method)]; }));
  else if (what === 'products') { const prod = {}; salesIn(from, to).forEach(d => d.items.forEach(it => { const o = prod[it.productId] = prod[it.productId] || { qty: 0, rev: 0, cost: 0 }; o.qty += sign(d) * it.qty; o.rev += sign(d) * lineTotal(it); o.cost += sign(d) * it.qty * (it.cost || 0); }));
    exportCSV(`product-sales-${from}-${to}`, [t('f_code'), t('f_productId'), t('f_qty'), t('revenue'), t('cogs'), t('profit')], Object.entries(prod).map(([pid, o]) => [DB.get('products', pid)?.code, prodName(pid), round(o.qty), round(o.rev), round(o.cost), round(o.rev - o.cost)])); }
  else exportCSV('stock', [t('f_code'), t('f_barcode'), t('f_name'), t('f_categoryId'), t('f_unit'), t('f_stock'), t('f_minQty'), t('f_cost'), t('f_price'), t('stockValueCost')],
    DB.all('products').filter(isStock).map(p2 => [p2.code, p2.barcode, loc(p2), refLabel('categories', p2.categoryId), t('opt_' + p2.unit), stockOf(p2.id), p2.minQty, p2.cost, p2.price, round(Math.max(0, stockOf(p2.id)) * p2.cost)]));
}
function reorderDraft() {
  const low = lowStock(); if (!low.length) return toast(t('allStocked'));
  const items = low.map(p => ({ productId: p.id, qty: Math.max(1, Math.ceil((+p.minQty || 0) * 3 - Math.max(0, stockOf(p.id)))), price: +p.cost || 0, discount: 0 }));
  docEditor('purchases', { items, paid: 0, method: 'transfer', notes: t('reorderNote') });
}

/* ================= Settings ================= */
function renderSettings() {
  const st = S();
  const f = (k, type = 'text', extra = '') => `<label class="field"><span>${t('f_' + k)}</span><input class="input" type="${type}" name="${k}" value="${esc(st[k] ?? '')}" ${extra}></label>`;
  return `${pageHead(t('nav_settings'), t('sub_settings'))}
    <form id="settings-form">
    ${card(t('businessInfo'), `<div class="form-grid">${f('businessName')}${f('businessNameEn', 'text', 'dir="ltr"')}${f('activity')}${f('activityEn', 'text', 'dir="ltr"')}${f('address')}${f('addressEn', 'text', 'dir="ltr"')}
      ${f('phone', 'tel', 'dir="ltr"')}${f('email', 'email', 'dir="ltr"')}
      <label class="field"><span>${t('f_municipality')}</span><input class="input" name="municipality" value="${esc(st.municipality || '')}" list="dl-mun"><datalist id="dl-mun">${LY_MUNICIPALITIES.map(m => `<option value="${m}">`).join('')}</datalist></label>
      ${f('crNo', 'text', 'dir="ltr"')}${f('taxNo', 'text', 'dir="ltr"')}${f('chamberNo', 'text', 'dir="ltr"')}${f('licenseNo', 'text', 'dir="ltr"')}</div>`)}
    ${card(t('salesSettings'), `<div class="form-grid">${f('currency')}${f('currencyEn', 'text', 'dir="ltr"')}${f('decimals', 'number', 'min="0" max="3"')}${f('taxRate', 'number', 'min="0" max="100" step="any"')}
      <label class="field"><span>${t('f_receiptSize')}</span><select class="input" name="receiptSize">${['80mm', 'A4'].map(v => `<option value="${v}" ${st.receiptSize === v ? 'selected' : ''}>${v === '80mm' ? t('receipt80') : 'A4'}</option>`).join('')}</select></label>
      <label class="field"><span>${t('f_printLang')}</span><select class="input" name="printLang">${PRINT_LANGS.map(v => `<option value="${v}" ${(st.printLang || 'ui') === v ? 'selected' : ''}>${t('opt_pl_' + v)}</option>`).join('')}</select></label>
      ${f('openingCash', 'number', 'step="any"')}${f('openingBank', 'number', 'step="any"')}
      <label class="field full"><span>${t('f_receiptFooter')}</span><input class="input" name="receiptFooter" value="${esc(st.receiptFooter || '')}"></label>
      <label class="field full"><span>${t('f_receiptFooterEn')}</span><input class="input" name="receiptFooterEn" value="${esc(st.receiptFooterEn || '')}" dir="ltr"></label>
      <label class="field row full"><input type="checkbox" name="allowNegativeStock" ${st.allowNegativeStock ? 'checked' : ''}><span>${t('f_allowNegativeStock')}</span></label></div>
      <p class="hint">${t('taxHint')}</p>
      <div class="form-actions"><button class="btn primary" type="button" data-act="settings-save">${icon('check')}<span>${t('save')}</span></button></div>`)}
    </form>
    ${waSettingsCard()}
    ${card(t('dataManagement'), `<p class="hint">${t('dataHint')}</p><div class="btn-row">
      <button class="btn ghost" data-act="backup">${icon('download')}<span>${t('backup')}</span></button>
      <label class="btn ghost">${icon('upload')}<span>${t('restore')}</span><input type="file" accept="application/json,.json" hidden data-chg="restore"></label>
      <button class="btn ghost" data-act="reset-demo">${icon('refresh')}<span>${t('resetDemo')}</span></button>
      <button class="btn danger" data-act="wipe">${icon('trash')}<span>${t('wipeData')}</span></button></div>`)}`;
}
