/* ===================================================
   DATA LAYER
=================================================== */
const STORAGE_KEY = 'ao_profiles_v1';
const ARTIKEL_KEY = 'ao_artikel_v1';
const PORTO_KEY   = 'ao_porto_v1';

function loadData()         { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveData(d)        { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function loadArtikel()      { try { return JSON.parse(localStorage.getItem(ARTIKEL_KEY)) || []; } catch { return []; } }
function saveArtikelData(d) { localStorage.setItem(ARTIKEL_KEY, JSON.stringify(d)); }
function loadPorto()        { try { return JSON.parse(localStorage.getItem(PORTO_KEY)) || []; } catch { return []; } }
function savePortoData(d)   { localStorage.setItem(PORTO_KEY, JSON.stringify(d)); }

let profiles = loadData();
let artikels  = loadArtikel();
let portos    = loadPorto();

let pendingDeleteId   = null;
let pendingDeleteType = null;
let currentProfileId  = null;
let currentSection    = 'artikel';
let isLoggedIn        = false;
let loginCallback     = null;

const AUTH_KEY = 'ao_auth_v1';
function loadCred() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || { username: 'admin', password: 'astra2025' }; }
  catch { return { username: 'admin', password: 'astra2025' }; }
}
let LOGIN_CRED = loadCred();

/* ===================================================
   NAVIGATION
=================================================== */
const LIST_VIEWS = new Set(['viewArtikelList', 'viewPortofolioList', 'viewDashboard']);

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('backBtn').style.display = LIST_VIEWS.has(id) ? 'none' : 'inline-block';
  window.scrollTo(0, 0);
}

function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const ids = { artikel: 'navArtikel', portofolio: 'navPortofolio', profil: 'navProfil' };
  document.getElementById(ids[section]).classList.add('active');
  if (section === 'artikel')     { renderArtikelList();    showView('viewArtikelList'); }
  else if (section === 'portofolio') { renderPortofolioList(); showView('viewPortofolioList'); }
  else {
    if (!isLoggedIn) {
      loginCallback = () => { renderList(); showView('viewDashboard'); };
      showLoginModal();
      return;
    }
    renderList();
    showView('viewDashboard');
  }
}

function goBack() {
  if (currentSection === 'artikel')         { renderArtikelList();    showView('viewArtikelList'); }
  else if (currentSection === 'portofolio') { renderPortofolioList(); showView('viewPortofolioList'); }
  else {
    if (!isLoggedIn) { showLoginModal(); return; }
    renderList();
    showView('viewDashboard');
  }
}

/* ===================================================
   LOGIN / LOGOUT
=================================================== */
function showLoginModal() {
  document.getElementById('loginModal').classList.add('show');
  setTimeout(() => document.getElementById('loginUsername').focus(), 100);
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('show');
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').textContent = '';
  loginCallback = null;
}

function handleAuthBtn() {
  if (isLoggedIn) doLogout();
  else showLoginModal();
}

function doLogin(e) {
  e.preventDefault();
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  if (u === LOGIN_CRED.username && p === LOGIN_CRED.password) {
    isLoggedIn = true;
    document.body.classList.add('admin-logged-in');
    updateAuthButton();
    closeLoginModal();
    showToast('Selamat datang, Admin!');
    if (loginCallback) {
      const cb = loginCallback;
      loginCallback = null;
      cb();
    } else {
      rerenderCurrentSection();
    }
  } else {
    err.textContent = 'Username atau password salah.';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    const card = document.querySelector('#loginModal .login-card');
    card.classList.add('login-shake');
    setTimeout(() => card.classList.remove('login-shake'), 500);
  }
}

function doLogout() {
  isLoggedIn = false;
  document.body.classList.remove('admin-logged-in');
  updateAuthButton();
  showToast('Berhasil keluar.');
  if (currentSection === 'profil') {
    currentSection = 'artikel';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('navArtikel').classList.add('active');
    renderArtikelList();
    showView('viewArtikelList');
  } else {
    rerenderCurrentSection();
  }
}

function togglePassword() {
  togglePwField('loginPassword');
}

function togglePwField(id) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

/* ===================================================
   GANTI PASSWORD
=================================================== */
function showChangePasswordModal() {
  document.getElementById('changePasswordForm').reset();
  document.getElementById('cpError').textContent = '';
  document.getElementById('changePasswordModal').classList.add('show');
  setTimeout(() => document.getElementById('cpCurrent').focus(), 100);
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.remove('show');
  document.getElementById('changePasswordForm').reset();
  document.getElementById('cpError').textContent = '';
}

function doChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('cpCurrent').value;
  const newPw   = document.getElementById('cpNew').value;
  const confirm = document.getElementById('cpConfirm').value;
  const err     = document.getElementById('cpError');

  if (current !== LOGIN_CRED.password) {
    err.textContent = 'Password saat ini tidak sesuai.';
    document.getElementById('cpCurrent').value = '';
    document.getElementById('cpCurrent').focus();
    return;
  }
  if (newPw !== confirm) {
    err.textContent = 'Konfirmasi password tidak cocok.';
    document.getElementById('cpConfirm').value = '';
    document.getElementById('cpConfirm').focus();
    return;
  }
  if (newPw === current) {
    err.textContent = 'Password baru harus berbeda dari password lama.';
    return;
  }

  LOGIN_CRED.password = newPw;
  localStorage.setItem(AUTH_KEY, JSON.stringify(LOGIN_CRED));
  closeChangePasswordModal();
  showToast('Password berhasil diubah!');
}

function updateAuthButton() {
  const btn = document.getElementById('headerAuthBtn');
  if (isLoggedIn) {
    btn.innerHTML = '&#128275; Keluar';
    btn.classList.add('is-logout');
  } else {
    btn.innerHTML = '&#128274; Masuk';
    btn.classList.remove('is-logout');
  }
}

function rerenderCurrentSection() {
  if (currentSection === 'artikel')         renderArtikelList();
  else if (currentSection === 'portofolio') renderPortofolioList();
  else if (currentSection === 'profil')     renderList();
}

/* ===================================================
   DELETE MODAL (shared)
=================================================== */
function openDeleteModal(id, type, titleText, bodyText) {
  pendingDeleteId   = id;
  pendingDeleteType = type;
  document.getElementById('deleteModalTitle').textContent = titleText || 'Hapus Item';
  document.getElementById('deleteModalText').textContent  = bodyText  || 'Yakin ingin menghapus item ini? Tindakan tidak dapat dibatalkan.';
  document.getElementById('deleteModal').classList.add('show');
}

function closeDeleteModal() {
  pendingDeleteId = pendingDeleteType = null;
  document.getElementById('deleteModal').classList.remove('show');
}

function confirmDelete() {
  if (pendingDeleteType === 'profile') {
    profiles = profiles.filter(p => p.id !== pendingDeleteId);
    saveData(profiles);
    showToast('Profil berhasil dihapus.');
  } else if (pendingDeleteType === 'artikel') {
    artikels = artikels.filter(a => a.id !== pendingDeleteId);
    saveArtikelData(artikels);
    showToast('Artikel berhasil dihapus.');
  } else if (pendingDeleteType === 'porto') {
    portos = portos.filter(p => p.id !== pendingDeleteId);
    savePortoData(portos);
    showToast('Portofolio berhasil dihapus.');
  }
  closeDeleteModal();
  goBack();
}

/* ===================================================
   COVER IMAGE UPLOAD (shared)
=================================================== */
function handleCoverUpload(evt, previewId, hiddenId) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    document.getElementById(hiddenId).value = src;
    document.getElementById(previewId).innerHTML = '<img src="' + src + '" alt="cover" />';
  };
  reader.readAsDataURL(file);
}

function setCoverPreview(previewId, hiddenId, src) {
  document.getElementById(hiddenId).value = src || '';
  const el = document.getElementById(previewId);
  el.innerHTML = src
    ? '<img src="' + src + '" alt="cover" />'
    : '<span class="cover-placeholder">🖼️&nbsp; Klik untuk unggah gambar cover</span>';
}

