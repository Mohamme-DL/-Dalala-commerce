/* Dalala Commerce — app shell, routing, auth, events */
'use strict';

let USER = null;
const ALL = ['admin', 'cashier', 'accountant', 'storekeeper'];

const MENU = [
  { g: 'g_main', items: [
    { id: 'dashboard', icon: 'home', roles: ['admin', 'accountant', 'storekeeper'] },
    { id: 'pos', icon: 'cart', roles: ['admin', 'cashier'] },
  ] },
  { g: 'g_sales', items: [
    { id: 'sales', icon: 'receipt', roles: ['admin', 'cashier', 'accountant'] },
    { id: 'customers', icon: 'users', roles: ['admin', 'cashier', 'accountant'] },
    { id: 'receipts', icon: 'arrowDown', roles: ['admin', 'cashier', 'accountant'] },
  ] },
  { g: 'g_purchases', items: [
    { id: 'purchases', icon: 'truck', roles: ['admin', 'storekeeper', 'accountant'] },
    { id: 'suppliers', icon: 'briefcase', roles: ['admin', 'storekeeper', 'accountant'] },
    { id: 'disbursements', icon: 'arrowUp', roles: ['admin', 'accountant'] },
  ] },
  { g: 'g_inventory', items: [
    { id: 'products', icon: 'box', roles: ALL },
    { id: 'categories', icon: 'tag', roles: ['admin', 'storekeeper'] },
    { id: 'adjustments', icon: 'scale', roles: ['admin', 'storekeeper'] },
  ] },
  { g: 'g_finance', items: [
    { id: 'treasury', icon: 'vault', roles: ['admin', 'accountant'] },
    { id: 'expenses', icon: 'wallet', roles: ['admin', 'accountant'] },
    { id: 'reports', icon: 'chart', roles: ['admin', 'accountant'] },
  ] },
  { g: 'g_system', items: [
    { id: 'users', icon: 'shield', roles: ['admin'] },
    { id: 'settings', icon: 'settings', roles: ['admin'] },
  ] },
];
const PAGES = { dashboard: renderDashboard, pos: renderPOS, doc: renderDoc, statement: renderStatement, item: renderItem, treasury: renderTreasury, reports: renderReports, settings: renderSettings };
const PAGE_ROLES = { doc: ['admin', 'cashier', 'accountant', 'storekeeper'], statement: ['admin', 'cashier', 'accountant', 'storekeeper'], item: ALL };
function pageRoles(id) { if (PAGE_ROLES[id]) return PAGE_ROLES[id]; for (const g of MENU) for (const i of g.items) if (i.id === id) return i.roles; return null; }
const homePage = () => (USER.role === 'cashier' ? 'pos' : 'dashboard');

function parseHash() {
  const h = location.hash.replace(/^#\/?/, ''); const [path, qs] = h.split('?'); const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  if (parts.length >= 3) { params.sub = parts[1]; params.id = parts[2]; } else if (parts[1]) params.id = parts[1];
  return { page: parts[0] || '', params };
}
function setParam(k, v) {
  const { page, params } = parseHash(); const pre = [params.sub, params.id].filter(Boolean).join('/'); delete params.id; delete params.sub; params[k] = v;
  location.hash = `#/${page}${pre ? '/' + pre : ''}?${new URLSearchParams(params)}`;
}

/* ---------- theme & language ---------- */
function applyPrefs() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  let theme = null; try { theme = localStorage.getItem('dalala_theme'); } catch (e) { /* ignore */ }
  if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
  document.title = `${t('appName')} — ${loc(S(), 'businessName')}`;
}
function isDark() { const th = document.documentElement.dataset.theme; return th ? th === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function setLang(l) { LANG = l; try { localStorage.setItem('dalala_lang', l); } catch (e) { /* ignore */ } applyPrefs(); render(); }

/* ---------- auth ---------- */
const SESSION_KEY = 'dalala_commerce_session';
function restoreSession() { let id = null; try { id = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ } USER = id ? DB.all('users').find(u => u.id === id && u.active !== false) || null : null; }
function login(username, password) {
  const u = DB.all('users').find(x => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password && x.active !== false);
  if (!u) return false;
  USER = u; try { localStorage.setItem(SESSION_KEY, u.id); } catch (e) { /* ignore */ }
  location.hash = '#/' + homePage(); render(); return true;
}
function logout() { USER = null; try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } location.hash = ''; render(); }

