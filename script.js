/* ===================================================
   API & AUTH LAYER
=================================================== */
const TOKEN_KEY = 'ao_token_v1';

function getToken()      { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)     { localStorage.setItem(TOKEN_KEY, t); }
function removeToken()   { localStorage.removeItem(TOKEN_KEY); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'Server error');
  }
  return res.json();
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const token = getToken();
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload gagal' }));
    throw new Error(err.error || 'Upload gagal');
  }
  const data = await res.json();
  return data.url;
}

let profiles = [];
let artikels  = [];
let portos    = [];

let pendingDeleteId   = null;
let pendingDeleteType = null;
let currentProfileId  = null;
let currentSection    = 'artikel';
let isLoggedIn        = false;
let loginCallback     = null;

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
  if (currentSection === 'artikel')         { history.pushState(null, '', window.location.pathname); renderArtikelList();    showView('viewArtikelList'); }
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

async function doLogin(e) {
  e.preventDefault();
  const u   = document.getElementById('loginUsername').value.trim();
  const p   = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p }),
    });
    setToken(data.token);
    isLoggedIn = true;
    document.body.classList.add('admin-logged-in');
    updateAuthButton();
    closeLoginModal();
    showToast('Selamat datang, Admin!');

    const profileData = await apiFetch('/api/profiles');
    profiles = profileData;

    if (loginCallback) {
      const cb = loginCallback;
      loginCallback = null;
      cb();
    } else {
      rerenderCurrentSection();
    }
  } catch (e) {
    err.textContent = e.message || 'Username atau password salah.';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    const card = document.querySelector('#loginModal .login-card');
    card.classList.add('login-shake');
    setTimeout(() => card.classList.remove('login-shake'), 500);
  }
}

function doLogout() {
  removeToken();
  isLoggedIn = false;
  profiles = [];
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

function togglePassword() { togglePwField('loginPassword'); }

function togglePwField(id) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

/* ===================================================
   LUPA PASSWORD
=================================================== */
function showForgotPasswordModal() {
  closeLoginModal();
  document.getElementById('forgotPasswordForm').reset();
  document.getElementById('fpError').textContent = '';
  document.getElementById('fpSuccess').classList.remove('show');
  document.getElementById('fpSubmitBtn').disabled = false;
  document.getElementById('forgotPasswordModal').classList.add('show');
  setTimeout(() => document.getElementById('fpUsername').focus(), 100);
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.remove('show');
  document.getElementById('forgotPasswordForm').reset();
  document.getElementById('fpError').textContent = '';
  document.getElementById('fpSuccess').classList.remove('show');
  document.getElementById('fpSubmitBtn').disabled = false;
}

async function doForgotPassword(e) {
  e.preventDefault();
  const username = document.getElementById('fpUsername').value.trim();
  const errEl    = document.getElementById('fpError');
  const succEl   = document.getElementById('fpSuccess');
  const btn      = document.getElementById('fpSubmitBtn');
  errEl.textContent = '';
  succEl.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';
  try {
    const data = await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    succEl.textContent = '✓ ' + data.message;
    succEl.classList.add('show');
    btn.textContent = 'Terkirim';
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = '✉ Kirim Link Reset';
  }
}

/* ===================================================
   RESET PASSWORD (dari link email)
=================================================== */
function showResetPasswordModal(token) {
  document.getElementById('resetToken').value = token;
  document.getElementById('resetPasswordForm').reset();
  document.getElementById('rpError').textContent = '';
  document.getElementById('resetPasswordModal').classList.add('show');
}

async function doResetPassword(e) {
  e.preventDefault();
  const token      = document.getElementById('resetToken').value;
  const newPw      = document.getElementById('rpNew').value;
  const confirm    = document.getElementById('rpConfirm').value;
  const errEl      = document.getElementById('rpError');
  errEl.textContent = '';
  if (newPw !== confirm) {
    errEl.textContent = 'Konfirmasi password tidak cocok.';
    document.getElementById('rpConfirm').value = '';
    return;
  }
  try {
    const data = await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword: newPw }),
    });
    document.getElementById('resetPasswordModal').classList.remove('show');
    history.replaceState(null, '', window.location.pathname);
    showToast('✓ ' + data.message);
    setTimeout(() => showLoginModal(), 800);
  } catch (err) {
    errEl.textContent = err.message;
  }
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

