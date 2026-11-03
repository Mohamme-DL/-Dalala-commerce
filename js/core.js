/* Dalala Commerce — core helpers, UI primitives, charts, business logic */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sum = (arr, fn = x => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);

/* ---------- Icons (stroke, 24x24) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M22 11h-6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  bookOpen: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 11h16M8 18v3M16 18v3"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/>',
  megaphone: '<path d="m3 11 15-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  printer: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

Object.assign(ICONS, {
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  barcode: '<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/>',
  store: '<path d="M3 9l1-5h16l1 5M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8M10 21v-5h4v5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  minus: '<path d="M5 12h14"/>',
  scale: '<path d="M12 3v18M5 21h14M3 7h18M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M15.5 12H17M7 20v1M17 20v1"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>', arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
});
const LOGO = `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#059669"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#lg1)"/><path d="M14 18h20l-1.8 17a2 2 0 0 1-2 1.8H17.8a2 2 0 0 1-2-1.8z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M19 18v-2.5a5 5 0 0 1 10 0V18" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="27" r="3" fill="#fde68a"/></svg>`;
/* ---------- Formatting ---------- */
const locale = () => (LANG === 'ar' ? 'ar-u-nu-latn' : 'en-US');
const S = () => DB.d.settings;
function fmtNum(n, d = 0) { return Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: d }); }
function money(n) { const d = +(S().decimals ?? 3); return Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }); }
function curLabel() { const st = S(); return (LANG === 'en' && PRINT_MODE !== 'both' && st.currencyEn) ? st.currencyEn : (st.currency || ''); }
function fmtMoney(n) { return `<span class="num">${money(n)}</span> <small class="cur">${esc(curLabel())}</small>`; }
function moneyText(n) { return `${money(n)} ${curLabel()}`; }
function parseISO(s) { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function iso(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function today() { return iso(new Date()); }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
function fmtDate(s, opt) { const d = parseISO(s); if (!d || isNaN(d)) return '—'; return d.toLocaleDateString(locale(), opt || { year: 'numeric', month: 'short', day: 'numeric' }); }
function dayName(i, short) { return t(short ? 'daysShort' : 'days')[i]; }
function loc(r, k = 'name') {
  if (!r) return '—';
  if (PRINT_MODE === 'both' && r[k + 'En'] && r[k] && r[k + 'En'] !== r[k]) return `${r[k]} / ${r[k + 'En']}`;
  return (LANG === 'en' && r[k + 'En']) ? r[k + 'En'] : (r[k] ?? '—');
}

/* ---------- Print language: 'ar' | 'en' | 'both' (Arabic + English), independent of the screen language ---------- */
let PRINT_MODE = null;
let PRINT_PICK = '';  // per-session choice made on the document page; '' = use the setting
const PRINT_LANGS = ['ui', 'ar', 'en', 'both'];
function effectivePrintLang(pick) { const v = pick || PRINT_PICK || S().printLang || 'ui'; return v === 'ui' ? LANG : v; }
function withPrintLang(pick, fn) {
  const mode = effectivePrintLang(pick); const prev = LANG;
  PRINT_MODE = mode; LANG = mode === 'en' ? 'en' : 'ar';
  try { return fn(); } finally { LANG = prev; PRINT_MODE = null; }
}
function receiptFooterText() {
  const st = S(); const ar = st.receiptFooter || '', en = st.receiptFooterEn || '';
  if (PRINT_MODE === 'en') return en || ar;
  if (PRINT_MODE === 'both') return [ar, en].filter(Boolean).join(' — ');
  return ar;
}
function printLangSelect(cls = '') {
  return `<label class="sel ${cls}"><span>${icon('globe')}</span><select class="input sm" data-chg="print-lang" title="${t('printLang')}">
    <option value="">${t('printLang')}: ${t('opt_pl_' + (S().printLang || 'ui'))}</option>${['ar', 'en', 'both'].map(v => `<option value="${v}" ${PRINT_PICK === v ? 'selected' : ''}>${t('opt_pl_' + v)}</option>`).join('')}</select></label>`;
}
function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }
function norm(s) { return String(s ?? '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }
function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function avatar(r, size = '') { const n = loc(r); return `<span class="av ${size}" style="--h:${hue(r.id || n)}">${esc((n || '?').trim().charAt(0))}</span>`; }
function badge(v, label) { return `<span class="badge b-${esc(v)}">${esc(label ?? t('opt_' + v))}</span>`; }
/* ---------- Libyan validation ---------- */
function isLyPhone(v) { return /^(\+?218|00218|0)?(9[1-6]\d{7}|[2-8]\d{7,8})$/.test(String(v || '').replace(/[\s-]/g, '')); }
const LY_MUNICIPALITIES = ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'زليتن', 'الخمس', 'صبراتة', 'صرمان', 'غريان', 'ترهونة', 'سرت', 'البيضاء', 'درنة', 'طبرق', 'أجدابيا', 'المرج', 'سبها', 'أوباري', 'مرزق', 'غات', 'الكفرة', 'نالوت', 'يفرن', 'زوارة', 'بني وليد', 'جنزور', 'تاجوراء', 'سوق الجمعة', 'أبوسليم', 'حي الأندلس', 'العجيلات', 'الجميل', 'القره بوللي', 'مسلاتة', 'هون', 'ودان', 'براك الشاطئ', 'الأبيار', 'شحات', 'الجفرة', 'جالو', 'قصر الأخيار', 'العزيزية', 'ككلة', 'الزنتان', 'الرجبان', 'جادو', 'ورشفانة'];

/* ---------- Modal / toast / confirm ---------- */
function modal({ title, body, footer = '', size = '' }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-back"><div class="modal ${size}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" type="button" data-x>${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div></div>`;
  root.classList.add('open');
  const back = root.firstElementChild;
  back.addEventListener('mousedown', e => { if (e.target === back) closeModal(); });
  $('[data-x]', root).onclick = closeModal;
  setTimeout(() => { const f = $('.modal-body input:not([type=hidden]):not([readonly]), .modal-body select, .modal-body textarea', root); f && f.focus(); }, 40);
  return root;
}
function closeModal() { const r = $('#modal-root'); r.innerHTML = ''; r.classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal-root.open')) closeModal(); });

function confirmBox(msg, onYes, { danger = true, okLabel } = {}) {
  const root = modal({
    title: t('confirm'), size: 'sm',
    body: `<div class="confirm-msg">${icon('alert', danger ? 'danger' : '')}<p>${msg}</p></div>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${okLabel || t('yes')}</button>`,
  });
  $('[data-x2]', root).onclick = closeModal;
  $('[data-ok]', root).onclick = () => { closeModal(); onYes(); };
}

function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : 'alert')}<span>${esc(msg)}</span>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------- Charts ---------- */
function barChart(items, { height = 190, suffix = '', max } = {}) {
  if (!items.length) return emptyState(t('noData'));
  const m = max || Math.max(1, ...items.map(i => +i.value || 0));
  return `<div class="bars" style="height:${height}px">${items.map(i => `
    <div class="bar-col" title="${esc(i.label)}: ${fmtNum(i.value, 1)}${suffix}">
      <div class="bar-val">${i.value == null ? '—' : fmtNum(i.value, 0) + suffix}</div>
      <div class="bar-track"><div class="bar" style="height:${Math.max(2, (+i.value || 0) / m * 100)}%;${i.color ? `background:${i.color}` : ''}"></div></div>
      <div class="bar-lbl">${esc(i.label)}</div>
    </div>`).join('')}</div>`;
}
function hbars(items, { suffix = '', max } = {}) {
  const m = max || Math.max(1, ...items.map(i => +i.value || 0));
  return `<div class="hbars">${items.map(i => `<div class="hbar"><span class="hbar-lbl">${esc(i.label)}</span>
    <div class="progress"><span style="width:${Math.min(100, (+i.value || 0) / m * 100)}%;${i.color ? `background:${i.color}` : ''}"></span></div>
    <b>${i.value == null ? '—' : fmtNum(i.value, 1) + suffix}</b></div>`).join('')}</div>`;
}
function donut(items, { center = '', sub = '' } = {}) {
  const total = sum(items, i => i.value) || 1, r = 60, C = 2 * Math.PI * r; let off = 0;
  const segs = items.map(i => {
    const len = i.value / total * C;
    const s = `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${i.color}" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`;
    off += len; return s;
  }).join('');
  return `<div class="donut-box"><div class="donut-wrap"><svg viewBox="0 0 160 160"><circle r="${r}" cx="80" cy="80" fill="none" stroke="var(--line)" stroke-width="20"/><g transform="rotate(-90 80 80)">${segs}</g></svg>
    <div class="donut-center"><b>${center}</b><span>${sub}</span></div></div>
    <div class="legend">${items.map(i => `<div><i style="background:${i.color}"></i><span>${esc(i.label)}</span><b>${fmtNum(i.value)}</b></div>`).join('')}</div></div>`;
}
const progress = (p, color) => `<div class="progress"><span style="width:${Math.max(0, Math.min(100, p || 0))}%;${color ? `background:${color}` : ''}"></span></div>`;
const emptyState = (msg, ic = 'sparkle') => `<div class="empty">${icon(ic)}<p>${esc(msg)}</p></div>`;

/* ---------- Files / print ---------- */
function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
/* exportCSV / exportWord live in office.js (real .xlsx / .docx files) */
function printHTML(html, mode = '') {
  const pa = $('#print-area');
  pa.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr');
  pa.innerHTML = html;
  document.body.classList.add('printing'); if (mode) document.body.classList.add(mode); window.__printMode = mode;
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); if (window.__printMode) document.body.classList.remove(window.__printMode); $('#print-area').innerHTML = ''; });

