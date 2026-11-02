/* Dalala Commerce — local data store (localStorage) + Libyan demo seed */
'use strict';

const DB_KEY = 'dalala_commerce_db_v1';
const COLS = ['products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'receipts', 'disbursements',
  'expenses', 'cashMoves', 'adjustments', 'users', 'held', 'stockCounts', 'quickGroups', 'closings'];

const DB = {
  d: null, v: 0,
  load() {
    try { this.d = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { this.d = null; }
    this.fresh = false;
    if (!this.d || !this.d.version) { this.d = emptyData(); this.fresh = true; } // first run: setup screen decides (new business or demo)
    this.normalize();
    this.v++;
  },
  save() {
    this.v++;
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.d)); }
    catch (e) { console.error(e); if (typeof toast === 'function') toast(t('storageFull'), 'err'); }
  },
  all(c) { return this.d[c]; },
  get(c, id) { return id ? this.d[c].find(r => r.id === id) : undefined; },
  insert(c, r) { r.id = r.id || uid(); r.createdAt = Date.now(); this.d[c].push(r); this.save(); return r; },
  update(c, id, patch) { const r = this.get(c, id); if (r) { Object.assign(r, patch); this.save(); } return r; },
  remove(c, id) { this.d[c] = this.d[c].filter(r => r.id !== id); this.save(); },
  nextCode(c, field, prefix) {
    const n = Math.max(0, ...this.d[c].filter(r => String(r[field] || '').startsWith(prefix + '-')).map(r => parseInt(String(r[field]).slice(prefix.length + 1), 10) || 0));
    return `${prefix}-${String(n + 1).padStart(6, '0')}`;
  },
  normalize() { COLS.forEach(c => { this.d[c] = this.d[c] || []; }); this.d.settings = Object.assign(defaultSettings(), this.d.settings || {}); },
  reset() { this.d = seedData(); this.normalize(); this.fresh = false; this.save(); },
  startEmpty(extra = {}) { this.d = emptyData(); Object.assign(this.d.settings, extra, { isDemo: false, openingCash: 0, openingBank: 0 }); this.fresh = false; this.save(); },
  wipe() {
    const settings = this.d.settings; const admin = this.d.users.find(u => u.role === 'admin');
    this.d = { version: 1, settings };
    COLS.forEach(c => { this.d[c] = []; });
    this.d.users = [admin || { id: uid(), username: 'admin', password: 'admin123', name: 'مدير النظام', role: 'admin', active: true }];
    this.d.categories = [{ id: uid(), name: 'عام', nameEn: 'General' }];
    this.save();
  },
};

function emptyData() {
  const d = { version: 1, settings: defaultSettings() }; COLS.forEach(c => { d[c] = []; });
  d.categories = [{ id: uid(), name: 'عام', nameEn: 'General' }];
  return d;
}

function defaultSettings() {
  return {
    country: 'LY', businessName: 'مؤسسة دلالة التجارية', businessNameEn: 'Dalala Trading Est.',
    activity: 'تجارة المواد الغذائية والمنظفات والأدوات المنزلية', activityEn: 'Groceries, cleaning supplies & household goods',
    crNo: '', taxNo: '', chamberNo: '', licenseNo: '', municipality: 'طرابلس',
    address: 'طرابلس — شارع الجمهورية', addressEn: 'Tripoli — Al-Jumhuriya St.', phone: '+218 21 000 0000', email: 'sales@dalala.ly',
    currency: 'د.ل', currencyEn: 'LYD', waCountryCode: '218', decimals: 3, taxRate: 0, allowNegativeStock: false, receiptSize: '80mm',
    receiptFooter: 'شكراً لتسوقكم معنا — البضاعة المباعة تستبدل خلال 3 أيام بالفاتورة', receiptFooterEn: 'Thank you for shopping with us — items can be exchanged within 3 days with the receipt', printLang: 'ui', openingCash: 5000, openingBank: 20000, invoicePrefix: 'S',
  };
}