function renderLogin() {
  const demos = [['admin', 'admin123', 'role_admin', 'shield'], ['cashier', 'cashier123', 'role_cashier', 'cart'], ['accountant', 'acc123', 'role_accountant', 'wallet'], ['store', 'store123', 'role_storekeeper', 'box']];
  $('#app').innerHTML = `<div class="login">
    <div class="login-art"><div class="art-inner">${LOGO}<h1>${t('appName')}</h1><p>${t('tagline')}</p>
      <ul>${['feat1', 'feat2', 'feat3', 'feat4'].map(f => `<li>${icon('check')}<span>${t(f)}</span></li>`).join('')}</ul></div>
      <div class="blob b1"></div><div class="blob b2"></div></div>
    <div class="login-form"><div class="lf-top"><button class="btn ghost sm" data-act="lang">${icon('globe')}<span>${LANG === 'ar' ? 'English' : 'العربية'}</span></button>
      <button class="icon-btn" data-act="theme">${icon(isDark() ? 'sun' : 'moon')}</button></div>
      <form id="login-form" class="lf-box"><div class="lf-logo">${LOGO}<div><b>${t('appName')}</b><small>${esc(loc(S(), 'businessName'))}</small></div></div>
        <h2>${t('signIn')}</h2><p class="muted">${t('signInSub')}</p>
        <label class="field"><span>${t('username')}</span><input class="input" name="u" autocomplete="username" dir="ltr" required></label>
        <label class="field"><span>${t('password')}</span><input class="input" name="p" type="password" autocomplete="current-password" dir="ltr" required></label>
        <div class="form-err" hidden>${t('loginError')}</div>
        <button class="btn primary block" type="submit">${t('signIn')}</button>
        <div class="demo"><span>${t('demoAccounts')}</span><div>${demos.map(([u, p, r, ic]) => `<button type="button" class="demo-b" data-act="demo-login" data-u="${u}" data-p="${p}">${icon(ic)}<span>${t(r)}</span></button>`).join('')}</div></div>
      </form><p class="foot">© ${new Date().getFullYear()} ${t('appName')}</p></div></div>`;
  $('#login-form').addEventListener('submit', e => { e.preventDefault(); if (!login(e.target.u.value, e.target.p.value)) $('.form-err', e.target).hidden = false; });
}

/* ---------- layout ---------- */
const NAV_PARENT = { doc: p => (p.sub === 'purchases' ? 'purchases' : 'sales'), statement: p => (p.sub === 'supplier' ? 'suppliers' : 'customers'), item: () => 'products' };
function sidebar(page, params) {
  const active = NAV_PARENT[page] ? NAV_PARENT[page](params) : page;
  return `<aside class="sidebar"><div class="brand">${LOGO}<div><b>${t('appName')}</b><small>${esc(loc(S(), 'businessName'))}</small></div></div>
    <nav>${MENU.map(g => { const items = g.items.filter(i => i.roles.includes(USER.role)); if (!items.length) return '';
      return `<div class="nav-g"><span>${t(g.g)}</span>${items.map(i => `<a href="#/${i.id}" class="nav-i ${active === i.id ? 'on' : ''}">${icon(i.icon)}<span>${t('nav_' + i.id)}</span>${i.id === 'products' && lowStock().length ? `<em class="nb">${lowStock().length}</em>` : ''}</a>`).join('')}</div>`; }).join('')}</nav>
    <div class="side-foot">${icon('vault')} ${t('acc_cash')}: <b>${can(['admin', 'accountant']) ? moneyText(accountBalance('cash')) : '•••'}</b></div></aside>`;
}
function topbar(page, params) {
  const title = { doc: t('document'), statement: t('statement'), item: t('itemCard') }[page] || t('nav_' + page);
  return `<header class="topbar"><button class="icon-btn only-m" data-act="menu">${icon('menu')}</button>
    <div class="crumbs"><span>${t('appName')}</span><b>${title}</b></div><span class="grow"></span>
    ${page !== 'pos' && can(['admin', 'cashier']) ? `<a class="btn primary sm" href="#/pos">${icon('cart')}<span>${t('nav_pos')}</span></a>` : ''}
    <button class="btn ghost sm" data-act="lang" title="Language">${icon('globe')}<span>${LANG === 'ar' ? 'EN' : 'ع'}</span></button>
    <button class="icon-btn" data-act="theme" title="${t('theme')}">${icon(isDark() ? 'sun' : 'moon')}</button>
    <div class="user-menu"><button class="user-b" data-act="user-menu">${avatar(USER)}<div><b>${esc(loc(USER))}</b><small>${t('role_' + USER.role)}</small></div></button>
      <div class="dropdown" hidden><button data-act="chpass">${icon('key')}<span>${t('changePassword')}</span></button><button data-act="logout" class="danger-t">${icon('logout')}<span>${t('logout')}</span></button></div></div>
  </header>`;
}