function printHeader(title, sub = '') {
  const st = S();
  const ids = [['crNo', st.crNo], ['taxNo', st.taxNo], ['chamberNo', st.chamberNo]].filter(x => x[1]).map(([k, v]) => `${t('f_' + k)}: ${esc(v)}`).join(' · ');
  return `<div class="ph">${LOGO.replace(/lg1/g, 'lgp')}<div><h2>${esc(loc(st, 'businessName'))}</h2><p>${esc(loc(st, 'activity'))}</p>
    <p>${esc(loc(st, 'address') || '')} · <span class="ltr">${esc(st.phone || '')}</span></p>${ids ? `<p>${ids}</p>` : ''}</div>
    <div class="ph-end"><b>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ''}<span>${fmtDate(today())}</span></div></div>`;
}

/* =================== Business logic =================== */
/* invoices imported from a previous system (archived: true) count only in sales / purchase reports and
   profit — they never change stock, cash, bank or customer / supplier balances */
const liveDocs = col => DB.all(col).filter(d => !d.archived);
const round = (n, d = 3) => Math.round((+n || 0) * 10 ** d) / 10 ** d;
const memoState = { v: -1, m: {} };
function memo(key, fn) { if (memoState.v !== DB.v) { memoState.v = DB.v; memoState.m = {}; } return key in memoState.m ? memoState.m[key] : (memoState.m[key] = fn()); }

