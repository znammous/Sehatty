// «اكتبي الاسم العلمي والعيار»: يملأ نموذج إضافة الصنف من سطر واحد.
// 1) قاموس محلي يعمل دون إنترنت: أسماء المواد بالعربية والإنجليزية، ومعاملات تحويل الأملاح إلى العنصر الفعلي
//    (كبريتات الحديدوز 200 ملغ = 65 ملغ حديد)، لأن حساب الحدود يحتاج العنصر لا وزن الملح.
// 2) قاعدة RxNorm المفتوحة من المكتبة الطبية الأمريكية لما ليس في القاموس. يُرسل إليها نص البحث وحده.
const MedLookup = (() => {
  const g = id => document.getElementById(id);
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FORM_KEYS = ['iron', 'folic', 'calcium', 'vitD', 'zinc', 'magnesium', 'iodine', 'vitA', 'omega3'];
  const UNIT = { iron: 'ملغ', folic: 'ملغ', calcium: 'ملغ', vitD: 'وحدة', magnesium: 'ملغ', zinc: 'ملغ', iodine: 'مكغ', vitA: 'مكغ', vitC: 'ملغ', vitE: 'ملغ',
    b6: 'ملغ', b3: 'ملغ', copper: 'ملغ', omega3: 'ملغ', metformin: 'ملغ', b12: 'مكغ', b1: 'ملغ', b2: 'ملغ', biotin: 'ملغ' };
  const LBL = { iron: 'حديد', folic: 'فوليك', calcium: 'كالسيوم', vitD: 'فيتامين D', magnesium: 'مغنيسيوم', zinc: 'زنك', iodine: 'يود', vitA: 'فيتامين A',
    vitC: 'فيتامين C', vitE: 'فيتامين E', b6: 'B6', b3: 'B3', copper: 'نحاس', omega3: 'أوميغا 3', metformin: 'ميتفورمين', b12: 'B12', b1: 'B1', b2: 'B2', biotin: 'بيوتين' };

  // [مفتاح المادة أو null للدواء، معامل العنصر (رقم أو دالة في الملغ)، الاسم العربي، الاسم الإنجليزي، أسماء أخرى…]
  const RAW = [
    ['iron', m => (m <= 250 ? 0.325 : 0.2), 'كبريتات الحديدوز', 'ferrous sulfate', 'ferrous sulphate', 'كبريتات الحديد', 'سلفات الحديد'],
    ['iron', 0.33, 'فومارات الحديدوز', 'ferrous fumarate', 'فومارات الحديد'],
    ['iron', 0.12, 'غلوكونات الحديدوز', 'ferrous gluconate', 'جلوكونات الحديد', 'غلوكونات الحديد'],
    ['iron', m => (m > 150 ? 0.176 : 1), 'كبريتات غليسين الحديدوز', 'ferrous glycine sulfate', 'ferrous glycine sulphate'],
    ['iron', m => (m >= 100 ? 0.2 : 1), 'بيسغليسينات الحديد', 'ferrous bisglycinate', 'iron bisglycinate', 'ferrous bisglycinate chelate', 'بيسجليسينات الحديد'],
    ['iron', 1, 'حديد بوليمالتوز', 'iron polymaltose', 'ferric hydroxide polymaltose', 'iron polymaltose complex', 'بوليمالتوز'],
    ['iron', 1, 'حديد', 'iron', 'elemental iron', 'حديد عنصري'],
    ['folic', 1, 'حمض الفوليك', 'folic acid', 'folate', 'methylfolate', 'l-methylfolate', 'folic', 'فوليك', 'فولات', 'فوليك اسيد'],
    ['calcium', 0.4, 'كربونات الكالسيوم', 'calcium carbonate'],
    ['calcium', 0.21, 'سترات الكالسيوم', 'calcium citrate'],
    ['calcium', 1, 'كالسيوم', 'calcium', 'elemental calcium'],
    ['vitD', 1, 'فيتامين D3', 'cholecalciferol', 'vitamin d3', 'vitamin d', 'vit d', 'vit d3', 'd3', 'فيتامين د', 'فيتامين دال', 'فيتامين d', 'فيتامين d3', 'كوليكالسيفيرول'],
    ['zinc', 0.227, 'كبريتات الزنك', 'zinc sulfate', 'zinc sulphate'],
    ['zinc', 0.143, 'غلوكونات الزنك', 'zinc gluconate'],
    ['zinc', 1, 'زنك', 'zinc'],
    ['magnesium', 0.6, 'أكسيد المغنيسيوم', 'magnesium oxide', 'اكسيد المغنيسيوم'],
    ['magnesium', 0.16, 'سترات المغنيسيوم', 'magnesium citrate'],
    ['magnesium', 1, 'مغنيسيوم', 'magnesium', 'ماغنيسيوم', 'مغنيزيوم'],
    ['iodine', 0.76, 'يوديد البوتاسيوم', 'potassium iodide'],
    ['iodine', 1, 'يود', 'iodine'],
    ['omega3', 0.3, 'زيت السمك', 'fish oil'],
    ['omega3', 1, 'EPA', 'epa'],
    ['omega3', 1, 'DHA', 'dha'],
    ['omega3', 1, 'أوميغا 3', 'omega 3', 'omega-3', 'omega3', 'epa+dha', 'epa dha', 'اوميغا 3', 'اوميجا 3', 'اوميغا', 'اوميجا'],
    ['metformin', 1, 'ميتفورمين', 'metformin', 'metformin hydrochloride', 'ميتفورمين هيدروكلوريد'],
    ['vitC', 1, 'فيتامين C', 'ascorbic acid', 'vitamin c', 'فيتامين c', 'فيتامين سي', 'حمض الاسكوربيك'],
    ['vitE', 1, 'فيتامين E', 'vitamin e', 'tocopherol', 'alpha tocopherol', 'فيتامين e', 'فيتامين اي'],
    ['b6', 1, 'فيتامين B6', 'pyridoxine', 'pyridoxine hydrochloride', 'vitamin b6', 'b6', 'فيتامين b6', 'بيريدوكسين'],
    ['b12', 1, 'فيتامين B12', 'cyanocobalamin', 'methylcobalamin', 'vitamin b12', 'b12', 'فيتامين b12', 'سيانوكوبالامين'],
    ['b1', 1, 'فيتامين B1', 'thiamine', 'vitamin b1', 'b1', 'ثيامين'],
    ['b2', 1, 'فيتامين B2', 'riboflavin', 'vitamin b2', 'b2', 'ريبوفلافين'],
    ['b3', 1, 'فيتامين B3', 'niacin', 'nicotinamide', 'niacinamide', 'vitamin b3', 'b3', 'نياسين'],
    ['vitA', 1, 'فيتامين A', 'retinol', 'vitamin a', 'فيتامين a', 'ريتينول'],
    ['biotin', 1, 'بيوتين', 'biotin'],
    ['copper', 1, 'نحاس', 'copper'],
    // أدوية شائعة في الحمل لا تدخل في حساب الفيتامينات، تُضاف للجدول والتذكير فقط
    [null, 1, 'أسبرين', 'aspirin', 'acetylsalicylic acid', 'اسبرين', 'اسبرو'],
    [null, 1, 'بروجسترون', 'progesterone', 'بروجيسترون'],
    [null, 1, 'ديدروجستيرون', 'dydrogesterone', 'دوفاستون', 'duphaston'],
    [null, 1, 'ليفوثيروكسين', 'levothyroxine', 'levothyroxine sodium', 'التروكسين', 'eltroxin', 'ثيروكسين'],
    [null, 1, 'ميثيل دوبا', 'methyldopa', 'ميثيلدوبا', 'الدوميت', 'aldomet'],
    [null, 1, 'لابيتالول', 'labetalol'],
    [null, 1, 'نيفيديبين', 'nifedipine'],
    [null, 1, 'إينوكسابارين', 'enoxaparin', 'clexane', 'كليكسان', 'انوكسابارين'],
    [null, 1, 'باراسيتامول', 'paracetamol', 'acetaminophen', 'بنادول', 'panadol'],
    [null, 1, 'دوكسيلامين مع بيريدوكسين', 'doxylamine', 'دوكسيلامين', 'diclegis'],
    [null, 1, 'ميتوكلوبراميد', 'metoclopramide', 'بريمبران', 'plasil'],
    [null, 1, 'أوندانسيترون', 'ondansetron', 'زوفران', 'zofran'],
    [null, 1, 'إنسولين', 'insulin', 'انسولين'],
  ];

  const norm = s => String(s || '').toLowerCase()
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٫,](?=\d)/g, '.').replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/µ/g, 'mc')
    .replace(/\s+/g, ' ').trim();
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ALIASES = [];
  RAW.forEach(([k, f, ar, en, ...more]) => {
    const item = { k, f, ar, en };
    [ar, en, ...more].forEach(a => ALIASES.push({ a: norm(a), item }));
  });
  ALIASES.sort((x, y) => y.a.length - x.a.length);
  const L = 'a-z\\u0621-\\u064a';
  const RE_ALIAS = new RegExp(`(^|[^${L}0-9])(وال|و|ال)?(${ALIASES.map(x => reEsc(x.a)).join('|')})(?![${L}])`, 'g');
  const BY_ALIAS = new Map(ALIASES.map(x => [x.a, x.item]));
  const RE_NUM = /(\d+(?:\.\d+)?)\s*(mcg|mg|ug|g|iu|unt|units?|ملغ|مغ|ملجم|مجم|مكغ|ميكروغرام|ميكروجرام|مكجم|غرام|جرام|جم|غ|وحدات|وحده)?(?![a-zء-ي])/;
  const unitOf = u => {
    if (!u) return '';
    if (/^(mcg|ug|مكغ|ميكروغرام|ميكروجرام|مكجم)$/.test(u)) return 'mcg';
    if (/^(mg|ملغ|مغ|ملجم|مجم)$/.test(u)) return 'mg';
    if (/^(g|غرام|جرام|جم|غ)$/.test(u)) return 'g';
    return 'iu';
  };
  const round = n => Math.round(n * 100) / 100, roundSalt = n => (n >= 10 ? Math.round(n) : round(n));

  // يحوّل الكمية المكتوبة إلى وحدة الحساب في التطبيق، ويطبّق معامل العنصر للأملاح
  function convert(item, val, u) {
    const k = item.k;
    if (!u) u = k === 'folic' ? (val >= 20 ? 'mcg' : 'mg') : k === 'vitD' ? 'iu' : ['iodine', 'b12', 'vitA'].includes(k) ? 'mcg' : k === 'biotin' ? (val >= 10 ? 'mcg' : 'mg') : 'mg';
    let out;
    if (k === 'vitD') out = u === 'iu' ? val : u === 'mcg' ? val * 40 : u === 'mg' ? val * 40000 : null;
    else if (u === 'iu') out = k === 'vitA' ? val * 0.3 : k === 'vitE' ? val * 0.67 : null;
    else {
      const mg = u === 'mcg' ? val / 1000 : u === 'g' ? val * 1000 : val;
      const f = typeof item.f === 'function' ? item.f(mg) : item.f;
      out = (UNIT[k] === 'مكغ' ? mg * 1000 : mg) * f;
      if (f !== 1) return { v: roundSalt(out), salt: true, u };
    }
    return out == null ? null : { v: round(out), salt: false, u };
  }
  const UNIT_AR = { mg: 'ملغ', mcg: 'مكغ', g: 'غ', iu: 'وحدة' };

  // يقرأ نصًا فيه مادة أو أكثر مع عيارها: «Ferrous fumarate 305 mg / folate 0.4 mg» أو «حديد 65 وفوليك 0.4»
  function parse(text) {
    const s = norm(text), hits = [];
    let m; RE_ALIAS.lastIndex = 0;
    while ((m = RE_ALIAS.exec(s))) {
      const start = m.index + m[1].length + (m[2] || '').length;
      hits.push({ item: BY_ALIAS.get(m[3]), start, end: start + m[3].length });
      RE_ALIAS.lastIndex = start + m[3].length;
    }
    if (!hits.length) return null;
    const parts = [], c = {}, notes = new Set();
    let rx = false, missing = false, noUnit = false;
    hits.forEach((x, i) => {
      const seg = s.slice(x.end, i + 1 < hits.length ? hits[i + 1].start : s.length);
      const prev = s.slice(i ? hits[i - 1].end : 0, x.start);
      const n = RE_NUM.exec(seg) || (i === 0 ? RE_NUM.exec(prev) : null);
      const val = n ? parseFloat(n[1]) : null, u = n ? unitOf(n[2]) : '';
      // للأدوية لا نفترض وحدة أبدًا: 50 قد تكون مكغ (ليفوثيروكسين) لا ملغ
      if (!x.item.k) { rx = true; if (val != null && !u) noUnit = true; parts.push({ label: x.item.ar, en: x.item.en, val, u: UNIT_AR[u] || '' }); if (val == null) missing = true; return; }
      if (val == null) { missing = true; parts.push({ label: x.item.ar, en: x.item.en, val: null }); return; }
      const r = convert(x.item, val, u);
      if (!r) { notes.add('لم تُفهم وحدة ' + x.item.ar + '، فأدخليها يدويًا.'); return; }
      c[x.item.k] = round((c[x.item.k] || 0) + r.v);
      if (r.salt) notes.add(`${x.item.ar} ${val} ${UNIT_AR[r.u]} تعطي تقريبًا ${r.v} ${UNIT[x.item.k]} ${LBL[x.item.k]}. إن كانت العلبة تذكر كمية ${LBL[x.item.k]} نفسه فاعتمدي رقمها.`);
      if (x.item.k === 'omega3' && x.item.en === 'fish oil') notes.add('زيت السمك 1000 ملغ فيه عادة نحو 300 ملغ EPA+DHA، والرقم الأدق على العلبة.');
      parts.push({ label: x.item.ar, en: x.item.en, val, u: UNIT_AR[r.u] });
    });
    return { parts, c, rx: rx && !Object.keys(c).length, missing, noUnit, notes: [...notes] };
  }

  const FORM_AR = [[/\b(oral )?tablet|\bpill\b/i, 'حبة'], [/\bcapsule/i, 'كبسولة'], [/\binjection|\bprefilled syringe|\bauto-injector/i, 'حقنة'],
    [/\boral (solution|suspension)|\bsyrup/i, 'ملعقة'], [/\bvaginal/i, 'تحميلة'], [/\bsachet|\bgranules|\bpowder/i, 'كيس']];
  function catOf(c, rx) {
    const ks = Object.keys(c);
    if (rx) return 'rx';
    if (c.metformin) return 'metformin';
    if (ks.length >= 4) return 'multi';
    if (c.iron) return ks.length >= 3 ? 'multi' : 'ironRx';
    if (c.calcium) return 'bone';
    if (c.omega3) return 'omega';
    if (ks.length === 1 && c.folic) return 'folic';
    return 'other';
  }
  // يبني اقتراحًا جاهزًا للنموذج من نتيجة القراءة
  function build(p, label, form, src) {
    const name = label || p.parts.map(x => x.label + (x.val != null ? ' ' + x.val + ' ' + (x.u || '') : '')).join(' + ').trim();
    const chips = Object.entries(p.c).map(([k, v]) => `${LBL[k]} ${v} ${UNIT[k]}`);
    return {
      name, src, form: form || 'حبة', c: p.c, rx: p.rx, missing: p.missing, noUnit: !!p.noUnit, notes: p.notes, chips,
      cat: catOf(p.c, p.rx),
      sub: p.rx ? (label ? '' : p.parts.map(x => x.en).join(' + ') + ' · ') + 'دواء بوصفة، لا يدخل في حساب الفيتامينات' : (p.notes.length ? 'يعادل: ' + chips.join(' + ') : 'أُضيف بالاسم العلمي والعيار'),
      why: p.rx ? 'دواء أضفتِه بالاسم العلمي. جرعته وتوقيته بقرار الطبيب.' : 'صنف أضفتِه بالاسم العلمي والعيار. الأرقام لكل حبة.',
    };
  }

  // ───── RxNorm ─────
  const API = 'https://rxnav.nlm.nih.gov/REST/';
  const cache = new Map();
  const getJSON = (url, signal) => fetch(url, { signal }).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const tidy = n => n.replace(/\s*\[[^\]]*\]/g, '').replace(/\b(\d+(?:\.\d+)?) (MG|MCG|UNT|ML)\b/g, (_, a, b) => a + ' ' + ({ MG: 'mg', MCG: 'mcg', UNT: 'IU', ML: 'ml' }[b])).trim();
  async function remote(term, signal) {
    const key = norm(term);
    if (cache.has(key)) return cache.get(key);
    const d = await getJSON(API + 'approximateTerm.json?maxEntries=25&term=' + encodeURIComponent(term), signal);
    const cand = (d.approximateGroup && d.approximateGroup.candidate) || [];
    let names = cand.filter(x => x.source === 'RXNORM' && x.name).map(x => x.name);
    if (!names.length) {
      const ids = [...new Set(cand.map(x => x.rxcui))].slice(0, 4);
      const props = await Promise.all(ids.map(id => getJSON(API + 'rxcui/' + id + '/properties.json', signal).catch(() => null)));
      names = props.map(p => p && p.properties && (p.properties.synonym || p.properties.name)).filter(Boolean);
    }
    const seen = new Set(), out = [];
    for (const raw of names) {
      const t = tidy(raw), k = t.toLowerCase();
      if (seen.has(k)) continue; seen.add(k); out.push(t);
    }
    const withNum = out.filter(n => /\d/.test(n));
    const res = (withNum.length ? withNum : out).slice(0, 5);
    cache.set(key, res);
    return res;
  }
  function fromRemoteName(n) {
    const form = (FORM_AR.find(([re]) => re.test(n)) || [])[1];
    const clean = n.replace(/\b(Oral|Tablet|Capsule|Pill|Product|Delayed Release|Extended Release|Chewable|Injection|Solution|Suspension|Prefilled Syringe|Vaginal|Insert|Gel|Mucosal Spray|Spray|Oral Powder|Powder|Film|Disintegrating|Sublingual|Soft|Hard)\b/gi, '').replace(/\s+/g, ' ').trim();
    const p = parse(clean);
    if (p && !p.missing) return build(p, clean, form, 'rx');
    const num = RE_NUM.exec(norm(clean));
    if (!num) return null;
    return build({ parts: [], c: {}, rx: true, missing: false, notes: [] }, clean, form, 'rx');
  }

  // ───── الواجهة ─────
  let list = [], picked = null, timer = 0, ctl = null;
  const q = () => g('f_q'), box = () => g('f_sug'), note = () => g('f_qnote');
  function show(msg) {
    const web = list.filter(x => x.src === 'rx');
    const item = (x, i) => `<button type="button" class="msug-i${x.missing ? ' miss' : ''}" data-msug="${i}">
      <b>${h(x.name)}</b>
      <span>${x.missing ? 'أضيفي العيار بعد الاسم، مثل: ' + h(x.name) + ' 5' : x.noUnit ? 'دواء بوصفة · أضيفي الوحدة (ملغ أو مكغ) كما على العلبة' : x.rx ? 'دواء بوصفة · للجدول والتذكير فقط' : x.chips.map(h).join(' · ')}${x.src === 'rx' ? ' · ' + h(x.form) : ''}</span></button>`;
    let html = list.map(item).join('');
    if (msg) html += `<p class="hint">${h(msg)}</p>`;
    if (web.length) html += '<p class="hint msrc">اقتراحات من قاعدة RxNorm المفتوحة للأدوية.</p>';
    box().innerHTML = html;
    box().hidden = !html;
  }
  function lookup() {
    const text = q().value.trim();
    picked = null; note().textContent = '';
    if (ctl) { ctl.abort(); ctl = null; }
    if (text.length < 2) { list = []; show(); return; }
    const p = parse(text);
    list = p ? [build(p, null, null, 'local')] : [];
    const latin = /[a-z]{3,}/i.test(text);
    // البحث البعيد للأسماء غير المعروفة محليًا، أو حين يكون في النص عيار يمكن مطابقته
    const term = latin && (!p || /\d/.test(text)) ? text : '';
    if (!term) { show(p ? '' : 'لم نعرف هذا الاسم. اكتبيه بالإنجليزية كما على العلبة، أو املئي الأرقام يدويًا.'); return; }
    show('جارٍ البحث في قاعدة الأدوية…');
    const my = ctl = new AbortController();
    const t = setTimeout(() => my.abort(), 7000);
    remote(term, my.signal).then(names => {
      if (my !== ctl) return;
      const key = x => norm(x.name) + '|' + x.form, have = new Set(list.map(key));
      names.map(fromRemoteName).filter(Boolean).forEach(x => { if (!have.has(key(x))) { have.add(key(x)); list.push(x); } });
      // اقتراح محلي ينقصه وحدة الدواء يتأخر خلف اقتراحات القاعدة التي فيها الوحدة
      if (list.length > 1 && list[0].noUnit) list.push(list.shift());
      show(list.length ? '' : 'لم نجد هذا الاسم. تأكدي من كتابته، أو املئي الأرقام يدويًا.');
    }).catch(() => {
      if (my !== ctl) return;
      show(navigator.onLine === false ? 'لا يوجد اتصال: تعمل الأسماء الشائعة فقط دون إنترنت.' : 'تعذّر الاتصال بقاعدة الأدوية الآن. الأسماء الشائعة تعمل دون إنترنت.');
    }).finally(() => clearTimeout(t));
  }
  function apply(x) {
    if (x.missing) { q().focus(); q().value = q().value.trim() + ' '; return; }
    picked = x;
    g('f_name').value = x.name;
    const sel = g('f_cat');
    if ([...sel.options].some(o => o.value === x.cat)) sel.value = x.cat;
    FORM_KEYS.forEach(k => { g('f_' + k).value = x.c[k] != null ? x.c[k] : ''; });
    const extra = Object.keys(x.c).filter(k => !FORM_KEYS.includes(k)).map(k => `${LBL[k]} ${x.c[k]} ${UNIT[k]}`);
    const lines = [...x.notes];
    if (extra.length) lines.push('يُضاف أيضًا: ' + extra.join('، ') + '.');
    if (x.noUnit) lines.push('لم تُكتب وحدة العيار: أضيفيها إلى الاسم (ملغ أو مكغ) كما على العلبة.');
    lines.push(x.rx ? 'لن يدخل في حساب الفيتامينات، لكنه يظهر في الجدول والتذكير. حدّدي عدد الحبات ثم اضغطي «إضافة».' : 'راجعي الأرقام مع العلبة، ثم حدّدي عدد الحبات واضغطي «إضافة».');
    note().innerHTML = lines.map(l => `<span>${h(l)}</span>`).join('');
    list = []; show();
    g('f_units').focus();
  }
  function init() {
    if (!q()) return;
    q().addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(lookup, 350); });
    q().addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); clearTimeout(timer);
      const first = list.find(x => !x.missing && !x.noUnit) || list.find(x => !x.missing);
      if (first) apply(first); else lookup();
    });
    box().addEventListener('click', e => { const b = e.target.closest('[data-msug]'); if (b && list[+b.dataset.msug]) apply(list[+b.dataset.msug]); });
    g('addForm').addEventListener('reset', () => { picked = null; list = []; show(); note().textContent = ''; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { pending: () => picked, parse, _build: build, _remote: remote, _fromRemoteName: fromRemoteName };
})();
