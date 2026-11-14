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

  function stopAll() {
    if (dataUnsub) { dataUnsub(); dataUnsub = null; }
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
    } else parent = true;
    if (!parent) { set('kid'); return; }
    dataUnsub = fb.fs.onSnapshot(famDoc('sehatty', 'main'), { includeMetadataChanges: true }, snap => {
      status = snap.metadata.fromCache ? 'offline' : 'ok';
      notify('status');
      if (snap.metadata.hasPendingWrites) return;   // صدى ما كتبناه نحن
      notify('data', { exists: snap.exists(), data: snap.exists() ? snap.data() : null, fromCache: snap.metadata.fromCache });
    }, () => set('offline'));
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

  return {
    start, signIn, join, signOut, save,
    on: fn => listeners.push(fn),
    get status() { return status; },
    get who() {
      if (!user) return '';
      if (!user.isAnonymous) return user.displayName || user.email || 'ولي الأمر';
      return guardName || (memberData && memberData.name) || '';
    },
  };
})();
