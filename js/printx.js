/* Dalala Commerce — print designs: A4 invoice, thermal receipt (one continuous strip, never split
   into pages), payment vouchers and the common report header. */
'use strict';

const PX = {
  accent: () => S().accent || '#059669',
  paper: () => (+(PP().paperWidth) === 58 ? 58 : 80), // thermal roll width, per computer
  logo: () => LOGO.replace(/lg1/g, 'lgx' + Math.random().toString(36).slice(2, 6)),
  userName: u => { const x = DB.all('users').find(z => z.username === u); return x ? loc(x) : (u || ''); },
  time: d => new Date(d.createdAt || Date.now()).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }),
  ids: () => { const st = S(); return [['crNo', st.crNo], ['taxNo', st.taxNo], ['chamberNo', st.chamberNo], ['licenseNo', st.licenseNo]].filter(x => x[1]).map(([k, v]) => `<span>${t('f_' + k)}: <b class="ltr">${esc(v)}</b></span>`).join(''); },
};

/* report / list header used by every A4 print */
printHeader = function (title, sub = '') { // eslint-disable-line no-global-assign
  const st = S();
  return `<div class="px-head" style="--ac:${PX.accent()}"><div class="px-biz">${PX.logo()}<div><h2>${esc(loc(st, 'businessName'))}</h2>${loc(st, 'activity') ? `<p>${esc(loc(st, 'activity'))}</p>` : ''}
      <p>${esc(loc(st, 'address') || '')}${st.phone ? ` · <span class="ltr">${esc(st.phone)}</span>` : ''}</p>${PX.ids() ? `<p class="px-ids">${PX.ids()}</p>` : ''}</div></div>
    <div class="px-title"><b>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ''}<small>${fmtDate(today())} · ${new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</small></div></div>`;
};

