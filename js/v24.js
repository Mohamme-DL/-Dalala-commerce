/* Dalala Commerce 2.4 — import wizard (data from a previous system), filters shown on exports,
   totals on printed lists, "open the file" after saving, label printing extras. */
'use strict';

/* ---------- labels used only by the import wizard ---------- */
const IML = {
  ar: { products: 'الأصناف والمخزون', customers: 'العملاء', suppliers: 'الموردون', sales: 'فواتير البيع السابقة', purchases: 'فواتير الشراء السابقة',
    h_products: 'اسم الصنف، السعر، التكلفة، الكمية الحالية (تصير رصيداً افتتاحياً)، الباركود…', h_customers: 'الاسم، الهاتف، العنوان، والرصيد المستحق على العميل (دين سابق).', h_suppliers: 'الاسم، الهاتف، العنوان، والرصيد المستحق للمورد (دين علينا).',
    h_sales: 'سجل فواتير البيع القديمة لتظهر في التقارير والأرباح: سطر لكل صنف في الفاتورة، أو سطر لكل فاتورة وإجماليها.', h_purchases: 'سجل فواتير الشراء القديمة لتظهر في تقارير المشتريات: سطر لكل صنف، أو سطر لكل فاتورة وإجماليها.',
    name: 'الاسم', name_products: 'اسم الصنف', name_customers: 'اسم العميل', name_suppliers: 'اسم المورد', sku: 'الكود', barcode: 'الباركود', category: 'الفئة', unit: 'الوحدة', cost_price: 'سعر الشراء / التكلفة', sale_price: 'سعر البيع',
    stock: 'الكمية الحالية (رصيد افتتاحي)', min_stock: 'حد التنبيه', expiry_date: 'تاريخ الصلاحية', phone: 'الهاتف', address: 'العنوان', notes: 'ملاحظات', balance: 'الرصيد', balance_customers: 'الرصيد (دين على العميل)', balance_suppliers: 'الرصيد (دين علينا للمورد)',
    invoice_no: 'رقم الفاتورة', date: 'تاريخ الفاتورة', customer: 'اسم العميل', supplier: 'اسم المورد', product: 'اسم الصنف (بند الفاتورة)', qty: 'الكمية', unit_price: 'سعر البيع للوحدة', unit_cost: 'تكلفة / سعر شراء الوحدة', line_total: 'إجمالي السطر', discount: 'الخصم', total: 'إجمالي الفاتورة (إن لم توجد بنود)', profit: 'الربح',
    title: 'ترحيل بيانات من منظومة سابقة', s1: 'اختيار الملف', s2: 'مطابقة الأعمدة', s3: 'فحص النتيجة', s4: 'الترحيل', what: 'ماذا تريد أن ترحّل من المنظومة السابقة؟', pick: 'اختر ملف البيانات أو اسحبه إلى هنا',
    formats: 'Excel (xlsx, ods) · CSV / TXT · JSON · XML · HTML · DBF · SQLite (db)', template: 'تنزيل قالب Excel جاهز لهذا النوع', templateNote: 'املأ الأعمدة التي عندك فقط واحذف سطر المثال، ثم ارفع الملف في المعالج.',
    tip: 'نصيحة: رحّل الأصناف أولاً ثم العملاء ثم الموردين ثم الفواتير، كل نوع بملف مستقل. تستطيع تصدير بياناتك من المنظومة القديمة إلى Excel أو CSV. قبل أي ترحيل تُحفظ نسخة احتياطية تلقائياً، ولا يتغير شيء إلا بعد موافقتك على نتيجة الفحص.',
    reading: 'جارٍ قراءة الملف…', file: 'الملف', records: 'سجل', truncated: '(يُقرأ أول 30000 فقط — قسّم الملف لترحيل الباقي)', sheet: 'الجدول / الورقة داخل الملف', ourField: 'الحقل في منظومتنا', yourCol: 'العمود في ملفك', example: 'مثال من الملف', none: '— لا أستورده —',
    exists: 'إذا كان السجل موجوداً مسبقاً في المنظومة', skip: 'تخطّيه (لا أغيّر الموجود)', update: 'تحديث بياناته من الملف (الأسعار والبيانات، دون تغيير الكمية أو الرصيد)', defDate: 'تاريخ تُسجَّل به الفواتير التي بلا تاريخ',
    archNote: 'تُسجَّل الفواتير المرحَّلة كمدفوعة وللأرشيف والتقارير والأرباح فقط: لا تغيّر المخزون ولا الصندوق ولا أرصدة العملاء والموردين (الأرصدة ترحّلها من «العملاء» و«الموردون»). الأصناف غير الموجودة تُنشأ كسجل أرشيفي مخفي.',
    balNote: 'الرصيد يُسجَّل كرصيد افتتاحي للحساب ويظهر في كشف الحساب ويمكن تسديده (سالب = رصيد له).', preview: 'معاينة أول 5 سجلات من ملفك', check: 'فحص البيانات', back: 'رجوع', needName: 'حدّد العمود الذي يحوي الاسم أولاً', needInv: 'حدّد العمود الذي يحوي رقم الفاتورة',
    needLine: 'حدّد عمود الصنف (لبنود الفاتورة) أو عمود إجمالي الفاتورة', noRecs: 'لا توجد سجلات للترحيل بهذه المطابقة', checking: 'جارٍ فحص السجلات', running: 'جارٍ الترحيل', created: 'جديد', updated: 'تحديث', skipped: 'تخطّي (موجود)', failed: 'خطأ', warnings: 'تنبيهات', fileDup: 'مكرر داخل الملف',
    errs: 'سجلات لن تُرحَّل — صحّحها في ملفك وأعد ترحيلها لاحقاً:', row: 'السطر', reason: 'السبب', exportErrs: 'تصدير الأخطاء إلى Excel', runNow: 'ترحيل الآن', nothing: 'لا يوجد ما يُرحَّل.', done: 'تم الترحيل', backup: 'نسخة احتياطية قبل الترحيل', close: 'إغلاق', again: 'ترحيل ملف آخر',
    eReq: 'حقل مطلوب فارغ', eNum: 'قيمة غير رقمية', eNeg: 'قيمة سالبة', eDate: 'تاريخ غير مفهوم', eBar: 'الباركود مسجل لصنف آخر', eNoLines: 'لا بنود ولا إجمالي للفاتورة', eLine: 'السطر', wUnit: 'وحدة غير معروفة فاعتُبرت «قطعة»', wExp: 'تاريخ صلاحية غير مفهوم فتُجوهل', wMissing: 'أصناف غير موجودة أُنشئ لها سجل أرشيفي مخفي', wNoCost: 'بنود بلا تكلفة (الربح سيظهر أعلى)', wBal: 'الرصيد الافتتاحي الموجود لم يُغيَّر' },
  en: { products: 'Items & stock', customers: 'Customers', suppliers: 'Suppliers', sales: 'Past sales invoices', purchases: 'Past purchase invoices',
    h_products: 'Item name, price, cost, current quantity (becomes opening stock), barcode…', h_customers: 'Name, phone, address and the amount the customer owes (old debt).', h_suppliers: 'Name, phone, address and the amount we owe the supplier.',
    h_sales: 'Old sales invoices for reports and profit: one row per invoice line, or one row per invoice with its total.', h_purchases: 'Old purchase invoices for purchase reports: one row per line, or one row per invoice with its total.',
    name: 'Name', name_products: 'Item name', name_customers: 'Customer name', name_suppliers: 'Supplier name', sku: 'Code', barcode: 'Barcode', category: 'Category', unit: 'Unit', cost_price: 'Cost / purchase price', sale_price: 'Sale price',
    stock: 'Current quantity (opening stock)', min_stock: 'Alert level', expiry_date: 'Expiry date', phone: 'Phone', address: 'Address', notes: 'Notes', balance: 'Balance', balance_customers: 'Balance (customer owes)', balance_suppliers: 'Balance (we owe)',
    invoice_no: 'Invoice number', date: 'Invoice date', customer: 'Customer name', supplier: 'Supplier name', product: 'Item name (invoice line)', qty: 'Quantity', unit_price: 'Unit sale price', unit_cost: 'Unit cost / purchase price', line_total: 'Line total', discount: 'Discount', total: 'Invoice total (when there are no lines)', profit: 'Profit',
    title: 'Import data from a previous system', s1: 'Choose file', s2: 'Match columns', s3: 'Check', s4: 'Import', what: 'What do you want to bring from the previous system?', pick: 'Choose the data file or drop it here',
    formats: 'Excel (xlsx, ods) · CSV / TXT · JSON · XML · HTML · DBF · SQLite (db)', template: 'Download a ready Excel template for this kind', templateNote: 'Fill only the columns you have, delete the example row, then upload the file in the wizard.',
    tip: 'Tip: import items first, then customers, suppliers and invoices, each kind from its own file. Most old systems export to Excel or CSV. A backup is saved automatically before importing, and nothing changes until you accept the check result.',
    reading: 'Reading the file…', file: 'File', records: 'records', truncated: '(only the first 30,000 are read — split the file)', sheet: 'Table / sheet in the file', ourField: 'Field in our system', yourCol: 'Column in your file', example: 'Example from the file', none: '— do not import —',
    exists: 'When the record already exists', skip: 'Skip it (keep what exists)', update: 'Update it from the file (prices and details, not the quantity or balance)', defDate: 'Date for invoices that have no date',
    archNote: 'Imported invoices are recorded as paid, for the archive, reports and profit only: they never change stock, cash or customer / supplier balances (import balances from Customers and Suppliers). Missing items are created as hidden archive items.',
    balNote: 'The balance becomes the account opening balance, shows on the statement and can be paid (negative = credit).', preview: 'First 5 records of your file', check: 'Check data', back: 'Back', needName: 'Choose the column that holds the name first', needInv: 'Choose the invoice number column',
    needLine: 'Choose the item column (invoice lines) or the invoice total column', noRecs: 'No records to import with this matching', checking: 'Checking records', running: 'Importing', created: 'New', updated: 'Update', skipped: 'Skipped (exists)', failed: 'Errors', warnings: 'Warnings', fileDup: 'Duplicates in file',
    errs: 'Records that will not be imported — fix them in your file and import them later:', row: 'Row', reason: 'Reason', exportErrs: 'Export errors to Excel', runNow: 'Import now', nothing: 'Nothing to import.', done: 'Import finished', backup: 'Backup before import', close: 'Close', again: 'Import another file',
    eReq: 'Required field is empty', eNum: 'Not a number', eNeg: 'Negative value', eDate: 'Date not understood', eBar: 'Barcode already used by another item', eNoLines: 'No lines and no invoice total', eLine: 'Line', wUnit: 'Unknown unit, set to "piece"', wExp: 'Expiry date not understood, ignored', wMissing: 'Missing items were created as hidden archive items', wNoCost: 'Lines without cost (profit will look higher)', wBal: 'Existing opening balance was not changed' },
};
const il = (k, kind) => (IML[LANG] || IML.ar)[kind && (IML[LANG] || IML.ar)[k + '_' + kind] ? k + '_' + kind : k] || k;