/* Documents (sales & purchases): { type: 'sale'|'return' | 'purchase'|'return', items:[{productId, qty, price, discount, cost}], discount, taxRate, paid, method } */
function lineTotal(it) { return round((+it.qty || 0) * (+it.price || 0) - (+it.discount || 0)); }
function docTotals(d) {
  const sub = round(sum(d.items || [], lineTotal)); const disc = +d.discount || 0; const after = Math.max(0, round(sub - disc));
  const tax = round(after * (+d.taxRate || 0) / 100); return { sub, disc, after, tax, total: round(after + tax) };
}
const docTotal = d => docTotals(d).total;
const docDue = d => round(docTotal(d) - (+d.paid || 0));
const sign = d => (d.type === 'return' ? -1 : 1);
function docStatus(d) { const due = docDue(d); return due <= 0.0005 ? 'paid' : (+d.paid || 0) > 0 ? 'partial' : 'credit'; }
function docCost(d) { return round(sum(d.items || [], it => (+it.qty || 0) * (+it.cost || 0))); }

/* Stock = opening + purchases - sales + sales returns - purchase returns + adjustments */
function stockMap() {
  return memo('stock', () => {
    const st = {}; DB.all('products').forEach(p => { st[p.id] = +p.openingQty || 0; });
    liveDocs('sales').forEach(s => s.items.forEach(it => { st[it.productId] = (st[it.productId] || 0) - sign(s) * (+it.qty || 0); }));
    liveDocs('purchases').forEach(s => s.items.forEach(it => { st[it.productId] = (st[it.productId] || 0) + sign(s) * (+it.qty || 0); }));
    DB.all('adjustments').forEach(a => { st[a.productId] = (st[a.productId] || 0) + (+a.qty || 0); });
    return st;
  });
}
const stockOf = id => round(stockMap()[id] || 0);
const isStock = p => p && p.kind !== 'service';
const lowStock = () => DB.all('products').filter(p => isStock(p) && p.active !== false && stockOf(p.id) <= (+p.minQty || 0));