/* ---------- A4 invoice ---------- */
function a4Invoice(kind, d) {
  const st = S(); const tt = docTotals(d); const isSales = kind === 'sales'; const ret = d.type === 'return';
  const party = DB.get(isSales ? 'customers' : 'suppliers', isSales ? d.customerId : d.supplierId);
  const ref = d.refId ? DB.get(kind, d.refId) : null; const rem = ret ? Math.max(0, docDue(d)) : docRemaining(d);
  const status = docStatus(d); const qtySum = sum(d.items, it => +it.qty || 0);
  const qr = (() => { try { return QrCode.svg(`${loc(st, 'businessName')}\n${d.number}\n${d.date}\n${money(tt.total)} ${curLabel()}`.slice(0, 200)); } catch (e) { return ''; } })();
  const row = (l, v, cls = '') => `<div class="${cls}"><span>${l}</span><b>${v}</b></div>`;
  return `<div class="inv" style="--ac:${PX.accent()}">
    <div class="inv-head"><div class="px-biz">${PX.logo()}<div><h2>${esc(loc(st, 'businessName'))}</h2>${loc(st, 'activity') ? `<p>${esc(loc(st, 'activity'))}</p>` : ''}<p>${esc(loc(st, 'address') || '')}</p>
        <p>${st.phone ? `<span class="ltr">${esc(st.phone)}</span>` : ''}${st.email ? ` · <span class="ltr">${esc(st.email)}</span>` : ''}</p>${PX.ids() ? `<p class="px-ids">${PX.ids()}</p>` : ''}</div></div>
      <div class="inv-title"><h1>${esc(docLabel(kind, d))}</h1><div class="inv-no ltr">${esc(d.number)}</div><div>${fmtDate(d.date, { year: 'numeric', month: 'long', day: 'numeric' })} · ${PX.time(d)}</div><span class="inv-st st-${status}">${t('opt_' + status)}</span></div></div>
    <div class="inv-cards">
      <div class="inv-card"><small>${t(isSales ? (ret ? 'returnFrom' : 'billTo') : 'supplierLbl')}</small><b>${esc(party ? loc(party) : t('walkIn'))}</b>
        ${party?.phone ? `<span>${t('f_phone')}: <b class="ltr">${esc(party.phone)}</b></span>` : ''}${party?.address ? `<span>${esc(party.address)}</span>` : ''}${party?.taxNo ? `<span>${t('f_taxNo')}: ${esc(party.taxNo)}</span>` : ''}</div>
      <div class="inv-card"><small>${t('details')}</small>
        <span>${t('f_method')}: <b>${t('opt_' + d.method)}</b></span>${d.user ? `<span>${t(isSales ? 'cashierLbl' : 'byUser')}: <b>${esc(PX.userName(d.user))}</b></span>` : ''}
        ${d.supplierRef ? `<span>${t('f_supplierRef')}: <b class="ltr">${esc(d.supplierRef)}</b></span>` : ''}${ref ? `<span>${t('returnOf')}: <b class="ltr">${esc(ref.number)}</b></span>` : ''}
        <span>${t('itemsCount')}: <b>${fmtNum(d.items.length)}</b> · ${t('f_qty')}: <b>${fmtNum(qtySum, 3)}</b></span></div></div>
    <table class="inv-table"><thead><tr><th>#</th><th>${t('f_productId')}</th><th>${t('f_unit')}</th><th>${t('f_qty')}</th><th>${t(isSales ? 'f_price' : 'f_cost')}</th><th>${t('f_discount')}</th><th>${t('total')}</th></tr></thead>
      <tbody>${d.items.map((it, i) => { const p = DB.get('products', it.productId); return `<tr><td>${i + 1}</td><td class="nm">${esc(prodName(it.productId))}${p?.barcode || p?.code ? `<small class="ltr">${esc(p.barcode || p.code)}</small>` : ''}${it.expiry ? `<small>${t('f_expiry')}: ${fmtDate(it.expiry)}</small>` : ''}</td><td>${t('opt_' + (p?.unit || 'piece'))}</td><td>${fmtNum(it.qty, 3)}</td><td>${money(it.price)}</td><td>${+it.discount ? money(it.discount) : '—'}</td><td><b>${money(lineTotal(it))}</b></td></tr>`; }).join('')}</tbody></table>
    <div class="inv-bottom">
      <div class="inv-notes">${qr ? `<div class="inv-qr">${qr}</div>` : ''}<div>${d.notes ? `<p><b>${t('f_notes')}:</b> ${esc(d.notes)}</p>` : ''}${isSales && receiptFooterText() ? `<p class="muted">${esc(receiptFooterText())}</p>` : ''}</div></div>
      <div class="inv-totals">${row(t('subtotal'), moneyText(tt.sub))}${tt.disc ? row(t('f_discount'), '− ' + moneyText(tt.disc)) : ''}${tt.tax ? row(`${t('tax')} ${fmtNum(d.taxRate, 2)}%`, moneyText(tt.tax)) : ''}
        ${row(t('total'), moneyText(tt.total), 'grand')}${row(t(ret ? 'refundAmount' : 'f_paid'), moneyText(d.paid))}${rem > 0.0005 ? row(t('remainingLbl'), moneyText(rem), 'due') : ''}
        ${party && !ret ? row(t('balanceAfter'), moneyText(Math.abs(isSales ? customerBalance(party.id) : supplierBalance(party.id)))) : ''}</div></div>
    <div class="psign"><div>${t('receiverSign')}</div><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div>
    <div class="inv-foot">${t('thanksDealing')} · ${esc(loc(st, 'businessName'))}</div></div>`;
}

