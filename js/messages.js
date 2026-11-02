/* Dalala Commerce — WhatsApp messages to customers (debt reminder, invoice, statement, offers) */
'use strict';

const WA_TYPES = ['debt', 'invoice', 'statement', 'custom'];
const WA_VARS = { debt: '{name} {amount} {business} {phone}', invoice: '{name} {number} {date} {items} {total} {paid} {due} {business} {phone}', statement: '{name} {date} {lines} {amount} {business} {phone}', custom: '{name} {text} {business} {phone}' };
const WA_DEFAULTS = {
  debt: 'السلام عليكم {name}،\n\nنود تذكيركم بأن الرصيد المستحق على حسابكم لدى {business} هو: *{amount}*\nنرجو التكرم بالسداد في أقرب وقت ممكن.\n\nشكراً لتعاملكم معنا 🌹\n{business} — {phone}',
  invoice: 'مرحباً {name}،\nشكراً لتسوقكم من {business} 🛍️\n\nفاتورة رقم: {number}\nالتاريخ: {date}\n{items}\n\nالإجمالي: *{total}*\nالمدفوع: {paid}\nالمتبقي: {due}\n\n{phone}',
  statement: 'السلام عليكم {name}،\nملخص حسابكم لدى {business} حتى {date}:\n\n{lines}\n\nالرصيد المستحق: *{amount}*\n\n{business} — {phone}',
  custom: 'مرحباً {name} 👋\n\n{text}\n\n{business} — {phone}',
};
const WA_DEFAULTS_EN = {
  debt: 'Dear {name},\n\nThis is a friendly reminder that the outstanding balance on your account with {business} is: *{amount}*\nPlease arrange payment at your earliest convenience.\n\nThank you for your business 🌹\n{business} — {phone}',
  invoice: 'Hello {name},\nThank you for shopping at {business} 🛍️\n\nInvoice no.: {number}\nDate: {date}\n{items}\n\nTotal: *{total}*\nPaid: {paid}\nDue: {due}\n\n{phone}',
  statement: 'Dear {name},\nYour account summary with {business} as of {date}:\n\n{lines}\n\nBalance due: *{amount}*\n\n{business} — {phone}',
  custom: 'Hello {name} 👋\n\n{text}\n\n{business} — {phone}',
};
const waEn = () => effectivePrintLang('') === 'en';
const waName = r => (r ? (waEn() && r.nameEn ? r.nameEn : r.name) : '');
function waMoney(n) { return `${money(n)} ${waEn() ? (S().currencyEn || S().currency) : S().currency}`; }
function waDate(d) { const prev = LANG; LANG = waEn() ? 'en' : 'ar'; try { return fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' }); } finally { LANG = prev; } }
function waBase(c) { const st = S(); return { name: waName(c) || (waEn() ? 'Dear customer' : 'عميلنا العزيز'), business: waEn() && st.businessNameEn ? st.businessNameEn : st.businessName, phone: st.phone || '' }; }

function waDebtText(c) { return waFill(waTemplate('debt'), { ...waBase(c), amount: waMoney(Math.max(0, customerBalance(c.id))) }); }
function waInvoiceText(d) {
  const c = DB.get('customers', d.customerId); const tt = docTotals(d);
  const items = d.items.map(it => `• ${waName(DB.get('products', it.productId))} × ${fmtNum(it.qty, 3)} = ${money(lineTotal(it))}`).join('\n') + (tt.disc ? `\n${waEn() ? 'Discount' : 'الخصم'}: -${money(tt.disc)}` : '');
  return waFill(waTemplate('invoice'), { ...waBase(c), number: d.number, date: waDate(d.date), items, total: waMoney(tt.total), paid: waMoney(d.paid), due: waMoney(Math.max(0, docDue(d))) });
}
function waStatementText(c) {
  const lines = withPrintLang(waEn() ? 'en' : 'ar', () => statement('customer', c.id)).slice(-12).map(l => `${l.date ? waDate(l.date) : '—'} | ${l.ref || ''} ${l.desc}: ${l.debit ? '+' + money(l.debit) : '-' + money(l.credit)} → ${money(l.balance)}`).join('\n');
  return waFill(waTemplate('statement'), { ...waBase(c), date: waDate(today()), lines: lines || '—', amount: waMoney(customerBalance(c.id)) });
}

function waCustomerCompose(id) {
  const c = DB.get('customers', id); if (!c) return;
  const last = DB.all('sales').filter(s => s.customerId === id && s.type === 'sale').sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number))[0];
  waCompose({ title: loc(c), to: loc(c), phone: c.phone, choices: [
    customerBalance(id) > 0.0005 ? { label: `${t('wa_debt')} (${moneyText(customerBalance(id))})`, type: 'debt', text: waDebtText(c) } : null,
    { label: t('wa_statement'), type: 'statement', text: waStatementText(c) },
    last ? { label: `${t('wa_invoice')} ${last.number}`, type: 'invoice', ref: last.number, text: waInvoiceText(last) } : null,
    { label: t('wa_custom'), type: 'custom', text: waFill(waTemplate('custom'), { ...waBase(c), text: '' }) },
  ] });
}
function waDocCompose(id) {
  const d = DB.get('sales', id); if (!d) return; const c = DB.get('customers', d.customerId);
  waCompose({ title: `${t('wa_invoice')} ${d.number}`, to: c ? loc(c) : t('walkIn'), phone: c?.phone || '', choices: [{ label: t('wa_invoice'), type: 'invoice', ref: d.number, text: waInvoiceText(d) }] });
}

