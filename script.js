/* ===================================================
   API & AUTH LAYER
=================================================== */
const TOKEN_KEY = 'ao_token_v1';

// sessionStorage: otomatis bersih saat tab/browser ditutup
function getToken()      { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t)     { sessionStorage.setItem(TOKEN_KEY, t); }
function removeToken()   { sessionStorage.removeItem(TOKEN_KEY); }

// Auto logout setelah 1 jam tidak aktif
const IDLE_MS = 60 * 60 * 1000;
let idleTimer = null;

function resetIdleTimer() {
  if (!getToken()) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    removeToken();
    isLoggedIn = false;
    document.body.classList.remove('admin-logged-in');
    updateAuthButton();
    showToast('Sesi berakhir karena tidak aktif. Silakan login kembali.');
  }, IDLE_MS);
}

['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(ev =>
  document.addEventListener(ev, resetIdleTimer, { passive: true })
);

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

/* ===================================================
   RICH TEXT EDITOR HELPERS
=================================================== */
let _richSel = null;

function saveRichSel() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) _richSel = sel.getRangeAt(0).cloneRange();
}

function execRich(cmd, val) {
  if (_richSel) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_richSel);
    _richSel = null;
  }
  document.execCommand(cmd, false, val !== undefined ? val : null);
}

let pendingDeleteId   = null;
let pendingDeleteType = null;
let currentProfileId  = null;
let currentSection    = 'artikel';
let isLoggedIn        = false;
let loginCallback     = null;

/* ===================================================
   NAVIGATION
=================================================== */
const LIST_VIEWS = new Set(['viewArtikelList', 'viewPortofolioList', 'viewDashboard', 'viewPenggajian']);

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('backBtn').style.display = LIST_VIEWS.has(id) ? 'none' : 'inline-block';
  window.scrollTo(0, 0);
}

function toggleWorkDropdown(e) {
  e.stopPropagation();
  document.getElementById('workDropdownMenu').classList.toggle('open');
}
function closeWorkDropdown() {
  document.getElementById('workDropdownMenu').classList.remove('open');
}
document.addEventListener('click', function(e) {
  if (!document.getElementById('navWorkDropdown').contains(e.target)) {
    closeWorkDropdown();
  }
});