/* ---------- thermal receipt ---------- */
function thermalReceipt(kind, d) {
  const st = S(); const tt = docTotals(d); const isSales = kind === 'sales'; const ret = d.type === 'return'; const W = PX.paper();
  const party = DB.get(isSales ? 'customers' : 'suppliers', isSales ? d.customerId : d.supplierId);
  const qtySum = sum(d.items, it => +it.qty || 0); const rem = ret ? Math.max(0, docDue(d)) : docRemaining(d);
  let bar = ''; try { bar = Code128.svg(d.number, { height: 40 }); } catch (e) { bar = ''; }
  const r = (l, v, cls = '') => `<div class="rc-r ${cls}"><span>${l}</span><b>${v}</b></div>`;
  return `<div class="rx rx-${W}">
    <div class="rx-head">${st.logo ? '' : PX.logo()}<b>${esc(loc(st, 'businessName'))}</b>${loc(st, 'activity') ? `<small>${esc(loc(st, 'activity'))}</small>` : ''}<small>${esc(loc(st, 'address') || '')}</small>${st.phone ? `<small class="ltr">${esc(st.phone)}</small>` : ''}${st.taxNo ? `<small>${t('f_taxNo')}: ${esc(st.taxNo)}</small>` : ''}</div>
    <div class="rx-title">${esc(docLabel(kind, d))}<span class="ltr">${esc(d.number)}</span></div>
    <div class="rx-meta"><span>${t('f_date')}: <b>${fmtDate(d.date)} ${PX.time(d)}</b></span>${d.user ? `<span>${t('cashierLbl')}: <b>${esc(PX.userName(d.user))}</b></span>` : ''}<span>${t(isSales ? 'f_customerId' : 'f_supplierId')}: <b>${esc(party ? loc(party) : t('walkIn'))}</b></span></div>
    ${d.items.length > 40 ? `<table class="rx-tbl"><colgroup><col class="c-nm"><col class="c-q"><col class="c-p"><col class="c-t"></colgroup>
      <thead><tr><th>${t('f_productId')}</th><th>${t('f_qty')}</th><th>${t('f_price')}</th><th>${t('total')}</th></tr></thead>
      <tbody>${d.items.map((it, i) => `<tr><td class="nm">${i + 1}. ${esc(prodName(it.productId))}</td><td class="q">${fmtNum(it.qty, 3)}</td><td class="p">${money(it.price)}</td><td class="t">${money(lineTotal(it))}</td></tr>`).join('')}</tbody></table>` : `<div class="rx-items">${d.items.map((it, i) => `<div class="rx-it"><div class="rx-nm">${i + 1}. ${esc(prodName(it.productId))}</div><div class="rx-ln"><span><span class="ltr">${fmtNum(it.qty, 3)} × ${money(it.price)}</span>${+it.discount ? ` <small>(${t('f_discount')} ${money(it.discount)})</small>` : ''}</span><b>${money(lineTotal(it))}</b></div></div>`).join('')}</div>`}
    <div class="rx-count">${t('itemsCount')}: ${fmtNum(d.items.length)} · ${t('f_qty')}: ${fmtNum(qtySum, 3)}</div>
    <div class="rx-tot">${r(t('subtotal'), money(tt.sub))}${tt.disc ? r(t('f_discount'), '− ' + money(tt.disc)) : ''}${tt.tax ? r(`${t('tax')} ${fmtNum(d.taxRate, 2)}%`, money(tt.tax)) : ''}
      <div class="rx-grand"><span>${t('total')}</span><b>${money(tt.total)} ${esc(curLabel())}</b></div>
      ${r(`${t(ret ? 'refundAmount' : 'f_paid')} (${t('opt_' + d.method)})`, money(d.paid))}${rem > 0.0005 ? r(t('remainingLbl'), money(rem), 'rx-due') : ''}</div>
    ${receiptFooterText() ? `<div class="rx-foot">${esc(receiptFooterText())}</div>` : ''}
    ${bar ? `<div class="rx-bar">${bar}<span class="ltr">${esc(d.number)}</span></div>` : ''}
    <div class="rx-end">${t('thanksDealing')}</div></div>`;
}

renderPrintDoc = function (kind, d, size) { // eslint-disable-line no-global-assign
  size = size || (kind === 'sales' ? S().receiptSize : 'A4');
  if (size === '80mm') printHTML(thermalReceipt(kind, d), 'rcpt-mode');
  else printHTML(a4Invoice(kind, d));
};

