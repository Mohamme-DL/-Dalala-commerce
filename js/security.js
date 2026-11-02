/* Dalala Commerce — accounts & security:
   first-run setup (empty business, admin account, no default password), PBKDF2 password hashing,
   lockout after 5 failed logins, lock screen (Ctrl+L) and per-user permissions. */
'use strict';

/* ---------- password hashing (PBKDF2-SHA256, 120k rounds) ---------- */
const PW_ROUNDS = 120000;
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashPassword(pw, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PW_ROUNDS }, key, 256);
  return `pbkdf2$${PW_ROUNDS}$${b64e(salt)}$${b64e(bits)}`;
}
const isHashed = s => /^pbkdf2\$\d+\$/.test(String(s || ''));
async function checkPassword(user, pw) {
  if (!user) return false;
  if (!isHashed(user.password)) { // legacy plain text (demo data) → upgrade on first successful login
    if (user.password !== pw) return false;
    user.password = await hashPassword(pw); DB.save(); return true;
  }
  const [, , salt] = user.password.split('$');
  const h = await hashPassword(pw, salt);
  let diff = h.length ^ user.password.length; for (let i = 0; i < Math.min(h.length, user.password.length); i++) diff |= h.charCodeAt(i) ^ user.password.charCodeAt(i);
  return diff === 0;
}

