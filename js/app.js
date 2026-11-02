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
    { id: 'messages', icon: 'whatsapp', roles: ['admin', 'cashier', 'accountant'] },
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
    { id: 'stockcount', icon: 'clipboard', roles: ['admin', 'storekeeper'] },
    { id: 'expiry', icon: 'clock', roles: ['admin', 'storekeeper', 'accountant'] },
    { id: 'labels', icon: 'barcode', roles: ['admin', 'storekeeper'] },
  ] },
  { g: 'g_finance', items: [
    { id: 'treasury', icon: 'vault', roles: ['admin', 'accountant'] },
    { id: 'expenses', icon: 'wallet', roles: ['admin', 'accountant'] },
    { id: 'reports', icon: 'chart', roles: ['admin', 'accountant'] },
    { id: 'accounts', icon: 'scale', roles: ['admin', 'accountant'] },
    { id: 'logs', icon: 'clipboard', roles: ['admin', 'accountant', 'storekeeper', 'cashier'] },
  ] },
  { g: 'g_system', items: [
    { id: 'users', icon: 'shield', roles: ['admin'] },
    { id: 'settings', icon: 'settings', roles: ['admin'] },
  ] },
];
const PAGES = { accounts: p => renderAccounts(p), logs: p => renderLogs(p), dashboard: renderDashboard, pos: renderPOS, doc: renderDoc, statement: renderStatement, item: renderItem, treasury: renderTreasury, reports: renderReports, messages: renderMessages, expiry: renderExpiry, stockcount: renderStockCount, labels: renderLabels, settings: renderSettings };
const PAGE_ROLES = { doc: ['admin', 'cashier', 'accountant', 'storekeeper'], statement: ['admin', 'cashier', 'accountant', 'storekeeper'], item: ALL };
function pageRoles(id) { if (PAGE_ROLES[id]) return PAGE_ROLES[id]; for (const g of MENU) for (const i of g.items) if (i.id === id) return i.roles; return null; }
/* pages that also need a permission (a custom user may have more or fewer than the role) */
const PAGE_PERM = { dashboard: 'viewDashboard', pos: 'createSale', sales: 'viewSales', receipts: 'collect', disbursements: 'collect', products: 'viewStock', adjustments: 'adjustStock', stockcount: 'adjustStock', treasury: 'finance', expenses: 'finance', reports: 'finance', accounts: 'finance' };
function pageAllowed(id) { const r = pageRoles(id); return !!r && r.includes(USER.role) && (!PAGE_PERM[id] || hasPerm(PAGE_PERM[id])); }
const homePage = () => { const pref = USER.role === 'cashier' ? ['pos', 'dashboard'] : ['dashboard', 'pos']; for (const g of [...pref, ...MENU.flatMap(x => x.items.map(i => i.id))]) if (pageAllowed(g)) return g; return 'settings'; };

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
  const ac = S().accent; const rs = document.documentElement.style; if (ac) { rs.setProperty('--primary', ac); rs.setProperty('--primary-2', ac); rs.setProperty('--primary-soft', `color-mix(in srgb, ${ac} 12%, transparent)`); } else { ['--primary', '--primary-2', '--primary-soft'].forEach(v => rs.removeProperty(v)); }
}
function isDark() { const th = document.documentElement.dataset.theme; return th ? th === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function setLang(l) { LANG = l; try { localStorage.setItem('dalala_lang', l); } catch (e) { /* ignore */ } applyPrefs(); render(); }

/* ---------- auth ---------- */
const SESSION_KEY = 'dalala_commerce_session';
function restoreSession() { let id = null; try { id = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ } USER = id ? DB.all('users').find(u => u.id === id && u.active !== false) || null : null; }
function login(username, password) { return loginAsync(username, password); }
function logout() { USER = null; LOCKED = false; $('#lock-screen')?.remove(); try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } location.hash = ''; render(); }

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
        ${pwField('p', t('password'), 'autocomplete="current-password" required')}
        <div class="form-err" hidden>${t('loginError')}</div>
        <button class="btn primary block" type="submit">${t('signIn')}</button>
        ${S().isDemo ? `<div class="demo"><span>${t('demoAccounts')}</span><div>${demos.map(([u, p, r, ic]) => `<button type="button" class="demo-b" data-act="demo-login" data-u="${u}" data-p="${p}">${icon(ic)}<span>${t(r)}</span></button>`).join('')}</div></div>` : ''}
      </form><p class="foot">© ${new Date().getFullYear()} ${t('appName')}</p></div></div>`;
  $('#login-form').addEventListener('submit', async e => { e.preventDefault(); const r = await loginAsync(e.target.u.value, e.target.p.value); if (!r.ok) { const b = $('.form-err', e.target); b.hidden = false; b.textContent = r.msg; } });
}

/* ---------- layout ---------- */
const NAV_PARENT = { doc: p => (p.sub === 'purchases' ? 'purchases' : 'sales'), statement: p => (p.sub === 'supplier' ? 'suppliers' : 'customers'), item: () => 'products' };
function sidebar(page, params) {
  const active = NAV_PARENT[page] ? NAV_PARENT[page](params) : page;
  return `<aside class="sidebar"><div class="brand">${LOGO}<div><b>${t('appName')}</b><small>${esc(loc(S(), 'businessName'))}</small></div></div>
    <nav>${MENU.map(g => { const items = g.items.filter(i => pageAllowed(i.id)); if (!items.length) return '';
      return `<div class="nav-g"><span>${t(g.g)}</span>${items.map(i => `<a href="#/${i.id}" class="nav-i ${active === i.id ? 'on' : ''}">${icon(i.icon)}<span>${t('nav_' + i.id)}</span>${i.id === 'products' && lowStock().length ? `<em class="nb">${lowStock().length}</em>` : ''}</a>`).join('')}</div>`; }).join('')}</nav>
    <div class="side-foot">${icon('vault')} ${t('acc_cash')}: <b>${can(['admin', 'accountant']) ? moneyText(accountBalance('cash')) : '•••'}</b></div></aside>`;
}
function topbar(page, params) {
  const title = { doc: t('document'), statement: t('statement'), item: t('itemCard') }[page] || t('nav_' + page);
  return `<header class="topbar"><button class="icon-btn only-m" data-act="menu">${icon('menu')}</button>
    <div class="crumbs"><span>${t('appName')}</span><b>${title}</b></div><span class="grow"></span>
    ${page !== 'pos' && pageAllowed('pos') ? `<a class="btn primary sm" href="#/pos">${icon('cart')}<span>${t('nav_pos')}</span></a>` : ''}
    ${netBadge()}<button class="btn ghost sm" data-act="lang" title="Language">${icon('globe')}<span>${LANG === 'ar' ? 'EN' : 'ع'}</span></button>
    <button class="icon-btn" data-act="theme" title="${t('theme')}">${icon(isDark() ? 'sun' : 'moon')}</button>
    <div class="user-menu"><button class="user-b" data-act="user-menu">${avatar(USER)}<div><b>${esc(loc(USER))}</b><small>${t('role_' + USER.role)}</small></div></button>
      <div class="dropdown" hidden><button data-act="lock">${icon('key')}<span>${t('lockNow')} <kbd>Ctrl+L</kbd></span></button><button data-act="chpass">${icon('key')}<span>${t('changePassword')}</span></button><button data-act="logout" class="danger-t">${icon('logout')}<span>${t('logout')}</span></button></div></div>
  </header>`;
}

function render() {
  applyPrefs();
  if (DB.fresh) { renderSetup(); return; }
  if (!USER) { renderLogin(); return; }
  let { page, params } = parseHash();
  const roles = pageRoles(page);
  if (!page || !roles || !roles.includes(USER.role) || (PAGE_PERM[page] && !hasPerm(PAGE_PERM[page]))) { page = homePage(); history.replaceState(null, '', '#/' + page); params = {}; }
  if (ENT[page] && params.period) crudState(page).f.period = params.period;
  let content;
  try { content = PAGES[page] ? PAGES[page](params) : renderCrud(page); }
  catch (e) { console.error(e); content = emptyState(t('errorPage') + ': ' + e.message, 'alert'); }
  const scrollY = window.__lastPage === page ? window.scrollY : 0; window.__lastPage = page;
  $('#app').innerHTML = `<div class="shell ${page === 'pos' ? 'is-pos' : ''}">${sidebar(page, params)}<div class="side-back" data-act="menu"></div><div class="main">${topbar(page, params)}<main class="content" id="content">${content}</main></div></div>`;
  window.scrollTo(0, scrollY);
  if (page === 'pos') setTimeout(() => $('#pos-q')?.focus(), 30);
  if (page === 'settings') setTimeout(() => { fillPrinters(); fillBackups(); }, 0);
  autoBackup(); // once a day (no-op when already done today)
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
        <label class="field"><span>${t('newPassword')}</span><input class="input" type="password" name="n" minlength="8" required dir="ltr"></label><div class="form-err" hidden></div></form>`,
      footer: `<button class="btn primary" type="submit" form="pform">${t('save')}</button>` });
    $('#pform', root).addEventListener('submit', async e => { e.preventDefault(); const f = e.target; const b = $('.form-err', f);
      if (!(await checkPassword(USER, f.o.value))) { b.hidden = false; b.textContent = t('wrongPassword'); return; }
      if (f.n.value.length < 8) { b.hidden = false; b.textContent = t('passwordShort8'); return; }
      DB.update('users', USER.id, { password: await hashPassword(f.n.value) }); closeModal(); toast(t('saved')); });
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
    const f = $('#settings-form'); const st = S(); const num = ['decimals', 'taxRate', 'openingCash', 'openingBank', 'autoLockMin', 'expiryAlertDays'];
    ['businessName', 'businessNameEn', 'activity', 'activityEn', 'address', 'addressEn', 'phone', 'email', 'municipality', 'crNo', 'taxNo', 'chamberNo', 'licenseNo', 'currency', 'currencyEn', 'accent', 'receiptSize', 'receiptFooter', 'receiptFooterEn', 'printLang', ...num]
      .forEach(k => { if (f.elements[k]) st[k] = num.includes(k) ? Number(f.elements[k].value) || 0 : f.elements[k].value.trim(); });
    st.decimals = Math.max(0, Math.min(3, Math.round(st.decimals)));
    st.allowNegativeStock = f.elements.allowNegativeStock.checked;
    DB.save(); toast(t('saved')); render();
  },
  backup: () => downloadFile(`dalala-commerce-backup-${today()}.json`, JSON.stringify(DB.d, null, 1), 'application/json'),
  'reset-demo': () => confirmBox(t('resetConfirm'), () => { DB.reset(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }),
  wipe: () => confirmBox(t('wipeConfirm'), () => { DB.wipe(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }),
};
Object.assign(ACT, {
  'pw-eye': el => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; },
  'setup-demo': () => { DB.reset(); USER = null; render(); },
  'switch-user': () => unlockSwitchUser(), lock: () => lockScreen(),
  'pos-hold': () => posHold(), 'pos-held': () => posHeldList(),
  'pos-newcust': () => { window.__onSaved = (r, key) => { if (key === 'customers') { POS.customerId = r.id; refreshPOS(false); } }; openForm('customers'); },
  'doc-edit': el => startEdit(el.dataset.kind, DB.get(el.dataset.kind, el.dataset.id)),
  'count-start': () => countStart(), 'count-post': () => countPost(), 'count-print': el => countPrint(el.dataset.id),
  'count-cancel': () => confirmBox(t('countCancelQ'), () => { DB.remove('stockCounts', openCount().id); render(); }),
  'exp-writeoff': el => writeOffExpired(el.dataset.id),
  'lbl-print': () => labelsPrint(), 'lbl-none': () => { LBL.sel = {}; render(); },
  'lbl-all': () => { const q = norm(LBL.q); DB.all('products').filter(p => p.active !== false && isStock(p) && (!q || norm(loc(p)).includes(q) || String(p.code).toLowerCase().includes(q) || String(p.barcode || '').includes(q))).forEach(p => { LBL.sel[p.id] = LBL.sel[p.id] || 1; }); render(); },
  'day-open': el => dayOpen(el.dataset.date),
  'crud-print': el => printCrud(el.dataset.key),
  'crud-print-html': el => printHTML(`${printHeader(el.dataset.title)}${($(el.dataset.target)?.innerHTML || '').replace(/<button[\s\S]*?<\/button>/g, '').replace('class="table compact"', 'class="ptable small"')}`),
  'new-year': () => newYearDialog(),
  'accent-reset': () => { delete S().accent; DB.save(); render(); },
  'settings-sec-save': () => { const st = S(); st.autoLockMin = Math.max(0, +$('#set-autolock').value || 0); st.expiryAlertDays = Math.max(1, +$('#set-expdays').value || 30); st.accent = $('#set-accent').value; DB.save(); toast(t('saved')); render(); },
});
Object.assign(ACT, {
  'net-test': async () => { const host = $('#net-host').value.trim(), port = +$('#net-port').value || 47630, key = $('#net-key').value.trim();
    if (!host) { toast(t('netHostAddr'), 'err'); return; } const r = await window.dalalaNet.test({ host, port, key });
    toast(r.ok ? (r.keyOk ? t('netTestOk') : t('netBadKey')) : t('netCantReach') + ' — ' + (r.error || ''), r.ok && r.keyOk ? 'ok' : 'err'); },
  'net-save': () => { const mode = ($('input[name=net-mode]:checked') || {}).value || 'local'; const cfg = { mode, port: +$('#net-port').value || 47630 };
    if (mode === 'client') { cfg.host = $('#net-host').value.trim(); cfg.key = $('#net-key').value.trim(); if (!cfg.host || !cfg.key) { toast(t('netNeedHostKey'), 'err'); return; } }
    confirmBox(t('netRestartConfirm'), () => window.dalalaNet.set(cfg)); },
});
Object.assign(ACT, ACT_V22);
Object.assign(ACT, ACT_EXTRA, { 'wa-customer': el => waCustomerCompose(el.dataset.id), 'wa-doc': el => waDocCompose(el.dataset.id) });
const CHG = {
  'net-mode': () => netModeFields(),
  'crud-filter': el => { const st = crudState(el.dataset.key); st.f[el.dataset.f] = el.value; st.page = 1; if (el.dataset.f === 'period' && parseHash().params.period) { location.hash = '#/' + el.dataset.key; return; } render(); },
  'nav-param': el => setParam(el.dataset.param, el.value),
  'print-lang': el => { PRINT_PICK = el.value; },
  'pos-customer': el => { POS.customerId = el.value; refreshPOS(false); },
  'pos-setqty': el => { const it = POS.items[+el.dataset.i]; const v = +el.value; const p = DB.get('products', it.productId);
    if (!(v > 0)) POS.items.splice(+el.dataset.i, 1);
    else if (stockProblem(p, v)) toast(stockProblem(p, v), 'err');
    else it.qty = round(v); refreshPOS(false); },
  'pos-price': el => { const it = POS.items[+el.dataset.i]; if (it && hasPerm('changePrice')) it.price = Math.max(0, +el.value || 0); refreshPOS(false); },
  'pos-discount': el => { POS.discount = Math.max(0, +el.value || 0); refreshPOS(false); },
  'pos-paid': el => { POS.paid = el.value === '' ? '' : Math.max(0, +el.value || 0); refreshPOS(false); },
  restore: el => {
    const file = el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.version || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('bad');
      confirmBox(t('restoreConfirm'), () => restoreData(d)); }
      catch (e) { toast(t('invalidFile'), 'err'); } };
    rd.readAsText(file);
  },
};
Object.assign(CHG, {
  'count-set': el => { const c = openCount(); if (!c) return; c.lines[el.dataset.id].counted = el.value === '' ? '' : Math.max(0, +el.value); DB.save(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  'lbl-q': el => { LBL.q = el.value; render(); }, 'lbl-n': el => { LBL.sel[el.dataset.id] = Math.max(0, Math.floor(+el.value || 0)); render(); },
  'lbl-opt': el => { const k = el.dataset.k; LBL[k] = el.type === 'checkbox' ? el.checked : (['w', 'h'].includes(k) ? Math.max(10, +el.value || 0) : el.value); render(); },
});
let searchTimer;
const INP = {
  'crud-search': el => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { const st = crudState(el.dataset.key); st.q = el.value; st.page = 1; refreshCrud(el.dataset.key); }, 150); },
  'pos-search': el => { POS.q = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { const g = $('#pos-grid'); if (g) g.innerHTML = posGrid(); }, 120); },
};
Object.assign(INP, INP_V22);

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
  if (!USER || LOCKED) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); lockScreen(); return; }
  if (e.key === 'F11') { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); return; }
  if (e.key === 'F5') { e.preventDefault(); if (NET_BOOT) { location.reload(); return; } DB.load(); restoreSession(); render(); return; }
  if (e.key === 'F2' && parseHash().page !== 'pos' && pageAllowed('pos')) { e.preventDefault(); location.hash = '#/pos'; return; }
  if (parseHash().page !== 'pos' || $('#modal-root.open')) return;
  if (e.key === 'F8') { e.preventDefault(); posHold(); return; }
  if (e.key === 'F4') { e.preventDefault(); posHeldList(); return; }
  if (e.key === 'F2') { e.preventDefault(); $('#pos-q')?.focus(); }
  else if (e.key === 'F9') { e.preventDefault(); posPay(); }
  else if (e.key === 'Enter' && e.target.id === 'pos-q') { e.preventDefault(); posScan(e.target.value); }
});
window.addEventListener('hashchange', () => { closeModal(); render(); });
const _origRender = render;
render = function () { if (window.__afterDelete) { const h = window.__afterDelete; window.__afterDelete = null; if (!DB.get(parseHash().params.sub || 'sales', parseHash().params.id)) { location.hash = h; return; } } _origRender(); if (parseHash().page === 'settings' && $('#net-card')) setTimeout(netFillInfo, 0); };
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

if (!(window.dalalaDesktop && window.dalalaDesktop.licensed)) { try { window.stop(); } catch (e) {} document.documentElement.innerHTML = '<head><meta charset="utf-8"><title>Dalala</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font-family:Segoe UI,Tahoma,sans-serif;text-align:center;padding:20px"><div><div style="font-size:54px">🔒</div><h2 style="margin:10px 0">هذه النسخة تعمل فقط من خلال البرنامج المرخّص</h2><p style="color:#94a3b8">This copy only runs inside the licensed Dalala application.</p></div></body>'; throw new Error('unlicensed'); }
if (NET_BOOT) NET_BOOT(() => { restoreSession(); render(); autoBackup(); });
else { DB.load(); restoreSession(); render(); autoBackup(); }