function renderMessages(p) {
  const type = ['debt', 'custom'].includes(p.type) ? p.type : 'debt';
  const custs = DB.all('customers').filter(c => c.active !== false);
  let ctl, rows;
  if (type === 'debt') {
    const min = +(p.min ?? 0);
    ctl = `<label class="sel"><span>${t('waMinAmount')}</span><input class="input sm" type="number" min="0" value="${min}" data-chg="nav-param" data-param="min"></label>`;
    rows = custs.map(c => ({ c, b: customerBalance(c.id) })).filter(x => x.b > Math.max(0.0005, min)).sort((a, b) => b.b - a.b)
      .map(({ c, b }) => ({ key: c.id, to: loc(c), sub: `${t('f_balance')}: ${moneyText(b)}`, phone: c.phone, type, ref: c.code, text: waDebtText(c) }));
  } else {
    const who = p.who === 'owing' ? 'owing' : 'all';
    ctl = `<label class="sel"><span>${t('waAudience')}</span><select class="input sm" data-chg="nav-param" data-param="who"><option value="all">${t('all')}</option><option value="owing" ${who === 'owing' ? 'selected' : ''}>${t('opt_owing')}</option></select></label>
      <label class="field grow"><span>${t('waCustomText')}</span><textarea class="input" rows="3" data-chg="nav-param" data-param="text" dir="auto" placeholder="${t('waOfferHint')}">${esc(p.text || '')}</textarea></label>`;
    rows = custs.filter(c => who === 'all' || customerBalance(c.id) > 0.0005).map(c => ({ key: c.id, to: loc(c), sub: c.city || '', phone: c.phone, type, ref: c.code, text: waFill(waTemplate('custom'), { ...waBase(c), text: p.text || '' }) }));
  }
  waQueueSet(rows, JSON.stringify([type, p.min, p.who, p.text]));
  return `${pageHead(t('nav_messages'), t('sub_messages'))}
    <div class="card"><div class="tabs wrap">${['debt', 'custom'].map(k => `<a class="tab ${type === k ? 'on' : ''}" href="#/messages?type=${k}">${t(k === 'custom' ? 'waOffers' : 'wa_debt')}</a>`).join('')}</div>
      <div class="toolbar wa-ctl">${ctl}</div><div id="wa-queue">${waQueueHtml()}</div></div>
    <div class="grid-2">${card(t('waLogTitle'), waLogHtml())}${card(t('waHowTitle'), `<ol class="howto"><li>${t('waHow1')}</li><li>${t('waHow2')}</li><li>${t('waHow3')}</li><li>${t('waHow4')}</li></ol><p class="hint">${t('waSingleHint')}</p>`, can(['admin']) ? `<a class="link" href="#/settings">${t('waEditTemplates')}</a>` : '')}</div>`;
}
