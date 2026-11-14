// «ضيفنا الجديد»: الاتصال بمشروع Firebase المشترك مع تطبيقات العائلة (tablehero-d582b).
// نفس آلية مجلس العائلة: ولي الأمر يدخل بحساب Google، وبقية الأجهزة تنضم برمز من مجلس العائلة
// (حساب مجهول يُسجَّل في families/{fid}/members/{uid}، ورمز «ولي أمر» يسجّله في guardians).
// بيانات الحمل في families/{fid}/sehatty/main: يقرؤها ويكتبها أولياء الأمر فقط بالقاعدة العامة،
// فلا تصل إليها أجهزة الأطفال دون أي تعديل في القواعد المشتركة.
const Cloud = (() => {
  const SDK = new URL('js/vendor/firebase/', document.baseURI).href;
  const FIREBASE = {
    apiKey: 'AIzaSyBny9DhGm7ySaAa9lBxw3tbHaZ7OdCAPNU',
    authDomain: 'tablehero-d582b.firebaseapp.com',
    projectId: 'tablehero-d582b',
    storageBucket: 'tablehero-d582b.firebasestorage.app',
    messagingSenderId: '1035331862918',
    appId: '1:1035331862918:web:d73e41610d2d2185a96c07',
  };
  const APP = 'sehatty';
  // تطبيقات العائلة على نفس النطاق تحفظ عائلة الجهاز هنا، فإن كان مرتبطاً بأحدها ندخل مباشرة
  const OTHER_APPS = { familyChat: 'family-chat-family', jungleHero: 'jungle-hero-family', spellingHero: 'spelling-hero-family' };
  const FID_KEY = 'sehatty-family';
  const NOLINK = 'sehatty-nolink';
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} },
  };

  // 'local' (بلا إنترنت أو من ملف) | 'loading' | 'out' | 'linking' | 'ok' | 'offline' | 'kid'
  let status = 'loading';
  let fb = null, user = null, fid = null, joining = false, parent = false;
  let memberData = null, dataUnsub = null, guardName = '';
  let extraUnsubs = [];   // المهام اليومية والسجل والمواعيد
  const listeners = [];
  const notify = (what, x) => listeners.forEach(fn => fn(what, x));
  const set = s => { status = s; notify('status'); };

  async function start() {
    if (!location.protocol.startsWith('http')) { set('local'); return; }
    try {
      const [app, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js'),
      ]);
      const a = app.initializeApp(FIREBASE);
      fb = { app: a, auth, fs, authI: auth.getAuth(a), db: fs.initializeFirestore(a, { localCache: fs.persistentLocalCache() }) };
      // للتجربة فقط: localhost/?emulator يستخدم محاكيات Firebase بدل المشروع الحقيقي
      if (location.hostname === 'localhost' && /[?&]emulator\b/.test(location.search)) {
        auth.connectAuthEmulator(fb.authI, 'http://localhost:9099', { disableWarnings: true });
        fs.connectFirestoreEmulator(fb.db, 'localhost', 8085);
        fb.emulator = true;
        window.__fb = fb;
      }
    } catch (e) {
      set('local');
      window.addEventListener('online', start, { once: true });
      return;
    }
    fb.auth.onAuthStateChanged(fb.authI, onUser);
  }

  const famDoc = (...p) => fb.fs.doc(fb.db, 'families', fid, ...p);
  const famCol = (...p) => fb.fs.collection(fb.db, 'families', fid, ...p);

  function stopAll() {
    if (dataUnsub) { dataUnsub(); dataUnsub = null; }
    extraUnsubs.forEach(u => u()); extraUnsubs = [];
    memberData = null; parent = false; guardName = '';
  }

  async function onUser(u) {
    if (joining && u && u.isAnonymous && !ls.get(FID_KEY)) { user = u; return; }
    stopAll();
    user = u;
    fid = !u ? null : u.isAnonymous ? ls.get(FID_KEY) : u.uid;
    if (u && u.isAnonymous && !fid && ls.get(NOLINK) !== '1') {
      set('linking');
      fid = await linkFromApps(u);
    }
    if (!fid) { set('out'); return; }
    if (u.isAnonymous) {
      const [m, g] = await Promise.all([
        fb.fs.getDoc(famDoc('members', u.uid)).catch(() => null),
        fb.fs.getDoc(famDoc('guardians', u.uid)).catch(() => null),
      ]);
      memberData = m && m.exists() ? m.data() : null;
      if (m && m.exists() === false && !m.metadata.fromCache) { ls.set(FID_KEY, null); fid = null; set('out'); return; }
      parent = !!(g && g.exists());
      guardName = parent ? (g.data().name || '') : '';
      // ولي الأمر فصل هذا الجهاز: يخرج فورًا وتُغلق اتصالاته (كما في مجلس العائلة)
      extraUnsubs.push(fb.fs.onSnapshot(famDoc('members', u.uid), snap => {
        if (snap.metadata.fromCache || snap.exists()) return;
        ls.set(FID_KEY, null); stopAll(); fid = null; set('out');
      }, () => {}));
    } else parent = true;
    if (!parent) {
      set('kid');
      // جهاز طفل: يقرأ موعد الولادة فقط من apps/sehattyKids
      extraUnsubs.push(fb.fs.onSnapshot(famDoc('apps', 'sehattyKids'), snap => {
        notify('kids', snap.exists() ? snap.data() : null);
      }, () => notify('kids', null)));
      return;
    }
    dataUnsub = fb.fs.onSnapshot(famDoc('sehatty', 'main'), { includeMetadataChanges: true }, snap => {
      status = snap.metadata.fromCache ? 'offline' : 'ok';
      notify('status');
      if (snap.metadata.hasPendingWrites) return;   // صدى ما كتبناه نحن
      notify('data', { exists: snap.exists(), data: snap.exists() ? snap.data() : null, fromCache: snap.metadata.fromCache });
    }, () => set('offline'));
    watchExtra();
  }

  // مهام كل يوم في sehattyDays/{التاريخ}، والسجل في sehattyLog، والمواعيد في sehattyAppts.
  // مستندات منفصلة حتى لا تمحو كتابةُ أحد الوالدين كتابةَ الآخر في نفس اللحظة.
  function watchExtra() {
    const fs = fb.fs, since = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    extraUnsubs.push(fs.onSnapshot(fs.query(famCol('sehattyDays'), fs.where('date', '>=', since)), snap => {
      const days = {}; snap.docs.forEach(d => { days[d.id] = d.data(); });
      notify('days', days);
    }, () => {}));
    extraUnsubs.push(fs.onSnapshot(fs.query(famCol('sehattyLog'), fs.orderBy('t', 'desc'), fs.limit(60)), snap => {
      notify('log', snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {}));
    extraUnsubs.push(fs.onSnapshot(fs.query(famCol('apps', 'sehattyKids', 'hearts'), fs.orderBy('t', 'desc'), fs.limit(30)), snap => {
      notify('hearts', snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })));
    }, () => {}));
    // الأجهزة المرتبطة بالعائلة: سجلّ members مع أولياء الأمر الآخرين في guardians
    let mem = null, gua = null;
    const pushDevices = () => {
      if (!mem || !gua) return;
      notify('devices', mem.map(d => ({ id: d.id, name: (gua[d.id] && gua[d.id].name) || d.name || '', guardian: !!gua[d.id], apps: Object.keys(d.apps || {}), at: d.at || 0, code: d.code || '', me: d.id === user.uid }))
        .sort((a, b) => (b.guardian - a.guardian) || (b.at - a.at)));
    };
    extraUnsubs.push(fs.onSnapshot(famCol('members'), snap => { mem = snap.docs.map(d => ({ id: d.id, ...d.data() })); pushDevices(); }, () => {}));
    extraUnsubs.push(fs.onSnapshot(famCol('guardians'), snap => { gua = {}; snap.docs.forEach(d => { gua[d.id] = d.data(); }); pushDevices(); }, () => {}));
    extraUnsubs.push(fs.onSnapshot(famCol('sehattyAppts'), snap => {
      notify('appts', { list: snap.docs.map(d => ({ id: d.id, ...d.data() })), fromCache: snap.metadata.fromCache });
    }, () => {}));
  }
  const live = () => !!(fb && fid && parent);
  function markTask(date, id, on, extra) {
    if (!live()) return Promise.resolve(false);
    const ref = famDoc('sehattyDays', date);
    const p = on
      ? fb.fs.setDoc(ref, { date, ...(extra || {}), done: { [id]: { at: Date.now(), by: who() } } }, { merge: true })
      : fb.fs.updateDoc(ref, { ['done.' + id]: fb.fs.deleteField(), ...(extra || {}) });
    return p.then(() => true).catch(() => false);
  }
  function setDay(date, patch) {
    if (!live()) return Promise.resolve(false);
    return fb.fs.setDoc(famDoc('sehattyDays', date), { date, ...patch }, { merge: true }).then(() => true).catch(() => false);
  }
  function addLog(text, kind, by) {
    if (!live()) return Promise.resolve(false);
    return fb.fs.addDoc(famCol('sehattyLog'), { t: Date.now(), by: by || who(), uid: user.uid, text: String(text).slice(0, 200), kind: kind || '' })
      .then(() => true).catch(() => false);
  }
  // ولي الأمر ينشر للأطفال موعد الولادة (lmp بالميلي ثانية) وعدد أكواب ماء ماما اليوم (water, waterDay)، لا غير
  function publishKids(data) {
    if (!live()) return Promise.resolve(false);
    return fb.fs.setDoc(famDoc('apps', 'sehattyKids'), { ...data, at: fb.fs.serverTimestamp() }, { merge: true }).then(() => true).catch(() => false);
  }
  // أي جهاز في العائلة (ومنه جهاز الطفل) يرسل قلبًا لماما
  function sendHeart(name) {
    if (!fb || !fid || !user) return Promise.resolve(false);
    return fb.fs.addDoc(famCol('apps', 'sehattyKids', 'hearts'), { t: fb.fs.serverTimestamp(), name: String(name || '').slice(0, 40) })
      .then(() => true).catch(() => false);
  }
  // دفتر ذكرياتنا: كل أجهزة العائلة (ومنها أجهزة الأطفال) تقرأ الدفتر وتكتب فيه، وكل جهاز يعدّل ما كتبه فقط
  // (وأولياء الأمر يحذفون أي ذكرى بالقاعدة العامة). الصورة في مستند منفصل في diaryImg حتى تبقى القائمة خفيفة.
  const diaryOn = () => !!(fb && fid && user && (parent || status === 'kid'));
  const dCol = n => famCol('apps', 'sehattyKids', n);
  function diaryWatch(cb) {
    if (!diaryOn()) return () => {};
    return fb.fs.onSnapshot(dCol('diary'), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => cb(null));
  }
  // img: نص الصورة لحفظها، أو null لحذفها، أو undefined لإبقائها كما هي
  function diarySave(id, e, img) {
    if (!diaryOn()) return Promise.reject(new Error('unavailable'));
    const b = fb.fs.writeBatch(fb.db), uid = user.uid;
    const keep = img === undefined ? !!e.img : !!img;
    b.set(fb.fs.doc(dCol('diary'), id), {
      m: e.m, name: String(e.name || '').slice(0, 40), role: e.role, mood: e.mood || '', text: String(e.text || '').slice(0, 2000),
      t: e.t || Date.now(), uid: e.uid && e.uid !== uid ? e.uid : uid, img: keep,
    });
    if (img) b.set(fb.fs.doc(dCol('diaryImg'), id), { d: img, uid });
    else if (img === null) b.delete(fb.fs.doc(dCol('diaryImg'), id));
    return b.commit();
  }
  function diaryDelete(id, hasImg) {
    if (!diaryOn()) return Promise.reject(new Error('unavailable'));
    const b = fb.fs.writeBatch(fb.db);
    if (hasImg) b.delete(fb.fs.doc(dCol('diaryImg'), id));
    b.delete(fb.fs.doc(dCol('diary'), id));
    return b.commit();
  }
  function diaryImg(id) {
    if (!diaryOn()) return Promise.resolve('');
    return fb.fs.getDoc(fb.fs.doc(dCol('diaryImg'), id)).then(s => (s.exists() && s.data().d) || '').catch(() => '');
  }
  // ولي الأمر يضيف جهازاً من داخل التطبيق: رمز من 8 أحرف بلا الأحرف المتشابهة، صالح لعشر دقائق.
  // kid = 'A|الاسم' لولي أمر، أو '' لجهاز طفل (نفس صيغة رموز تطبيقات العائلة)
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const CODE_MS = 10 * 60 * 1000;
  async function createCode(kid) {
    if (!live()) throw new Error('unavailable');
    const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => ALPHABET[b % ALPHABET.length]).join('');
    const exp = Date.now() + CODE_MS;
    await Promise.race([
      fb.fs.setDoc(fb.fs.doc(fb.db, 'pairCodes', code), { fid, kid: String(kid || '').slice(0, 40), exp: fb.fs.Timestamp.fromMillis(exp) }),
      new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), 15000)),
    ]);
    return { code, exp };
  }
  function cancelCode(code) {
    if (!live()) return Promise.resolve();
    return fb.fs.deleteDoc(fb.fs.doc(fb.db, 'pairCodes', code)).catch(() => {});
  }

  // ولي الأمر يفصل جهازاً عن العائلة كلها، كما في مجلس العائلة: يلغي صلاحيات ولي الأمر ويحذف سجلّه،
  // ويُعلَّم ملفه في المجلس بالفصل (إن وُجد) لتبقى رسائله باسمه
  async function removeDevice(id) {
    if (!live() || id === user.uid) return false;
    await fb.fs.deleteDoc(famDoc('guardians', id)).catch(() => {});
    const ok = await fb.fs.deleteDoc(famDoc('members', id)).then(() => true).catch(() => false);
    await fb.fs.updateDoc(famDoc('chatUsers', id), { left: Date.now() }).catch(() => {});
    return ok;
  }
  function saveAppt(a) {
    if (!live()) return Promise.resolve(false);
    const { id, ...rest } = a;
    return fb.fs.setDoc(famDoc('sehattyAppts', id), rest).then(() => true).catch(() => false);
  }
  function deleteAppt(id) {
    if (!live()) return Promise.resolve(false);
    return fb.fs.deleteDoc(famDoc('sehattyAppts', id)).then(() => true).catch(() => false);
  }

  async function linkFromApps(u) {
    for (const key of Object.values(OTHER_APPS)) {
      const f = ls.get(key);
      if (!f) continue;
      const snap = await fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'families', f, 'members', u.uid)).catch(() => null);
      if (snap && snap.exists()) { ls.set(FID_KEY, f); return f; }
    }
    return null;
  }

  async function signIn() {
    if (!fb) throw new Error('unavailable');
    const provider = new fb.auth.GoogleAuthProvider();
    return fb.auth.signInWithPopup(fb.authI, provider).catch(e => {
      if (e.code === 'auth/popup-blocked') return fb.auth.signInWithRedirect(fb.authI, provider);
      throw e;
    });
  }

  // رمز من مجلس العائلة (8 أحرف، صالح لعشر دقائق)
  async function join(raw, name) {
    const code = String(raw).toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (code.length !== 8) throw new Error('bad-code');
    if (!fb) throw new Error('unavailable');
    if (user && !user.isAnonymous) throw new Error('signed-in');
    joining = true;
    try {
      const cred = user || (await fb.auth.signInAnonymously(fb.authI)).user;
      const snap = await fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'pairCodes', code)).catch(e => {
        throw new Error(e.code === 'permission-denied' ? 'expired' : 'network');
      });
      if (!snap.exists() || snap.data().exp.toMillis() < Date.now()) throw new Error('expired');
      const c = snap.data();
      const mref = fb.fs.doc(fb.db, 'families', c.fid, 'members', cred.uid);
      const member = await fb.fs.getDocFromServer(mref).catch(() => null);
      const old = member && member.exists() ? member.data() : null;
      const entry = { code, name: String(name || '').slice(0, 40), at: Date.now() };
      const apps = { ...((old && old.apps) || {}) };
      apps[APP] = '';
      await fb.fs.setDoc(mref, { ...entry, kid: (old && old.kid) || '', apps });
      if (/^A\|/.test(c.kid || '')) {
        await fb.fs.setDoc(fb.fs.doc(fb.db, 'families', c.fid, 'guardians', cred.uid),
          { code, name: (c.kid.slice(2) || String(name || '')).slice(0, 40), at: Date.now() });
        fb.fs.deleteDoc(fb.fs.doc(fb.db, 'pairCodes', code)).catch(() => {});
      }
      ls.set(FID_KEY, c.fid);
      ls.set(NOLINK, null);
      joining = false;
      await onUser(cred);
    } finally { joining = false; }
  }

  const otherApps = d => !!(d && d.apps && Object.keys(d.apps).some(a => a !== APP));

  // الجهاز يخرج من «ضيفنا الجديد» فقط، ويبقى مرتبطاً بتطبيقات العائلة الأخرى إن كان مرتبطاً بها
  async function signOut() {
    if (user && user.isAnonymous && fid && memberData && memberData.apps && APP in memberData.apps) {
      const ref = famDoc('members', user.uid);
      await (otherApps(memberData)
        ? fb.fs.updateDoc(ref, { ['apps.' + APP]: fb.fs.deleteField() })
        : fb.fs.deleteDoc(ref)).catch(() => {});
    }
    const keep = user && user.isAnonymous && otherApps(memberData);
    ls.set(FID_KEY, null);
    if (user && user.isAnonymous) ls.set(NOLINK, '1');
    if (keep || (user && user.isAnonymous && !memberData)) { stopAll(); fid = null; set('out'); return; }
    return fb.auth.signOut(fb.authI);
  }

  function save(data) {
    if (!fb || !fid || !parent) return Promise.resolve(false);
    return fb.fs.setDoc(famDoc('sehatty', 'main'), { ...data, at: fb.fs.serverTimestamp(), by: user.uid })
      .then(() => true).catch(() => false);
  }

  function who() {
    if (!user) return '';
    if (!user.isAnonymous) return user.displayName || user.email || 'ولي الأمر';
    return guardName || (memberData && memberData.name) || '';
  }

  return {
    start, signIn, join, signOut, save, markTask, setDay, addLog, saveAppt, deleteAppt, publishKids, sendHeart, removeDevice, createCode, cancelCode,
    diaryWatch, diarySave, diaryDelete, diaryImg,
    get diaryOn() { return diaryOn(); },
    get uid() { return user ? user.uid : ''; },
    get owner() { return !!(user && !user.isAnonymous); },
    get live() { return live(); },
    on: fn => listeners.push(fn),
    get status() { return status; },
    get who() { return who(); },
  };
})();