function seedData() {
  let seed = 7310; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const id = () => uid() + Math.floor(rnd() * 1e6).toString(36);
  const T = today(); const settings = defaultSettings();
  const r3 = n => Math.round(n * 1000) / 1000;
  const phone = () => '09' + pick(['1', '2', '4', '5']) + String(Math.floor(1000000 + rnd() * 8999999));

  const cats = [['مواد غذائية', 'Groceries'], ['مشروبات', 'Beverages'], ['منظفات', 'Cleaning'], ['أدوات منزلية', 'Household'], ['عناية شخصية', 'Personal care'], ['إلكترونيات صغيرة', 'Small electronics']]
    .map(([name, nameEn]) => ({ id: id(), name, nameEn }));
  const C = Object.fromEntries(['food', 'drink', 'clean', 'home', 'care', 'elec'].map((k, i) => [k, cats[i].id]));
  // [name, nameEn, cat, unit, cost, price, opening, min]
  const pdefs = [
    ['أرز بسمتي 5 كجم', 'Basmati rice 5kg', 'food', 'bag', 28, 35, 60, 10], ['سكر 1 كجم', 'Sugar 1kg', 'food', 'piece', 3.2, 4, 200, 40], ['دقيق 1 كجم', 'Flour 1kg', 'food', 'piece', 2.1, 2.75, 150, 30],
    ['زيت ذرة 1.5 لتر', 'Corn oil 1.5L', 'food', 'bottle', 9, 11.5, 90, 15], ['زيت زيتون 1 لتر', 'Olive oil 1L', 'food', 'bottle', 22, 28, 40, 8], ['معكرونة 500 غ', 'Pasta 500g', 'food', 'piece', 1.4, 2, 220, 40],
    ['كسكسي 1 كجم', 'Couscous 1kg', 'food', 'piece', 3.5, 4.5, 120, 20], ['طماطم معجون 400 غ', 'Tomato paste 400g', 'food', 'can', 2.2, 3, 160, 30], ['تونة 160 غ', 'Tuna 160g', 'food', 'can', 3.1, 4.25, 140, 25],
    ['شاي أحمر 250 غ', 'Black tea 250g', 'food', 'piece', 6.5, 8.5, 70, 12], ['قهوة 250 غ', 'Coffee 250g', 'food', 'piece', 11, 14, 50, 10], ['حليب بودرة 900 غ', 'Milk powder 900g', 'food', 'can', 24, 30, 45, 10],
    ['تمر 1 كجم', 'Dates 1kg', 'food', 'box', 10, 13, 60, 10], ['عسل طبيعي 500 غ', 'Natural honey 500g', 'food', 'jar', 35, 45, 25, 5],
    ['مياه معدنية 1.5 لتر (6)', 'Mineral water 1.5L (6)', 'drink', 'pack', 3, 4, 200, 40], ['عصير برتقال 1 لتر', 'Orange juice 1L', 'drink', 'piece', 3.3, 4.5, 120, 20], ['مشروب غازي 330 مل', 'Soft drink 330ml', 'drink', 'can', 0.9, 1.25, 400, 60],
    ['مشروب طاقة 250 مل', 'Energy drink 250ml', 'drink', 'can', 2.5, 3.5, 150, 24],
    ['مسحوق غسيل 3 كجم', 'Laundry powder 3kg', 'clean', 'bag', 17, 22, 50, 10], ['سائل جلي 1 لتر', 'Dish soap 1L', 'clean', 'bottle', 3.8, 5, 90, 15], ['كلور 2 لتر', 'Bleach 2L', 'clean', 'bottle', 2.9, 4, 80, 15],
    ['منظف أرضيات 2 لتر', 'Floor cleaner 2L', 'clean', 'bottle', 5.5, 7.5, 60, 10], ['مناديل ورقية (10)', 'Tissues (10)', 'clean', 'pack', 7, 9.5, 80, 15],
    ['طقم أواني 7 قطع', 'Cookware set 7pc', 'home', 'set', 85, 120, 12, 3], ['ترمس شاي 1 لتر', 'Tea flask 1L', 'home', 'piece', 18, 27, 25, 5], ['طقم كاسات (6)', 'Glass set (6)', 'home', 'set', 12, 18, 30, 6],
    ['مكنسة يدوية', 'Broom', 'home', 'piece', 6, 9, 35, 6],
    ['شامبو 400 مل', 'Shampoo 400ml', 'care', 'bottle', 7.5, 10, 70, 12], ['صابون (4)', 'Soap bars (4)', 'care', 'pack', 4, 5.5, 90, 15], ['معجون أسنان', 'Toothpaste', 'care', 'piece', 3.2, 4.5, 100, 20],
    ['حفاضات أطفال (40)', 'Baby diapers (40)', 'care', 'pack', 28, 36, 40, 8],
    ['شاحن هاتف سريع', 'Fast phone charger', 'elec', 'piece', 15, 25, 30, 5], ['سماعة بلوتوث', 'Bluetooth earbuds', 'elec', 'piece', 35, 55, 20, 4], ['مصباح LED 12 واط', 'LED bulb 12W', 'elec', 'piece', 3.5, 6, 100, 20],
    ['وصلة كهرباء 4 مخارج', 'Power strip 4-way', 'elec', 'piece', 12, 19, 30, 6], ['بطارية AA (4)', 'AA batteries (4)', 'elec', 'pack', 4.5, 7, 80, 15],
  ];
  const products = pdefs.map(([name, nameEn, cat, unit, cost, price, openingQty, minQty], i) => ({
    id: id(), code: `PRD-${String(i + 1).padStart(6, '0')}`, barcode: '62' + String(Math.floor(1e10 + rnd() * 9e10)), name, nameEn, categoryId: C[cat],
    unit, kind: 'stock', cost, price, wholesalePrice: r3(price * 0.92), openingQty, minQty, active: true }));
  products.push({ id: id(), code: 'PRD-000099', barcode: '', name: 'خدمة توصيل', nameEn: 'Delivery service', categoryId: C.home, unit: 'service', kind: 'service', cost: 0, price: 5, openingQty: 0, minQty: 0, active: true });

  const cities = ['طرابلس', 'طرابلس', 'جنزور', 'تاجوراء', 'سوق الجمعة', 'الزاوية', 'مصراتة'];
  const cust = [['مطعم الأصيل', 'Al-Aseel Restaurant'], ['مقهى النخلة', 'Al-Nakhla Cafe'], ['سوبرماركت الهدى', 'Al-Huda Supermarket'], ['محمد علي الزوي', 'Mohammed Ali Al-Zawi'], ['شركة البناء الحديث', 'Modern Construction Co.'],
    ['فندق الواحة', 'Al-Waha Hotel'], ['عبدالسلام المصراتي', 'Abdulsalam Al-Misrati'], ['مدرسة دلالة النموذجية', 'Dalala Model School'], ['صيدلية الشفاء', 'Al-Shifa Pharmacy'], ['سالم الورفلي', 'Salem Al-Warfalli']]
    .map(([name, nameEn], i) => ({ id: id(), code: `CUS-${String(i + 1).padStart(6, '0')}`, name, nameEn, phone: phone(), city: pick(cities), address: '', creditLimit: [3000, 5000, 10000][i % 3], openingBalance: i % 4 === 0 ? 450 : 0, active: true }));
  const sups = [['شركة الأمان للمواد الغذائية', 'Al-Aman Food Co.'], ['مؤسسة النور للتوزيع', 'Al-Nour Distribution'], ['شركة الخليج للمنظفات', 'Gulf Detergents Co.'], ['مصنع المدينة للمياه', 'Al-Madina Water Factory'], ['شركة التقنية للإلكترونيات', 'Tech Electronics Co.'], ['مستودع البيت الحديث', 'Modern Home Warehouse']]
    .map(([name, nameEn], i) => ({ id: id(), code: `SUP-${String(i + 1).padStart(6, '0')}`, name, nameEn, phone: phone(), city: pick(['طرابلس', 'مصراتة', 'بنغازي']), taxNo: '', openingBalance: i === 0 ? 2500 : 0, active: true }));
  const supFor = { [C.food]: sups[0], [C.drink]: sups[3], [C.clean]: sups[2], [C.home]: sups[5], [C.care]: sups[1], [C.elec]: sups[4] };

  const sales = [], purchases = [], receipts = [], disbursements = [], expenses = [], cashMoves = [], adjustments = [];
  const stock = Object.fromEntries(products.map(p => [p.id, p.openingQty]));
  let sn = 0, pn = 0, rn = 0, dn = 0, en = 0;
  const days = 60;
  for (let k = days; k >= 0; k--) {
    const date = addDays(T, -k); const dow = parseISO(date).getDay();
    // purchases every 7 days per supplier group to restock
    if (k % 7 === 3) {
      Object.entries(supFor).forEach(([cid, sup]) => {
        const items = products.filter(p => p.categoryId === cid && isStock(p) && stock[p.id] < p.openingQty * 0.7).map(p => ({ productId: p.id, qty: Math.round(p.openingQty * 0.6), price: p.cost, discount: 0,
          ...([C.food, C.drink, C.care].includes(cid) ? { expiry: addDays(date, cid === C.drink ? 40 : cid === C.care ? 400 : 240) } : {}) }));
        if (!items.length) return;
        items.forEach(it => { stock[it.productId] += it.qty; });
        const total = sum(items, it => it.qty * it.price); const paid = rnd() < 0.6 ? total : r3(total * 0.5);
        purchases.push({ id: id(), number: `P-${String(++pn).padStart(6, '0')}`, type: 'purchase', supplierRef: 'INV-' + Math.floor(1000 + rnd() * 8999), date, supplierId: sup.id, items, discount: 0, taxRate: 0, paid: r3(paid), method: pick(['cash', 'transfer', 'transfer']), notes: '' });
      });
    }
    const n = dow === 5 ? 10 : 18 + Math.floor(rnd() * 12);
    for (let j = 0; j < n; j++) {
      const credit = rnd() < 0.18; const customer = credit || rnd() < 0.15 ? pick(cust) : null;
      const items = []; const used = new Set();
      for (let q = 0; q < 1 + Math.floor(rnd() * 4); q++) {
        const p = pick(products); if (used.has(p.id)) continue; used.add(p.id);
        const qty = customer && rnd() < 0.5 ? 2 + Math.floor(rnd() * 10) : 1 + Math.floor(rnd() * 3);
        if (isStock(p) && stock[p.id] < qty) continue;
        if (isStock(p)) stock[p.id] -= qty;
        items.push({ productId: p.id, qty, price: p.price, discount: 0, cost: p.cost });
      }
      if (!items.length) continue;
      const total = r3(sum(items, it => it.qty * it.price)); const discount = total > 150 && rnd() < 0.3 ? Math.round(total * 0.05) : 0;
      const method = credit ? 'credit' : pick(['cash', 'cash', 'cash', 'card', 'transfer']);
      const paid = credit ? (rnd() < 0.3 ? r3((total - discount) * 0.5) : 0) : r3(total - discount);
      sales.push({ id: id(), number: `S-${String(++sn).padStart(6, '0')}`, type: 'sale', date, customerId: customer ? customer.id : '', items, discount, taxRate: 0, paid, method: credit ? (paid ? 'cash' : 'credit') : method, notes: '' });
    }
    if (k % 6 === 0) { const c = pick(cust); receipts.push({ id: id(), number: `RV-${String(++rn).padStart(6, '0')}`, date, customerId: c.id, amount: 100 * (2 + Math.floor(rnd() * 6)), method: pick(['cash', 'transfer']), notes: '' }); }
    if (k % 10 === 5) { const s = pick(sups); disbursements.push({ id: id(), number: `PV-${String(++dn).padStart(6, '0')}`, date, supplierId: s.id, amount: 500 * (1 + Math.floor(rnd() * 4)), method: 'transfer', notes: '' }); }
    if (addDays(date, 1).endsWith('-01')) {
      [['rent', 2500, 'transfer'], ['salaries', 4500, 'transfer'], ['electricity', 420, 'cash'], ['internet', 150, 'cash']]
        .forEach(([category, amount, method]) => expenses.push({ id: id(), number: `EX-${String(++en).padStart(6, '0')}`, date, category, amount, method, description: '' }));
    }
    if (k % 7 === 0 && k) cashMoves.push({ id: id(), number: `CM-${String(cashMoves.length + 1).padStart(6, '0')}`, date, type: 'out', account: 'cash', amount: 4000, notes: 'إيداع في المصرف' },
      { id: id(), number: `CM-${String(cashMoves.length + 2).padStart(6, '0')}`, date, type: 'in', account: 'bank', amount: 4000, notes: 'إيداع من الخزينة' });
    if (k % 9 === 4) expenses.push({ id: id(), number: `EX-${String(++en).padStart(6, '0')}`, date, category: pick(['transport', 'maintenance', 'other']), amount: 50 + Math.floor(rnd() * 200), method: 'cash', description: '' });
  }
  // a couple of sales returns
  sales.slice(-40, -38).forEach(s => {
    const it = s.items[0]; stock[it.productId] += 1;
    sales.push({ id: id(), number: `SR-${String(sales.filter(x => x.type === 'return').length + 1).padStart(6, '0')}`, type: 'return', refId: s.id, date: s.date, customerId: s.customerId, items: [{ ...it, qty: 1 }], discount: 0, taxRate: 0, paid: s.customerId ? 0 : it.price, method: 'cash', notes: '' });
  });
  const dmg = products[20]; adjustments.push({ id: id(), number: 'ADJ-000001', date: addDays(T, -12), productId: dmg.id, qty: -3, reason: 'damage', notes: 'عبوات تالفة' });
  adjustments.push({ id: id(), number: 'ADJ-000002', date: addDays(T, -2), productId: products[16].id, qty: 6, reason: 'count', notes: 'جرد دوري' });

  const users = [
    { id: id(), username: 'admin', password: 'admin123', name: 'مدير النظام', nameEn: 'System Admin', role: 'admin', active: true },
    { id: id(), username: 'cashier', password: 'cashier123', name: 'أحمد الكاشير', nameEn: 'Ahmed (Cashier)', role: 'cashier', active: true },
    { id: id(), username: 'accountant', password: 'acc123', name: 'سعاد المحاسبة', nameEn: 'Suad (Accountant)', role: 'accountant', active: true },
    { id: id(), username: 'store', password: 'store123', name: 'خالد أمين المخزن', nameEn: 'Khalid (Storekeeper)', role: 'storekeeper', active: true },
  ];
  settings.isDemo = true;
  return { version: 1, settings, categories: cats, products, customers: cust, suppliers: sups, sales, purchases, receipts, disbursements, expenses, cashMoves, adjustments, users };
}