async function doChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('cpCurrent').value;
  const newPw   = document.getElementById('cpNew').value;
  const confirm = document.getElementById('cpConfirm').value;
  const err     = document.getElementById('cpError');

  if (newPw !== confirm) {
    err.textContent = 'Konfirmasi password tidak cocok.';
    document.getElementById('cpConfirm').value = '';
    document.getElementById('cpConfirm').focus();
    return;
  }
  try {
    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
    });
    closeChangePasswordModal();
    showToast('Password berhasil diubah!');
  } catch (e) {
    err.textContent = e.message;
    document.getElementById('cpCurrent').value = '';
    document.getElementById('cpCurrent').focus();
  }
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

async function confirmDelete() {
  try {
    if (pendingDeleteType === 'profile') {
      await apiFetch('/api/profiles/' + pendingDeleteId, { method: 'DELETE' });
      profiles = profiles.filter(p => p.id !== pendingDeleteId);
      showToast('Profil berhasil dihapus.');
    } else if (pendingDeleteType === 'artikel') {
      await apiFetch('/api/artikels/' + pendingDeleteId, { method: 'DELETE' });
      artikels = artikels.filter(a => a.id !== pendingDeleteId);
      showToast('Artikel berhasil dihapus.');
    } else if (pendingDeleteType === 'porto') {
      await apiFetch('/api/portos/' + pendingDeleteId, { method: 'DELETE' });
      portos = portos.filter(p => p.id !== pendingDeleteId);
      showToast('Portofolio berhasil dihapus.');
    }
  } catch (e) {
    showToast('Gagal menghapus: ' + e.message);
  }
  closeDeleteModal();
  goBack();
}