/* ---------- failed-login lockout: 5 attempts → 5 minutes ---------- */
const FAIL_KEY = 'dalala_commerce_fails';
const fails = { get() { try { return JSON.parse(localStorage.getItem(FAIL_KEY) || '{}'); } catch (e) { return {}; } }, set(v) { try { localStorage.setItem(FAIL_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
function lockedFor(username) { const f = fails.get()[String(username).toLowerCase()]; return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0; }
function noteFail(username) { const all = fails.get(); const k = String(username).toLowerCase(); const f = all[k] || { n: 0 }; f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; } all[k] = f; fails.set(all); }
function clearFails(username) { const all = fails.get(); delete all[String(username).toLowerCase()]; fails.set(all); }

async function loginAsync(username, password) {
  const name = String(username || '').trim();
  const mins = lockedFor(name); if (mins) return { ok: false, msg: t('loginLocked').replace('{n}', mins) };
  const u = DB.all('users').find(x => x.username.toLowerCase() === name.toLowerCase() && x.active !== false);
  if (!u || !(await checkPassword(u, password))) { noteFail(name); const left = lockedFor(name); return { ok: false, msg: left ? t('loginLocked').replace('{n}', left) : t('loginError') }; }
  clearFails(name); USER = u; try { localStorage.setItem(SESSION_KEY, u.id); } catch (e) { /* ignore */ }
  location.hash = '#/' + homePage(); render(); return { ok: true };
}

/* ---------- permissions ---------- */
const PERMS = ['discount', 'changePrice', 'returns', 'editInvoice', 'viewCost', 'deleteDocs'];
const ROLE_PERMS = { admin: PERMS, cashier: ['discount'], accountant: ['discount', 'returns', 'viewCost', 'editInvoice'], storekeeper: ['viewCost'] };
function hasPerm(p) { if (!USER) return false; if (USER.role === 'admin') return true; const list = Array.isArray(USER.perms) && USER.perms.length ? USER.perms : ROLE_PERMS[USER.role] || []; return list.includes(p); }

/* ---------- password field helpers on the login / setup / lock screens ---------- */
function pwField(name, label, extra = '') {
  return `<label class="field"><span>${label}</span><div class="pw-wrap"><input class="input" name="${name}" type="password" dir="ltr" ${extra}><button type="button" class="icon-btn pw-eye" data-act="pw-eye" title="${t('showPassword')}">${icon('eye')}</button></div><small class="caps" hidden>⇪ ${t('capsOn')}</small></label>`;
}
document.addEventListener('keyup', e => { if (e.target && e.target.type === 'password' || e.target?.closest?.('.pw-wrap')) { const cap = e.getModifierState && e.getModifierState('CapsLock'); const lbl = e.target.closest('.field'); const c = lbl && $('.caps', lbl); if (c) c.hidden = !cap; } });

/* ---------- first-run setup ---------- */
function renderSetup() {
  applyPrefs();
  $('#app').innerHTML = `<div class="login"><div class="login-art"><div class="art-inner">${LOGO}<h1>${t('appName')}</h1><p>${t('setupWelcome')}</p>
      <ul>${['setupP1', 'setupP2', 'setupP3'].map(f => `<li>${icon('check')}<span>${t(f)}</span></li>`).join('')}</ul></div><div class="blob b1"></div><div class="blob b2"></div></div>
    <div class="login-form"><div class="lf-top"><button class="btn ghost sm" data-act="lang">${icon('globe')}<span>${LANG === 'ar' ? 'English' : 'العربية'}</span></button></div>
      <form id="setup-form" class="lf-box"><h2>${t('setupTitle')}</h2><p class="muted">${t('setupSub')}</p>
        <label class="field"><span>${t('f_businessName')}</span><input class="input" name="biz" required placeholder="${t('setupBizPh')}"></label>
        <label class="field"><span>${t('f_phone')}</span><input class="input" name="phone" dir="ltr" placeholder="09XXXXXXXX"></label>
        <label class="field"><span>${t('setupAdminName')}</span><input class="input" name="name" required></label>
        <label class="field"><span>${t('username')}</span><input class="input" name="u" required dir="ltr" autocomplete="off" pattern="[A-Za-z0-9_.\\-]{3,}"></label>
        ${pwField('p', t('password') + ' (8+)', 'required minlength="8" autocomplete="new-password"')}${pwField('p2', t('confirmPassword'), 'required minlength="8" autocomplete="new-password"')}
        <div class="form-err" hidden></div>
        <button class="btn primary block" type="submit">${icon('check')}<span>${t('setupStart')}</span></button>
        <button class="btn ghost block" type="button" data-act="setup-demo">${icon('sparkle')}<span>${t('setupDemo')}</span></button>
      </form></div></div>`;
  $('#setup-form').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; const err = m => { const b = $('.form-err', f); b.hidden = false; b.textContent = m; };
    if (f.p.value.length < 8) return err(t('passwordShort8'));
    if (f.p.value !== f.p2.value) return err(t('passwordMismatch'));
    if (!/^[A-Za-z0-9_.-]{3,}$/.test(f.u.value.trim())) return err(t('usernameRule'));
    DB.startEmpty({ businessName: f.biz.value.trim(), phone: f.phone.value.trim() });
    const admin = { id: uid(), username: f.u.value.trim(), name: f.name.value.trim(), nameEn: '', role: 'admin', active: true, password: await hashPassword(f.p.value) };
    DB.d.users = [admin]; DB.save();
    USER = admin; try { localStorage.setItem(SESSION_KEY, admin.id); } catch (e2) { /* ignore */ }
    location.hash = '#/settings'; render(); toast(t('setupDone'));
  });
}

/* ---------- lock screen ---------- */
let LOCKED = false;
function lockScreen() {
  if (!USER || LOCKED) return; LOCKED = true; closeModal();
  const el = document.createElement('div'); el.id = 'lock-screen'; el.className = 'lock-screen';
  el.innerHTML = `<form class="lock-box">${LOGO}<h2>${t('lockedTitle')}</h2><p class="muted">${esc(loc(USER))} · ${t('role_' + USER.role)}</p>
    ${pwField('p', t('password'), 'required autocomplete="current-password" autofocus')}<div class="form-err" hidden></div>
    <button class="btn primary block" type="submit">${icon('key')}<span>${t('unlock')}</span></button>
    <button class="btn ghost block" type="button" data-act="switch-user">${icon('users')}<span>${t('switchUser')}</span></button></form>`;
  document.body.appendChild(el); setTimeout(() => $('input', el)?.focus(), 30);
  $('form', el).addEventListener('submit', async e => {
    e.preventDefault(); const name = USER.username; const mins = lockedFor(name); const b = $('.form-err', el);
    if (mins) { b.hidden = false; b.textContent = t('loginLocked').replace('{n}', mins); return; }
    if (await checkPassword(USER, e.target.p.value)) { clearFails(name); LOCKED = false; el.remove(); }
    else { noteFail(name); b.hidden = false; b.textContent = t('wrongPassword'); e.target.p.value = ''; }
  });
}
function unlockSwitchUser() { LOCKED = false; $('#lock-screen')?.remove(); logout(); }

/* auto-lock after inactivity (settings.autoLockMin, 0 = off) */
let lastActivity = Date.now();
['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => { const m = +(DB.d?.settings?.autoLockMin || 0); if (m > 0 && USER && !LOCKED && Date.now() - lastActivity > m * 60000) lockScreen(); }, 20000);
