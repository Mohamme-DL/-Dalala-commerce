/* Dalala — WhatsApp messaging through click-to-chat links (wa.me).
   No WhatsApp Business API account is needed: the message is prepared here and
   WhatsApp opens with it ready; the user presses "send". Each app defines WA_DEFAULTS
   (default templates) and WA_TYPES (the message kinds shown in the settings editor). */
'use strict';

ICONS.whatsapp = '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1.3-1.6-2.3-1.1-.9 1a4.5 4.5 0 0 1-2.4-2.4l1-.9-1.1-2.3z"/>';

/* Normalise any local/international number to wa.me format (digits, country code, no +). */
function waPhone(raw) {
  let d = String(raw || '').replace(/\D/g, ''); const cc = String(S().waCountryCode || '218').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (cc && d.startsWith(cc)) { /* already international */ }
  else if (d.startsWith('0')) d = cc + d.slice(1);
  else if (d.length <= 10) d = cc + d;
  return d.length >= 10 && d.length <= 15 ? d : '';
}
function waFill(tpl, vars) { return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)).replace(/\n{3,}/g, '\n\n').trim(); }
function waTemplate(key) {
  const st = S(); const en = typeof waEn === 'function' && waEn() && typeof WA_DEFAULTS_EN !== 'undefined';
  return (en ? (st.waTemplatesEn || {})[key] || WA_DEFAULTS_EN[key] : null) || (st.waTemplates && st.waTemplates[key]) || WA_DEFAULTS[key] || '';
}
const waUrl = (phone, text) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

function waLog(entry) {
  DB.d.waLog = DB.d.waLog || [];
  DB.d.waLog.push({ id: uid(), at: Date.now(), user: USER?.username || '', ...entry });
  if (DB.d.waLog.length > 3000) DB.d.waLog.splice(0, DB.d.waLog.length - 3000);
  DB.save();
}
function waOpen(phone, text, meta = {}) {
  const p = waPhone(phone); if (!p) { toast(t('waNoPhone'), 'err'); return false; }
  window.open(waUrl(p, text), '_blank', 'noopener');
  waLog({ phone: p, type: meta.type || 'custom', to: meta.to || '', ref: meta.ref || '', text: String(text).slice(0, 600) });
  return true;
}