/* ===================================================
   COVER IMAGE UPLOAD (shared)
=================================================== */
async function handleCoverUpload(evt, previewId, hiddenId) {
  const file = evt.target.files[0];
  if (!file) return;
  try {
    const url = await uploadImage(file);
    document.getElementById(hiddenId).value = url;
    document.getElementById(previewId).innerHTML = '<img src="' + url + '" alt="cover" />';
  } catch (e) {
    showToast('Gagal upload gambar: ' + e.message);
  }
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

async function saveArtikel(e) {
  e.preventDefault();
  const editId = document.getElementById('a_editId').value;
  const payload = {
    title:    document.getElementById('a_title').value.trim(),
    category: document.getElementById('a_category').value.trim(),
    author:   document.getElementById('a_author').value.trim(),
    date:     document.getElementById('a_date').value || null,
    content:  document.getElementById('a_content').value.trim(),
    tags:     document.getElementById('a_tags').value.trim(),
    cover:    document.getElementById('a_coverData').value || null,
  };
  try {
    if (editId) {
      const updated = await apiFetch('/api/artikels/' + editId, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = artikels.findIndex(a => a.id === editId);
      if (idx >= 0) artikels[idx] = updated;
      showToast('Artikel berhasil diperbarui!');
    } else {
      const created = await apiFetch('/api/artikels', { method: 'POST', body: JSON.stringify(payload) });
      artikels.unshift(created);
      showToast('Artikel berhasil disimpan!');
    }
    goBack();
  } catch (e) {
    showToast('Gagal menyimpan artikel: ' + e.message);
  }
}

/* ===================================================
   ARTIKEL — DETAIL
=================================================== */
function viewArtikel(id) {
  const a = artikels.find(x => String(x.id) === String(id));
  if (!a) return;
  history.pushState(null, '', '#artikel-' + a.id);
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
  const sid = String(a.id);
  const shareSection =
    '<div class="share-section">'
    + '<div class="share-label">Bagikan Artikel</div>'
    + '<div class="share-buttons">'
    + '<button class="share-btn share-wa"      onclick="shareArtikel(\'whatsapp\',\'' + sid + '\')"><span class="share-icon">&#128241;</span>WhatsApp</button>'
    + '<button class="share-btn share-x"       onclick="shareArtikel(\'x\',\''        + sid + '\')"><span class="share-icon">&#120143;</span>X</button>'
    + '<button class="share-btn share-threads" onclick="shareArtikel(\'threads\',\''  + sid + '\')"><span class="share-icon">&#64;</span>Threads</button>'
    + '<button class="share-btn share-ig"      onclick="shareArtikel(\'instagram\',\''+ sid + '\')"><span class="share-icon">&#128247;</span>Instagram</button>'
    + '<button class="share-btn share-tiktok"  onclick="shareArtikel(\'tiktok\',\''   + sid + '\')"><span class="share-icon">&#9835;</span>TikTok</button>'
    + '<button class="share-btn share-copy"    onclick="shareArtikel(\'copy\',\''     + sid + '\')"><span class="share-icon">&#128279;</span>Salin Link</button>'
    + '</div></div>';
  document.getElementById('artikelDetailPage').innerHTML =
    coverHtml
    + '<div class="detail-body">'
    + (a.category ? '<div class="detail-category">' + esc(a.category) + '</div>' : '')
    + '<h1 class="detail-title">' + esc(a.title) + '</h1>'
    + '<div class="detail-meta">' + metaParts.join(' &middot; ') + '</div>'
    + '<div class="detail-content">' + esc(a.content) + '</div>'
    + (tags ? '<div class="detail-tags">' + tags + '</div>' : '')
    + shareSection
    + '<div class="prof-actions">'
    + '<button class="btn-secondary" onclick="goBack()">&#8592; Kembali</button>'
    + adminBtns
    + '</div></div>';
  showView('viewArtikelDetail');
}

/* ===================================================
   SHARE ARTIKEL
=================================================== */
function shareArtikel(platform, articleId) {
  const a = artikels.find(x => String(x.id) === String(articleId));
  if (!a) return;
  const url  = window.location.origin + window.location.pathname + '#artikel-' + articleId;
  const title = a.title;
  const text  = title + '\n' + url;

  function copyToClipboard(str, toastMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(() => showToast(toastMsg)).catch(() => legacyCopy(str, toastMsg));
    } else {
      legacyCopy(str, toastMsg);
    }
  }
  function legacyCopy(str, toastMsg) {
    const ta = document.createElement('textarea');
    ta.value = str; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(toastMsg); } catch { showToast('Salin link: ' + str); }
    document.body.removeChild(ta);
  }

  switch (platform) {
    case 'whatsapp':
      window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank'); break;
    case 'x':
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url), '_blank'); break;
    case 'threads':
      window.open('https://www.threads.net/intent/post?text=' + encodeURIComponent(text), '_blank'); break;
    case 'instagram':
      copyToClipboard(url, 'Link disalin! Buka Instagram & tempel di caption.'); break;
    case 'tiktok':
      copyToClipboard(url, 'Link disalin! Buka TikTok & tempel di bio/caption.'); break;
    case 'copy':
      copyToClipboard(url, 'Link berhasil disalin!'); break;
  }
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