/* ================= running an import (dry = check only) ================= */
function impRun(kind, recs, { dry, mode, date }) {
  const res = { created: 0, updated: 0, skipped: 0, failed: 0, warnings: 0, errors: [] };
  const seenBar = new Set(); const d = DB.d;
  const num = (v, label) => { const n = impNum(v); if (n === null) return null; if (Number.isNaN(n)) throw new Error(`${il('eNum')}: ${label} «${v}»`); return n; };
  const pos = (v, label) => { const n = num(v, label); if (n !== null && n < 0) throw new Error(`${il('eNeg')}: ${label}`); return n; };
  const catFor = name => { const n = impNorm(name); if (!n) return (d.categories[0] || {}).id; let c = d.categories.find(x => impNorm(x.name) === n || impNorm(x.nameEn) === n); if (!c && !dry) { c = { id: uid(), name: String(name).trim(), nameEn: '', createdAt: Date.now() }; d.categories.push(c); } return c ? c.id : (d.categories[0] || {}).id; };
  const findProduct = (sku, bar, name, any) => d.products.find(p => (any || !p.deleted) && ((bar && p.barcode === bar) || (sku && String(p.code).toLowerCase() === String(sku).toLowerCase()))) || d.products.find(p => (any || !p.deleted) && name && impNorm(p.name) === impNorm(name));
  const hidden = (name, price, cost) => { const p = { id: uid(), createdAt: Date.now(), code: DB.nextCode('products', 'code', 'PRD'), barcode: '', name, nameEn: '', categoryId: (d.categories[0] || {}).id, unit: 'piece', kind: 'stock', cost: round(cost || 0), price: round(price || 0), openingQty: 0, minQty: 0, active: false, deleted: true, importedArchive: true }; d.products.push(p); return p; };
  for (const r of recs) {
    const warn = [];
    try {
      let st;
      if (kind === 'products') {
        const name = String(r.name || '').trim(); if (!name) throw new Error(`${il('eReq')}: ${il('name', 'products')}`);
        const sku = String(r.sku || '').trim(), bar = String(r.barcode || '').trim();
        const cost = pos(r.cost_price, il('cost_price')), price = pos(r.sale_price, il('sale_price')), qty = num(r.stock, il('stock')), min = pos(r.min_stock, il('min_stock'));
        let unit = impUnit(r.unit); if (unit === null) { unit = 'piece'; warn.push(il('wUnit')); }
        let exp = ''; if (r.expiry_date) { exp = impDate(r.expiry_date); if (!exp) warn.push(il('wExp')); }
        const ex = findProduct(sku, bar, name);
        if (ex) {
          if (mode !== 'update') st = 'skip';
          else { if (!dry) Object.assign(ex, { name, ...(cost !== null ? { cost } : {}), ...(price !== null ? { price } : {}), ...(min !== null ? { minQty: min } : {}), ...(bar && !ex.barcode ? { barcode: bar } : {}), ...(r.category ? { categoryId: catFor(r.category) } : {}), ...(r.unit ? { unit } : {}) }); st = 'update'; }
        } else {
          if (bar && (seenBar.has(bar) || d.products.some(p => p.barcode === bar))) throw new Error(`${il('eBar')} «${bar}»`);
          if (bar) seenBar.add(bar);
          if (!dry) {
            const code = sku && !d.products.some(p => String(p.code).toLowerCase() === sku.toLowerCase()) ? sku : DB.nextCode('products', 'code', 'PRD');
            d.products.push({ id: uid(), createdAt: Date.now(), code, barcode: bar, name, nameEn: '', categoryId: catFor(r.category), unit, kind: 'stock', cost: cost || 0, price: price || 0, openingQty: qty || 0, openingExpiry: exp, minQty: min || 0, active: true, imported: today() });
          }
          st = 'new';
        }
      } else if (kind === 'customers' || kind === 'suppliers') {
        const name = String(r.name || '').trim(); if (!name) throw new Error(`${il('eReq')}: ${il('name', kind)}`);
        const phone = String(r.phone || '').trim(); const bal = num(r.balance, il('balance'));
        const ex = d[kind].find(c => impNorm(c.name) === impNorm(name) && (!phone || !c.phone || String(c.phone).replace(/\D/g, '') === phone.replace(/\D/g, '')));
        if (ex) {
          if (mode !== 'update') st = 'skip';
          else { if (!dry) { if (phone) ex.phone = phone; if (r.address) ex.address = r.address; if (r.notes) ex.notes = r.notes; if (bal !== null) { if (!+ex.openingBalance) ex.openingBalance = round(bal); else if (round(bal) !== round(+ex.openingBalance)) warn.push(il('wBal')); } } st = 'update'; }
        } else {
          if (!dry) d[kind].push({ id: uid(), createdAt: Date.now(), code: DB.nextCode(kind, 'code', kind === 'customers' ? 'CUS' : 'SUP'), name, nameEn: '', phone, city: '', address: r.address || '', notes: r.notes || '', openingBalance: round(bal || 0), creditLimit: 0, active: true, imported: today() });
          st = 'new';
        }
      } else { // sales / purchases (archive)
        const isS = kind === 'sales'; const no = String(r.invoice_no || '').trim(); if (!no) throw new Error(`${il('eReq')}: ${il('invoice_no')}`);
        const number = 'OLD-' + no.replace(/\s+/g, '').slice(0, 40);
        if (d[kind].some(x => x.number === number)) { st = 'skip'; }
        else {
          let dt = date; if (r.date) { dt = impDate(r.date); if (!dt) throw new Error(`${il('eDate')}: ${r.date}`); }
          const pname = String((isS ? r.customer : r.supplier) || '').trim(); const party = pname ? d[isS ? 'customers' : 'suppliers'].find(c => impNorm(c.name) === impNorm(pname)) : null;
          const items = []; let missing = 0, noCost = 0;
          (r.lines || []).forEach((ln, i) => {
            const label = `${il('eLine')} ${i + 1}`; const pn = String(ln.product || ln.sku || ln.barcode || '').trim(); if (!pn) throw new Error(`${label}: ${il('eReq')} (${il('product')})`);
            let q = pos(ln.qty, il('qty')); if (q === null) q = 1; if (!(q > 0)) throw new Error(`${label} (${pn}): ${il('eNum')} ${il('qty')}`);
            let pr = pos(isS ? ln.unit_price : ln.unit_cost, isS ? il('unit_price') : il('unit_cost')); let lt = pos(ln.line_total, il('line_total'));
            if (pr === null && lt === null) throw new Error(`${label} (${pn}): ${il('eNoLines')}`);
            if (pr === null) pr = lt / q; if (lt === null) lt = pr * q;
            let p = findProduct(String(ln.sku || '').trim(), String(ln.barcode || '').trim(), String(ln.product || '').trim(), true);
            let uc = isS ? pos(ln.unit_cost, il('unit_cost')) : pr;
            if (isS && uc === null) { const lp = num(ln.profit, il('profit')); if (lp !== null) uc = Math.max(0, (lt - lp) / q); else if (p) uc = +p.cost || 0; else { uc = 0; noCost++; } }
            if (!p) { missing++; if (!dry) p = hidden(pn, isS ? pr : 0, uc); }
            items.push({ productId: p ? p.id : '', qty: round(q), price: round(lt / q), discount: 0, cost: round(uc || 0) });
          });
          if (!items.length) {
            const tot = pos(r.total, il('total')); if (!(tot > 0)) throw new Error(il('eNoLines'));
            const prof = isS ? num(r.profit, il('profit')) : null;
            let p = d.products.find(x => x.importedArchive && x.name === t('impArchivedLines')); if (!p && !dry) p = hidden(t('impArchivedLines'), 0, 0);
            items.push({ productId: p ? p.id : '', qty: 1, price: round(tot), discount: 0, cost: round(prof !== null ? Math.max(0, tot - prof) : 0) });
          }
          if (missing) warn.push(`${il('wMissing')} (${missing})`); if (noCost) warn.push(`${il('wNoCost')} (${noCost})`);
          const disc = isS ? pos(r.discount, il('discount')) || 0 : 0;
          if (!dry) {
            const doc = { id: uid(), createdAt: Date.now(), number, type: isS ? 'sale' : 'purchase', date: dt, items, discount: disc, taxRate: 0, paid: 0, method: 'cash', notes: t('impArchivedNote'), user: USER ? USER.username : '', archived: true, ...(party ? {} : { archiveParty: pname }) };
            if (isS) doc.customerId = party ? party.id : ''; else { doc.supplierId = party ? party.id : ''; doc.supplierRef = no; }
            doc.paid = docTotal(doc); d[kind].push(doc);
          }
          st = 'new';
        }
      }
      res[st === 'new' ? 'created' : st === 'update' ? 'updated' : 'skipped']++; res.warnings += warn.length;
      if (warn.length && res.errors.length < 200) warn.forEach(w => res.errors.length < 200 && res.errors.push({ row: r._row, name: r.name || r.invoice_no || '', msg: '⚠ ' + w, warn: true }));
    } catch (e) { res.failed++; if (res.errors.length < 200) res.errors.push({ row: r._row, name: r.name || r.invoice_no || '', msg: e.message }); }
  }
  if (!dry && (res.created + res.updated)) DB.save();
  return res;
}

