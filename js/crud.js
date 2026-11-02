/* Dalala Commerce — generic CRUD engine (tables, filters, forms) */
'use strict';
function refLabel(ref, id) { const r = DB.get(ref, id); return r ? (REF_LABEL[ref] || (x => loc(x)))(r) : '—'; }
function refOptions(f, cur) {
  let rows = DB.all(f.ref).slice();
  rows = rows.filter(r => r.active !== false || r.id === cur || (Array.isArray(cur) && cur.includes(r.id)));
  rows.sort((a, b) => String((REF_LABEL[f.ref] || loc)(a)).localeCompare(String((REF_LABEL[f.ref] || loc)(b)), LANG));
  if (f.refFilter) rows = rows.filter(r => f.refFilter(r, cur) || r.id === cur);
  return rows.map(r => ({ v: r.id, l: (REF_LABEL[f.ref] || (x => loc(x)))(r) }));
}
function fieldOpts(f) {
  const o = typeof f.opts === 'function' ? f.opts() : f.opts;
  return (o || []).map(v => ({ v, l: f.optLabel ? f.optLabel(v) : t('opt_' + v) }));
}
const fieldLabel = f => t('f_' + f.k);
function can(roles) { return !!USER && (USER.role === 'admin' || (roles || ['admin']).includes(USER.role)); }
const canEdit = key => can(ENT[key].edit) && (!ENT[key].editPerm || hasPerm(ENT[key].editPerm));

/* ---------- cell rendering ---------- */
function cellText(f, r) {
  const v = f.get ? f.get(r) : r[f.k];
  if (f.show) return f.show(r);
  if (f.money) return moneyText(v);
  switch (f.type) {
    case 'select': return v === '' || v == null ? '—' : (f.optLabel ? f.optLabel(v) : t('opt_' + v));
    case 'ref': return v ? refLabel(f.ref, v) : '—';
    case 'multiref': return (v || []).map(x => refLabel(f.ref, x)).join('، ');
    case 'multiselect': return (v || []).map(x => (f.optLabel ? f.optLabel(x) : t('opt_' + x))).join('، ');
    case 'date': return v ? fmtDate(v) : '—';
    case 'bool': return v ? t('yes') : t('no');
    default: return v === '' || v == null ? '—' : String(v);
  }
}
function cellHtml(f, r) {
  if (f.fmt) return f.fmt(r);
  if (f.money) return fmtMoney(f.get ? f.get(r) : r[f.k]);
  if (f.badge && r[f.k]) return badge(r[f.k]);
  if (f.type === 'bool') return r[f.k] ? badge('active', t('yes')) : badge('withdrawn', t('no'));
  if (f.type === 'ref' && REF_LINK[f.ref] && r[f.k]) { const s = DB.get(f.ref, r[f.k]); if (s) return `<a class="who" href="${REF_LINK[f.ref](s)}">${avatar(s)}<span>${esc(refLabel(f.ref, s.id))}</span></a>`; }
  const txt = cellText(f, r);
  return f.type === 'textarea' ? `<span class="clip">${esc(txt)}</span>` : esc(txt);
}
const sortVal = (f, r) => { const v = f.get ? f.get(r) : r[f.k]; return (f.money || f.type === 'number' || f.num || typeof v === 'number') ? +v || 0 : norm(cellText(f, r)); };

