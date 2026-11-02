/* Dalala Commerce — several computers, one database.
   In "host" (main computer) or "client" mode the data lives on the main computer's server.
   This computer keeps a working copy: every DB.save() sends only the records that changed,
   changes from other computers arrive by long-polling, and an offline queue resends anything
   that could not be delivered. In "local" mode nothing here runs. */
'use strict';

const NETCFG = (window.dalalaNet && window.dalalaNet.config) || { mode: 'local' };
const NETSTATE = { on: NETCFG.mode === 'host' || NETCFG.mode === 'client', online: false, pending: 0, version: 0, error: '', lastSync: 0 };
let NET_BOOT = null;

(function () {
  if (!NETSTATE.on) return;
  const clientId = (() => { try { let id = localStorage.getItem('dalala_net_client'); if (!id) { id = uid(); localStorage.setItem('dalala_net_client', id); } return id; } catch (e) { return uid(); } })();
  const QKEY = 'dalala_net_queue', VKEY = 'dalala_net_version';
  const H = { 'x-dalala-key': NETCFG.key || '', 'x-dalala-client': clientId };
  let base = {}, queue = [], sending = false, renderPending = false, polling = false;
  try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { queue = []; }
  NETSTATE.pending = queue.length;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const saveQueue = () => { try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch (e) { /* ignore */ } NETSTATE.pending = queue.length; };
  const setVersion = v => { NETSTATE.version = v; try { localStorage.setItem(VKEY, String(v)); } catch (e) { /* ignore */ } };

  async function req(path, { method = 'GET', body, timeout = 8000 } = {}) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(NETCFG.url + path, { method, headers: { ...H, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store' });
      if (res.status === 401) throw new Error(t('netBadKey'));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally { clearTimeout(tm); }
  }

  /* ---- record-level diff against what the server already has ---- */
  function snapshotOf(d) {
    const b = {}; for (const [k, v] of Object.entries(d || {})) { if (k === 'version') continue;
      if (Array.isArray(v)) b[k] = new Map(v.filter(r => r && r.id).map(r => [r.id, JSON.stringify(r)]));
      else if (v && typeof v === 'object') b[k] = JSON.stringify(v); }
    return b;
  }
  function diff() {
    const ops = [];
    for (const [k, v] of Object.entries(DB.d)) { if (k === 'version') continue;
      if (Array.isArray(v)) {
        const old = base[k] instanceof Map ? base[k] : new Map(); const put = []; const seen = new Set();
        for (const r of v) { if (!r || !r.id) continue; seen.add(r.id); const s = JSON.stringify(r); if (old.get(r.id) !== s) put.push(JSON.parse(s)); }
        const del = [...old.keys()].filter(id => !seen.has(id));
        if (put.length || del.length) ops.push({ col: k, put, del });
      } else if (v && typeof v === 'object') { const s = JSON.stringify(v); if (base[k] !== s) ops.push({ obj: k, value: JSON.parse(s) }); }
    }
    base = snapshotOf(DB.d); return ops;
  }
  const pendingIds = () => { const s = new Set(); queue.forEach(op => (op.put || []).forEach(r => s.add(op.col + '|' + r.id))); return s; };
  function applyEntries(entries) {
    if (!DB.fresh) { const local = diff(); if (local.length) { queue.push(...local); saveQueue(); flush(); } } // never let remote changes swallow unsent local edits
    const mine = pendingIds(); let n = 0;
    for (const e of entries) for (const op of e.ops) {
      if (op.obj) { DB.d[op.obj] = op.value; n++; continue; }
      const arr = Array.isArray(DB.d[op.col]) ? DB.d[op.col] : (DB.d[op.col] = []);
      if (op.del && op.del.length) { const ds = new Set(op.del); DB.d[op.col] = arr.filter(r => !ds.has(r.id)); }
      const tgt = DB.d[op.col]; const idx = new Map(tgt.map((r, i) => [r.id, i]));
      for (const r of op.put || []) { if (mine.has(op.col + '|' + r.id) && e.clientId !== clientId) continue; if (idx.has(r.id)) tgt[idx.get(r.id)] = r; else { idx.set(r.id, tgt.length); tgt.push(r); } }
      n++;
    }
    if (!n) return;
    DB.normalize(); base = snapshotOf(DB.d); DB.v++; cacheLocal();
    if (USER) USER = DB.get('users', USER.id) || USER;
    scheduleRender();
  }
  const origSave = DB.save.bind(DB), origLoad = DB.load.bind(DB);
  const cacheLocal = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(DB.d)); } catch (e) { /* cache only */ } };

  DB.save = function () {
    origSave();
    if (this.fresh) return;
    const ops = diff(); if (ops.length) { queue.push(...ops); saveQueue(); flush(); updateBadge(); }
  };
  DB.load = function () { origLoad(); base = snapshotOf(this.d); };

  async function flush() {
    if (sending || !queue.length) return; sending = true;
    const batch = queue.slice(0, 300);
    try {
      await req('/api/apply', { method: 'POST', body: { ops: batch }, timeout: 20000 });
      queue.splice(0, batch.length); saveQueue(); NETSTATE.online = true; NETSTATE.error = ''; NETSTATE.lastSync = Date.now();
      sending = false; updateBadge(); if (queue.length) flush();
    } catch (e) { NETSTATE.online = false; NETSTATE.error = e.message; sending = false; updateBadge(); setTimeout(flush, 3000); }
  }
  async function reloadSnapshot() {
    const s = await req('/api/snapshot', { timeout: 20000 });
    if (s.data && Object.keys(s.data).length) { DB.d = s.data; DB.d.version = DB.d.version || 1; DB.fresh = false; DB.normalize(); }
    base = snapshotOf(DB.d); setVersion(s.version); DB.v++; cacheLocal(); if (USER) USER = DB.get('users', USER.id) || null;
    return s;
  }
  async function poll() {
    if (polling) return; polling = true;
    for (;;) {
      try {
        const r = await req(`/api/changes?since=${NETSTATE.version}&wait=1&name=${encodeURIComponent(NETCFG.name || '')}`, { timeout: 35000 });
        NETSTATE.online = true; NETSTATE.error = ''; NETSTATE.lastSync = Date.now();
        if (r.reset) { if (!DB.fresh) { const local = diff(); if (local.length) { queue.push(...local); saveQueue(); } } await reloadSnapshot(); scheduleRender(); }
        else { if (r.entries && r.entries.length) applyEntries(r.entries); setVersion(r.version); }
        if (queue.length) flush();
        updateBadge();
      } catch (e) { NETSTATE.online = false; NETSTATE.error = e.message; updateBadge(); await sleep(3000); }
    }
  }

  /* re-render after remote changes, but never under someone's fingers */
  function busy() { const a = document.activeElement; return !!($('#modal-root.open') || LOCKED || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'pos-q')); }
  function scheduleRender() { renderPending = true; }
  setInterval(() => { if (renderPending && USER && !DB.fresh && !busy()) { renderPending = false; const y = window.scrollY; render(); window.scrollTo(0, y); } }, 700);

  function updateBadge() { const b = $('#net-badge'); if (b) b.outerHTML = netBadge(); }

  /* boot: fetch the shared database (or fall back to this computer's last copy when offline) */
  NET_BOOT = async done => {
    $('#app').innerHTML = `<div class="net-boot">${LOGO}<b>${t('netConnecting')}</b><small class="ltr">${esc(NETCFG.url)}</small></div>`;
    try {
      const s = await req('/api/snapshot', { timeout: 7000 });
      NETSTATE.online = true;
      if (s.data && Object.keys(s.data).length) { await reloadSnapshot(); }
      else {
        origLoad();
        if (NETCFG.mode === 'host' && !DB.fresh) { const r = await req('/api/init', { method: 'POST', body: { data: DB.d }, timeout: 60000 }); setVersion(r.version); } // first start as main computer: share this computer's data
        else if (!DB.fresh) { DB.d = emptyData(); DB.fresh = true; } // empty main computer: start the setup there or here
        else setVersion(s.version);
        base = snapshotOf(DB.d);
      }
    } catch (e) {
      NETSTATE.online = false; NETSTATE.error = e.message; origLoad(); base = snapshotOf(DB.d);
      try { NETSTATE.version = +localStorage.getItem(VKEY) || 0; } catch (e2) { NETSTATE.version = 0; }
      if (DB.fresh) { $('#app').innerHTML = `<div class="net-boot err">${icon('alert')}<b>${t('netCantReach')}</b><small class="ltr">${esc(NETCFG.url)} — ${esc(e.message)}</small><p>${t('netCantReachHint')}</p><div class="btn-row"><button class="btn primary" onclick="location.reload()">${t('retry')}</button><button class="btn ghost" onclick="confirm(t('netRestartConfirm')) && window.dalalaNet.set({ mode: 'local', port: ${+NETCFG.port || 47630} })">${t('netGoLocal')}</button></div></div>`; poll(); return; }
    }
    if (queue.length) flush();
    poll(); done();
  };
})();