/* ================= the 4-step wizard ================= */
function importWizard(kind) {
  if (!USER || USER.role !== 'admin') return toast(t('noPermission'), 'err');
  const S = { kind: kind || 'products', parsed: null, ti: 0, map: {}, mode: 'skip', date: today(), file: '', recs: [], fileDup: 0, agg: null };
  const root = $('.modal', modal({ title: il('title'), size: 'xl', body: '<div id="imp-body" class="imp"></div>' })); // listeners live on this window only
  const body = () => $('#imp-body', root);
  const bar = n => `<div class="imp-steps">${['s1', 's2', 's3', 's4'].map((k, i) => `<span class="${i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}">${i + 1}. ${il(k)}</span>`).join('')}</div>`;
  const F = () => IMPF[S.kind].fields;
  function step1() {
    body().innerHTML = `${bar(1)}<p class="muted">${il('what')}</p><div class="btn-row">${Object.keys(IMPF).map(k => `<button type="button" class="btn ${S.kind === k ? 'primary' : 'ghost'}" data-ik="${k}">${il(k)}</button>`).join('')}</div>
      <p class="hint">${il('h_' + S.kind)}</p>
      <label class="imp-drop" id="imp-drop">${icon('upload')}<b>${il('pick')}</b><small class="ltr">${il('formats')}</small><input type="file" id="imp-file" hidden accept=".csv,.txt,.tsv,.xlsx,.xlsm,.ods,.json,.xml,.dbf,.db,.sqlite,.sqlite3,.htm,.html"></label>
      <div class="btn-row"><button type="button" class="btn ghost sm" data-ia="template">${icon('download')}<span>${il('template')}</span></button></div><p class="note-warn">${il('tip')}</p>`;
  }
  async function take(f) {
    body().innerHTML = `${bar(1)}<div class="imp-wait">${il('reading')} «${esc(f.name)}»</div>`;
    try {
      if (f.size > 40 * 1024 * 1024) throw new Error(t('impTooBig'));
      S.parsed = await IMP.read(f); S.file = f.name; let best = 0, bs = -Infinity;
      S.parsed.tables.forEach((tb, i) => { const m = impAutoMap(S.kind, tb.headers); let sc = Object.keys(m).length * 1000 + Math.min(tb.total, 999); if (m[F()[0][0]] == null) sc -= 100000; if (sc > bs) { bs = sc; best = i; } });
      S.ti = best; S.map = impAutoMap(S.kind, S.parsed.tables[best].headers); step2();
    } catch (e) { toast(e.message, 'err'); step1(); }
  }
  function step2() {
    const tb = S.parsed.tables[S.ti]; const arch = S.kind === 'sales' || S.kind === 'purchases';
    body().innerHTML = `${bar(2)}<p class="muted">${il('file')}: <b class="ltr">${esc(S.file)}</b> (${esc(S.parsed.format)}) — ${fmtNum(tb.total)} ${il('records')} ${tb.truncated ? il('truncated') : ''}</p>
      ${S.parsed.tables.length > 1 ? `<label class="field"><span>${il('sheet')}</span><select class="input" id="imp-ti">${S.parsed.tables.map((x, i) => `<option value="${i}" ${i === S.ti ? 'selected' : ''}>${esc(x.name)} — ${fmtNum(x.total)}</option>`).join('')}</select></label>` : ''}
      <div class="imp-map"><b class="muted">${il('ourField')}</b><b class="muted">${il('yourCol')}</b><b class="muted">${il('example')}</b>
        ${F().map(([k, req]) => `<span>${esc(il(k, S.kind))}${req ? ' <i class="req">*</i>' : ''}</span><select class="input sm" data-im="${k}"><option value="">${il('none')}</option>${tb.headers.map((h, i) => `<option value="${i}" ${S.map[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select><span class="imp-ex" data-ex="${k}">${esc(S.map[k] != null ? impShow(k, (tb.rows[0] || [])[S.map[k]]) : '')}</span>`).join('')}</div>
      ${!arch ? `<label class="field"><span>${il('exists')}</span><select class="input" id="imp-mode"><option value="skip" ${S.mode === 'skip' ? 'selected' : ''}>${il('skip')}</option><option value="update" ${S.mode === 'update' ? 'selected' : ''}>${il('update')}</option></select></label>` : ''}
      ${arch ? `<label class="field"><span>${il('defDate')}</span><input class="input" type="date" id="imp-date" value="${S.date}"></label><p class="hint">${il('archNote')}</p>` : ''}${S.kind === 'customers' || S.kind === 'suppliers' ? `<p class="hint">${il('balNote')}</p>` : ''}
      <p class="muted">${il('preview')}</p><div class="table-wrap imp-pv"><table class="table compact"><thead><tr>${tb.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tb.rows.slice(0, 5).map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="btn-row"><button type="button" class="btn primary" data-ia="check">${icon('check')}<span>${il('check')}</span></button><button type="button" class="btn ghost" data-ia="back1">${il('back')}</button></div>`;
  }
  function build() {
    const tb = S.parsed.tables[S.ti]; S.fileDup = 0;
    const val = (r, k) => (S.map[k] == null ? '' : String(r[S.map[k]] ?? '').trim());
    if (S.kind === 'sales' || S.kind === 'purchases') {
      const inv = {}, ord = [];
      tb.rows.forEach((r, i) => {
        const o = {}; let any = false; F().forEach(([k]) => { const v = val(r, k); if (v !== '') { o[k] = v; any = true; } }); if (!any || !o.invoice_no) return;
        let g = inv[o.invoice_no]; if (!g) { g = inv[o.invoice_no] = { _row: i + 2, invoice_no: o.invoice_no, lines: [] }; ord.push(g); }
        ['date', 'customer', 'supplier', 'discount', 'total', 'profit'].forEach(k => { if (o[k] && !g[k]) g[k] = o[k]; });
        if (o.product || o.sku || o.barcode) g.lines.push({ product: o.product || '', sku: o.sku || '', barcode: o.barcode || '', qty: o.qty || '', unit_price: o.unit_price || '', unit_cost: o.unit_cost || '', line_total: o.line_total || '', profit: o.profit || '' });
      });
      S.recs = ord; return;
    }
    const seen = {}; S.recs = [];
    tb.rows.forEach((r, i) => {
      const o = { _row: i + 2 }; let any = false; F().forEach(([k]) => { const v = val(r, k); if (v !== '') { o[k] = v; any = true; } }); if (!any) return;
      const key = S.kind === 'products' ? (o.barcode ? 'b:' + o.barcode : o.sku ? 's:' + o.sku : 'n:' + impNorm(o.name)) : 'n:' + impNorm(o.name) + '|' + (o.phone || '');
      if (o.name && seen[key]) { S.fileDup++; return; } if (o.name) seen[key] = 1; S.recs.push(o);
    });
  }
  const cards = (A, list) => `<div class="imp-cards">${list.map(([v, l, c]) => `<div class="imp-card ${c}"><b>${fmtNum(v)}</b><span>${l}</span></div>`).join('')}</div>`;
  const errTable = A => (A.errors.length ? `<p class="muted">${il('errs')}</p><div class="table-wrap imp-pv"><table class="table compact"><thead><tr><th>${il('row')}</th><th>${t('f_name')}</th><th>${il('reason')}</th></tr></thead><tbody>${A.errors.slice(0, 100).map(e => `<tr class="${e.warn ? '' : 'neg'}"><td>${e.row || ''}</td><td>${esc(e.name)}</td><td>${esc(e.msg)}</td></tr>`).join('')}</tbody></table></div>
    <button type="button" class="btn ghost sm" data-ia="errs">${icon('download')}<span>${il('exportErrs')}</span></button>` : '');
  function check() {
    const arch = S.kind === 'sales' || S.kind === 'purchases';
    if (arch) { if (S.map.invoice_no == null) return toast(il('needInv'), 'err'); if (S.map.product == null && S.map.sku == null && S.map.barcode == null && S.map.total == null) return toast(il('needLine'), 'err'); }
    else if (S.map.name == null) return toast(il('needName'), 'err');
    build(); if (!S.recs.length) return toast(il('noRecs'), 'err');
    S.agg = impRun(S.kind, S.recs, { dry: true, mode: S.mode, date: S.date }); const A = S.agg; const ok = A.created + A.updated;
    body().innerHTML = `${bar(3)}${cards(A, [[A.created, il('created'), 'ok'], [A.updated, il('updated'), 'info'], [A.skipped, il('skipped'), ''], [A.failed, il('failed'), 'bad'], [A.warnings, il('warnings'), 'warn'], ...(S.fileDup ? [[S.fileDup, il('fileDup'), '']] : [])])}
      ${errTable(A)}<div class="btn-row">${ok ? `<button type="button" class="btn primary" data-ia="run">${icon('upload')}<span>${il('runNow')} (${fmtNum(ok)})</span></button>` : `<span class="muted">${il('nothing')}</span>`}<button type="button" class="btn ghost" data-ia="back2">${il('back')}</button></div>`;
  }
  async function run() {
    body().innerHTML = `${bar(4)}<div class="imp-wait">${il('running')}…</div>`;
    const tag = 'before-import-' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const saved = await backupNow(tag); if (!saved) downloadFile(`dalala-commerce-${tag}.json`, JSON.stringify(DB.d), 'application/json');
    const A = impRun(S.kind, S.recs, { dry: false, mode: S.mode, date: S.date });
    body().innerHTML = `${bar(4)}<h3 class="pos">✓ ${il('done')}</h3>${cards(A, [[A.created, il('created'), 'ok'], [A.updated, il('updated'), 'info'], [A.skipped, il('skipped'), ''], [A.failed, il('failed'), 'bad']])}
      <p class="hint">${il('backup')}: <b class="ltr">${esc(saved ? tag : tag + '.json')}</b></p>${errTable(A)}
      <div class="btn-row"><button type="button" class="btn primary" data-ia="close">${il('close')}</button><button type="button" class="btn ghost" data-ia="again">${il('again')}</button></div>`;
    S.agg = A;
  }
  root.addEventListener('click', e => {
    const k = e.target.closest('[data-ik]'); if (k) { S.kind = k.dataset.ik; step1(); return; }
    const a = e.target.closest('[data-ia]'); if (!a) return; const act = a.dataset.ia;
    if (act === 'template') OFFICE.xlsx(`import-template-${S.kind}`, [{ name: il(S.kind), title: `${il('template')} — ${il(S.kind)}`, sub: il('templateNote'), headers: F().map(([f]) => il(f, S.kind)), rows: [F().map(([f]) => IMP_SAMPLE[f] || '')] }]);
    if (act === 'back1') step1(); if (act === 'check') check(); if (act === 'back2') step2(); if (act === 'run') run();
    if (act === 'errs') OFFICE.xlsx('import-errors', [{ name: il('failed'), title: il('errs'), sub: S.file, headers: [il('row'), t('f_name'), il('reason')], rows: S.agg.errors.map(x => [x.row || '', x.name, x.msg]) }]);
    if (act === 'close') { closeModal(); render(); } if (act === 'again') { S.parsed = null; step1(); }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'imp-file' && el.files[0]) take(el.files[0]);
    if (el.id === 'imp-ti') { S.ti = +el.value; S.map = impAutoMap(S.kind, S.parsed.tables[S.ti].headers); step2(); }
    if (el.dataset.im) { S.map[el.dataset.im] = el.value === '' ? null : +el.value; const ex = $(`[data-ex="${el.dataset.im}"]`, root); const tb = S.parsed.tables[S.ti]; if (ex) ex.textContent = S.map[el.dataset.im] == null ? '' : impShow(el.dataset.im, (tb.rows[0] || [])[S.map[el.dataset.im]]); }
    if (el.id === 'imp-mode') S.mode = el.value; if (el.id === 'imp-date') S.date = el.value || today();
  });
  root.addEventListener('dragover', e => { if (e.target.closest('#imp-drop')) { e.preventDefault(); e.target.closest('#imp-drop').classList.add('over'); } });
  root.addEventListener('dragleave', e => { const z = e.target.closest('#imp-drop'); if (z) z.classList.remove('over'); });
  root.addEventListener('drop', e => { const z = e.target.closest('#imp-drop'); if (!z) return; e.preventDefault(); z.classList.remove('over'); const f = e.dataTransfer?.files?.[0]; if (f) take(f); });
  step1();
}
const impShow = (k, v) => (/date/.test(k) && v && impDate(v) ? fmtDate(impDate(v)) : v || ''); // example column: Excel date numbers shown as dates
function importCard() {
  if (!USER || USER.role !== 'admin') return '';
  return card(`${icon('upload')} ${il('title')}`, `<p class="hint">${il('tip')}</p><div class="btn-row">${Object.keys(IMPF).map(k => `<button class="btn ghost" data-act="import-open" data-kind="${k}">${icon('upload')}<span>${il(k)}</span></button>`).join('')}</div>`);
}

/* ================= imported (archived) invoices: read only ================= */
(function () {
  const _e = startEdit; startEdit = function (kind, d) { if (d && d.archived) return toast(t('archivedNoEdit'), 'err'); return _e(kind, d); }; // eslint-disable-line no-global-assign
  const _r = startReturn; startReturn = function (kind, d) { if (d && d.archived) return toast(t('archivedNoEdit'), 'err'); return _r(kind, d); }; // eslint-disable-line no-global-assign
  ['sales', 'purchases'].forEach(col => {
    const E = ENT[col]; const nf = E.fields.find(f => f.k === 'number'); const prev = nf.fmt;
    nf.fmt = r => `${prev ? prev(r) : esc(r.number)}${r.archived ? ` <small class="badge b-archived">${t('archivedLbl')}</small>` : ''}`;
    const pf = E.fields.find(f => f.k === (col === 'sales' ? 'customerId' : 'supplierId')); const ps = pf.show;
    pf.show = r => (r.archived && r.archiveParty && !(col === 'sales' ? r.customerId : r.supplierId) ? r.archiveParty : ps ? ps(r) : partyName(col === 'sales' ? 'customers' : 'suppliers', col === 'sales' ? r.customerId : r.supplierId));
    E.actions.filter(a => a.label === 'makeReturn').forEach(a => { const s0 = a.show; a.show = r => !r.archived && (!s0 || s0(r)); });
    E.filters.push({ k: 'archived', opts: ['live', 'archived'], test: (r, v) => (v === 'archived' ? !!r.archived : !r.archived) });
  });
  ENT.products.hidden = r => r.deleted; // imported archive items stay hidden like deleted ones
})();

/* ================= filters on exports, totals on printed lists ================= */
function crudInfo(key) {
  const cfg = ENT[key], st = crudState(key), out = [];
  (cfg.filters || []).forEach(fl => {
    const v = st.f[fl.k]; if (v === '' || v == null) return; const f = cfg.fields.find(x => x.k === fl.k) || {};
    const opts = fl.opts ? fl.opts.map(o => ({ v: o, l: t('opt_' + o) })) : f.type === 'ref' ? refOptions(f) : fieldOpts(f);
    out.push(`${t('f_' + fl.k)}: ${(opts.find(o => String(o.v) === String(v)) || { l: v }).l}`);
  });
  if (st.q) out.push(`${t('search')}: ${st.q}`);
  return out;
}
const crudVal = (f, r) => { if (f.money || (f.type === 'number' && !f.signed)) { const v = f.type === 'calc' ? f.get(r) : r[f.k]; return v === '' || v == null ? '' : round(+v); } if (f.type === 'number') return r[f.k] === '' ? '' : +r[f.k]; return cellText(f, r); };
exportCrud = function (key) { // eslint-disable-line no-global-assign
  const cfg = ENT[key]; const cols = cfg.fields.filter(f => f.type !== 'password'); const rows = crudRows(key);
  const totals = cols.some(f => f.money) ? cols.map((f, i) => (f.money ? round(sum(rows, r => +crudVal(f, r) || 0)) : i === 0 ? t('total') : '')) : null;
  exportCSV(key, cols.map(fieldLabel), rows.map(r => cols.map(f => crudVal(f, r))), { sheet: t('nav_' + key), sub: crudInfo(key).join(' · '), totals });
};
printCrud = function (key) { // eslint-disable-line no-global-assign
  const cfg = ENT[key]; const cols = cfg.fields.filter(f => f.list); const rows = crudRows(key); const info = crudInfo(key);
  const tot = cols.some(f => f.money) ? `<tfoot><tr><td></td>${cols.map((f, i) => `<td>${f.money ? money(sum(rows, r => +crudVal(f, r) || 0)) : i === 0 ? t('total') : ''}</td>`).join('')}</tr></tfoot>` : '';
  const size = cols.length > 9 ? 'xs' : cols.length > 6 ? 'small' : '';
  printHTML(`${printHeader(t('nav_' + key), `${fmtNum(rows.length)} ${t('records')}${info.length ? ' · ' + esc(info.join(' · ')) : ''}`)}<table class="ptable ${size}"><thead><tr><th>#</th>${cols.map(f => `<th>${esc(fieldLabel(f))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(f => `<td>${esc(cellText(f, r))}</td>`).join('')}</tr>`).join('')}</tbody>${tot}</table>`, cols.length > 6 ? 'land-mode' : '');
};

/* ================= desktop: offer to open an exported file ================= */
if (window.dalalaFiles) window.dalalaFiles.onSaved(p => { if (/\.(xlsx|docx|pdf|csv)$/i.test(p)) confirmBox(`${t('fileSavedQ')}<br><b class="ltr">${esc(p)}</b>`, () => window.dalalaFiles.openLast(), { danger: false, okLabel: t('openFile') }); });

/* ================= labels: scan to add, default copies ================= */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target || e.target.id !== 'lbl-scan') return; e.preventDefault();
  const v = e.target.value.trim(); if (!v) return; const p = DB.all('products').find(x => !x.deleted && (x.barcode === v || String(x.code).toLowerCase() === v.toLowerCase()));
  if (!p) { toast(t('notFound'), 'err'); e.target.value = ''; return; }
  LBL.sel[p.id] = (+LBL.sel[p.id] || 0) + Math.max(1, +LBL.copies || 1); setTimeout(() => { render(); $('#lbl-scan')?.focus(); }, 0); toast(`${loc(p)} ×${LBL.sel[p.id]}`);
});
if (typeof SCAN_FIELDS !== 'undefined') SCAN_FIELDS.push('lbl-scan');

const ACT_V24 = { 'import-open': el => importWizard(el.dataset.kind) };