/* Compose dialog: pick a message kind (when several), edit the text and the number, then send. */
function waCompose({ title, to = '', phone = '', choices }) {
  const opts = choices.filter(Boolean);
  const root = modal({ title: `${t('waSendTitle')} — ${esc(title || to)}`, size: 'sm',
    body: `<div class="form-grid one">
      ${opts.length > 1 ? `<label class="field"><span>${t('waType')}</span><select class="input" id="wa-kind">${opts.map((c, i) => `<option value="${i}">${esc(c.label)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>${t('waPhoneLbl')}${to ? ` — ${esc(to)}` : ''}</span><input class="input" id="wa-phone" value="${esc(phone)}" dir="ltr" placeholder="09XXXXXXXX"></label>
      <label class="field"><span>${t('waMessage')}</span><textarea class="input wa-text" id="wa-text" rows="11" dir="auto">${esc(opts[0].text)}</textarea></label>
      <div class="form-err" hidden></div></div>`,
    footer: `<button class="btn ghost" data-copy>${icon('file')}<span>${t('copyText')}</span></button><span class="grow"></span><button class="btn wa" data-send>${icon('whatsapp')}<span>${t('waSend')}</span></button>` });
  const kind = $('#wa-kind', root);
  if (kind) kind.onchange = () => { $('#wa-text', root).value = opts[+kind.value].text; };
  $('[data-copy]', root).onclick = () => { try { navigator.clipboard.writeText($('#wa-text', root).value); toast(t('copied')); } catch (e) { toast(t('copyFailed'), 'err'); } };
  $('[data-send]', root).onclick = () => {
    const c = opts[kind ? +kind.value : 0]; const ph = $('#wa-phone', root).value;
    if (!waPhone(ph)) { const b = $('.form-err', root); b.hidden = false; b.textContent = t('waNoPhone'); return; }
    if (waOpen(ph, $('#wa-text', root).value, { type: c.type || 'custom', to, ref: c.ref || '' })) closeModal();
  };
}

/* Bulk queue: a list of prepared messages; each row opens WhatsApp, "send next" walks the list. */
const WAQ = { rows: [], sent: new Set(), sig: '' };
function waQueueSet(rows, sig) { if (WAQ.sig !== sig) { WAQ.sent = new Set(); WAQ.sig = sig; } WAQ.rows = rows; }
function waQueueHtml() {
  const rows = WAQ.rows; const ok = rows.filter(r => waPhone(r.phone)).length; const done = rows.filter(r => WAQ.sent.has(r.key)).length;
  if (!rows.length) return emptyState(t('waNoRecipients'), 'users');
  return `<div class="summary"><div class="sum-item"><span>${t('waRecipients')}</span><b>${fmtNum(rows.length)}</b></div><div class="sum-item s-P"><span>${t('waSentCount')}</span><b id="wa-done">${fmtNum(done)}</b></div>
      <div class="sum-item s-A"><span>${t('waNoPhoneCount')}</span><b>${fmtNum(rows.length - ok)}</b></div>
      <div class="sum-item wa-next-box"><button class="btn wa block" data-act="wa-next" ${done >= ok ? 'disabled' : ''}>${icon('whatsapp')}<span>${t('waSendNext')}</span></button></div></div>
    <p class="hint">${t('waQueueHint')}</p>
    <div class="wa-list">${rows.map((r, i) => { const has = !!waPhone(r.phone), sent = WAQ.sent.has(r.key);
      return `<div class="wa-row ${sent ? 'sent' : ''} ${has ? '' : 'nophone'}" id="wa-r${i}"><div class="wa-meta"><b>${esc(r.to)}</b><small class="ltr">${esc(r.phone || t('waNoPhoneShort'))}</small>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>
        <details><summary>${t('waPreview')}</summary><pre class="wa-pre" dir="auto">${esc(r.text)}</pre></details>
        <div class="wa-acts">${sent ? badge('active', '✓ ' + t('waSentLbl')) : ''}<button class="icon-btn" data-act="wa-edit" data-i="${i}" title="${t('edit')}">${icon('edit')}</button>
          <button class="btn wa sm" data-act="wa-row" data-i="${i}" ${has ? '' : 'disabled'}>${icon('whatsapp')}<span>${t('waSend')}</span></button></div></div>`; }).join('')}</div>`;
}
function waSendRow(i) {
  const r = WAQ.rows[i]; if (!r) return;
  if (waOpen(r.phone, r.text, { type: r.type, to: r.to, ref: r.ref })) {
    WAQ.sent.add(r.key); const el = $('#wa-r' + i); if (el) el.classList.add('sent');
    const area = $('#wa-queue'); if (area) { const y = window.scrollY; area.innerHTML = waQueueHtml(); window.scrollTo(0, y); }
  }
}
function waSendNext() { const i = WAQ.rows.findIndex(r => waPhone(r.phone) && !WAQ.sent.has(r.key)); if (i >= 0) waSendRow(i); }
function waEditRow(i) { const r = WAQ.rows[i]; waCompose({ title: r.to, to: r.to, phone: r.phone, choices: [{ label: r.type, type: r.type, ref: r.ref, text: r.text }] }); }

function waLogHtml(limit = 15) {
  const log = (DB.d.waLog || []).slice(-limit).reverse();
  return log.length ? `<ul class="list">${log.map(l => `<li>${icon('whatsapp')}<div><b>${esc(l.to || l.phone)}</b><small>${new Date(l.at).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })} · ${esc(t('wa_' + l.type))} · ${esc(l.user)}</small></div><small class="ltr muted">+${esc(l.phone)}</small></li>`).join('')}</ul>` : emptyState(t('noData'), 'whatsapp');
}

/* Settings card: country code + editable templates */
function waSettingsCard() {
  const st = S();
  return `<section class="card"><div class="card-head"><h3>${icon('whatsapp')} ${t('waSettings')}</h3></div><div class="card-body">
    <div class="form-grid"><label class="field"><span>${t('f_waCountryCode')}</span><input class="input" id="wa-cc" value="${esc(st.waCountryCode || '218')}" dir="ltr"></label></div>
    <p class="hint">${t('waTplHint')}</p>
    <div class="form-grid">${WA_TYPES.map(k => `<label class="field full"><span>${t('wa_' + k)} <small class="muted ltr">${esc(WA_VARS[k] || '')}</small></span><textarea class="input" rows="5" data-wa-tpl="${k}" dir="auto">${esc(waTemplate(k))}</textarea></label>`).join('')}</div>
    <div class="form-actions"><button class="btn ghost" type="button" data-act="wa-tpl-reset">${icon('refresh')}<span>${t('waTplReset')}</span></button><button class="btn primary" type="button" data-act="wa-tpl-save">${icon('check')}<span>${t('save')}</span></button></div>
  </div></section>`;
}
const ACT_EXTRA = {};
Object.assign(ACT_EXTRA, {
  'wa-row': el => waSendRow(+el.dataset.i),
  'wa-next': () => waSendNext(),
  'wa-edit': el => waEditRow(+el.dataset.i),
  'wa-tpl-save': () => {
    const st = S(); st.waCountryCode = ($('#wa-cc').value || '218').replace(/\D/g, '') || '218';
    st.waTemplates = {}; $$('[data-wa-tpl]').forEach(x => { const v = x.value.trim(); if (v && v !== WA_DEFAULTS[x.dataset.waTpl]) st.waTemplates[x.dataset.waTpl] = v; });
    DB.save(); toast(t('saved'));
  },
  'wa-tpl-reset': () => confirmBox(t('waTplResetQ'), () => { S().waTemplates = {}; DB.save(); render(); }),
});
