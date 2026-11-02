/* Dalala Commerce — entity schemas */
'use strict';

const METHODS = ['cash', 'card', 'transfer', 'cheque'];
const periodFilter = { k: 'period', opts: ['today', 'week', 'month', 'lastMonth', 'year'], test: (r, v) => { const [f, to] = periodRange(v); return r.date >= f && r.date <= to; } };
const usedInDocs = pid => DB.all('sales').some(d => d.items.some(i => i.productId === pid)) || DB.all('purchases').some(d => d.items.some(i => i.productId === pid)) || DB.all('adjustments').some(a => a.productId === pid);
const balanceFmt = (b, kind) => `<b class="${b > 0.0005 ? (kind === 'c' ? 'neg' : 'neg') : b < -0.0005 ? 'pos' : ''}">${fmtMoney(Math.abs(b))}</b>${b > 0.0005 ? ` <small class="muted">${t(kind === 'c' ? 'owesUs' : 'weOwe')}</small>` : b < -0.0005 ? ` <small class="muted">${t(kind === 'c' ? 'creditFor' : 'advance')}</small>` : ''}`;

const ENT = {
  products: {
    icon: 'box', edit: ['admin', 'storekeeper'], order: (a, b) => String(a.code).localeCompare(String(b.code)),
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'PRD', unique: 1, dir: 'ltr' },
      { k: 'barcode', type: 'text', dir: 'ltr', unique: 1 },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<a class="who" href="#/item/${r.id}"><span class="dot" style="background:${catColor(r.categoryId)}"></span><span>${esc(loc(r))}</span></a>` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'categoryId', type: 'ref', ref: 'categories', req: 1, list: 1 },
      { k: 'unit', type: 'select', opts: ['piece', 'box', 'carton', 'pack', 'bag', 'bottle', 'can', 'jar', 'set', 'kg', 'liter', 'meter', 'dozen', 'service'], def: 'piece', list: 1 },
      { k: 'kind', type: 'select', opts: ['stock', 'service'], def: 'stock' },
      { k: 'cost', type: 'number', money: 1, list: 1, def: 0 },
      { k: 'price', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'wholesalePrice', type: 'number', money: 1 },
      { k: 'openingQty', type: 'number', def: 0, signed: 1 },
      { k: 'minQty', type: 'number', def: 0 },
      { k: 'stock', type: 'calc', list: 1, get: r => (isStock(r) ? stockOf(r.id) : null), fmt: r => stockBadge(r) },
      { k: 'margin', type: 'calc', list: 1, get: r => (+r.price ? pct(r.price - r.cost, r.price) : 0), fmt: r => `${fmtNum(+r.price ? pct(r.price - r.cost, r.price) : 0, 1)}%` },
      { k: 'active', type: 'bool', def: true },
    ],
    filters: [{ k: 'categoryId' }, { k: 'stockState', opts: ['low', 'out', 'ok'], test: (r, v) => isStock(r) && stockState(r) === v }, { k: 'kind' }],
    validate: r => (+r.price < +r.cost ? t('warnBelowCost') : null),
    blockDelete: id => (usedInDocs(id) ? t('errUsedProduct') : null),
    actions: [{ icon: 'eye', label: 'itemCard', href: r => '#/item/' + r.id }, { icon: 'scale', label: 'adjustStock', roles: ['admin', 'storekeeper'], show: isStock, fn: r => openForm('adjustments', null, { productId: r.id }) }],
    summary: rows => [{ label: t('itemsCount'), value: fmtNum(rows.length) }, { label: t('stockValueCost'), value: moneyText(sum(rows.filter(isStock), p => Math.max(0, stockOf(p.id)) * (+p.cost || 0))) },
      { label: t('lowStockCount'), value: fmtNum(rows.filter(p => isStock(p) && stockState(p) !== 'ok').length), cls: 'b-overdue' }],
  },

  categories: {
    icon: 'tag', edit: ['admin', 'storekeeper'],
    fields: [
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<span class="dot" style="background:${catColor(r.id)}"></span> ${esc(loc(r))}` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'itemsCount', type: 'calc', list: 1, get: r => DB.all('products').filter(p => p.categoryId === r.id).length },
    ],
    blockDelete: id => (DB.all('products').some(p => p.categoryId === id) ? t('errUsedCategory') : null),
  },

  customers: {
    icon: 'users', edit: ['admin', 'accountant', 'cashier'],
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'CUS', unique: 1, dir: 'ltr' },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<a class="who" href="#/statement/customer/${r.id}">${avatar(r)}<span>${esc(loc(r))}</span></a>` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'phone', type: 'tel', list: 1, dir: 'ltr' },
      { k: 'city', type: 'text', list: 1, datalist: () => LY_MUNICIPALITIES },
      { k: 'address', type: 'text' },
      { k: 'taxNo', type: 'text', dir: 'ltr' },
      { k: 'creditLimit', type: 'number', money: 1, def: 0 },
      { k: 'openingBalance', type: 'number', money: 1, def: 0, signed: 1 },
      { k: 'balance', type: 'calc', list: 1, money: 1, get: r => customerBalance(r.id), fmt: r => balanceFmt(customerBalance(r.id), 'c') },
      { k: 'notes', type: 'textarea', full: 1 },
      { k: 'active', type: 'bool', def: true },
    ],
    filters: [{ k: 'balanceState', opts: ['owing', 'settled', 'overLimit'], test: (r, v) => { const b = customerBalance(r.id); return v === 'owing' ? b > 0.0005 : v === 'settled' ? Math.abs(b) <= 0.0005 : (+r.creditLimit && b > +r.creditLimit); } }],
    validate: r => (S().country === 'LY' && r.phone && !isLyPhone(r.phone) ? t('errPhone') : null),
    blockDelete: id => (DB.all('sales').some(s => s.customerId === id) || DB.all('receipts').some(s => s.customerId === id) ? t('errUsedParty') : null),
    actions: [{ icon: 'file', label: 'statement', href: r => '#/statement/customer/' + r.id }, { icon: 'arrowDown', label: 'newReceipt', roles: ['admin', 'accountant', 'cashier'], fn: r => openForm('receipts', null, { customerId: r.id, amount: Math.max(0, customerBalance(r.id)) }) }],
    summary: rows => [{ label: t('totalReceivable'), value: moneyText(sum(rows, r => Math.max(0, customerBalance(r.id)))), cls: 'b-overdue' }, { label: t('count'), value: fmtNum(rows.length) }],
  },

  suppliers: {
    icon: 'truck', edit: ['admin', 'accountant', 'storekeeper'],
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'SUP', unique: 1, dir: 'ltr' },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<a class="who" href="#/statement/supplier/${r.id}">${avatar(r)}<span>${esc(loc(r))}</span></a>` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'phone', type: 'tel', list: 1, dir: 'ltr' },
      { k: 'city', type: 'text', list: 1, datalist: () => LY_MUNICIPALITIES },
      { k: 'address', type: 'text' },
      { k: 'taxNo', type: 'text', dir: 'ltr' },
      { k: 'openingBalance', type: 'number', money: 1, def: 0, signed: 1 },
      { k: 'balance', type: 'calc', list: 1, money: 1, get: r => supplierBalance(r.id), fmt: r => balanceFmt(supplierBalance(r.id), 's') },
      { k: 'notes', type: 'textarea', full: 1 },
      { k: 'active', type: 'bool', def: true },
    ],
    validate: r => (S().country === 'LY' && r.phone && !isLyPhone(r.phone) ? t('errPhone') : null),
    blockDelete: id => (DB.all('purchases').some(s => s.supplierId === id) || DB.all('disbursements').some(s => s.supplierId === id) ? t('errUsedParty') : null),
    actions: [{ icon: 'file', label: 'statement', href: r => '#/statement/supplier/' + r.id }, { icon: 'arrowUp', label: 'newPayment', roles: ['admin', 'accountant'], fn: r => openForm('disbursements', null, { supplierId: r.id, amount: Math.max(0, supplierBalance(r.id)) }) }],
    summary: rows => [{ label: t('totalPayable'), value: moneyText(sum(rows, r => Math.max(0, supplierBalance(r.id)))), cls: 'b-overdue' }, { label: t('count'), value: fmtNum(rows.length) }],
  },

  sales: {
    icon: 'receipt', edit: ['admin', 'cashier', 'accountant'], noEdit: 1, order: (a, b) => (b.date || '').localeCompare(a.date || '') || String(b.number).localeCompare(String(a.number)),
    fields: [
      { k: 'number', type: 'text', list: 1, fmt: r => `<a class="link ltr" href="#/doc/sales/${r.id}">${esc(r.number)}</a>` },
      { k: 'date', type: 'date', list: 1 },
      { k: 'type', type: 'select', opts: ['sale', 'return'], list: 1, badge: 1 },
      { k: 'customerId', type: 'ref', ref: 'customers', list: 1, show: r => partyName('customers', r.customerId) },
      { k: 'total', type: 'calc', money: 1, list: 1, get: docTotal },
      { k: 'paid', type: 'number', money: 1, list: 1 },
      { k: 'due', type: 'calc', money: 1, list: 1, get: r => Math.max(0, docDue(r)) },
      { k: 'method', type: 'select', opts: [...METHODS, 'credit'], list: 1 },
      { k: 'status', type: 'calc', list: 1, get: r => t('opt_' + docStatus(r)), fmt: r => badge(docStatus(r)) },
    ],
    filters: [periodFilter, { k: 'type' }, { k: 'method' }, { k: 'status', opts: ['paid', 'partial', 'credit'], test: (r, v) => docStatus(r) === v }, { k: 'customerId' }],
    onAdd: () => { location.hash = '#/pos'; },
    blockDelete: id => (DB.all('sales').some(s => s.refId === id) ? t('errHasReturns') : null),
    actions: [
      { icon: 'eye', label: 'view', href: r => `#/doc/sales/${r.id}` },
      { icon: 'printer', label: 'print', fn: r => printDoc('sales', r) },
      { icon: 'undo', label: 'makeReturn', roles: ['admin', 'cashier', 'accountant'], show: r => r.type === 'sale', fn: r => startReturn('sales', r) },
    ],
    summary: rows => [
      { label: t('netSales'), value: moneyText(sum(rows, d => sign(d) * docTotal(d))) },
      { label: t('f_paid'), value: moneyText(sum(rows, d => sign(d) * (+d.paid || 0))), cls: 'b-paid' },
      { label: t('f_due'), value: moneyText(sum(rows.filter(d => d.type === 'sale'), d => Math.max(0, docDue(d)))), cls: 'b-overdue' },
      { label: t('invoicesCount'), value: fmtNum(rows.filter(d => d.type === 'sale').length) },
    ],
  },

  purchases: {
    icon: 'truck', edit: ['admin', 'storekeeper', 'accountant'], noEdit: 1, order: (a, b) => (b.date || '').localeCompare(a.date || '') || String(b.number).localeCompare(String(a.number)),
    fields: [
      { k: 'number', type: 'text', list: 1, fmt: r => `<a class="link ltr" href="#/doc/purchases/${r.id}">${esc(r.number)}</a>` },
      { k: 'supplierRef', type: 'text', list: 1 },
      { k: 'date', type: 'date', list: 1 },
      { k: 'type', type: 'select', opts: ['purchase', 'return'], list: 1, badge: 1 },
      { k: 'supplierId', type: 'ref', ref: 'suppliers', list: 1 },
      { k: 'total', type: 'calc', money: 1, list: 1, get: docTotal },
      { k: 'paid', type: 'number', money: 1, list: 1 },
      { k: 'due', type: 'calc', money: 1, list: 1, get: r => Math.max(0, docDue(r)) },
      { k: 'status', type: 'calc', list: 1, get: r => t('opt_' + docStatus(r)), fmt: r => badge(docStatus(r)) },
    ],
    filters: [periodFilter, { k: 'type' }, { k: 'supplierId' }, { k: 'status', opts: ['paid', 'partial', 'credit'], test: (r, v) => docStatus(r) === v }],
    onAdd: () => docEditor('purchases'),
    blockDelete: id => (DB.all('purchases').some(s => s.refId === id) ? t('errHasReturns') : null),
    actions: [
      { icon: 'eye', label: 'view', href: r => `#/doc/purchases/${r.id}` },
      { icon: 'printer', label: 'print', fn: r => printDoc('purchases', r) },
      { icon: 'undo', label: 'makeReturn', roles: ['admin', 'storekeeper', 'accountant'], show: r => r.type === 'purchase', fn: r => startReturn('purchases', r) },
    ],
    summary: rows => [
      { label: t('netPurchases'), value: moneyText(sum(rows, d => sign(d) * docTotal(d))) },
      { label: t('f_paid'), value: moneyText(sum(rows, d => sign(d) * (+d.paid || 0))), cls: 'b-paid' },
      { label: t('f_due'), value: moneyText(sum(rows.filter(d => d.type === 'purchase'), d => Math.max(0, docDue(d)))), cls: 'b-overdue' },
    ],
  },

  receipts: {
    icon: 'arrowDown', edit: ['admin', 'accountant', 'cashier'], order: (a, b) => (b.date || '').localeCompare(a.date || '') || String(b.number).localeCompare(String(a.number)),
    fields: [
      { k: 'number', type: 'text', list: 1, auto: 'RV', unique: 1, dir: 'ltr' },
      { k: 'date', type: 'date', list: 1, def: () => today(), req: 1 },
      { k: 'customerId', type: 'ref', ref: 'customers', req: 1, list: 1 },
      { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'method', type: 'select', opts: METHODS, def: 'cash', list: 1 },
      { k: 'notes', type: 'textarea', full: 1, list: 1 },
    ],
    filters: [periodFilter, { k: 'method' }, { k: 'customerId' }],
    validate: r => (+r.amount <= 0 ? t('errAmount') : null),
    actions: [{ icon: 'printer', label: 'print', fn: r => printVoucher('receipts', r) }],
    afterSave: (r, isNew) => { if (isNew) confirmBox(t('printVoucherQ'), () => printVoucher('receipts', r), { danger: false, okLabel: t('print') }); },
    summary: rows => [{ label: t('total'), value: moneyText(sum(rows, r => r.amount)), cls: 'b-paid' }, { label: t('count'), value: fmtNum(rows.length) }],
  },

  disbursements: {
    icon: 'arrowUp', edit: ['admin', 'accountant'], order: (a, b) => (b.date || '').localeCompare(a.date || '') || String(b.number).localeCompare(String(a.number)),
    fields: [
      { k: 'number', type: 'text', list: 1, auto: 'PV', unique: 1, dir: 'ltr' },
      { k: 'date', type: 'date', list: 1, def: () => today(), req: 1 },
      { k: 'supplierId', type: 'ref', ref: 'suppliers', req: 1, list: 1 },
      { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'method', type: 'select', opts: METHODS, def: 'transfer', list: 1 },
      { k: 'notes', type: 'textarea', full: 1, list: 1 },
    ],
    filters: [periodFilter, { k: 'method' }, { k: 'supplierId' }],
    validate: r => (+r.amount <= 0 ? t('errAmount') : null),
    actions: [{ icon: 'printer', label: 'print', fn: r => printVoucher('disbursements', r) }],
    summary: rows => [{ label: t('total'), value: moneyText(sum(rows, r => r.amount)), cls: 'b-overdue' }, { label: t('count'), value: fmtNum(rows.length) }],
  },

  expenses: {
    icon: 'wallet', edit: ['admin', 'accountant'], order: (a, b) => (b.date || '').localeCompare(a.date || ''),
    fields: [
      { k: 'number', type: 'text', list: 1, auto: 'EX', unique: 1, dir: 'ltr' },
      { k: 'date', type: 'date', list: 1, def: () => today(), req: 1 },
      { k: 'category', type: 'select', opts: ['rent', 'salaries', 'electricity', 'water', 'internet', 'phone', 'transport', 'maintenance', 'marketing', 'government', 'other'], req: 1, list: 1, badge: 1 },
      { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'method', type: 'select', opts: METHODS, def: 'cash', list: 1 },
      { k: 'description', type: 'textarea', full: 1, list: 1 },
    ],
    filters: [periodFilter, { k: 'category' }, { k: 'method' }],
    validate: r => (+r.amount <= 0 ? t('errAmount') : null),
    summary: rows => [{ label: t('total'), value: moneyText(sum(rows, r => r.amount)), cls: 'b-overdue' }, { label: t('count'), value: fmtNum(rows.length) }],
  },

  cashMoves: {
    icon: 'vault', edit: ['admin', 'accountant'], order: (a, b) => (b.date || '').localeCompare(a.date || ''),
    fields: [
      { k: 'number', type: 'text', list: 1, auto: 'CM', unique: 1, dir: 'ltr' },
      { k: 'date', type: 'date', list: 1, def: () => today(), req: 1 },
      { k: 'account', type: 'select', opts: ['cash', 'bank'], optLabel: v => t('acc_' + v), def: 'cash', req: 1, list: 1 },
      { k: 'type', type: 'select', opts: ['in', 'out'], optLabel: v => t('opt_move_' + v), def: 'in', req: 1, list: 1 },
      { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'notes', type: 'textarea', full: 1, list: 1 },
    ],
    validate: r => (+r.amount <= 0 ? t('errAmount') : null),
  },

  adjustments: {
    icon: 'scale', edit: ['admin', 'storekeeper'], order: (a, b) => (b.date || '').localeCompare(a.date || ''),
    fields: [
      { k: 'number', type: 'text', list: 1, auto: 'ADJ', unique: 1, dir: 'ltr' },
      { k: 'date', type: 'date', list: 1, def: () => today(), req: 1 },
      { k: 'productId', type: 'ref', ref: 'products', refFilter: isStock, req: 1, list: 1 },
      { k: 'qty', type: 'number', req: 1, list: 1, signed: 1, fmt: r => `<b class="${r.qty < 0 ? 'neg' : 'pos'}">${r.qty > 0 ? '+' : ''}${fmtNum(r.qty, 3)}</b>` },
      { k: 'reason', type: 'select', opts: ['count', 'damage', 'expired', 'gift', 'internal', 'other'], def: 'count', list: 1, badge: 1 },
      { k: 'notes', type: 'textarea', full: 1, list: 1 },
    ],
    filters: [periodFilter, { k: 'reason' }],
    validate: r => (!+r.qty ? t('errQtyZero') : null),
  },

  users: {
    icon: 'shield', edit: ['admin'],
    fields: [
      { k: 'username', type: 'text', req: 1, list: 1, unique: 1, dir: 'ltr' },
      { k: 'password', type: 'password', req: 1, dir: 'ltr' },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r) },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'role', type: 'select', opts: ['admin', 'cashier', 'accountant', 'storekeeper'], optLabel: v => t('role_' + v), req: 1, list: 1, badge: 1 },
      { k: 'active', type: 'bool', def: true, list: 1 },
    ],
    filters: [{ k: 'role' }],
    canDelete: r => r.id !== USER.id,
  },
};

const REF_LABEL = {
  products: p => `${loc(p)} — ${p.code}`,
  customers: c => loc(c), suppliers: c => loc(c), categories: c => loc(c),
};
const REF_LINK = { customers: c => `#/statement/customer/${c.id}`, suppliers: c => `#/statement/supplier/${c.id}` };

function stockState(p) { const q = stockOf(p.id); return q <= 0 ? 'out' : q <= (+p.minQty || 0) ? 'low' : 'ok'; }
function stockBadge(p) {
  if (!isStock(p)) return `<span class="muted">${t('opt_service')}</span>`;
  const q = stockOf(p.id), s = stockState(p);
  return badge(s === 'ok' ? 'active' : s === 'low' ? 'partial' : 'overdue', `${fmtNum(q, 3)} ${t('opt_' + p.unit)}`);
}
