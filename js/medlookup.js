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
      generic: label ? label.split(/\d/)[0].split('/')[0].trim() : ((p.parts.find(x => x.en) || {}).en || ''),
      name, src, form: form || 'حبة', c: p.c, rx: p.rx, missing: p.missing, noUnit: !!p.noUnit, notes: p.notes, chips,
      cat: catOf(p.c, p.rx),
      sub: p.rx ? (label ? '' : p.parts.map(x => x.en).join(' + ') + ' · ') + 'دواء بوصفة، لا يدخل في حساب الفيتامينات' : (p.notes.length ? 'يعادل: ' + chips.join(' + ') : 'أُضيف بالاسم العلمي والعيار'),
      why: p.rx ? 'دواء أضفتِه بالاسم العلمي. جرعته وتوقيته بقرار الطبيب.' : 'صنف أضفتِه بالاسم العلمي والعيار. الأرقام لكل حبة.',
    };
  }

  const getJSON = (url, signal) => fetch(url, { signal }).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  // ───── أدوية خطرة على الحمل ─────
  // bad: معروف أنه يسبب تشوهات أو إجهاضًا، أو ممنوع في الحمل. warn: يُحذر منه في مرحلة معينة أو بشروط.
  // قائمة منتقاة من المراجع المعروفة (نشرات FDA وتصنيفات الأدوية المسببة للتشوهات)، ولا تغني عن الطبيب والصيدلي.
  const RISK_RAW = [
    ['bad', 'يسبب تشوهات شديدة في الجنين، وهو ممنوع تمامًا في الحمل.', 'isotretinoin', 'roaccutane', 'accutane', 'ايزوتريتينوين', 'روكتان', 'رواكيوتان', 'روأكيوتان', 'acitretin', 'neotigason', 'اسيتريتين', 'نيوتيجازون'],
    ['bad', 'يسبب تشوهات في الجنين ونزيفًا، ويُستبدل عادة بحقن الهيبارين في الحمل.', 'warfarin', 'coumadin', 'marevan', 'وارفارين', 'كومادين', 'ماريفان'],
    ['bad', 'يرفع خطر تشوهات العمود الفقري والقلب ويؤثر في نمو دماغ الجنين.', 'valproate', 'valproic acid', 'sodium valproate', 'divalproex', 'depakine', 'depakote', 'فالبروات', 'ديباكين', 'حمض الفالبرويك'],
    ['bad', 'يرفع خطر تشوهات الجنين، ويحتاج متابعة الطبيب وجرعة عالية من الفوليك.', 'carbamazepine', 'tegretol', 'كاربامازيبين', 'تجريتول', 'phenytoin', 'epanutin', 'dilantin', 'فينيتوين', 'ابانوتين', 'topiramate', 'topamax', 'توبيرامات', 'توباماكس'],
    ['bad', 'يسبب الإجهاض وتشوهات الجنين، وهو ممنوع في الحمل.', 'methotrexate', 'ميثوتريكسات', 'misoprostol', 'cytotec', 'ميزوبروستول', 'سايتوتك', 'سيتوتك', 'mifepristone', 'ميفيبريستون', 'thalidomide', 'ثاليدومايد', 'lenalidomide', 'leflunomide', 'arava', 'ليفلونومايد', 'mycophenolate', 'cellcept', 'مايكوفينولات', 'ribavirin', 'ريبافيرين'],
    ['bad', 'يضر كلى الجنين ونموه، خاصة بعد الشهر الثالث. يُستبدل بدواء ضغط آمن في الحمل.', 'lisinopril', 'enalapril', 'captopril', 'ramipril', 'perindopril', 'fosinopril', 'quinapril', 'benazepril', 'ليسينوبريل', 'اينالابريل', 'كابتوبريل', 'راميبريل', 'بيريندوبريل', 'losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan', 'olmesartan', 'azilsartan', 'لوسارتان', 'فالسارتان', 'ايربيسارتان', 'كانديسارتان', 'تلميسارتان', 'اولميسارتان', 'cozaar', 'diovan', 'كوزار', 'ديوفان', 'entresto', 'انتريستو', 'aliskiren'],
    ['bad', 'هرمون يؤثر في تكوّن الجنين، وهو ممنوع في الحمل.', 'finasteride', 'dutasteride', 'فيناسترايد', 'دوتاسترايد', 'danazol', 'دانازول', 'testosterone', 'تستوستيرون', 'letrozole', 'femara', 'ليتروزول', 'فيمارا', 'tamoxifen', 'تاموكسيفين', 'raloxifene', 'رالوكسيفين', 'diethylstilbestrol'],
    ['bad', 'يسبب تشوهات في الجنين، وهو ممنوع في الحمل.', 'bosentan', 'ambrisentan', 'macitentan', 'riociguat', 'بوسنتان'],
    ['bad', 'يسبب انقباض الرحم وقد يؤدي إلى الإجهاض.', 'ergotamine', 'cafergot', 'ارجوتامين', 'كافرجوت'],
    ['warn', 'قد يرتبط بتشوه في قلب الجنين، ويحتاج متابعة دقيقة من الطبيب.', 'lithium', 'ليثيوم'],
    ['warn', 'يصبغ أسنان الجنين ويؤثر في عظامه بعد الأسبوع 15، فيُستبدل عادة بمضاد آخر.', 'doxycycline', 'tetracycline', 'minocycline', 'دوكسيسيكلين', 'تتراسيكلين', 'مينوسيكلين', 'vibramycin', 'فيبراميسين'],
    ['warn', 'مسكنات الالتهاب تُتجنب بعد الأسبوع 20 لأنها تضر كلى الجنين وقلبه. الباراسيتامول هو البديل المعتاد.', 'ibuprofen', 'brufen', 'advil', 'ايبوبروفين', 'بروفين', 'diclofenac', 'voltaren', 'cataflam', 'ديكلوفيناك', 'فولتارين', 'كاتافلام', 'naproxen', 'نابروكسين', 'mefenamic acid', 'ponstan', 'بونستان', 'ketorolac', 'كيتورولاك', 'celecoxib', 'celebrex', 'سيليكوكسيب', 'meloxicam', 'ميلوكسيكام', 'indomethacin', 'اندوميثاسين'],
    ['warn', 'يُتجنب عادة في الشهور الثلاثة الأولى، ويختار الطبيب بديلًا أنسب لتلك المرحلة.', 'methimazole', 'carbimazole', 'ميثيمازول', 'كاربيمازول', 'neo-mercazole', 'نيوميركازول', 'trimethoprim', 'co-trimoxazole', 'sulfamethoxazole', 'septrin', 'bactrim', 'سبترين', 'باكتريم'],
    ['warn', 'الجرعات العالية والطويلة منه قد تضر الجنين.', 'fluconazole', 'diflucan', 'فلوكونازول', 'ديفلوكان'],
    ['warn', 'يوقفه الطبيب عادة أثناء الحمل.', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'اتورفاستاتين', 'روزوفاستاتين', 'سيمفاستاتين', 'lipitor', 'crestor', 'ليبيتور', 'كريستور', 'amiodarone', 'اميودارون', 'spironolactone', 'aldactone', 'سبيرونولاكتون', 'الداكتون'],
  ];
  const RISK_ALIAS = [];
  RISK_RAW.forEach(([lv, why, ...names]) => names.forEach(n => RISK_ALIAS.push({ a: norm(n), lv, why })));
  RISK_ALIAS.sort((x, y) => y.a.length - x.a.length);
  const RE_RISK = new RegExp(`(^|[^${L}])(?:وال|و|ال)?(${RISK_ALIAS.map(x => reEsc(x.a)).join('|')})(?![${L}])`);
  const RISK_BY = new Map(RISK_ALIAS.map(x => [x.a, x]));
  const RISK_SRC = 'قائمة الأدوية المعروف ضررها على الحمل';
  function riskOfText(text) {
    const m = RE_RISK.exec(norm(text));
    return m ? { lv: RISK_BY.get(m[2]).lv, why: RISK_BY.get(m[2]).why, src: RISK_SRC } : null;
  }
  // خطر الصنف: من القائمة المحلية باسمه، أو مما حُفظ معه من نشرة openFDA عند إضافته
  const risk = p => (p ? riskOfText([p.name, p.sub].join(' ')) || p.risk || null : null);
  const RISK_ICON = { bad: '⛔', warn: '⚠️' }, RISK_T = { bad: 'خطر على الحمل', warn: 'يحتاج حذرًا في الحمل' };
  const badge = p => { const r = risk(p); return r ? ` <span class="rbadge ${r.lv}" title="${h(r.why)}"><span aria-hidden="true">${RISK_ICON[r.lv]}</span> ${RISK_T[r.lv]}</span>` : ''; };
  // تنبيهات النتيجة لكل صنف مختار فيه خطر، ومنها تنتقل إلى ملخص الطبيب
  const alerts = items => items.map(p => [p, risk(p)]).filter(([, r]) => r).sort((a, b) => (a[1].lv === 'bad' ? 0 : 1) - (b[1].lv === 'bad' ? 0 : 1)).map(([p, r]) => ({
    lv: r.lv, t: `${RISK_ICON[r.lv]} ${p.name}: ${RISK_T[r.lv]}`,
    b: `${r.why} لا توقفيه فجأة ولا تكمليه من نفسك، وتواصلي مع طبيبك في أقرب وقت ليقرر البديل.${r.src && r.src !== RISK_SRC ? ' (المصدر: ' + r.src + ')' : ''}`,
  }));
  // للأدوية غير الموجودة في القائمة: نشرة الدواء في openFDA. تحذير الصندوق الأسود عن الجنين = خطر، وذكر الحمل في موانع الاستعمال = حذر
  const fdaCache = new Map();
  async function fdaRisk(generic) {
    const g0 = String(generic || '').toLowerCase().replace(/[^a-z \-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (g0.length < 4) return null;
    if (fdaCache.has(g0)) return fdaCache.get(g0);
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    try {
      const d = await getJSON('https://api.fda.gov/drug/label.json?limit=3&search=openfda.generic_name:%22' + encodeURIComponent(g0) + '%22', ctl.signal);
      let r = null;
      for (const x of d.results || []) {
        const bw = (x.boxed_warning || []).join(' '), ci = (x.contraindications || []).join(' ');
        if (/fetal|embryo|birth defect|pregnan|abortion/i.test(bw)) { r = { lv: 'bad', why: 'نشرة الدواء تحمل تحذيرًا مشددًا عن الضرر على الجنين أو الحمل.', src: 'نشرة الدواء في openFDA' }; break; }
        if (/pregnan/i.test(ci)) r = { lv: 'warn', why: 'نشرة الدواء تذكر الحمل ضمن موانع الاستعمال أو قيوده.', src: 'نشرة الدواء في openFDA' };
      }
      fdaCache.set(g0, r);
      return r;
    } catch (e) { return null; } finally { clearTimeout(t); }
  }

  // ───── RxNorm ─────
  const API = 'https://rxnav.nlm.nih.gov/REST/';
  const cache = new Map();
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
      <b>${h(x.name)}${badge(x)}</b>
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
    // اسم دواء خطر غير موجود في القاموس (مثل «روكتان 20»): يُقترح كما كُتب مع علامة الخطر
    if (!p && riskOfText(text)) list = [build({ parts: [], c: {}, rx: true, missing: false, notes: [], noUnit: /\d/.test(text) && !RE_NUM.exec(norm(text))[2] }, text.replace(/\s+/g, ' '), null, 'local')];
    const latin = /[a-z]{3,}/i.test(text);
    // البحث البعيد للأسماء غير المعروفة محليًا، أو حين يكون في النص عيار يمكن مطابقته
    const term = latin && (!p || /\d/.test(text)) ? text : '';
    if (!term) { show(list.length ? '' : 'لم نعرف هذا الاسم. اكتبيه بالإنجليزية كما على العلبة، أو املئي الأرقام يدويًا.'); return; }
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
  const riskNote = x => { const r = risk(x); return r ? `<b class="rnote ${r.lv}">${RISK_ICON[r.lv]} ${RISK_T[r.lv]}: ${h(r.why)} لا توقفيه فجأة ولا تكمليه من نفسك، واسألي طبيبك.</b>` : ''; };
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
    note().innerHTML = riskNote(x) + lines.map(l => `<span>${h(l)}</span>`).join('');
    if (!risk(x) && (x.rx || x.src === 'rx') && x.generic) {
      const me = x;
      fdaRisk(x.generic).then(r => { if (r && picked === me) { me.risk = r; note().insertAdjacentHTML('afterbegin', riskNote(me)); } });
    }
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
  return { pending: () => picked, parse, risk, badge, alerts, _fdaRisk: fdaRisk, _build: build, _remote: remote, _fromRemoteName: fromRemoteName };
})();