/* ===================================================
   ARTIKEL — LIST
=================================================== */
function renderArtikelList() {
  const q     = document.getElementById('artikelSearchInput').value.toLowerCase();
  const list  = document.getElementById('artikelList');
  const empty = document.getElementById('artikelEmptyState');
  const filtered = artikels.filter(a =>
    a.title.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q)
  );
  if (!filtered.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(a => {
    const cover   = a.cover ? '<img src="' + a.cover + '" alt="cover" />' : '<span style="font-size:2.5rem">📰</span>';
    const excerpt = (a.content || '').replace(/\n/g, ' ').slice(0, 140) + ((a.content || '').length > 140 ? '…' : '');
    const tags    = (a.tags || '').split(',').filter(t => t.trim()).map(t => '<span class="item-tag">' + esc(t.trim()) + '</span>').join('');
    const catBadge = a.category ? '<span class="item-category">' + esc(a.category) + '</span>' : '';
    const meta    = [a.author, a.date ? formatDate(a.date) : ''].filter(Boolean).join(' · ');
    const adminBtns = isLoggedIn
      ? '<div class="card-actions-col" onclick="event.stopPropagation()">'
        + '<button class="btn-icon edit" title="Edit" onclick="showArtikelForm(\'' + a.id + '\')">&#9998;</button>'
        + '<button class="btn-icon del" title="Hapus" onclick="openDeleteModal(\'' + a.id + '\',\'artikel\',\'Hapus Artikel\',\'Yakin ingin menghapus artikel ini?\')">&#128465;</button>'
        + '</div>'
      : '';
    return '<div class="artikel-card" onclick="viewArtikel(\'' + a.id + '\')">'
      + '<div class="artikel-card-cover">' + cover + '</div>'
      + '<div class="artikel-card-body">'
      + '<div>' + catBadge + '</div>'
      + '<div class="artikel-card-title">' + esc(a.title) + '</div>'
      + '<div class="artikel-card-excerpt">' + esc(excerpt) + '</div>'
      + '<div>' + tags + '</div>'
      + '<div class="artikel-card-meta">' + esc(meta) + '</div>'
      + '</div>'
      + adminBtns
      + '</div>';
  }).join('');
}

/* ===================================================
   ARTIKEL — FORM
=================================================== */
function showArtikelForm(id) {
  if (!isLoggedIn) {
    loginCallback = () => showArtikelForm(id);
    showLoginModal();
    return;
  }
  document.getElementById('artikelForm').reset();
  document.getElementById('a_editId').value = '';
  setCoverPreview('artikelCoverPreview', 'a_coverData', null);
  if (id) {
    const a = artikels.find(x => x.id === id);
    if (!a) return;
    document.getElementById('artikelFormTitle').textContent = 'Edit Artikel';
    document.getElementById('a_editId').value   = a.id;
    document.getElementById('a_title').value    = a.title    || '';
    document.getElementById('a_category').value = a.category || '';
    document.getElementById('a_author').value   = a.author   || '';
    document.getElementById('a_date').value     = a.date     || '';
    document.getElementById('a_content').value  = a.content  || '';
    document.getElementById('a_tags').value     = a.tags     || '';
    setCoverPreview('artikelCoverPreview', 'a_coverData', a.cover || null);
  } else {
    document.getElementById('artikelFormTitle').textContent = 'Tulis Artikel Baru';
    document.getElementById('a_date').value = new Date().toISOString().split('T')[0];
  }
  showView('viewArtikelForm');
}

function saveArtikel(e) {
  e.preventDefault();
  const editId = document.getElementById('a_editId').value;
  const id = editId || crypto.randomUUID();
  const artikel = {
    id,
    title:    document.getElementById('a_title').value.trim(),
    category: document.getElementById('a_category').value.trim(),
    author:   document.getElementById('a_author').value.trim(),
    date:     document.getElementById('a_date').value,
    content:  document.getElementById('a_content').value.trim(),
    tags:     document.getElementById('a_tags').value.trim(),
    cover:    document.getElementById('a_coverData').value || null,
  };
  const idx = artikels.findIndex(a => a.id === id);
  if (idx >= 0) { artikels[idx] = { ...artikels[idx], ...artikel }; }
  else { artikels.push(artikel); }
  saveArtikelData(artikels);
  showToast(idx >= 0 ? 'Artikel berhasil diperbarui!' : 'Artikel berhasil disimpan!');
  goBack();
}