function netBadge() {
  if (!NETSTATE.on) return '';
  const role = NETCFG.mode === 'host' ? t('netHostShort') : t('netClientShort');
  return `<span id="net-badge" class="net-badge ${NETSTATE.online ? 'on' : 'off'}" title="${esc(NETSTATE.error || NETCFG.url)}">${icon('globe')}<span>${role} · ${NETSTATE.online ? t('netOnline') : t('netOffline')}${NETSTATE.pending ? ` (${fmtNum(NETSTATE.pending)} ${t('netPending')})` : ''}</span></span>`;
}

/* settings card (desktop only) */
function netSettingsCard() {
  if (!window.dalalaNet || USER.role !== 'admin') return '';
  const c = NETCFG; const m = c.mode || 'local';
  return `<section class="card" id="net-card"><div class="card-head"><h3>${icon('globe')} ${t('netTitle')}</h3>${netBadge()}</div><div class="card-body">
    <p class="hint">${t('netIntro')}</p>
    <div class="net-modes">${['local', 'host', 'client'].map(k => `<label class="net-mode ${m === k ? 'on' : ''}"><input type="radio" name="net-mode" value="${k}" ${m === k ? 'checked' : ''} data-chg="net-mode"><b>${t('netMode_' + k)}</b><small>${t('netModeHint_' + k)}</small></label>`).join('')}</div>
    <div class="form-grid" id="net-fields">
      <label class="field net-c"><span>${t('netHostAddr')}</span><input class="input" id="net-host" dir="ltr" value="${esc(c.host || '')}" placeholder="192.168.1.10"></label>
      <label class="field net-c"><span>${t('netKey')}</span><input class="input" id="net-key" dir="ltr" value="${esc(m === 'client' ? c.key || '' : '')}" placeholder="XXXX-XXXX"></label>
      <label class="field"><span>${t('netPort')}</span><input class="input" id="net-port" type="number" dir="ltr" value="${esc(c.port || 47630)}"></label>
    </div>
    <div id="net-info"></div>
    <div class="form-actions"><button class="btn ghost net-c" type="button" data-act="net-test">${icon('refresh')}<span>${t('netTest')}</span></button>
      <button class="btn primary" type="button" data-act="net-save">${icon('check')}<span>${t('netSaveRestart')}</span></button></div>
    <p class="hint">${t('netWarn')}</p></div></section>`;
}
async function netFillInfo() {
  const box = $('#net-info'); if (!box || !window.dalalaNet) return;
  netModeFields();
  const i = await window.dalalaNet.info();
  if (NETCFG.mode === 'host') {
    const clients = (i.server && i.server.clients) || [];
    box.innerHTML = `<div class="net-host-info"><div><span>${t('netThisAddr')}</span><b class="ltr">${(i.ips || []).join(' / ') || '—'}</b></div><div><span>${t('netPort')}</span><b class="ltr">${esc(i.port)}</b></div>
      <div><span>${t('netKey')}</span><b class="ltr net-key">${esc(i.key || '—')}</b></div><div><span>${t('netDevices')}</span><b>${fmtNum(clients.filter(x => x.online).length)} ${t('netOnlineNow')}</b></div></div>
      ${clients.length ? `<ul class="list">${clients.map(x => `<li>${icon('store')}<div><b>${esc(x.name || x.id.slice(0, 6))}</b><small class="ltr">${esc(String(x.ip || '').replace('::ffff:', ''))} · ${new Date(x.lastSeen).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</small></div>${badge(x.online ? 'active' : 'withdrawn', x.online ? t('netOnline') : t('netOffline'))}</li>`).join('')}</ul>` : ''}
      ${i.serverError ? `<p class="form-err">${esc(i.serverError)}</p>` : ''}<p class="hint">${t('netHostHint')}</p>`;
  } else box.innerHTML = '';
}
function netModeFields() { const m = ($('input[name=net-mode]:checked') || {}).value || 'local'; $$('.net-c').forEach(el => { el.hidden = m !== 'client'; }); $$('.net-mode').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); }