/* ---------- CRUD page ---------- */
const UI = {};
function crudState(key) { return (UI[key] = UI[key] || { q: '', f: {}, page: 1, sort: null, dir: 1 }); }
function crudRows(key) {
  const cfg = ENT[key], st = crudState(key);
  let rows = DB.all(key).slice(); if (cfg.hidden) rows = rows.filter(r => !cfg.hidden(r));
  for (const [fk, v] of Object.entries(st.f)) {
    if (v === '' || v == null) continue;
    const flt = (cfg.filters || []).find(x => x.k === fk);
    rows = rows.filter(r => (flt && flt.test ? flt.test(r, v) : String(r[fk]) === String(v)));
  }
  if (st.q) {
    const q = norm(st.q).trim(); const fs = cfg.fields.filter(f => f.type !== 'password');
    rows = rows.filter(r => fs.some(f => norm(cellText(f, r)).includes(q) || (f.k.endsWith('En') && norm(r[f.k]).includes(q))));
  }
  if (st.sort) { const f = cfg.fields.find(x => x.k === st.sort); rows.sort((a, b) => { const x = sortVal(f, a), y = sortVal(f, b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
  else if (cfg.order) rows.sort(cfg.order);
  return rows;
}

function renderCrud(key, { title, embedded } = {}) {
  const cfg = ENT[key], st = crudState(key), editable = canEdit(key);
  const filters = (cfg.filters || []).map(fl => {
    const f = cfg.fields.find(x => x.k === fl.k) || {};
    const opts = fl.opts ? fl.opts.map(v => ({ v, l: t('opt_' + v) })) : f.type === 'ref' ? refOptions(f) : fieldOpts(f);
    return `<select class="input sm" data-chg="crud-filter" data-key="${key}" data-f="${fl.k}">
      <option value="">${t('f_' + fl.k)}: ${t('all')}</option>${opts.map(o => `<option value="${esc(o.v)}" ${String(st.f[fl.k]) === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  }).join('');
  const tools = (cfg.tools || []).filter(tl => can(tl.roles)).map((tl, i) => `<button class="btn ghost" data-act="crud-tool" data-key="${key}" data-i="${i}">${icon(tl.icon)}<span>${t(tl.label)}</span></button>`).join('');
  return `${embedded ? '' : pageHead(title || t('nav_' + key), t('sub_' + key), `
      <button class="btn ghost" data-act="crud-print" data-key="${key}">${icon('printer')}<span>${t('print')}</span></button><button class="btn ghost" data-act="crud-export" data-key="${key}">${icon('download')}<span>Excel</span></button><button class="btn ghost" data-act="crud-word" data-key="${key}">${icon('file')}<span>Word</span></button>${tools}
      ${editable ? `<button class="btn primary" data-act="crud-add" data-key="${key}">${icon('plus')}<span>${t('add')}</span></button>` : ''}`)}
    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" placeholder="${t('search')}…" value="${esc(st.q)}" data-inp="crud-search" data-key="${key}"></div>
        ${filters}
        ${Object.values(st.f).some(v => v) || st.q ? `<button class="btn ghost sm" data-act="crud-clear" data-key="${key}">${icon('x')}<span>${t('clear')}</span></button>` : ''}
      </div>
      <div id="crud-${key}">${crudTable(key)}</div>
    </div>`;
}

const PAGE_SIZE = 15;
function crudTable(key) {
  const cfg = ENT[key], st = crudState(key), rows = crudRows(key), editable = canEdit(key);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); st.page = Math.min(st.page, pages);
  const slice = rows.slice((st.page - 1) * PAGE_SIZE, st.page * PAGE_SIZE);
  const cols = cfg.fields.filter(f => f.list);
  const summary = cfg.summary ? `<div class="summary">${cfg.summary(rows).map(s => `<div class="sum-item ${s.cls || ''}"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}</div>` : '';
  const actions = r => {
    const custom = (cfg.actions || []).map((a, i) => (a.show && !a.show(r)) || (a.roles && !can(a.roles)) ? '' :
      a.href ? `<a class="icon-btn" href="${a.href(r)}" title="${t(a.label)}">${icon(a.icon)}</a>`
        : `<button class="icon-btn" data-act="crud-action" data-key="${key}" data-i="${i}" data-id="${r.id}" title="${t(a.label)}">${icon(a.icon)}</button>`).join('');
    const ed = editable ? `${cfg.noEdit ? '' : `<button class="icon-btn" data-act="crud-edit" data-key="${key}" data-id="${r.id}" title="${t('edit')}">${icon('edit')}</button>`}
      ${!cfg.canDelete || cfg.canDelete(r) ? `<button class="icon-btn danger" data-act="crud-del" data-key="${key}" data-id="${r.id}" title="${t('delete')}">${icon('trash')}</button>` : ''}` : '';
    return custom + ed;
  };
  if (!rows.length) return summary + emptyState(t('noResults'), 'search');
  const body = cfg.card
    ? `<div class="cards-grid">${slice.map(r => `<div class="ann-wrap">${cfg.card(r)}<div class="ann-actions">${actions(r)}</div></div>`).join('')}</div>`
    : `<div class="table-wrap"><table class="table crud"><thead><tr>${cols.map(f => `<th data-act="crud-sort" data-key="${key}" data-f="${f.k}" class="sortable">${fieldLabel(f)}${st.sort === f.k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th class="act-col"></th></tr></thead>
      <tbody>${slice.map(r => `<tr>${cols.map(f => `<td data-label="${esc(fieldLabel(f))}">${cellHtml(f, r)}</td>`).join('')}<td class="row-actions">${actions(r)}</td></tr>`).join('')}</tbody></table></div>`;
  return `${summary}${body}
    <div class="pager"><span>${t('showing')} ${fmtNum((st.page - 1) * PAGE_SIZE + 1)}–${fmtNum(Math.min(rows.length, st.page * PAGE_SIZE))} ${t('of')} ${fmtNum(rows.length)}</span>
    <div>${pages > 1 ? `<button class="icon-btn" data-act="crud-page" data-key="${key}" data-p="${st.page - 1}" ${st.page <= 1 ? 'disabled' : ''}>${icon(LANG === 'ar' ? 'chevR' : 'chevL')}</button>
      <b>${fmtNum(st.page)} / ${fmtNum(pages)}</b>
      <button class="icon-btn" data-act="crud-page" data-key="${key}" data-p="${st.page + 1}" ${st.page >= pages ? 'disabled' : ''}>${icon(LANG === 'ar' ? 'chevL' : 'chevR')}</button>` : ''}</div></div>`;
}
function refreshCrud(key) { const el = $('#crud-' + key); if (el) el.innerHTML = crudTable(key); else render(); }

function exportCrud(key) {
  const cfg = ENT[key]; const cols = cfg.fields.filter(f => f.type !== 'password');
  const val = (f, r) => { if (f.money || (f.type === 'number' && !f.signed)) { const v = f.type === 'calc' ? f.get(r) : r[f.k]; return v === '' || v == null ? '' : round(+v); } if (f.type === 'number') return r[f.k] === '' ? '' : +r[f.k]; return cellText(f, r); };
  exportCSV(key, cols.map(fieldLabel), crudRows(key).map(r => cols.map(f => val(f, r))), { sheet: t('nav_' + key) });
}

/* ---------- Form ---------- */
function inputHtml(f, v, rec) {
  const name = `name="${f.k}"`, req = f.req ? 'required' : '', dir = f.dir ? `dir="${f.dir}"` : '';
  switch (f.type) {
    case 'textarea': return `<textarea class="input" rows="3" ${name} ${req} ${dir}>${esc(v)}</textarea>`;
    case 'select': return `<select class="input" ${name} ${req}><option value="">—</option>${fieldOpts(f).map(o => `<option value="${esc(o.v)}" ${String(v) === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
    case 'ref': return `<select class="input" ${name} ${req}><option value="">—</option>${refOptions(f, v).map(o => `<option value="${esc(o.v)}" ${v === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
    case 'multiselect': return `<div class="days">${fieldOpts(f).map(o => `<label class="day"><input type="checkbox" name="${f.k}" value="${esc(o.v)}" ${(v || []).includes(o.v) ? 'checked' : ''}><span>${esc(o.l)}</span></label>`).join('')}</div>${f.hint ? `<small class="hint">${t(f.hint)}</small>` : ''}`;
    case 'multiref': return `<select class="input" ${name} multiple size="6">${refOptions(f, v || []).map(o => `<option value="${esc(o.v)}" ${(v || []).includes(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select><small class="hint">${t('multiHint')}</small>`;
    case 'bool': return `<label class="switch"><input type="checkbox" ${name} ${v ? 'checked' : ''}><span></span></label>`;
    case 'number': return `<input class="input" type="number" step="any" ${f.signed ? '' : 'min="0"'} ${name} value="${esc(v)}" ${req} dir="ltr">`;
    default: {
      const dl = f.datalist ? `<datalist id="dl-${f.k}">${f.datalist().map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
      return `<input class="input" type="${f.type === 'password' ? 'text' : f.type}" ${name} value="${esc(v)}" ${req} ${dir} ${dl ? `list="dl-${f.k}"` : ''}>${dl}`;
    }
  }
}

function openForm(key, id, preset = {}) {
  const cfg = ENT[key]; const old = id ? DB.get(key, id) : null;
  const rec = old ? { ...old } : {};
  if (!old) cfg.fields.forEach(f => {
    if (f.auto) rec[f.k] = DB.nextCode(key, f.k, f.auto);
    else if (f.def !== undefined) rec[f.k] = typeof f.def === 'function' ? f.def() : f.def;
  });
  Object.assign(rec, preset);
  const fields = cfg.fields.filter(f => f.type !== 'calc');
  const root = modal({
    title: `${t(old ? 'edit' : 'add')} — ${t('ent_' + key)}`, size: 'lg',
    body: `<form id="mform" class="form-grid" novalidate>${fields.map(f => `<label class="field ${f.full ? 'full' : ''}"><span>${fieldLabel(f)}${f.req ? ' <i class="req">*</i>' : ''}</span>${inputHtml(f, rec[f.k] ?? '', rec)}</label>`).join('')}
      <div class="form-err full" hidden></div></form>`,
    footer: `<button class="btn ghost" type="button" data-cancel>${t('cancel')}</button><button class="btn primary" type="submit" form="mform">${icon('check')}<span>${t('save')}</span></button>`,
  });
  const form = $('#mform', root);
  $('[data-cancel]', root).onclick = closeModal;
  if (cfg.onChange) form.addEventListener('change', e => cfg.onChange(form, e.target.name));
  // barcode scanners send Enter after the code: move to the next field instead of saving the form
  form.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.type === 'submit') return; e.preventDefault();
    const els = [...form.querySelectorAll('input:not([type=hidden]):not([readonly]), select, textarea')]; const i = els.indexOf(e.target); if (i >= 0 && els[i + 1]) els[i + 1].focus(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const out = {}; let err = null;
    for (const f of fields) {
      const el = form.elements[f.k];
      let v = f.type === 'bool' ? el.checked : f.type === 'multiref' ? [...el.selectedOptions].map(o => o.value) : f.type === 'multiselect' ? [...form.querySelectorAll(`input[name="${f.k}"]:checked`)].map(o => o.value) : el.value.trim();
      if (f.type === 'number' || f.num) v = v === '' ? '' : Number(v);
      if (f.req && (v === '' || v == null)) { err = `${t('errRequired')}: ${fieldLabel(f)}`; el.focus(); break; }
      const dup = f.unique && v !== '' && DB.all(key).find(r => r.id !== id && String(r[f.k]).toLowerCase() === String(v).toLowerCase());
      if (dup) { err = `${t('errUnique')}: ${fieldLabel(f)} — ${t('usedBy')} «${dup.deleted ? t('deletedItem') + ' ' : ''}${REF_LABEL[key] ? REF_LABEL[key](dup) : loc(dup) !== '—' ? loc(dup) : dup.number || dup.code || ''}»`; el.focus(); break; }
      out[f.k] = v;
    }
    if (!err && cfg.validate) err = cfg.validate({ ...rec, ...out }, old);
    const box = $('.form-err', form);
    if (err) { box.hidden = false; box.textContent = err; return; }
    let saved;
    if (old) saved = DB.update(key, id, out); else saved = DB.insert(key, { ...preset, ...out });
    closeModal(); toast(t('saved')); render();
    if (cfg.afterSave) cfg.afterSave(saved, !old);
    if (window.__onSaved) { const cb = window.__onSaved; window.__onSaved = null; cb(saved, key); }
  });
}

function deleteRecord(key, id) {
  const block = ENT[key].blockDelete && ENT[key].blockDelete(id);
  if (block) { toast(block, 'err'); return; }
  confirmBox(key === 'products' ? t('confirmDeleteProduct') : t('confirmDelete'), () => {
    if (ENT[key].softDelete && ENT[key].softDelete(id)) { DB.update(key, id, { deleted: true, active: false, deletedAt: today() }); toast(t('deleted')); render(); return; } // keeps the name on old invoices
    DB.remove(key, id);
    if (ENT[key].onDelete) ENT[key].onDelete(id);
    DB.save(); toast(t('deleted')); render();
  });
}