/* Balances: customer > 0 → owes us ; supplier > 0 → we owe them */
function customerBalances() {
  return memo('cbal', () => {
    const b = {}; DB.all('customers').forEach(c => { b[c.id] = +c.openingBalance || 0; });
    liveDocs('sales').forEach(s => { if (s.customerId) b[s.customerId] = (b[s.customerId] || 0) + sign(s) * docDue(s); });
    DB.all('receipts').forEach(r => { b[r.customerId] = (b[r.customerId] || 0) - (+r.amount || 0); });
    return b;
  });
}
function supplierBalances() {
  return memo('sbal', () => {
    const b = {}; DB.all('suppliers').forEach(c => { b[c.id] = +c.openingBalance || 0; });
    liveDocs('purchases').forEach(s => { if (s.supplierId) b[s.supplierId] = (b[s.supplierId] || 0) + sign(s) * docDue(s); });
    DB.all('disbursements').forEach(r => { b[r.supplierId] = (b[r.supplierId] || 0) - (+r.amount || 0); });
    return b;
  });
}
const customerBalance = id => round(customerBalances()[id] || 0);
const supplierBalance = id => round(supplierBalances()[id] || 0);

/* Party statement lines: { date, ref, desc, debit, credit } (debit increases what the party owes us / we owe them) */
function statement(kind, id) {
  const lines = []; const party = DB.get(kind === 'customer' ? 'customers' : 'suppliers', id);
  if (+party?.openingBalance) lines.push({ date: '', ref: '', desc: t('openingBalance'), debit: Math.max(0, +party.openingBalance), credit: Math.max(0, -party.openingBalance) });
  const docs = kind === 'customer' ? liveDocs('sales').filter(s => s.customerId === id) : liveDocs('purchases').filter(s => s.supplierId === id);
  docs.forEach(d => {
    const total = docTotal(d), paid = +d.paid || 0, ret = d.type === 'return';
    lines.push({ date: d.date, ref: d.number, desc: t(kind === 'customer' ? (ret ? 'salesReturn' : 'salesInvoice') : (ret ? 'purchaseReturn' : 'purchaseInvoice')), debit: ret ? 0 : total, credit: ret ? total : 0, link: `#/doc/${kind === 'customer' ? 'sales' : 'purchases'}/${d.id}` });
    if (paid) lines.push({ date: d.date, ref: d.number, desc: t(ret ? 'refund' : 'paidOnInvoice'), debit: ret ? paid : 0, credit: ret ? 0 : paid });
  });
  (kind === 'customer' ? DB.all('receipts').filter(r => r.customerId === id) : DB.all('disbursements').filter(r => r.supplierId === id))
    .forEach(r => lines.push({ date: r.date, ref: r.number, desc: t(kind === 'customer' ? 'receiptVoucher' : 'paymentVoucher') + (r.notes ? ' — ' + r.notes : ''), debit: 0, credit: +r.amount || 0 }));
  lines.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.ref || '').localeCompare(b.ref || ''));
  let bal = 0; lines.forEach(l => { bal = round(bal + l.debit - l.credit); l.balance = bal; });
  return lines;
}