/* ===================================================
   ARTIKEL — DETAIL
=================================================== */
function viewArtikel(id) {
  const a = artikels.find(x => x.id === id);
  if (!a) return;
  const coverHtml = a.cover ? '<div class="detail-cover"><img src="' + a.cover + '" alt="cover" /></div>' : '';
  const tags = (a.tags || '').split(',').filter(t => t.trim()).map(t => '<span class="item-tag">' + esc(t.trim()) + '</span>').join('');
  const metaParts = [
    a.author   ? '<strong>' + esc(a.author) + '</strong>' : '',
    a.category ? esc(a.category) : '',
    a.date     ? formatDate(a.date) : '',
  ].filter(Boolean);
  const adminBtns = isLoggedIn
    ? '<button class="btn-primary" onclick="showArtikelForm(\'' + a.id + '\')">&#9998; Edit</button>'
      + '<button class="btn-danger" onclick="openDeleteModal(\'' + a.id + '\',\'artikel\',\'Hapus Artikel\',\'Yakin ingin menghapus artikel ini?\')">&#128465; Hapus</button>'
    : '';
  document.getElementById('artikelDetailPage').innerHTML =
    coverHtml
    + '<div class="detail-body">'
    + (a.category ? '<div class="detail-category">' + esc(a.category) + '</div>' : '')
    + '<h1 class="detail-title">' + esc(a.title) + '</h1>'
    + '<div class="detail-meta">' + metaParts.join(' &middot; ') + '</div>'
    + '<div class="detail-content">' + esc(a.content) + '</div>'
    + (tags ? '<div class="detail-tags">' + tags + '</div>' : '')
    + '<div class="prof-actions">'
    + '<button class="btn-secondary" onclick="goBack()">&#8592; Kembali</button>'
    + adminBtns
    + '</div></div>';
  showView('viewArtikelDetail');
}

