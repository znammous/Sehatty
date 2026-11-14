// «دفتر ذكرياتنا»: كل شهر من أشهر الحمل يكتب كل فرد في العائلة ما يشعر به (الأم والأب والأطفال)،
// مع مزاجه وصورة للذكرى، وفي النهاية يُجمع كله «كتاب ذكرياتنا» يُحفظ PDF أو يُطبع.
// مع حساب العائلة يُحفظ في families/{fid}/apps/sehattyKids/diary (والصور في diaryImg) فيراه الجميع،
// ودون حساب يُحفظ في هذا الجهاز (IndexedDB)، ويُنقل إلى حساب العائلة تلقائيًا عند الربط.
const Diary = (() => {
  const MOODS = [
    ['happy', '😊', 'سعيد', 'سعيدة'], ['love', '🥰', 'مشتاق', 'مشتاقة'], ['excited', '🤩', 'متحمّس', 'متحمّسة'],
    ['calm', '😌', 'مطمئن', 'مطمئنة'], ['grateful', '🤲', 'ممتن', 'ممتنة'], ['tired', '😴', 'متعب', 'متعبة'], ['worried', '😟', 'قلق', 'قلقة'],
  ];
  const ROLES = { mom: ['ماما', '🤰'], dad: ['بابا', '🧔'], kid: ['أنا من الأطفال', '🧒'] };
  const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
  const PROMPTS = {
    mom: ['كيف عرفتِ بالخبر؟ وماذا شعرتِ في تلك اللحظة؟', 'كيف حالك مع التعب هذا الشهر؟ وما الذي تشتهينه؟', 'ماذا شعرتِ حين سمعتِ نبضه أو رأيتِه في السونار؟',
      'ما الذي تغيّر فيكِ هذا الشهر؟', 'كيف كانت أول حركة شعرتِ بها؟', 'ماذا تقولين له حين يتحرك؟', 'ما الذي تجهّزينه لاستقباله؟',
      'ما أكثر ما تنتظرينه في أول لقاء؟', 'رسالة قصيرة يقرؤها حين يكبر', 'كيف كان يوم اللقاء؟ وماذا شعرتِ حين حملتِه أول مرة؟'],
    dad: ['كيف استقبلت الخبر؟ وماذا قلت لماما؟', 'كيف تساعد ماما هذا الشهر؟', 'ماذا شعرت حين سمعت نبضه أو رأيته في السونار؟',
      'ما الأسماء التي تفكّر فيها؟ ولماذا؟', 'هل شعرت بحركته؟ صف اللحظة.', 'ما الذي تحلم أن تعلّمه إياه؟', 'ماذا جهّزت لاستقباله؟',
      'دعاء تدعو به له', 'رسالة قصيرة يقرؤها حين يكبر', 'كيف كان يوم اللقاء؟ وماذا شعرت حين حملته أول مرة؟'],
    kid: ['ماذا شعرت حين عرفت أن ضيفًا جديدًا سيأتي؟', 'ماذا تريد أن تقول لضيفنا الجديد؟', 'كيف تتخيّل وجهه؟', 'ما اللعبة التي ستلعبها معه؟',
      'ضع يدك على بطن ماما: هل شعرت به يتحرك؟', 'ما القصة التي ستحكيها له؟', 'كيف ساعدت ماما هذا الشهر؟', 'ماذا ستعلّمه حين يكبر؟',
      'ماذا ستقول له أول ما تراه؟', 'ماذا شعرت حين رأيته أول مرة؟'],
  };
  const NAME_KEY = 'sehatty-diary-name', ROLE_KEY = 'sehatty-diary-role';
  const ls = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const g = id => document.getElementById(id);
  const say = m => (typeof toast === 'function' ? toast(m) : alert(m));

  // ───── الحفظ في هذا الجهاز (دون حساب) ─────
  const Local = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, fail) => {
      const r = indexedDB.open('sehatty-diary', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('e', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(r.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((ok, fail) => {
      const t = db.transaction('e', mode), s = t.objectStore('e'), r = fn(s);
      t.oncomplete = () => ok(r && r.result); t.onerror = () => fail(t.error); t.onabort = () => fail(t.error);
    }));
    return {
      all: () => tx('readonly', s => s.getAll()).catch(() => []),
      put: e => tx('readwrite', s => s.put(e)),
      del: id => tx('readwrite', s => s.delete(id)),
    };
  })();

  let entries = [], localAll = [], unsub = null, mode = '', sel = 0, picked = false, host = null, kidUi = false;
  const imgs = new Map();   // معرّف الذكرى ← الصورة
  const cloud = () => typeof Cloud !== 'undefined' && Cloud.diaryOn;

  function sync() {
    const want = cloud() ? 'cloud' : 'local';
    if (want === mode) return;
    if (unsub) { unsub(); unsub = null; }
    mode = want; entries = [];
    if (mode === 'cloud') {
      unsub = Cloud.diaryWatch(list => { if (list) { entries = list; render(); } });
      migrate();
    } else {
      Local.all().then(list => { localAll = list || []; if (mode !== 'local') return; entries = localAll.map(strip); render(); });
    }
    render();
  }
  const strip = e => { const { img, ...rest } = e; if (img) imgs.set(e.id, img); return { ...rest, img: !!img }; };
  // ما كُتب في هذا الجهاز قبل الربط ينتقل إلى حساب العائلة
  async function migrate() {
    const list = await Local.all();
    for (const e of list || []) {
      if (!cloud()) return;
      try { const { img, ...rest } = e; await Cloud.diarySave(e.id, { ...rest, uid: '' }, img || null); await Local.del(e.id); } catch (err) { return; }
    }
  }

  // ───── الشهر الحالي من موعد الولادة ─────
  function curMonth() {
    const L = typeof kidLmp === 'function' ? kidLmp() : null;
    if (L == null || typeof MONTHS === 'undefined') return 0;
    const ga = Math.max(0, Math.floor((todayU() - L) / DAY));
    if (ga >= 280) return 10;
    const wk = Math.floor(ga / 7) + 1;
    const M = MONTHS.find(x => wk >= x.w[0] && wk <= x.w[1]);
    return M ? M.m : 9;
  }
  const monthInfo = m => (typeof MONTHS !== 'undefined' && MONTHS.find(x => x.m === m)) || null;
  const monthTitle = m => m === 10 ? 'يوم اللقاء' : `الشهر ${ORD[m - 1]}`;
  const monthSub = m => { if (m === 10) return 'أهلًا بك بيننا يا ضيفنا الجديد 🎉'; const M = monthInfo(m); return M ? `ضيفنا ${M.size}` : ''; };
  const monthIcon = m => m === 10 ? '🎉' : ((monthInfo(m) || {}).fruit || '🌱');
  const fmt = t => new Date(t).toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
  const moodOf = (k, role) => { const x = MOODS.find(y => y[0] === k); return x ? `${x[1]} ${role === 'mom' ? x[3] : x[2]}` : ''; };
  const byTime = (a, b) => (a.t || 0) - (b.t || 0);
  const mine = e => mode === 'local' || (typeof Cloud !== 'undefined' && e.uid === Cloud.uid);
  const canMod = e => mine(e) || (typeof Cloud !== 'undefined' && Cloud.live);

  // ───── الدفتر ─────
  function render() {
    if (!host || !host.isConnected) return;
    const cur = curMonth();
    if (!picked || !sel) sel = cur || sel || 1;   // يتبع الشهر الحالي ما لم يختر المستخدم شهرًا
    const count = m => entries.filter(e => e.m === m).length;
    const list = entries.filter(e => e.m === sel).sort(byTime);
    const future = cur && sel > cur && sel !== 10;
    const lock10 = sel === 10 && cur && cur < 9;
    const role = kidUi ? 'kid' : (ls.get(ROLE_KEY) || 'mom');
    host.innerHTML = `
      <div class="dy-head">
        <span class="dy-cover" aria-hidden="true">📔</span>
        <div><h2>دفتر ذكرياتنا</h2><p>كل شهر يكتب كل واحد منا ما يشعر به، ونلتقط صورة للذكرى، فيصير كله كتابًا لضيفنا الجديد.</p></div>
        <button class="dy-btn soft" type="button" data-dy="book">📖 كتاب ذكرياتنا</button>
      </div>
      <div class="dy-months" role="tablist" aria-label="أشهر الحمل">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(m => `<button type="button" role="tab" data-dy="m" data-m="${m}" aria-selected="${m === sel}" class="${m === cur ? 'now' : ''}${cur && m > cur && m !== 10 ? ' later' : ''}">
          <span class="ic">${monthIcon(m)}</span><span class="nm">${m === 10 ? 'اللقاء' : m}</span>${count(m) ? `<b>${count(m)}</b>` : ''}</button>`).join('')}
      </div>
      <section class="dy-month">
        <header class="dy-mh"><span class="dy-fruit" aria-hidden="true">${monthIcon(sel)}</span>
          <div><h3>${monthTitle(sel)}${sel === cur ? ' <i class="dy-now">نحن هنا</i>' : ''}</h3><small>${h(monthSub(sel))}</small></div></header>
        ${future || lock10
          ? `<p class="dy-wait">⏳ ${lock10 ? 'هذه الصفحة لِيوم اللقاء بإذن الله.' : 'لم نصل إلى هذا الشهر بعد، نكتب فيه حين يأتي بإذن الله.'}</p>`
          : `<p class="dy-prompt">💭 ${h(PROMPTS[role][sel - 1])}</p>
             <button class="dy-btn big" type="button" data-dy="new">✍️ اكتب ذكرى ${sel === 10 ? 'يوم اللقاء' : 'هذا الشهر'}</button>`}
        <div class="dy-list">${list.length ? list.map(e => card(e)).join('') : (future || lock10 ? '' : '<p class="dy-empty">لا ذكريات في هذه الصفحة بعد. كن أول من يكتب 💗</p>')}</div>
      </section>`;
    loadImgs(host);
  }
  function card(e, book) {
    const r = ROLES[e.role] || ROLES.kid;
    const name = e.name || (e.role === 'kid' ? '' : r[0]);
    return `<article class="dy-e r-${h(e.role)}">
      <header><span class="dy-av" aria-hidden="true">${r[1]}</span><div><b>${h(name)}</b>${e.mood ? `<span class="dy-mood">${moodOf(e.mood, e.role)}</span>` : ''}</div><time>${fmt(e.t)}</time></header>
      ${e.text ? `<p>${h(e.text)}</p>` : ''}
      ${e.img ? `<figure class="dy-ph"><img alt="صورة الذكرى" data-dyimg="${h(e.id)}" ${imgs.has(e.id) ? `src="${imgs.get(e.id)}"` : ''}></figure>` : ''}
      ${!book && canMod(e) ? `<div class="dy-acts">${mine(e) ? `<button type="button" data-dy="edit" data-id="${h(e.id)}">تعديل</button>` : ''}<button type="button" data-dy="del" data-id="${h(e.id)}">حذف</button></div>` : ''}
    </article>`;
  }
  function getImg(id) {
    if (imgs.has(id)) return Promise.resolve(imgs.get(id));
    if (mode !== 'cloud') return Promise.resolve('');
    return Cloud.diaryImg(id).then(d => { if (d) imgs.set(id, d); return d; });
  }
  function loadImgs(root) {
    root.querySelectorAll('img[data-dyimg]:not([src])').forEach(el => {
      getImg(el.dataset.dyimg).then(d => { if (d) el.src = d; else el.closest('.dy-ph').classList.add('none'); });
    });
  }

  // ───── كتابة ذكرى ─────
  let draft = null;
  function sheet() {
    let el = g('dyEdit');
    if (!el) {
      el = document.createElement('div');
      el.className = 'viewer dy-sheet'; el.id = 'dyEdit'; el.hidden = true;
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'dyTitle');
      document.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target === el) closeSheet(); });
    }
    return el;
  }
  function openEdit(id) {
    const old = id ? entries.find(e => e.id === id) : null;
    const role = old ? old.role : kidUi ? 'kid' : (ls.get(ROLE_KEY) || 'mom');
    const who = typeof Cloud !== 'undefined' && Cloud.status === 'kid' ? (Cloud.who || '') : '';
    draft = old ? { ...old, img0: old.img, imgNew: undefined } : { m: sel, role, name: defName(role, who), mood: '', text: '', img0: false, imgNew: undefined };
    const el = sheet(); el.hidden = false; paintSheet(true);
    if (old && old.img) getImg(old.id).then(() => paintSheet());
  }
  function defName(role, who) {
    if (role === 'mom') return 'ماما';
    if (role === 'dad') return 'بابا';
    return who || ls.get(NAME_KEY);
  }
  function paintSheet(first) {
    const el = sheet(), d = draft; if (!d) return;
    const text = g('dyText') ? g('dyText').value : d.text, name = g('dyName') ? g('dyName').value : d.name;
    d.text = text; d.name = name;
    const photo = d.imgNew !== undefined ? d.imgNew : (d.img0 ? imgs.get(d.id) || '' : '');
    const lockRole = kidUi || (d.id && entries.some(e => e.id === d.id));
    el.innerHTML = `<figure class="welcome dy-form">
      <figcaption><span id="dyTitle">✍️ ${monthTitle(d.m)}</span><button class="btn" type="button" data-dy="close">إغلاق</button></figcaption>
      ${lockRole ? '' : `<div class="dy-field"><span>من يكتب؟</span><div class="dy-chips">${Object.keys(ROLES).map(k => `<button type="button" data-dy="role" data-v="${k}" aria-pressed="${d.role === k}">${ROLES[k][1]} ${ROLES[k][0]}</button>`).join('')}</div></div>`}
      <label class="dy-field"><span>الاسم</span><input id="dyName" maxlength="40" autocomplete="off" placeholder="${d.role === 'kid' ? 'اكتب اسمك' : ''}" value="${h(d.name)}"></label>
      <div class="dy-field"><span>${d.role === 'mom' ? 'كيف تشعرين؟' : 'كيف تشعر؟'}</span><div class="dy-chips moods">${MOODS.map(x => `<button type="button" data-dy="mood" data-v="${x[0]}" aria-pressed="${d.mood === x[0]}"><i>${x[1]}</i>${d.role === 'mom' ? x[3] : x[2]}</button>`).join('')}</div></div>
      <label class="dy-field"><span>${h(PROMPTS[d.role][d.m - 1])}</span><textarea id="dyText" rows="5" maxlength="1500" placeholder="${d.role === 'mom' ? 'اكتبي ما تشعرين به…' : 'اكتب ما تشعر به…'}">${h(d.text)}</textarea></label>
      <div class="dy-field"><span>صورة للذكرى</span>
        ${photo ? `<div class="dy-prev"><img src="${photo}" alt="الصورة المختارة"><button type="button" class="dy-x" data-dy="noimg" aria-label="إزالة الصورة">✕</button></div>`
          : (d.img0 && d.imgNew === undefined ? '<p class="hint">تُحمَّل الصورة…</p>' : '')}
        <div class="dy-chips"><label class="dy-pick">📸 التقط صورة<input type="file" accept="image/*" capture="environment" hidden data-dyfile></label>
        <label class="dy-pick">🖼️ من الألبوم<input type="file" accept="image/*" hidden data-dyfile></label></div></div>
      <div class="btns cbtns"><button class="btn primary" type="button" data-dy="save">احفظ الذكرى 💗</button><button class="btn" type="button" data-dy="close">إلغاء</button></div>
    </figure>`;
    if (first) setTimeout(() => { const t = g('dyText'); if (t) t.focus({ preventScroll: true }); }, 50);
  }
  function closeSheet() { const el = g('dyEdit'); if (el) el.hidden = true; draft = null; }

  // الصورة تُصغَّر على الجهاز قبل الحفظ (كما في مجلس العائلة)
  function shrink(src, w, h0) {
    let max = 1280, q = 0.8, out = '';
    for (let i = 0; i < 8; i++) {
      const s = Math.min(1, max / Math.max(w, h0)), c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h0 * s);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 450000) break;
      max *= 0.8; q = Math.max(0.5, q - 0.07);
    }
    return out;
  }
  function compress(file) {
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(shrink(img, img.naturalWidth, img.naturalHeight)); };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('img')); };
      img.src = url;
    });
  }

  async function save(btn) {
    const d = draft; if (!d) return;
    d.text = g('dyText').value.trim(); d.name = g('dyName').value.trim().slice(0, 40);
    if (!d.text && !d.imgNew && !(d.img0 && d.imgNew === undefined)) { say(d.role === 'mom' ? 'اكتبي شيئًا أو أضيفي صورة' : 'اكتب شيئًا أو أضف صورة'); g('dyText').focus(); return; }
    if (d.role === 'kid' && !d.name) { say('اكتب اسمك أولًا'); g('dyName').focus(); return; }
    const id = d.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const e = { id, m: d.m, role: d.role, name: d.name, mood: d.mood, text: d.text, t: d.t || Date.now(), uid: d.uid || '' };
    const img = d.imgNew;   // undefined: كما هي، null: تُحذف، نص: صورة جديدة
    e.img = img === undefined ? !!d.img0 : !!img;
    if (d.role === 'kid' && d.name) ls.set(NAME_KEY, d.name);
    if (!kidUi && d.role !== 'kid') ls.set(ROLE_KEY, d.role);
    btn.disabled = true; btn.textContent = 'يُحفظ…';
    try {
      if (mode === 'cloud') {
        if (img) imgs.set(id, img); else if (img === null) imgs.delete(id);
        // الكتابة تظهر فورًا من الذاكرة المؤقتة وتصل حين يتوفر الإنترنت
        const p = Cloud.diarySave(id, e, img);
        await Promise.race([p, new Promise(ok => setTimeout(ok, 2500))]);
        p.catch(() => say('تعذّر حفظ الذكرى، أعيدوا المحاولة'));
      } else {
        const full = { ...e, img: img === undefined ? (d.img0 ? imgs.get(id) || '' : '') : (img || '') };
        await Local.put(full);
        if (full.img) imgs.set(id, full.img); else imgs.delete(id);
        localAll = localAll.filter(x => x.id !== id).concat(full);
        entries = localAll.map(strip);
      }
      closeSheet(); sel = e.m; picked = true; render();
      say(e.role === 'kid' ? 'حُفظت ذكراك يا بطل 💗' : 'حُفظت الذكرى 💗');
      if (mode === 'cloud' && e.role === 'kid' && !d.id && typeof Cloud !== 'undefined' && Cloud.status === 'kid') Cloud.sendHeart(`${e.name} (كتب في دفتر الذكريات)`.slice(0, 40));
    } catch (err) {
      btn.disabled = false; btn.textContent = 'احفظ الذكرى 💗';
      say(String(err && err.name).includes('Quota') ? 'ذاكرة الجهاز ممتلئة، جرّبوا صورة أصغر' : 'تعذّر حفظ الذكرى');
    }
  }
  async function remove(id) {
    const e = entries.find(x => x.id === id); if (!e) return;
    try {
      if (mode === 'cloud') await Cloud.diaryDelete(id, e.img);
      else { await Local.del(id); localAll = localAll.filter(x => x.id !== id); entries = localAll.map(strip); }
      imgs.delete(id); render(); say('حُذفت الذكرى');
    } catch (err) { say('تعذّر الحذف'); }
  }

  // ───── كتاب ذكرياتنا: كل الأشهر في صفحات تُحفظ PDF أو تُطبع ─────
  async function openBook() {
    let el = g('dyBook');
    if (!el) { el = document.createElement('div'); el.id = 'dyBook'; el.className = 'dy-book'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'كتاب ذكرياتنا'); document.body.appendChild(el); }
    el.hidden = false; document.body.classList.add('dy-open');
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(m => entries.some(e => e.m === m));
    const all = entries.slice().sort(byTime);
    const names = [...new Set(all.map(e => e.name || (ROLES[e.role] || [''])[0]).filter(Boolean))];
    const span = all.length ? (fmt(all[0].t) === fmt(all[all.length - 1].t) ? fmt(all[0].t) : `${fmt(all[0].t)} – ${fmt(all[all.length - 1].t)}`) : '';
    el.innerHTML = `<div class="dy-tools"><button class="btn primary" type="button" data-dy="print" ${months.length ? '' : 'disabled'}>🖨️ حفظ PDF أو طباعة</button><span class="hint" id="dyBookWait"></span><button class="btn" type="button" data-dy="bookClose">إغلاق</button></div>
      <div class="dy-pages">
        <section class="dy-page dy-front">
          <svg width="96" height="96" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="13" fill="var(--accent)"/><path d="M22 33.5s-10.5-6.4-10.5-13.6A5.9 5.9 0 0 1 22 16.6a5.9 5.9 0 0 1 10.5 3.3c0 7.2-10.5 13.6-10.5 13.6z" fill="#fff"/></svg>
          <h1>حكاية انتظارك</h1>
          <p class="dy-lead">دفتر ذكريات عائلتنا ونحن ننتظر ضيفنا الجديد، شهرًا بشهر.</p>
          ${names.length ? `<p class="dy-by">كتبه بحب: ${names.map(h).join('، ')}</p>` : ''}
          ${span ? `<p class="dy-span">${span}</p>` : ''}
          <p class="dy-ayah">رَبِّ هَبْ لِي مِنْ لَدُنْكَ ذُرِّيَّةً طَيِّبَةً</p>
        </section>
        ${months.length ? months.map(m => `<section class="dy-page">
          <header class="dy-mh"><span class="dy-fruit" aria-hidden="true">${monthIcon(m)}</span><div><h2>${monthTitle(m)}</h2><small>${h(monthSub(m))}</small></div></header>
          <div class="dy-list">${entries.filter(e => e.m === m).sort(byTime).map(e => card(e, true)).join('')}</div>
        </section>`).join('') : '<section class="dy-page"><p class="dy-empty">الكتاب فارغ بعد. اكتبوا أول ذكرى في الدفتر، فتظهر هنا صفحة لكل شهر.</p></section>'}
      </div>`;
    el.scrollTop = 0;
    const pics = [...el.querySelectorAll('img[data-dyimg]')];
    const wait = g('dyBookWait'), pb = el.querySelector('[data-dy="print"]');
    if (pics.some(p => !p.getAttribute('src'))) { wait.textContent = 'نجهّز الصور…'; pb.disabled = true; }
    await Promise.all(pics.map(p => getImg(p.dataset.dyimg).then(d => { if (d) p.src = d; else p.closest('.dy-ph').classList.add('none'); })));
    await Promise.all(pics.filter(p => p.src).map(p => p.decode ? p.decode().catch(() => {}) : null));
    if (wait.isConnected) { wait.textContent = ''; pb.disabled = !months.length; }
  }
  function closeBook() { const el = g('dyBook'); if (el) { el.hidden = true; el.innerHTML = ''; } document.body.classList.remove('dy-open'); }

  // ───── الأحداث ─────
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dy]'); if (!b) return;
    const a = b.dataset.dy;
    if (a === 'm') { sel = +b.dataset.m; picked = true; render(); return; }
    if (a === 'new') { openEdit(); return; }
    if (a === 'edit') { openEdit(b.dataset.id); return; }
    if (a === 'del') {
      if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'تأكيد الحذف'; setTimeout(() => { if (b.isConnected) { b.classList.remove('arm'); b.textContent = 'حذف'; } }, 4000); return; }
      b.disabled = true; remove(b.dataset.id); return;
    }
    if (a === 'close') { closeSheet(); return; }
    if (a === 'role') { draft.role = b.dataset.v; const n = g('dyName').value.trim(); if (!n || n === 'ماما' || n === 'بابا') { draft.name = defName(draft.role, ''); g('dyName').value = draft.name; } paintSheet(); return; }
    if (a === 'mood') { draft.mood = draft.mood === b.dataset.v ? '' : b.dataset.v; paintSheet(); return; }
    if (a === 'noimg') { draft.imgNew = draft.img0 ? null : undefined; if (!draft.img0) draft.imgNew = undefined; paintSheet(); return; }
    if (a === 'save') { save(b); return; }
    if (a === 'book') { openBook(); return; }
    if (a === 'bookClose') { closeBook(); return; }
    if (a === 'print') { window.print(); return; }
    if (a === 'kidClose') { closeKid(); return; }
  });
  document.addEventListener('change', async e => {
    const inp = e.target.closest('input[data-dyfile]'); if (!inp || !draft) return;
    const f = inp.files && inp.files[0]; inp.value = '';
    if (!f) return;
    try { draft.text = g('dyText').value; draft.name = g('dyName').value; draft.imgNew = await compress(f); paintSheet(); }
    catch (err) { say('تعذّرت قراءة الصورة'); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (g('dyEdit') && !g('dyEdit').hidden) closeSheet();
    else if (g('dyBook') && !g('dyBook').hidden) closeBook();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('dy-printing'));
  window.addEventListener('beforeprint', () => { if (g('dyBook') && !g('dyBook').hidden) document.body.classList.add('dy-printing'); });

  // ───── واجهة الأطفال: الدفتر في صفحة كاملة ─────
  function openKid() {
    let el = g('dyKid');
    if (!el) {
      el = document.createElement('div'); el.id = 'dyKid'; el.className = 'dy-kid';
      el.innerHTML = '<button class="dy-back" type="button" data-dy="kidClose">→ رجوع</button><div class="dy dy-k" id="dyKidHost"></div>';
      document.body.appendChild(el);
    }
    el.hidden = false; document.body.classList.add('dy-open');
    mount(g('dyKidHost'), true); window.scrollTo(0, 0); el.scrollTop = 0;
  }
  function closeKid() { const el = g('dyKid'); if (el) el.hidden = true; document.body.classList.remove('dy-open'); host = null; }

  function mount(el, kid) { host = el; kidUi = !!kid; sync(); render(); }
  if (typeof Cloud !== 'undefined') Cloud.on(what => {
    if (what === 'status') setTimeout(() => {
      sync();
      // جهاز خرج من وضع الأطفال أو دخله: نغلق صفحة الأطفال إن لم تعد مناسبة
      if (g('dyKid') && !g('dyKid').hidden && !document.body.classList.contains('kidmode')) closeKid();
    }, 0);
    if (what === 'kids') render();
  });
  return { mount, openKid, render, closeKid };
})();