function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const ids = { artikel: 'navArtikel', portofolio: 'navPortofolio', profil: 'navProfil', penggajian: 'navProfil' };
  document.getElementById(ids[section]).classList.add('active');
  if (section === 'artikel')     { renderArtikelList();    showView('viewArtikelList'); }
  else if (section === 'portofolio') { renderPortofolioList(); showView('viewPortofolioList'); }
  else if (section === 'penggajian') {
    if (!isLoggedIn) {
      loginCallback = () => { pgCurrentMonth = null; loadPenggajian(); };
      showLoginModal();
      return;
    }
    pgCurrentMonth = null;
    loadPenggajian();
  } else {
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
  else if (currentSection === 'penggajian') {
    pgCurrentMonth = null;
    renderPenggajianDashboard();
    showView('viewPenggajian');
  }
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
    resetIdleTimer();
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
  if (currentSection === 'profil' || currentSection === 'penggajian') {
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
async function sendResetLink() {
  const btn = document.getElementById('forgotPwBtn');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';
  try {
    const data = await apiFetch('/api/auth/send-reset', { method: 'POST' });
    closeLoginModal();
    showToast('✓ ' + data.message);
  } catch (err) {
    showToast('Gagal: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#128231; Lupa Password?';
  }
}

/* ===================================================
   RESET PASSWORD (dari link email)
=================================================== */
function showResetPasswordModal(token) {
  document.getElementById('resetPasswordForm').reset();
  document.getElementById('resetToken').value = token;
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
  else if (currentSection === 'penggajian') { pgCurrentMonth = null; loadPenggajian(); }
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
  document.getElementById('a_content').innerHTML = '';
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
    document.getElementById('a_content').innerHTML = a.content || '';
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
  const contentEl = document.getElementById('a_content');
  const content = contentEl.innerHTML.trim();
  if (!content || content === '<br>') {
    showToast('Isi artikel tidak boleh kosong');
    contentEl.focus();
    return;
  }
  const editId = document.getElementById('a_editId').value;
  const payload = {
    title:    document.getElementById('a_title').value.trim(),
    category: document.getElementById('a_category').value.trim(),
    author:   document.getElementById('a_author').value.trim(),
    date:     document.getElementById('a_date').value || null,
    content:  content,
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
    + '<div class="detail-content">' + (a.content || '') + '</div>'
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
  document.getElementById('p_description').innerHTML = '';
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
    document.getElementById('p_description').innerHTML = p.description || '';
    document.getElementById('p_technologies').value = p.technologies || '';
    setCoverPreview('portoCoverPreview', 'p_coverData', p.cover || null);
  } else {
    document.getElementById('portoFormTitle').textContent = 'Tambah Portofolio Baru';
  }
  showView('viewPortofolioForm');
}

async function savePortofolio(e) {
  e.preventDefault();
  const descEl = document.getElementById('p_description');
  const description = descEl.innerHTML.trim();
  if (!description || description === '<br>') {
    showToast('Deskripsi proyek tidak boleh kosong');
    descEl.focus();
    return;
  }
  const editId = document.getElementById('p_editId').value;
  const payload = {
    title:        document.getElementById('p_title').value.trim(),
    category:     document.getElementById('p_category').value.trim(),
    year:         document.getElementById('p_year').value.trim(),
    client:       document.getElementById('p_client').value.trim(),
    role:         document.getElementById('p_role').value.trim(),
    url:          document.getElementById('p_url').value.trim(),
    description:  description,
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
    + '<div class="detail-content">' + (p.description || '') + '</div>'
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
      resetIdleTimer();
    } catch {
      removeToken();
    }
  }

  buildPaYearSelects();

  const hashResetMatch = window.location.hash.match(/^#reset=([a-f0-9]{64})$/);
  const resetToken = hashResetMatch
    ? hashResetMatch[1]
    : new URLSearchParams(window.location.search).get('reset');
  if (resetToken) {
    history.replaceState(null, '', window.location.pathname);
    showResetPasswordModal(resetToken);
  }

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

/* ===================================================
   PENGGAJIAN
=================================================== */
let payrollSettings     = { gajiPokok: 0, overtimeRate: 0, nama: '' };
let payrollOvertime     = [];
let payrollAdditional   = [];
let payrollClosedMonths = [];
let pgCurrentMonth      = null; // { bulan, tahun }
let pgActiveTab         = 'overtime';

const BULAN_NAMES = ['','Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];

function fmtRp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

// Periode penggajian: 26 bulan lalu s/d 25 bulan ini
// Tanggal 26+ masuk ke bulan berikutnya; tanggal 1-25 masuk bulan tersebut
function getPayrollMonth(tglStr) {
  const d = new Date(tglStr + 'T00:00:00');
  let bulan = d.getMonth() + 1;
  let tahun = d.getFullYear();
  if (d.getDate() > 25) {
    bulan++;
    if (bulan > 12) { bulan = 1; tahun++; }
  }
  return { bulan, tahun };
}

// Kembalikan string periode: "26 Juni 2026 – 25 Juli 2026" untuk bulan Juli 2026
function getPeriodeStr(bulan, tahun) {
  let prevBulan = bulan - 1;
  let prevTahun = tahun;
  if (prevBulan < 1) { prevBulan = 12; prevTahun--; }
  return '26 ' + BULAN_NAMES[prevBulan] + ' ' + prevTahun + ' – 25 ' + BULAN_NAMES[bulan] + ' ' + tahun;
}

function isMonthClosed(bulan, tahun) {
  if (payrollClosedMonths.some(c => c.bulan === bulan && c.tahun === tahun)) return true;
  // Auto-close: jika hari ini >= 25, bulan kalender saat ini otomatis ditutup
  const now = new Date();
  return now.getDate() >= 25 && now.getMonth() + 1 === bulan && now.getFullYear() === tahun;
}

function getClosedInfo(bulan, tahun) {
  return payrollClosedMonths.find(c => c.bulan === bulan && c.tahun === tahun) || null;
}

// Bulan aktif = bulan terbuka berikutnya, mempertimbangkan auto-close tanggal 25
function getActiveMonth() {
  const now = new Date();
  let bulan = now.getMonth() + 1;
  let tahun = now.getFullYear();
  // Jika hari ini >= 25, bulan sekarang otomatis tutup, aktif = bulan berikutnya
  if (now.getDate() >= 25) {
    bulan++;
    if (bulan > 12) { bulan = 1; tahun++; }
  }
  if (payrollClosedMonths.length) {
    const sorted = [...payrollClosedMonths].sort((a, b) =>
      b.tahun !== a.tahun ? b.tahun - a.tahun : b.bulan - a.bulan
    );
    let dbBulan = sorted[0].bulan + 1;
    let dbTahun = sorted[0].tahun;
    if (dbBulan > 12) { dbBulan = 1; dbTahun++; }
    if (dbTahun * 12 + dbBulan > tahun * 12 + bulan) {
      return { bulan: dbBulan, tahun: dbTahun };
    }
  }
  return { bulan, tahun };
}

async function loadPenggajian() {
  try {
    const [s, ot, ad, cl] = await Promise.all([
      apiFetch('/api/penggajian/settings'),
      apiFetch('/api/penggajian/overtime'),
      apiFetch('/api/penggajian/additional'),
      apiFetch('/api/penggajian/closed'),
    ]);
    payrollSettings     = s;
    payrollOvertime     = ot;
    payrollAdditional   = ad;
    payrollClosedMonths = cl;
  } catch (e) {
    showToast('Gagal memuat data penggajian');
  }
  renderPgSettingsBar();
  renderPenggajianDashboard();
  showView('viewPenggajian');
}

function renderPgSettingsBar() {
  const bar = document.getElementById('pgSettingsBar');
  bar.innerHTML =
    (payrollSettings.nama ? '<div class="pg-set-item"><span class="pg-set-label">Karyawan</span><span class="pg-set-val">' + payrollSettings.nama + '</span></div>' : '') +
    '<div class="pg-set-item"><span class="pg-set-label">Gaji Pokok</span><span class="pg-set-val">' + fmtRp(payrollSettings.gajiPokok) + '</span></div>' +
    '<div class="pg-set-item"><span class="pg-set-label">Overtime / Jam</span><span class="pg-set-val">' + fmtRp(payrollSettings.overtimeRate) + '</span></div>';
}

function pgGetMonths() {
  const active = getActiveMonth();
  const set    = new Set();
  const key    = (b, t) => t + '-' + String(b).padStart(2, '0');
  set.add(key(active.bulan, active.tahun));
  payrollOvertime.forEach(o => {
    const pm = getPayrollMonth(o.tgl);
    set.add(key(pm.bulan, pm.tahun));
  });
  payrollAdditional.forEach(a => set.add(key(a.bulan, a.tahun)));
  payrollClosedMonths.forEach(c => set.add(key(c.bulan, c.tahun)));
  return Array.from(set)
    .map(k => { const [t, b] = k.split('-'); return { tahun: +t, bulan: +b }; })
    .sort((a, b) => b.tahun !== a.tahun ? b.tahun - a.tahun : b.bulan - a.bulan);
}

function pgCalcMonth(bulan, tahun) {
  const ovMonth = payrollOvertime.filter(o => {
    const pm = getPayrollMonth(o.tgl);
    return pm.bulan === bulan && pm.tahun === tahun;
  });
  const adMonth = payrollAdditional.filter(a => a.bulan === bulan && a.tahun === tahun);
  const totalJam        = ovMonth.reduce((s, o) => s + o.jam, 0);
  const totalOvertime   = Math.round(totalJam * payrollSettings.overtimeRate);
  const totalAdditional = adMonth.reduce((s, a) => s + a.nominal, 0);
  const totalGaji       = payrollSettings.gajiPokok + totalOvertime + totalAdditional;
  return { ovMonth, adMonth, totalJam, totalOvertime, totalAdditional, totalGaji };
}

function renderPenggajianDashboard() {
  const months = pgGetMonths();
  const list   = document.getElementById('pgMonthList');
  if (!months.length) {
    list.innerHTML = '<div class="pg-empty">Belum ada data. Klik "+ Input" untuk menambah data.</div>';
    return;
  }
  list.innerHTML = months.map(({ bulan, tahun }) => {
    const { totalJam, totalOvertime, totalAdditional, totalGaji } = pgCalcMonth(bulan, tahun);
    const closed  = isMonthClosed(bulan, tahun);
    const badge   = closed
      ? '<span class="pg-badge pg-badge-closed">&#128274; Closed</span>'
      : '<span class="pg-badge pg-badge-open">&#9654; Open</span>';
    return '<div class="pg-month-card' + (closed ? ' pg-month-closed' : '') + '" onclick="viewPgMonth(' + bulan + ',' + tahun + ')">'
      + '<div class="pg-mc-left">'
      + '<div class="pg-mc-bulan">' + BULAN_NAMES[bulan] + ' ' + tahun + ' ' + badge + '</div>'
      + '<div class="pg-mc-breakdown">'
      + '<span>OT: ' + totalJam + ' jam (+' + fmtRp(totalOvertime) + ')</span>'
      + '<span>Additional: +' + fmtRp(totalAdditional) + '</span>'
      + '</div></div>'
      + '<div class="pg-mc-right">'
      + '<div class="pg-mc-total-label">Total Gaji</div>'
      + '<div class="pg-mc-total-val">' + fmtRp(totalGaji) + '</div>'
      + '</div></div>';
  }).join('');
}

function viewPgMonth(bulan, tahun) {
  pgCurrentMonth = { bulan, tahun };
  const closedInfo   = getClosedInfo(bulan, tahun);
  const dbClosed     = !!closedInfo;
  const autoClosed   = !dbClosed && isMonthClosed(bulan, tahun);
  const closed       = dbClosed || autoClosed;
  const { ovMonth, adMonth, totalJam, totalOvertime, totalAdditional, totalGaji } = pgCalcMonth(bulan, tahun);

  document.getElementById('pgDetailTitle').textContent = BULAN_NAMES[bulan] + ' ' + tahun;

  // Action buttons di toolbar (dirender via pgDetailActions div)
  let actions = '';
  if (isLoggedIn) {
    actions += '<button class="btn-pg-print" onclick="printPgSlip(' + bulan + ',' + tahun + ')">&#128438; Export PDF</button>';
    if (dbClosed) {
      actions += '<button class="btn-pg-reopen admin-only" onclick="reopenPgMonth(' + bulan + ',' + tahun + ')">&#128275; Buka Kembali</button>';
    } else if (!autoClosed) {
      actions += '<button class="btn-pg-close admin-only" onclick="closePgMonth(' + bulan + ',' + tahun + ')">&#128274; Tutup Bulan</button>';
      actions += '<button class="btn-pg-input admin-only" onclick="openPgInputModal()">+ Input</button>';
    }
  }
  document.getElementById('pgDetailActions').innerHTML = actions;

  // Status bar
  let statusHtml = '';
  if (dbClosed && closedInfo) {
    const tglClose = new Date(closedInfo.closedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    statusHtml = '<div class="pg-slip-status closed">&#128274; Ditutup pada ' + tglClose + '</div>';
  } else if (autoClosed) {
    statusHtml = '<div class="pg-slip-status closed">&#128274; Ditutup otomatis — penggajian tanggal 25</div>';
  } else {
    statusHtml = '<div class="pg-slip-status draft">&#9998; Draft — belum ditutup</div>';
  }

  // Slip preview
  let slip = '<div class="pg-slip-preview">';

  // Header slip
  slip += '<div class="pg-slip-head">'
    + '<div class="pg-slip-head-title">SLIP GAJI</div>'
    + '<div class="pg-slip-head-periode">Periode: ' + getPeriodeStr(bulan, tahun) + '</div>'
    + '</div>';

  // Info karyawan
  slip += '<div class="pg-slip-empinfo">'
    + '<div class="pg-slip-emprow"><span class="pg-slip-emp-label">Nama</span><span class="pg-slip-emp-colon">:</span><span class="pg-slip-emp-val">' + (payrollSettings.nama || '—') + '</span></div>'
    + '<div class="pg-slip-emprow"><span class="pg-slip-emp-label">Periode</span><span class="pg-slip-emp-colon">:</span><span class="pg-slip-emp-val">' + getPeriodeStr(bulan, tahun) + '</span></div>'
    + '</div>';

  // Tabel komponen
  slip += '<table class="pg-slip-table">'
    + '<thead><tr><th>Komponen Gaji</th><th class="pg-slip-th-right">Nominal</th></tr></thead>'
    + '<tbody>';

  // Gaji pokok
  slip += '<tr class="pg-slip-tr-main"><td>Gaji Pokok</td><td class="pg-slip-td-right">' + fmtRp(payrollSettings.gajiPokok) + '</td></tr>';

  // Overtime
  slip += '<tr class="pg-slip-tr-main"><td>Overtime (' + totalJam + ' jam)</td><td class="pg-slip-td-right">+ ' + fmtRp(totalOvertime) + '</td></tr>';
  ovMonth.forEach(o => {
    const d    = new Date(o.tgl + 'T00:00:00');
    const tgl  = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long' });
    const val  = Math.round(o.jam * payrollSettings.overtimeRate);
    const delBtn = (!closed && isLoggedIn)
      ? ' <button class="pg-slip-del admin-only" onclick="deletePgOvertime(\'' + o.id + '\')" title="Hapus">&#10005;</button>'
      : '';
    slip += '<tr class="pg-slip-tr-sub"><td>' + tgl + ' — ' + o.jam + ' jam &times; ' + fmtRp(payrollSettings.overtimeRate) + '/jam' + delBtn + '</td><td class="pg-slip-td-right">' + fmtRp(val) + '</td></tr>';
  });

  // Additional
  slip += '<tr class="pg-slip-tr-main"><td>Additional Gaji</td><td class="pg-slip-td-right">+ ' + fmtRp(totalAdditional) + '</td></tr>';
  adMonth.forEach(a => {
    const delBtn = (!closed && isLoggedIn)
      ? ' <button class="pg-slip-del admin-only" onclick="deletePgAdditional(\'' + a.id + '\')" title="Hapus">&#10005;</button>'
      : '';
    slip += '<tr class="pg-slip-tr-sub"><td>' + (a.deskripsi || 'Additional') + delBtn + '</td><td class="pg-slip-td-right">' + fmtRp(a.nominal) + '</td></tr>';
  });

  slip += '</tbody>'
    + '<tfoot><tr class="pg-slip-tr-total"><td>TOTAL GAJI BERSIH</td><td class="pg-slip-td-right">' + fmtRp(totalGaji) + '</td></tr></tfoot>'
    + '</table>';

  // Tanda tangan
  if (closed) {
    const tglClose = (dbClosed && closedInfo)
      ? new Date(closedInfo.closedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;
    slip += '<div class="pg-slip-sign">'
      + '<div class="pg-slip-sign-box">'
      + '<div class="pg-slip-sign-label">' + (tglClose ? 'Ditutup, ' + tglClose : 'Ditutup tanggal 25') + '</div>'
      + '<div class="pg-slip-sign-line">( Ayu Fitriah N )</div>'
      + '</div></div>';
  }

  slip += '</div>'; // end pg-slip-preview

  document.getElementById('pgDetailBody').innerHTML = statusHtml + slip;
  showView('viewPenggajianDetail');
}

// --- Close / Reopen ---
async function closePgMonth(bulan, tahun) {
  try {
    await apiFetch('/api/penggajian/close', { method: 'POST', body: JSON.stringify({ bulan, tahun }) });
    const now = new Date().toISOString();
    payrollClosedMonths.push({ bulan, tahun, closedAt: now });
    viewPgMonth(bulan, tahun);
    renderPenggajianDashboard();
    showToast('Gaji ' + BULAN_NAMES[bulan] + ' ' + tahun + ' ditutup.');
  } catch (e) {
    showToast('Gagal menutup bulan: ' + e.message);
  }
}

async function reopenPgMonth(bulan, tahun) {
  try {
    await apiFetch('/api/penggajian/close/' + bulan + '/' + tahun, { method: 'DELETE' });
    payrollClosedMonths = payrollClosedMonths.filter(c => !(c.bulan === bulan && c.tahun === tahun));
    viewPgMonth(bulan, tahun);
    renderPenggajianDashboard();
    showToast('Gaji ' + BULAN_NAMES[bulan] + ' ' + tahun + ' dibuka kembali.');
  } catch (e) {
    showToast('Gagal membuka kembali: ' + e.message);
  }
}

// --- Print / Export PDF ---
function printPgSlip(bulan, tahun) {
  const closed     = isMonthClosed(bulan, tahun);
  const closedInfo = getClosedInfo(bulan, tahun);
  const { ovMonth, adMonth, totalJam, totalOvertime, totalAdditional, totalGaji } = pgCalcMonth(bulan, tahun);

  const tglClose = closedInfo
    ? new Date(closedInfo.closedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : (closed ? 'tanggal 25' : null);

  const ovRows = ovMonth.map(o => {
    const d   = new Date(o.tgl + 'T00:00:00');
    const tgl = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const val = Math.round(o.jam * payrollSettings.overtimeRate);
    return '<tr class="sub"><td>' + tgl + ' — ' + o.jam + ' jam &times; ' + fmtRp(payrollSettings.overtimeRate) + '/jam</td><td>' + fmtRp(val) + '</td></tr>';
  }).join('');

  const adRows = adMonth.map(a =>
    '<tr class="sub"><td>' + (a.deskripsi || 'Additional') + '</td><td>' + fmtRp(a.nominal) + '</td></tr>'
  ).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>Slip Gaji ' + BULAN_NAMES[bulan] + ' ' + tahun + '</title>'
    + '<style>'
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:20px}'
    + '.slip{max-width:680px;margin:0 auto;border:2px solid #333;padding:28px 32px}'
    + '.slip-head{text-align:center;border-bottom:2px solid #333;padding-bottom:14px;margin-bottom:18px}'
    + '.slip-head .title{font-size:17px;font-weight:bold;letter-spacing:1px;text-transform:uppercase}'
    + '.slip-head .sub{font-size:12px;margin-top:4px;color:#555}'
    + '.emp{display:grid;grid-template-columns:100px 8px 1fr;gap:4px;margin-bottom:18px}'
    + '.emp .lbl{font-weight:bold}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:20px}'
    + 'th,td{border:1px solid #bbb;padding:7px 10px;text-align:left}'
    + 'th{background:#e8e8e8;font-weight:bold}'
    + 'tr.sub td{font-size:11px;color:#444;padding:4px 10px 4px 22px}'
    + 'tr.main td{font-weight:600}'
    + 'tr.total td{background:#ddd;font-weight:bold;font-size:13px}'
    + '.td-r{text-align:right}'
    + '.sign{display:flex;justify-content:flex-end;margin-top:24px}'
    + '.sign-box{text-align:center}'
    + '.sign-line{border-top:1px solid #333;margin-top:55px;padding-top:5px;font-size:11px;min-width:200px}'
    + '.status-draft{text-align:center;border:1px solid #c00;color:#c00;padding:5px;font-size:11px;font-weight:bold;margin-bottom:14px}'
    + '.status-closed{text-align:center;color:#555;font-size:11px;margin-bottom:14px}'
    + '@media print{body{padding:0}}'
    + '</style></head><body>'
    + '<div class="slip">'
    + '<div class="slip-head">'
    + '<div class="title">Slip Gaji</div>'
    + '<div class="sub">Periode: ' + getPeriodeStr(bulan, tahun) + '</div>'
    + '</div>'
    + (tglClose ? '<div class="status-closed">Ditutup pada: ' + tglClose + '</div>' : '<div class="status-draft">DRAFT — BELUM DITUTUP</div>')
    + '<div class="emp"><span class="lbl">Nama</span><span>:</span><span>' + (payrollSettings.nama || '—') + '</span></div>'
    + '<table>'
    + '<thead><tr><th>Komponen Gaji</th><th class="td-r" style="width:200px">Nominal</th></tr></thead>'
    + '<tbody>'
    + '<tr class="main"><td>Gaji Pokok</td><td class="td-r">' + fmtRp(payrollSettings.gajiPokok) + '</td></tr>'
    + '<tr class="main"><td>Overtime (' + totalJam + ' jam)</td><td class="td-r">+ ' + fmtRp(totalOvertime) + '</td></tr>'
    + ovRows
    + '<tr class="main"><td>Additional Gaji</td><td class="td-r">+ ' + fmtRp(totalAdditional) + '</td></tr>'
    + adRows
    + '</tbody>'
    + '<tfoot><tr class="total"><td>TOTAL GAJI BERSIH</td><td class="td-r">' + fmtRp(totalGaji) + '</td></tr></tfoot>'
    + '</table>'
    + '<div class="sign"><div class="sign-box">'
    + '<div style="font-size:11px;color:#555">' + (tglClose ? 'Ditutup, ' + tglClose : closed ? 'Ditutup tanggal 25' : 'Tanda Tangan') + '</div>'
    + '<div class="sign-line">( Ayu Fitriah N )</div>'
    + '</div></div>'
    + '</div>'
    + '<script>window.onload=function(){window.print();}<\/script>'
    + '</body></html>';

  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) { showToast('Izinkan popup browser untuk mengekspor PDF.'); return; }
  win.document.write(html);
  win.document.close();
}

// --- Settings modal ---
function openPgSettingsModal() {
  document.getElementById('pgSettingsNama').value         = payrollSettings.nama || '';
  document.getElementById('pgSettingsGajiPokok').value    = payrollSettings.gajiPokok;
  document.getElementById('pgSettingsOvertimeRate').value = payrollSettings.overtimeRate;
  document.getElementById('pgSettingsModal').classList.add('show');
}
function closePgSettingsModal() {
  document.getElementById('pgSettingsModal').classList.remove('show');
}
async function savePgSettings() {
  const nama         = document.getElementById('pgSettingsNama').value.trim();
  const gajiPokok    = parseInt(document.getElementById('pgSettingsGajiPokok').value)    || 0;
  const overtimeRate = parseInt(document.getElementById('pgSettingsOvertimeRate').value) || 0;
  try {
    const res = await apiFetch('/api/penggajian/settings', {
      method: 'PUT',
      body: JSON.stringify({ gajiPokok, overtimeRate, nama }),
    });
    payrollSettings = res;
    closePgSettingsModal();
    renderPgSettingsBar();
    if (document.getElementById('viewPenggajianDetail').classList.contains('active') && pgCurrentMonth) {
      viewPgMonth(pgCurrentMonth.bulan, pgCurrentMonth.tahun);
    } else {
      renderPenggajianDashboard();
    }
    showToast('Pengaturan gaji disimpan.');
  } catch (e) {
    showToast('Gagal menyimpan pengaturan: ' + e.message);
  }
}

// --- Input modal ---
function openPgInputModal() {
  const active = getActiveMonth();
  const now    = new Date();
  const today  = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  // Default tanggal overtime: pakai hari ini jika hasil mapping-nya masuk ke bulan aktif,
  // jika tidak (misal hari ini tanggal 25 yang auto-close) gunakan tanggal 1 bulan aktif
  const pm = getPayrollMonth(today);
  const ovDate = (pm.bulan === active.bulan && pm.tahun === active.tahun)
    ? today
    : active.tahun + '-' + String(active.bulan).padStart(2, '0') + '-01';
  document.getElementById('pgOvTgl').value            = ovDate;
  document.getElementById('pgOvJam').value            = '';
  document.getElementById('pgAddBulan').value         = active.bulan;
  document.getElementById('pgAddTahun').value         = active.tahun;
  document.getElementById('pgAddDeskripsi').value     = '';
  document.getElementById('pgAddNominal').value       = '';
  switchPgTab('overtime');
  document.getElementById('pgInputModal').classList.add('show');
}
function closePgInputModal() {
  document.getElementById('pgInputModal').classList.remove('show');
}
function switchPgTab(tab) {
  pgActiveTab = tab;
  document.getElementById('pgTabOvertime').classList.toggle('active',   tab === 'overtime');
  document.getElementById('pgTabAdditional').classList.toggle('active', tab === 'additional');
  document.getElementById('pgOvertimeForm').style.display   = tab === 'overtime'   ? 'block' : 'none';
  document.getElementById('pgAdditionalForm').style.display = tab === 'additional' ? 'block' : 'none';
}
async function savePgInput() {
  try {
    if (pgActiveTab === 'overtime') {
      const tgl = document.getElementById('pgOvTgl').value;
      const jam = parseFloat(document.getElementById('pgOvJam').value);
      if (!tgl)            { showToast('Pilih tanggal overtime.'); return; }
      if (!jam || jam <= 0) { showToast('Masukkan jumlah jam yang valid.'); return; }
      const entry = await apiFetch('/api/penggajian/overtime', {
        method: 'POST', body: JSON.stringify({ tgl, jam }),
      });
      payrollOvertime.unshift(entry);
      showToast('Data overtime ditambahkan.');
    } else {
      const bulan    = parseInt(document.getElementById('pgAddBulan').value);
      const tahun    = parseInt(document.getElementById('pgAddTahun').value);
      const deskripsi = document.getElementById('pgAddDeskripsi').value.trim();
      const nominal  = parseInt(document.getElementById('pgAddNominal').value) || 0;
      if (!tahun)   { showToast('Masukkan tahun.'); return; }
      if (!nominal) { showToast('Masukkan nominal.'); return; }
      const entry = await apiFetch('/api/penggajian/additional', {
        method: 'POST', body: JSON.stringify({ bulan, tahun, deskripsi, nominal }),
      });
      payrollAdditional.unshift(entry);
      showToast('Additional gaji ditambahkan.');
    }
    closePgInputModal();
    if (document.getElementById('viewPenggajianDetail').classList.contains('active') && pgCurrentMonth) {
      viewPgMonth(pgCurrentMonth.bulan, pgCurrentMonth.tahun);
    } else {
      renderPenggajianDashboard();
    }
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message);
  }
}

async function deletePgOvertime(id) {
  try {
    await apiFetch('/api/penggajian/overtime/' + id, { method: 'DELETE' });
    payrollOvertime = payrollOvertime.filter(o => o.id !== id);
    if (pgCurrentMonth) viewPgMonth(pgCurrentMonth.bulan, pgCurrentMonth.tahun);
    else renderPenggajianDashboard();
    showToast('Data overtime dihapus.');
  } catch (e) {
    showToast('Gagal menghapus: ' + e.message);
  }
}

async function deletePgAdditional(id) {
  try {
    await apiFetch('/api/penggajian/additional/' + id, { method: 'DELETE' });
    payrollAdditional = payrollAdditional.filter(a => a.id !== id);
    if (pgCurrentMonth) viewPgMonth(pgCurrentMonth.bulan, pgCurrentMonth.tahun);
    else renderPenggajianDashboard();
    showToast('Additional gaji dihapus.');
  } catch (e) {
    showToast('Gagal menghapus: ' + e.message);
  }
}

initApp();