async function savePortofolio(e) {
  e.preventDefault();
  const editId = document.getElementById('p_editId').value;
  const payload = {
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
  try {
    if (editId) {
      const updated = await apiFetch('/api/portos/' + editId, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = portos.findIndex(p => p.id === editId);
      if (idx >= 0) portos[idx] = updated;
      showToast('Portofolio berhasil diperbarui!');
    } else {
      const created = await apiFetch('/api/portos', { method: 'POST', body: JSON.stringify(payload) });
      portos.unshift(created);
      showToast('Portofolio berhasil disimpan!');
    }
    goBack();
  } catch (e) {
    showToast('Gagal menyimpan portofolio: ' + e.message);
  }
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
async function showForm(id) {
  if (!isLoggedIn) {
    loginCallback = () => showForm(id);
    showLoginModal();
    return;
  }
  resetForm();
  if (id) {
    try {
      const p = await apiFetch('/api/profiles/' + id);
      document.getElementById('formTitleBar').textContent  = 'Edit Individual Profile';
      document.getElementById('editId').value              = p.id;
      document.getElementById('f_npk').value              = p.npk           || '';
      document.getElementById('f_name').value             = p.name          || '';
      document.getElementById('f_dob').value              = p.dob           || '';
      document.getElementById('f_jobTitle').value         = p.jobTitle      || '';
      document.getElementById('f_company').value          = p.company       || '';
      setComboValue('f_grade_sel', 'f_grade_custom', p.grade || '');
      document.getElementById('f_hav').value              = p.hav           || '';
      document.getElementById('f_promotionDate').value    = p.promotionDate || '';
      document.getElementById('f_paYear1').value = p.paYear1 || '2023';
      setComboValue('f_paVal1_sel', 'f_paVal1_custom', p.paVal1 || '');
      document.getElementById('f_paYear2').value = p.paYear2 || '2024';
      setComboValue('f_paVal2_sel', 'f_paVal2_custom', p.paVal2 || '');
      document.getElementById('f_paYear3').value = p.paYear3 || '2025';
      setComboValue('f_paVal3_sel', 'f_paVal3_custom', p.paVal3 || '');
      document.getElementById('f_strength').value         = p.strength      || '';
      document.getElementById('f_afd').value              = p.afd           || '';
      if (p.photo) setPhotoPreview(p.photo);
      (p.edu      || []).forEach(r => addRow('edu',      r));
      (p.training || []).forEach(r => addRow('training', r));
      (p.others   || []).forEach(r => addRow('others',   r));
      (p.work     || []).forEach(r => addRow('work',     r));
      (p.idp      || []).forEach(r => addRow('idp',      r));
    } catch (e) {
      showToast('Gagal memuat profil: ' + e.message);
      return;
    }
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
  ['f_paVal1_custom','f_paVal2_custom','f_paVal3_custom','f_grade_custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.value = ''; }
  });
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
async function handlePhoto(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  try {
    const url = await uploadImage(file);
    setPhotoPreview(url);
  } catch (e) {
    showToast('Gagal upload foto: ' + e.message);
  }
}

function setPhotoPreview(src) {
  const el = document.getElementById('photoPreview');
  if (src) {
    el.innerHTML = '<img src="' + src + '" alt="foto" />';
    el.dataset.src = src;
  } else {
    el.innerHTML = '<div class="placeholder">FOTO<br><small>Klik untuk unggah</small></div>';
    delete el.dataset.src;
  }
}

/* ===================================================
   SAVE PROFILE
=================================================== */
async function saveProfile(e) {
  e.preventDefault();
  const editId = document.getElementById('editId').value;
  const payload = {
    npk:           document.getElementById('f_npk').value.trim(),
    name:          document.getElementById('f_name').value.trim(),
    dob:           document.getElementById('f_dob').value || null,
    jobTitle:      document.getElementById('f_jobTitle').value.trim(),
    company:       document.getElementById('f_company').value.trim(),
    grade:         getComboValue('f_grade_sel', 'f_grade_custom'),
    hav:           document.getElementById('f_hav').value.trim(),
    promotionDate: document.getElementById('f_promotionDate').value || null,
    paYear1:       document.getElementById('f_paYear1').value,
    paVal1:        getComboValue('f_paVal1_sel', 'f_paVal1_custom'),
    paYear2:       document.getElementById('f_paYear2').value,
    paVal2:        getComboValue('f_paVal2_sel', 'f_paVal2_custom'),
    paYear3:       document.getElementById('f_paYear3').value,
    paVal3:        getComboValue('f_paVal3_sel', 'f_paVal3_custom'),
    strength:      document.getElementById('f_strength').value.trim(),
    afd:           document.getElementById('f_afd').value.trim(),
    photo:         document.getElementById('photoPreview').dataset.src || null,
    edu:           collectRows('edu'),
    training:      collectRows('training'),
    others:        collectRows('others'),
    work:          collectRows('work'),
    idp:           collectRows('idp'),
  };
  try {
    if (editId) {
      await apiFetch('/api/profiles/' + editId, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = profiles.findIndex(p => p.id === editId);
      if (idx >= 0) profiles[idx] = { ...profiles[idx], ...payload, id: editId };
      showToast('Profil berhasil diperbarui!');
    } else {
      const created = await apiFetch('/api/profiles', { method: 'POST', body: JSON.stringify(payload) });
      profiles.unshift({ ...payload, id: created.id });
      showToast('Profil berhasil disimpan!');
    }
    goBack();
  } catch (e) {
    showToast('Gagal menyimpan profil: ' + e.message);
  }
}

/* ===================================================
   PROFILE VIEW
=================================================== */
async function viewProfile(id) {
  try {
    const p = await apiFetch('/api/profiles/' + id);
    currentProfileId = id;

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
      +           '<span class="prof-colon">:<div class="pa-display" style="margin-top:4px"><div class="pa-cell head">' + esc(p.paYear1||'2023') + '</div><div class="pa-cell head">' + esc(p.paYear2||'2024') + '</div><div class="pa-cell head">' + esc(p.paYear3||'2025') + '</div></div>'
      +           '<div class="pa-display"><div class="pa-cell">' + esc(p.paVal1||'-') + '</div><div class="pa-cell">' + esc(p.paVal2||'-') + '</div><div class="pa-cell">' + esc(p.paVal3||'-') + '</div></div></span>'
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
  } catch (e) {
    showToast('Gagal memuat profil: ' + e.message);
  }
}

/* ===================================================
   COMBO SELECT (select + free-text fallback)
=================================================== */
function handleComboSelect(sel, customId) {
  const custom = document.getElementById(customId);
  if (sel.value === '__custom__') {
    custom.style.display = 'block';
    custom.value = '';
    custom.focus();
  } else {
    custom.style.display = 'none';
    custom.value = '';
  }
}

function getComboValue(selId, customId) {
  const sel = document.getElementById(selId);
  return sel.value === '__custom__'
    ? document.getElementById(customId).value.trim()
    : sel.value;
}

function setComboValue(selId, customId, value) {
  const sel = document.getElementById(selId);
  const custom = document.getElementById(customId);
  const inList = value && Array.from(sel.options).some(o => o.value === value && o.value !== '__custom__' && o.value !== '');
  if (inList) {
    sel.value = value;
    custom.style.display = 'none';
    custom.value = '';
  } else if (value) {
    sel.value = '__custom__';
    custom.style.display = 'block';
    custom.value = value;
  } else {
    sel.value = '';
    custom.style.display = 'none';
    custom.value = '';
  }
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
function buildPaYearSelects() {
  const now = new Date().getFullYear();
  const defaults = ['2023', '2024', '2025'];
  ['f_paYear1', 'f_paYear2', 'f_paYear3'].forEach((id, i) => {
    const sel = document.getElementById(id);
    for (let y = 2015; y <= now + 5; y++) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      if (String(y) === defaults[i]) opt.selected = true;
      sel.appendChild(opt);
    }
  });
}

async function initApp() {
  try {
    const [a, p] = await Promise.all([
      apiFetch('/api/artikels'),
      apiFetch('/api/portos'),
    ]);
    artikels = a;
    portos   = p;
  } catch (e) {
    showToast('Gagal memuat data dari server');
  }

  const token = getToken();
  if (token) {
    try {
      const profileData = await apiFetch('/api/profiles');
      profiles = profileData;
      isLoggedIn = true;
      document.body.classList.add('admin-logged-in');
      updateAuthButton();
    } catch {
      removeToken();
    }
  }

  buildPaYearSelects();

  const resetToken = new URLSearchParams(window.location.search).get('reset');
  if (resetToken) { showResetPasswordModal(resetToken); }

  const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
  const isRefresh = navType === 'reload';
  const hash = window.location.hash;
  const artikelMatch = !isRefresh && hash.match(/^#artikel-(.+)$/);
  if (artikelMatch) {
    const found = artikels.find(x => String(x.id) === artikelMatch[1]);
    if (found) { viewArtikel(found.id); return; }
  }
  if (hash) history.replaceState(null, '', window.location.pathname);
  renderArtikelList();
}

initApp();