/* ===================================================
   PORTOFOLIO — LIST
=================================================== */
function renderPortofolioList() {
  const q     = document.getElementById('portoSearchInput').value.toLowerCase();
  const list  = document.getElementById('portoList');
  const empty = document.getElementById('portoEmptyState');
  const filtered = portos.filter(p =>
    p.title.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
  );
  if (!filtered.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(p => {
    const cover  = p.cover ? '<img src="' + p.cover + '" alt="cover" />' : '<span style="font-size:3rem">💼</span>';
    const techs  = (p.technologies || '').split(',').filter(t => t.trim()).slice(0, 4).map(t => '<span class="tech-badge">' + esc(t.trim()) + '</span>').join('');
    const meta   = [p.year, p.client].filter(Boolean).join(' · ');
    const adminBtns = isLoggedIn
      ? '<div class="porto-card-actions" onclick="event.stopPropagation()">'
        + '<button class="btn-icon edit" title="Edit" onclick="showPortofolioForm(\'' + p.id + '\')">&#9998;</button>'
        + '<button class="btn-icon del" title="Hapus" onclick="openDeleteModal(\'' + p.id + '\',\'porto\',\'Hapus Portofolio\',\'Yakin ingin menghapus portofolio ini?\')">&#128465;</button>'
        + '</div>'
      : '';
    return '<div class="porto-card" onclick="viewPortofolio(\'' + p.id + '\')">'
      + '<div class="porto-card-cover">' + cover + '</div>'
      + '<div class="porto-card-body">'
      + (p.category ? '<div class="porto-card-category">' + esc(p.category) + '</div>' : '')
      + '<div class="porto-card-title">' + esc(p.title) + '</div>'
      + (meta ? '<div class="porto-card-meta">' + esc(meta) + '</div>' : '')
      + (techs ? '<div>' + techs + '</div>' : '')
      + '</div>'
      + adminBtns
      + '</div>';
  }).join('');
}

/* ===================================================
   PORTOFOLIO — FORM
=================================================== */
function showPortofolioForm(id) {
  if (!isLoggedIn) {
    loginCallback = () => showPortofolioForm(id);
    showLoginModal();
    return;
  }
  document.getElementById('portofolioForm').reset();
  document.getElementById('p_editId').value = '';
  setCoverPreview('portoCoverPreview', 'p_coverData', null);
  if (id) {
    const p = portos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('portoFormTitle').textContent    = 'Edit Portofolio';
    document.getElementById('p_editId').value       = p.id;
    document.getElementById('p_title').value        = p.title        || '';
    document.getElementById('p_category').value     = p.category     || '';
    document.getElementById('p_year').value         = p.year         || '';
    document.getElementById('p_client').value       = p.client       || '';
    document.getElementById('p_role').value         = p.role         || '';
    document.getElementById('p_url').value          = p.url          || '';
    document.getElementById('p_description').value  = p.description  || '';
    document.getElementById('p_technologies').value = p.technologies || '';
    setCoverPreview('portoCoverPreview', 'p_coverData', p.cover || null);
  } else {
    document.getElementById('portoFormTitle').textContent = 'Tambah Portofolio Baru';
  }
  showView('viewPortofolioForm');
}

function savePortofolio(e) {
  e.preventDefault();
  const editId = document.getElementById('p_editId').value;
  const id = editId || crypto.randomUUID();
  const porto = {
    id,
    title:        document.getElementById('p_title').value.trim(),
    category:     document.getElementById('p_category').value.trim(),
    year:         document.getElementById('p_year').value.trim(),
    client:       document.getElementById('p_client').value.trim(),
    role:         document.getElementById('p_role').value.trim(),
    url:          document.getElementById('p_url').value.trim(),
    description:  document.getElementById('p_description').value.trim(),
    technologies: document.getElementById('p_technologies').value.trim(),
    cover:        document.getElementById('p_coverData').value || null,
  };
  const idx = portos.findIndex(p => p.id === id);
  if (idx >= 0) { portos[idx] = { ...portos[idx], ...porto }; }
  else { portos.push(porto); }
  savePortoData(portos);
  showToast(idx >= 0 ? 'Portofolio berhasil diperbarui!' : 'Portofolio berhasil disimpan!');
  goBack();
}

/* ===================================================
   PORTOFOLIO — DETAIL
=================================================== */
function viewPortofolio(id) {
  const p = portos.find(x => x.id === id);
  if (!p) return;
  const coverHtml = p.cover
    ? '<div class="detail-cover"><img src="' + p.cover + '" alt="cover" /></div>'
    : '<div class="detail-cover-placeholder">💼</div>';
  const techs   = (p.technologies || '').split(',').filter(t => t.trim()).map(t => '<span class="tech-badge tech-badge--lg">' + esc(t.trim()) + '</span>').join('');
  const safeUrl = p.url && /^https?:\/\//i.test(p.url) ? p.url : null;
  const infoRows = [
    ['Kategori',    p.category ? esc(p.category) : null],
    ['Tahun',       p.year     ? esc(p.year)     : null],
    ['Klien',       p.client   ? esc(p.client)   : null],
    ['Peran',       p.role     ? esc(p.role)     : null],
    ['Link Proyek', safeUrl    ? '<a href="' + esc(safeUrl) + '" target="_blank" rel="noopener">' + esc(safeUrl) + '</a>' : null],
  ].filter(([, v]) => v);
  const infoHtml = infoRows.map(([label, val]) =>
    '<div class="porto-info-row"><span class="porto-info-label">' + label + '</span><span class="porto-info-val">' + val + '</span></div>'
  ).join('');
  const adminBtns = isLoggedIn
    ? '<button class="btn-primary" onclick="showPortofolioForm(\'' + p.id + '\')">&#9998; Edit</button>'
      + '<button class="btn-danger" onclick="openDeleteModal(\'' + p.id + '\',\'porto\',\'Hapus Portofolio\',\'Yakin ingin menghapus portofolio ini?\')">&#128465; Hapus</button>'
    : '';
  document.getElementById('portoDetailPage').innerHTML =
    coverHtml
    + '<div class="detail-body">'
    + (p.category ? '<div class="detail-category">' + esc(p.category) + '</div>' : '')
    + '<h1 class="detail-title">' + esc(p.title) + '</h1>'
    + (infoHtml ? '<div class="porto-info-grid">' + infoHtml + '</div>' : '')
    + '<div class="detail-content">' + esc(p.description) + '</div>'
    + (techs ? '<div style="margin-top:20px"><div class="porto-info-label" style="margin-bottom:8px">Teknologi</div>' + techs + '</div>' : '')
    + '<div class="prof-actions">'
    + '<button class="btn-secondary" onclick="goBack()">&#8592; Kembali</button>'
    + adminBtns
    + '</div></div>';
  showView('viewPortofolioDetail');
}

/* ===================================================
   INDIVIDUAL PROFILE — DASHBOARD
=================================================== */
function renderList() {
  const q     = document.getElementById('searchInput').value.toLowerCase();
  const list  = document.getElementById('profileList');
  const empty = document.getElementById('emptyState');
  const filtered = profiles.filter(p =>
    p.npk.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );
  if (filtered.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(p => {
    const initials = p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatar   = p.photo ? '<img src="' + p.photo + '" alt="' + esc(p.name) + '" />' : initials;
    return '<div class="profile-card" onclick="viewProfile(\'' + p.id + '\')">'
      + '<div class="avatar">' + avatar + '</div>'
      + '<div class="info">'
      + '<div class="npk">NPK: ' + esc(p.npk) + '</div>'
      + '<div class="name">' + esc(p.name) + '</div>'
      + '<div class="sub">' + esc(p.jobTitle || '') + (p.jobTitle && p.company ? ' — ' : '') + esc(p.company || '') + '</div>'
      + '</div>'
      + '<div class="card-actions" onclick="event.stopPropagation()">'
      + '<button class="btn-icon edit" title="Edit" onclick="editProfile(\'' + p.id + '\')">&#9998;</button>'
      + '<button class="btn-icon del" title="Hapus" onclick="openDeleteModal(\'' + p.id + '\',\'profile\',\'Hapus Profil\',\'Yakin ingin menghapus profil ini? Tindakan tidak dapat dibatalkan.\')">&#128465;</button>'
      + '</div></div>';
  }).join('');
}

/* ===================================================
   INDIVIDUAL PROFILE — FORM
=================================================== */
function showForm(id) {
  if (!isLoggedIn) {
    loginCallback = () => showForm(id);
    showLoginModal();
    return;
  }
  resetForm();
  if (id) {
    const p = profiles.find(x => x.id === id);
    if (!p) return;
    document.getElementById('formTitleBar').textContent  = 'Edit Individual Profile';
    document.getElementById('editId').value              = p.id;
    document.getElementById('f_npk').value              = p.npk           || '';
    document.getElementById('f_name').value             = p.name          || '';
    document.getElementById('f_dob').value              = p.dob           || '';
    document.getElementById('f_jobTitle').value         = p.jobTitle      || '';
    document.getElementById('f_company').value          = p.company       || '';
    document.getElementById('f_grade').value            = p.grade         || '';
    document.getElementById('f_hav').value              = p.hav           || '';
    document.getElementById('f_promotionDate').value    = p.promotionDate || '';
    document.getElementById('f_pa2023').value           = p.pa2023        || '';
    document.getElementById('f_pa2024').value           = p.pa2024        || '';
    document.getElementById('f_pa2025').value           = p.pa2025        || '';
    document.getElementById('f_strength').value         = p.strength      || '';
    document.getElementById('f_afd').value              = p.afd           || '';
    if (p.photo) setPhotoPreview(p.photo);
    (p.edu      || []).forEach(r => addRow('edu',      r));
    (p.training || []).forEach(r => addRow('training', r));
    (p.others   || []).forEach(r => addRow('others',   r));
    (p.work     || []).forEach(r => addRow('work',     r));
    (p.idp      || []).forEach(r => addRow('idp',      r));
  } else {
    document.getElementById('formTitleBar').textContent = 'Input Individual Profile';
    addRow('edu'); addRow('training'); addRow('others'); addRow('work'); addRow('idp');
  }
  showView('viewForm');
}

function editProfile(id) { showForm(id); }

function resetForm() {
  document.getElementById('profileForm').reset();
  document.getElementById('editId').value = '';
  ['edu','training','others','work','idp'].forEach(t => {
    document.getElementById(t + 'Body').innerHTML = '';
  });
  setPhotoPreview(null);
}

/* ===================================================
   DYNAMIC TABLE ROWS
=================================================== */
const rowConfigs = {
  edu:      { body: 'eduBody',      fields: ['year','grade','institution'] },
  training: { body: 'trainingBody', fields: ['year','aldp','ict'] },
  others:   { body: 'othersBody',   fields: ['training','year','vendor'] },
  work:     { body: 'workBody',     fields: ['year','position','company'] },
  idp:      { body: 'idpBody',      fields: ['devArea','devProgram','devTarget','dueDate'] },
};

function addRow(type, data) {
  data = data || {};
  const cfg   = rowConfigs[type];
  const tbody = document.getElementById(cfg.body);
  const tr    = document.createElement('tr');
  cfg.fields.map(f => {
    const td  = document.createElement('td');
    const inp = document.createElement('input');
    inp.type  = f === 'dueDate' ? 'date' : 'text';
    inp.dataset.field = f;
    inp.value = data[f] || '';
    td.appendChild(inp);
    return td;
  }).forEach(td => tr.appendChild(td));
  const tdDel = document.createElement('td');
  tdDel.innerHTML = '<button type="button" class="btn-rm" onclick="this.closest(\'tr\').remove()">&#215;</button>';
  tr.appendChild(tdDel);
  tbody.appendChild(tr);
}

function collectRows(type) {
  const cfg   = rowConfigs[type];
  const tbody = document.getElementById(cfg.body);
  return Array.from(tbody.querySelectorAll('tr')).map(tr => {
    const obj = {};
    cfg.fields.forEach(f => {
      const inp = tr.querySelector('input[data-field="' + f + '"]');
      obj[f] = inp ? inp.value : '';
    });
    return obj;
  }).filter(r => Object.values(r).some(v => v.trim()));
}

/* ===================================================
   PHOTO (profile)
=================================================== */
function handlePhoto(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => setPhotoPreview(e.target.result);
  reader.readAsDataURL(file);
}

function setPhotoPreview(src) {
  const el = document.getElementById('photoPreview');
  if (src) {
    el.innerHTML = '<img src="' + src + '" alt="foto" />';
    el.dataset.b64 = src;
  } else {
    el.innerHTML = '<div class="placeholder">FOTO<br><small>Klik untuk unggah</small></div>';
    delete el.dataset.b64;
  }
}

/* ===================================================
   SAVE PROFILE
=================================================== */
function saveProfile(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value || crypto.randomUUID();
  const profile = {
    id,
    npk:           document.getElementById('f_npk').value.trim(),
    name:          document.getElementById('f_name').value.trim(),
    dob:           document.getElementById('f_dob').value,
    jobTitle:      document.getElementById('f_jobTitle').value.trim(),
    company:       document.getElementById('f_company').value.trim(),
    grade:         document.getElementById('f_grade').value.trim(),
    hav:           document.getElementById('f_hav').value.trim(),
    promotionDate: document.getElementById('f_promotionDate').value,
    pa2023:        document.getElementById('f_pa2023').value.trim(),
    pa2024:        document.getElementById('f_pa2024').value.trim(),
    pa2025:        document.getElementById('f_pa2025').value.trim(),
    strength:      document.getElementById('f_strength').value.trim(),
    afd:           document.getElementById('f_afd').value.trim(),
    photo:         document.getElementById('photoPreview').dataset.b64 || null,
    edu:           collectRows('edu'),
    training:      collectRows('training'),
    others:        collectRows('others'),
    work:          collectRows('work'),
    idp:           collectRows('idp'),
  };
  const idx = profiles.findIndex(p => p.id === id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  saveData(profiles);
  showToast(idx >= 0 ? 'Profil berhasil diperbarui!' : 'Profil berhasil disimpan!');
  goBack();
}

/* ===================================================
   PROFILE VIEW
=================================================== */
function viewProfile(id) {
  currentProfileId = id;
  const p = profiles.find(x => x.id === id);
  if (!p) return;

  const dobStr  = p.dob ? formatDate(p.dob) : '-';
  const age     = p.dob ? calcAge(p.dob) : '-';
  const promStr = p.promotionDate ? formatDate(p.promotionDate) : '-';
  const photoHtml = p.photo
    ? '<img src="' + p.photo + '" alt="foto" />'
    : '<span style="color:#a8c4bc;font-size:.8rem">FOTO</span>';

  function tr(rows, fields) {
    if (!rows || rows.length === 0)
      return '<tr><td colspan="' + fields.length + '" style="text-align:center;color:#a8c4bc;font-size:.82rem;padding:10px">-</td></tr>';
    return rows.map(r =>
      '<tr>' + fields.map(f => '<td>' + esc(r[f] || '') + '</td>').join('') + '</tr>'
    ).join('');
  }

  var html = ''
    + '<div class="profile-header-bar">'
    +   '<div style="display:flex;align-items:center;gap:10px">'
    +     '<div style="background:#fffaf5;color:#00695c;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0"><svg viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block"><ellipse cx="23" cy="31" rx="18" ry="15" fill="#00695c"/><circle cx="23" cy="17" r="13" fill="#00695c"/><ellipse cx="23" cy="20.5" rx="8.5" ry="9.5" fill="#f5c09a"/><ellipse cx="23" cy="9" rx="8.5" ry="5" fill="#00695c"/><circle cx="19.5" cy="19.5" r="1.7" fill="#1a0a00"/><circle cx="26.5" cy="19.5" r="1.7" fill="#1a0a00"/><circle cx="20.2" cy="18.8" r="0.55" fill="#fff"/><circle cx="27.2" cy="18.8" r="0.55" fill="#fff"/><path d="M20 24.5 Q23 27.5 26 24.5" stroke="#b06040" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg></div>'
    +     '<span class="logo-text">Ayu Fitriah</span>'
    +   '</div>'
    +   '<span class="prof-title">Individual Profile</span>'
    + '</div>'
    + '<div class="profile-content">'
    +   '<div class="prof-outer-layout">'
    +     '<div>'
    +       '<div class="prof-top">'
    +         '<div><div class="prof-info-grid">'
    +           '<span class="prof-label">Name</span><span class="prof-colon">: <strong>' + esc(p.name) + '</strong></span>'
    +           '<span class="prof-label">Date of Birth / Age</span><span class="prof-colon">: ' + dobStr + ' / ' + age + '</span>'
    +           '<span class="prof-label">Job Title</span><span class="prof-colon">: ' + esc(p.jobTitle || '-') + '</span>'
    +           '<span class="prof-label">Company</span><span class="prof-colon">: ' + esc(p.company || '-') + '</span>'
    +           '<span class="prof-label">Grade / HAV</span><span class="prof-colon">: ' + esc(p.grade || '-') + ' / ' + esc(p.hav || '-') + '</span>'
    +           '<span class="prof-label">Promotion date</span><span class="prof-colon">: ' + promStr + '</span>'
    +           '<span class="prof-label">PA History</span>'
    +           '<span class="prof-colon">:<div class="pa-display" style="margin-top:4px"><div class="pa-cell head">2023</div><div class="pa-cell head">2024</div><div class="pa-cell head">2025</div></div>'
    +           '<div class="pa-display"><div class="pa-cell">' + esc(p.pa2023||'-') + '</div><div class="pa-cell">' + esc(p.pa2024||'-') + '</div><div class="pa-cell">' + esc(p.pa2025||'-') + '</div></div></span>'
    +         '</div></div>'
    +         '<div class="prof-photo">' + photoHtml + '</div>'
    +       '</div>'
    +       '<div class="prof-section"><div class="prof-sec-title">Educational Background</div>'
    +         '<table class="prof-table"><thead><tr><th>Year</th><th>Grade</th><th>Institution, Major</th></tr></thead>'
    +         '<tbody>' + tr(p.edu, ['year','grade','institution']) + '</tbody></table></div>'
    +       '<div class="prof-section"><div class="prof-sec-title">Training</div>'
    +         '<table class="prof-table"><thead><tr><th>Year</th><th>Astra Leadership Dev Prog</th><th>ICT/Project/Total</th></tr></thead>'
    +         '<tbody>' + tr(p.training, ['year','aldp','ict']) + '</tbody></table></div>'
    +       '<div class="prof-section"><div class="prof-sec-title">Others (during past 5 years)</div>'
    +         '<table class="prof-table"><thead><tr><th>Training</th><th>Year</th><th>Vendor</th></tr></thead>'
    +         '<tbody>' + tr(p.others, ['training','year','vendor']) + '</tbody></table></div>'
    +       '<div class="prof-section"><div class="prof-sec-title">Working Experience</div>'
    +         '<table class="prof-table"><thead><tr><th>Year</th><th>Position</th><th>Company</th></tr></thead>'
    +         '<tbody>' + tr(p.work, ['year','position','company']) + '</tbody></table></div>'
    +     '</div>'
    +     '<div class="right-sections">'
    +       '<div class="right-box"><div class="right-box-title">Strength</div><div class="right-box-body">' + esc(p.strength||'-') + '</div></div>'
    +       '<div class="right-box"><div class="right-box-title">Areas for Development</div><div class="right-box-body">' + esc(p.afd||'-') + '</div></div>'
    +       '<div class="right-box"><div class="right-box-title">Individual Development Plan</div>'
    +         '<table class="prof-table"><thead><tr><th>Development Area</th><th>Development Program</th><th>Development Target</th><th>Due Date</th></tr></thead>'
    +         '<tbody>' + tr(p.idp, ['devArea','devProgram','devTarget','dueDate']) + '</tbody></table></div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="prof-actions">'
    +     '<button class="btn-secondary" onclick="goBack()">&#8592; Kembali</button>'
    +     '<button class="btn-primary" onclick="editProfile(\'' + p.id + '\')">&#9998; Edit</button>'
    +     '<button class="btn-danger" onclick="openDeleteModal(\'' + p.id + '\',\'profile\',\'Hapus Profil\',\'Yakin ingin menghapus profil ini?\')">&#128465; Hapus</button>'
    +     '<button class="btn-primary" onclick="window.print()">&#128196; Export PDF</button>'
    +   '</div>'
    + '</div>';

  document.getElementById('profilePage').innerHTML = html;
  showView('viewProfile');
}

/* ===================================================
   UTILS
=================================================== */
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return d + ' ' + months[+m - 1] + ' ' + y;
}
function calcAge(iso) {
  const dob = new Date(iso), today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age + ' thn';
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* ===================================================
   INIT
=================================================== */
renderArtikelList();