function render() {
  applyPrefs();
  if (!USER) { renderLogin(); return; }
  let { page, params } = parseHash();
  const roles = pageRoles(page);
  if (!page || !roles || !roles.includes(USER.role)) { page = homePage(); history.replaceState(null, '', '#/' + page); params = {}; }
  if (ENT[page] && params.period) crudState(page).f.period = params.period;
  let content;
  try { content = PAGES[page] ? PAGES[page](params) : renderCrud(page); }
  catch (e) { console.error(e); content = emptyState(t('errorPage') + ': ' + e.message, 'alert'); }
  const scrollY = window.__lastPage === page ? window.scrollY : 0; window.__lastPage = page;
  $('#app').innerHTML = `<div class="shell ${page === 'pos' ? 'is-pos' : ''}">${sidebar(page, params)}<div class="side-back" data-act="menu"></div><div class="main">${topbar(page, params)}<main class="content" id="content">${content}</main></div></div>`;
  window.scrollTo(0, scrollY);
  if (page === 'pos') setTimeout(() => $('#pos-q')?.focus(), 30);
}

/* ---------- actions ---------- */
const ACT = {
  lang: () => setLang(LANG === 'ar' ? 'en' : 'ar'),
  theme: () => { const next = isDark() ? 'light' : 'dark'; try { localStorage.setItem('dalala_theme', next); } catch (e) { /* ignore */ } render(); },
  menu: () => document.body.classList.toggle('nav-open'),
  'user-menu': el => { const d = el.parentElement.querySelector('.dropdown'); d.hidden = !d.hidden; },
  logout: () => logout(),
  'demo-login': el => login(el.dataset.u, el.dataset.p),
  chpass: () => {
    const root = modal({ title: t('changePassword'), size: 'sm',
      body: `<form id="pform" class="form-grid one"><label class="field"><span>${t('currentPassword')}</span><input class="input" type="password" name="o" required dir="ltr"></label>
        <label class="field"><span>${t('newPassword')}</span><input class="input" type="password" name="n" minlength="6" required dir="ltr"></label><div class="form-err" hidden></div></form>`,
      footer: `<button class="btn primary" type="submit" form="pform">${t('save')}</button>` });
    $('#pform', root).addEventListener('submit', e => { e.preventDefault(); const f = e.target; const b = $('.form-err', f);
      if (f.o.value !== USER.password) { b.hidden = false; b.textContent = t('wrongPassword'); return; }
      if (f.n.value.length < 6) { b.hidden = false; b.textContent = t('passwordShort'); return; }
      DB.update('users', USER.id, { password: f.n.value }); closeModal(); toast(t('saved')); });
  },
  'quick-add': el => openForm(el.dataset.key, null, el.dataset.preset ? JSON.parse(el.dataset.preset) : {}),
  'new-purchase': () => docEditor('purchases'),
  reorder: () => reorderDraft(),
  'crud-add': el => (ENT[el.dataset.key].onAdd ? ENT[el.dataset.key].onAdd() : openForm(el.dataset.key)),
  'crud-edit': el => openForm(el.dataset.key, el.dataset.id),
  'crud-del': el => { const k = el.dataset.key; const go = ['sales', 'purchases'].includes(k) && parseHash().page === 'doc'; deleteRecord(k, el.dataset.id); if (go) window.__afterDelete = '#/' + k; },
  'crud-export': el => exportCrud(el.dataset.key),
  'crud-tool': el => ENT[el.dataset.key].tools[+el.dataset.i].fn(),
  'crud-action': el => ENT[el.dataset.key].actions[+el.dataset.i].fn(DB.get(el.dataset.key, el.dataset.id)),
  'crud-sort': el => { const st = crudState(el.dataset.key); if (st.sort === el.dataset.f) st.dir = -st.dir; else { st.sort = el.dataset.f; st.dir = 1; } refreshCrud(el.dataset.key); },
  'crud-page': el => { crudState(el.dataset.key).page = +el.dataset.p; refreshCrud(el.dataset.key); },
  'crud-clear': el => { Object.assign(crudState(el.dataset.key), { q: '', f: {}, page: 1 }); if (parseHash().params.period) location.hash = '#/' + el.dataset.key; else render(); },
  // POS
  'pos-add': el => posAdd(el.dataset.id),
  'pos-cat': el => { POS.cat = el.dataset.c; $$('.chip-b').forEach(b => b.classList.toggle('on', b === el)); refreshPOS(true); },
  'pos-qty': el => { const it = POS.items[+el.dataset.i]; const d = +el.dataset.d; if (d > 0) posAdd(it.productId, 1); else { it.qty = round(it.qty - 1); if (it.qty <= 0) POS.items.splice(+el.dataset.i, 1); refreshPOS(false); } },
  'pos-del': el => { POS.items.splice(+el.dataset.i, 1); refreshPOS(false); },
  'pos-clear': () => confirmBox(t('clearCartQ'), () => { Object.assign(POS, { items: [], discount: 0, paid: '', method: 'cash', customerId: '' }); refreshPOS(false); }),
  'pos-method': el => { POS.method = el.dataset.m; if (POS.method === 'credit') POS.paid = ''; refreshPOS(false); },
  'pos-pay': () => posPay(),
  // documents
  'doc-print': el => printDoc(el.dataset.kind, DB.get(el.dataset.kind, el.dataset.id), el.dataset.size),
  'doc-return': el => startReturn(el.dataset.kind, DB.get(el.dataset.kind, el.dataset.id)),
  'stmt-print': el => withPrintLang('', () => { const col = el.dataset.kind === 'customer' ? 'customers' : 'suppliers'; const p = DB.get(col, el.dataset.id); const lines = statement(el.dataset.kind, p.id);
    printHTML(`${printHeader(t('statement'), esc(loc(p)))}${stmtTable(lines).replace(/<a [^>]*>|<\/a>/g, '').replace('class="table compact"', 'class="ptable"')}<div class="ptotals"><div><span>${t('currentBalance')}</span><b>${moneyText(lines.length ? lines[lines.length - 1].balance : 0)}</b></div></div>`); }),
  'stmt-export': el => exportCSV(`statement-${el.dataset.kind}`, [t('f_date'), t('ref'), t('f_description'), t('debit'), t('credit'), t('f_balance')], statement(el.dataset.kind, el.dataset.id).map(l => [l.date, l.ref, l.desc, l.debit, l.credit, l.balance])),
  'treasury-export': el => { let b = 0; exportCSV(`treasury-${el.dataset.acc}`, [t('f_date'), t('ref'), t('f_description'), t('in'), t('out'), t('f_balance')], moneyMoves().filter(m => m.account === el.dataset.acc).map(m => { b = round(b + m.amount); return [m.date, m.ref, m.desc, m.amount > 0 ? m.amount : '', m.amount < 0 ? -m.amount : '', b]; })); },
  'rep-export': el => reportExport(el),
  'settings-save': () => {
    const f = $('#settings-form'); const st = S(); const num = ['decimals', 'taxRate', 'openingCash', 'openingBank'];
    ['businessName', 'businessNameEn', 'activity', 'activityEn', 'address', 'addressEn', 'phone', 'email', 'municipality', 'crNo', 'taxNo', 'chamberNo', 'licenseNo', 'currency', 'currencyEn', 'receiptSize', 'receiptFooter', 'receiptFooterEn', 'printLang', ...num]
      .forEach(k => { if (f.elements[k]) st[k] = num.includes(k) ? Number(f.elements[k].value) || 0 : f.elements[k].value.trim(); });
    st.decimals = Math.max(0, Math.min(3, Math.round(st.decimals)));
    st.allowNegativeStock = f.elements.allowNegativeStock.checked;
    DB.save(); toast(t('saved')); render();
  },
  backup: () => downloadFile(`dalala-commerce-backup-${today()}.json`, JSON.stringify(DB.d, null, 1), 'application/json'),
  'reset-demo': () => confirmBox(t('resetConfirm'), () => { DB.reset(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }),
  wipe: () => confirmBox(t('wipeConfirm'), () => { DB.wipe(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }),
};
const CHG = {
  'crud-filter': el => { const st = crudState(el.dataset.key); st.f[el.dataset.f] = el.value; st.page = 1; if (el.dataset.f === 'period' && parseHash().params.period) { location.hash = '#/' + el.dataset.key; return; } render(); },
  'nav-param': el => setParam(el.dataset.param, el.value),
  'print-lang': el => { PRINT_PICK = el.value; },
  'pos-customer': el => { POS.customerId = el.value; refreshPOS(false); },
  'pos-setqty': el => { const it = POS.items[+el.dataset.i]; const v = +el.value; const p = DB.get('products', it.productId);
    if (!(v > 0)) POS.items.splice(+el.dataset.i, 1);
    else if (isStock(p) && !S().allowNegativeStock && v > stockOf(p.id)) toast(`${t('errNoStock')}: ${loc(p)} (${fmtNum(stockOf(p.id), 3)})`, 'err');
    else it.qty = round(v); refreshPOS(false); },
  'pos-discount': el => { POS.discount = Math.max(0, +el.value || 0); refreshPOS(false); },
  'pos-paid': el => { POS.paid = el.value === '' ? '' : Math.max(0, +el.value || 0); refreshPOS(false); },
  restore: el => {
    const file = el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.version || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('bad');
      confirmBox(t('restoreConfirm'), () => { DB.d = d; DB.save(); DB.load(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }); }
      catch (e) { toast(t('invalidFile'), 'err'); } };
    rd.readAsText(file);
  },
};
let searchTimer;
const INP = {
  'crud-search': el => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { const st = crudState(el.dataset.key); st.q = el.value; st.page = 1; refreshCrud(el.dataset.key); }, 150); },
  'pos-search': el => { POS.q = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { const g = $('#pos-grid'); if (g) g.innerHTML = posGrid(); }, 120); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!e.target.closest('.user-menu')) $$('.dropdown').forEach(d => { d.hidden = true; });
  if (e.target.closest('.nav-i')) document.body.classList.remove('nav-open');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el); });
document.addEventListener('keydown', e => {
  if (!USER || parseHash().page !== 'pos' || $('#modal-root.open')) return;
  if (e.key === 'F2') { e.preventDefault(); $('#pos-q')?.focus(); }
  else if (e.key === 'F9') { e.preventDefault(); posPay(); }
  else if (e.key === 'Enter' && e.target.id === 'pos-q') { e.preventDefault(); posScan(e.target.value); }
});
window.addEventListener('hashchange', () => { closeModal(); render(); });
const _origRender = render;
render = function () { if (window.__afterDelete) { const h = window.__afterDelete; window.__afterDelete = null; if (!DB.get(parseHash().params.sub || 'sales', parseHash().params.id)) { location.hash = h; return; } } _origRender(); };
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

DB.load();
restoreSession();
render();