/* Treasury: every money movement, per account (cash | bank) */
const accountOf = method => (method === 'cash' || method === 'credit' ? 'cash' : 'bank');
function moneyMoves() {
  return memo('moves', () => {
    const mv = [];
    const add = (date, account, amount, desc, ref, link) => { if (amount) mv.push({ date, account, amount: round(amount), desc, ref, link }); };
    const st = S();
    add('', 'cash', +st.openingCash || 0, t('openingBalance'), ''); add('', 'bank', +st.openingBank || 0, t('openingBalance'), '');
    liveDocs('sales').forEach(d => add(d.date, accountOf(d.method), sign(d) * (+d.paid || 0), `${t(d.type === 'return' ? 'salesReturn' : 'salesInvoice')} — ${partyName('customers', d.customerId)}`, d.number, `#/doc/sales/${d.id}`));
    liveDocs('purchases').forEach(d => add(d.date, accountOf(d.method), -sign(d) * (+d.paid || 0), `${t(d.type === 'return' ? 'purchaseReturn' : 'purchaseInvoice')} — ${partyName('suppliers', d.supplierId)}`, d.number, `#/doc/purchases/${d.id}`));
    DB.all('receipts').forEach(r => add(r.date, accountOf(r.method), +r.amount, `${t('receiptVoucher')} — ${partyName('customers', r.customerId)}`, r.number));
    DB.all('disbursements').forEach(r => add(r.date, accountOf(r.method), -r.amount, `${t('paymentVoucher')} — ${partyName('suppliers', r.supplierId)}`, r.number));
    DB.all('expenses').forEach(e => add(e.date, accountOf(e.method), -e.amount, `${t('expense')} — ${t('opt_' + e.category)}${e.description ? ' — ' + e.description : ''}`, e.number));
    DB.all('cashMoves').forEach(c => add(c.date, c.account, (c.type === 'in' ? 1 : -1) * c.amount, `${t('opt_move_' + c.type)}${c.notes ? ' — ' + c.notes : ''}`, c.number));
    return mv.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  });
}
const accountBalance = acc => round(sum(moneyMoves().filter(m => m.account === acc), m => m.amount));
function partyName(col, id) { if (!id) return t('walkIn'); const p = DB.get(col, id); return p ? loc(p) : '—'; }

/* Profit for a date range [from, to] */
function profitFor(from, to) {
  const inR = d => (!from || d.date >= from) && (!to || d.date <= to);
  const sales = DB.all('sales').filter(inR);
  const revenue = round(sum(sales, d => sign(d) * docTotals(d).after));
  const cogs = round(sum(sales, d => sign(d) * docCost(d)));
  const expenses = round(sum(DB.all('expenses').filter(inR), e => e.amount));
  return { revenue, cogs, gross: round(revenue - cogs), expenses, net: round(revenue - cogs - expenses), count: sales.filter(d => d.type !== 'return').length };
}
function periodRange(p) {
  const T = today(), d = parseISO(T);
  if (p === 'today') return [T, T];
  if (p === 'week') return [addDays(T, -6), T];
  if (p === 'month') return [T.slice(0, 8) + '01', T];
  if (p === 'lastMonth') { const f = new Date(d.getFullYear(), d.getMonth() - 1, 1), l = new Date(d.getFullYear(), d.getMonth(), 0); return [iso(f), iso(l)]; }
  if (p === 'year') return [T.slice(0, 5) + '01-01', T];
  return ['', ''];
}
const PALETTE = ['#059669', '#0ea5e9', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];
function catColor(id) { const i = DB.all('categories').findIndex(c => c.id === id); return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; }