/* ---------- payment / receipt vouchers ---------- */
renderPrintVoucher = function (kind, r) { // eslint-disable-line no-global-assign
  const isR = kind === 'receipts'; const party = DB.get(isR ? 'customers' : 'suppliers', isR ? r.customerId : r.supplierId); const col = isR ? 'sales' : 'purchases';
  const alloc = (r.alloc || []).map(a => ({ d: DB.get(col, a.docId), amount: a.amount })).filter(a => a.d);
  const bal = party ? (isR ? customerBalance(party.id) : supplierBalance(party.id)) : 0;
  printHTML(`${printHeader(t(isR ? 'receiptVoucher' : 'paymentVoucher'), `<span class="ltr">${esc(r.number)}</span>`)}
    <div class="vc" style="--ac:${PX.accent()}">
      <div class="vc-amount"><small>${t('f_amount')}</small><b>${moneyText(r.amount)}</b></div>
      <div class="inv-cards"><div class="inv-card"><small>${t(isR ? 'receivedFrom' : 'paidTo')}</small><b>${esc(party ? loc(party) : '—')}</b>${party?.phone ? `<span class="ltr">${esc(party.phone)}</span>` : ''}</div>
        <div class="inv-card"><small>${t('details')}</small><span>${t('f_date')}: <b>${fmtDate(r.date)}</b></span><span>${t('f_method')}: <b>${t('opt_' + r.method)}</b></span><span>${t('balanceAfter')}: <b>${moneyText(Math.abs(bal))}</b></span>${r.user ? `<span>${t('byUser')}: <b>${esc(PX.userName(r.user))}</b></span>` : ''}</div></div>
      ${alloc.length ? `<table class="inv-table"><thead><tr><th>${t('f_number')}</th><th>${t('f_date')}</th><th>${t('total')}</th><th>${t('allocated')}</th><th>${t('remainingLbl')}</th></tr></thead><tbody>${alloc.map(a => `<tr><td class="ltr">${esc(a.d.number)}</td><td>${fmtDate(a.d.date)}</td><td>${money(docTotal(a.d))}</td><td><b>${money(a.amount)}</b></td><td>${money(docRemaining(a.d))}</td></tr>`).join('')}</tbody></table>` : ''}
      ${r.notes ? `<p><b>${t('f_notes')}:</b> ${esc(r.notes)}</p>` : ''}
      <div class="psign"><div>${t(isR ? 'payerSign' : 'receiverSign')}</div><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div></div>`);
};

/* ---------- page size: thermal receipts print as ONE continuous page ---------- */
const RX_MAX_MM = 4900; // keep under the 5080 mm (200 in) page limit of the print system
function receiptHeightMm(html, zoom = 1) {
  const W = PX.paper(); const box = document.createElement('div');
  box.style.cssText = `position:absolute;left:-10000px;top:0;width:${W}mm;visibility:hidden;background:#fff${zoom < 1 ? `;zoom:${zoom}` : ''}`; box.className = 'print-measure';
  box.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr'); box.innerHTML = html; document.body.appendChild(box);
  const px = box.getBoundingClientRect().height * (zoom < 1 ? 1 : 1); box.remove();
  return Math.ceil(px * 25.4 / 96) + 8; // + a little paper at the end for the cutter
}
function setPageStyle(mode, html) {
  let el = document.getElementById('page-style'); if (!el) { el = document.createElement('style'); el.id = 'page-style'; document.head.appendChild(el); }
  if (mode === 'rcpt-mode') {
    // one continuous page as long as the receipt; print systems allow up to ~5 m per page (PDF limit), so very long
    // receipts get a slightly smaller font instead of being cut into pages
    const W = PX.paper(); let H = receiptHeightMm(html); let zoom = 1;
    if (H > RX_MAX_MM) { zoom = Math.max(0.55, (RX_MAX_MM - 10) / H); H = Math.ceil(receiptHeightMm(html, zoom)); }
    el.textContent = `@media print { @page { size: ${W}mm ${H}mm; margin: 0; } html, body { width: ${W}mm; } ${zoom < 1 ? `#print-area .rx { zoom: ${zoom.toFixed(3)}; }` : ''} }`; return { W, H };
  }
  if (mode === 'labels-mode') { el.textContent = ''; return null; }
  el.textContent = '@media print { @page { size: A4; margin: 12mm 12mm 14mm; } }'; return null;
}
(function () {
  const inner = printHTML;
  printHTML = function (html, mode = '') { // eslint-disable-line no-global-assign
    const size = setPageStyle(mode, html); window.__pageSize = size;
    return inner(html, mode);
  };
})();
