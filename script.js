/* ===================================================
   DATA LAYER
=================================================== */
const STORAGE_KEY = 'ao_profiles_v1';

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let profiles = loadData();
let pendingDeleteId = null;
let currentProfileId = null;

/* ===================================================
   NAVIGATION
=================================================== */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const isHome = id === 'viewDashboard';
  document.getElementById('backBtn').style.display = isHome ? 'none' : 'inline-block';
  window.scrollTo(0, 0);
}

function goBack() {
  showView('viewDashboard');
  renderList();
}

/* ===================================================
   DASHBOARD
=================================================== */
function renderList() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const list = document.getElementById('profileList');
  const empty = document.getElementById('emptyState');
  const filtered = profiles.filter(p =>
    p.npk.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );
  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(p => {
    const initials = p.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const avatar = p.photo
      ? '<img src="' + p.photo + '" alt="' + p.name + '" />'
      : initials;
    return '<div class="profile-card" onclick="viewProfile(\'' + p.id + '\')">'
      + '<div class="avatar">' + avatar + '</div>'
      + '<div class="info">'
      + '<div class="npk">NPK: ' + esc(p.npk) + '</div>'
      + '<div class="name">' + esc(p.name) + '</div>'
      + '<div class="sub">' + esc(p.jobTitle || '') + (p.jobTitle && p.company ? ' — ' : '') + esc(p.company || '') + '</div>'
      + '</div>'
      + '<div class="card-actions" onclick="event.stopPropagation()">'
      + '<button class="btn-icon edit" title="Edit" onclick="editProfile(\'' + p.id + '\')">&#9998;</button>'
      + '<button class="btn-icon del" title="Hapus" onclick="openDeleteModal(\'' + p.id + '\')">&#128465;</button>'
      + '</div></div>';
  }).join('');
}

/* ===================================================
   FORM
=================================================== */
function showForm(id) {
  resetForm();
  if (id) {
    const p = profiles.find(x => x.id === id);
    if (!p) return;
    document.getElementById('formTitleBar').textContent = 'Edit Individual Profile';
    document.getElementById('editId').value = p.id;
    document.getElementById('f_npk').value = p.npk || '';
    document.getElementById('f_name').value = p.name || '';
    document.getElementById('f_dob').value = p.dob || '';
    document.getElementById('f_jobTitle').value = p.jobTitle || '';
    document.getElementById('f_company').value = p.company || '';
    document.getElementById('f_grade').value = p.grade || '';
    document.getElementById('f_hav').value = p.hav || '';
    document.getElementById('f_promotionDate').value = p.promotionDate || '';
    document.getElementById('f_pa2023').value = p.pa2023 || '';
    document.getElementById('f_pa2024').value = p.pa2024 || '';
    document.getElementById('f_pa2025').value = p.pa2025 || '';
    document.getElementById('f_strength').value = p.strength || '';
    document.getElementById('f_afd').value = p.afd || '';
    if (p.photo) setPhotoPreview(p.photo);
    (p.edu || []).forEach(r => addRow('edu', r));
    (p.training || []).forEach(r => addRow('training', r));
    (p.others || []).forEach(r => addRow('others', r));
    (p.work || []).forEach(r => addRow('work', r));
    (p.idp || []).forEach(r => addRow('idp', r));
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
  edu:      { body: 'eduBody',       fields: ['year','grade','institution'] },
  training: { body: 'trainingBody',  fields: ['year','aldp','ict'] },
  others:   { body: 'othersBody',    fields: ['training','year','vendor'] },
  work:     { body: 'workBody',      fields: ['year','position','company'] },
  idp:      { body: 'idpBody',       fields: ['devArea','devProgram','devTarget','dueDate'] },
};

function addRow(type, data) {
  data = data || {};
  const cfg = rowConfigs[type];
  const tbody = document.getElementById(cfg.body);
  const tr = document.createElement('tr');
  const cells = cfg.fields.map(f => {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.dataset.field = f;
    inp.value = data[f] || '';
    if (f === 'dueDate') { inp.type = 'date'; inp.value = data[f] || ''; }
    td.appendChild(inp);
    return td;
  });
  cells.forEach(c => tr.appendChild(c));
  const tdDel = document.createElement('td');
  tdDel.innerHTML = '<button type="button" class="btn-rm" onclick="this.closest(\'tr\').remove()">&#215;</button>';
  tr.appendChild(tdDel);
  tbody.appendChild(tr);
}

function collectRows(type) {
  const cfg = rowConfigs[type];
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
   PHOTO
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
   SAVE
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
    : '<span style="color:#aab;font-size:.8rem">FOTO</span>';

  function tr(rows, fields) {
    if (!rows || rows.length === 0)
      return '<tr><td colspan="' + fields.length + '" style="text-align:center;color:#aaa;font-size:.82rem;padding:10px">-</td></tr>';
    return rows.map(function(r) {
      return '<tr>' + fields.map(function(f) { return '<td>' + esc(r[f] || '') + '</td>'; }).join('') + '</tr>';
    }).join('');
  }

  var html = ''
    + '<div class="profile-header-bar">'
    +   '<div style="display:flex;align-items:center;gap:10px">'
    +     '<div class="logo-circle" style="background:#fff;color:#1a3a6b;width:38px;height:38px;font-size:11px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900">AO</div>'
    +     '<span class="logo-text">ASTRA Otoparts</span>'
    +   '</div>'
    +   '<span class="prof-title">Individual Profile</span>'
    + '</div>'
    + '<div class="profile-content">'
    +   '<div class="prof-outer-layout">'
    +     '<div>'
    +       '<div class="prof-top">'
    +         '<div><div class="prof-info-grid">'
    +           '<span class="prof-label">Name</span>'
    +           '<span class="prof-colon">: <strong>' + esc(p.name) + '</strong></span>'
    +           '<span class="prof-label">Date of Birth / Age</span>'
    +           '<span class="prof-colon">: ' + dobStr + ' / ' + age + '</span>'
    +           '<span class="prof-label">Job Title</span>'
    +           '<span class="prof-colon">: ' + esc(p.jobTitle || '-') + '</span>'
    +           '<span class="prof-label">Company</span>'
    +           '<span class="prof-colon">: ' + esc(p.company || '-') + '</span>'
    +           '<span class="prof-label">Grade / HAV</span>'
    +           '<span class="prof-colon">: ' + esc(p.grade || '-') + ' / ' + esc(p.hav || '-') + '</span>'
    +           '<span class="prof-label">Promotion date</span>'
    +           '<span class="prof-colon">: ' + promStr + '</span>'
    +           '<span class="prof-label">PA History</span>'
    +           '<span class="prof-colon">:'
    +             '<div class="pa-display" style="margin-top:4px">'
    +               '<div class="pa-cell head">2023</div>'
    +               '<div class="pa-cell head">2024</div>'
    +               '<div class="pa-cell head">2025</div>'
    +             '</div>'
    +             '<div class="pa-display">'
    +               '<div class="pa-cell">' + esc(p.pa2023 || '-') + '</div>'
    +               '<div class="pa-cell">' + esc(p.pa2024 || '-') + '</div>'
    +               '<div class="pa-cell">' + esc(p.pa2025 || '-') + '</div>'
    +             '</div>'
    +           '</span>'
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
    +       '<div class="right-box"><div class="right-box-title">Strength</div>'
    +         '<div class="right-box-body">' + esc(p.strength || '-') + '</div></div>'
    +       '<div class="right-box"><div class="right-box-title">Areas for Development</div>'
    +         '<div class="right-box-body">' + esc(p.afd || '-') + '</div></div>'
    +       '<div class="right-box"><div class="right-box-title">Individual Development Plan</div>'
    +         '<table class="prof-table"><thead><tr><th>Development Area</th><th>Development Program</th><th>Development Target</th><th>Due Date</th></tr></thead>'
    +         '<tbody>' + tr(p.idp, ['devArea','devProgram','devTarget','dueDate']) + '</tbody></table></div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="prof-actions">'
    +     '<button class="btn-secondary" onclick="goBack()">&#8592; Kembali</button>'
    +     '<button class="btn-primary" onclick="editProfile(\'' + p.id + '\')">&#9998; Edit</button>'
    +     '<button class="btn-danger" onclick="openDeleteModal(\'' + p.id + '\')">&#128465; Hapus</button>'
    +     '<button class="btn-primary" onclick="window.print()">&#128196; Export PDF</button>'
    +   '</div>'
    + '</div>';

  document.getElementById('profilePage').innerHTML = html;
  showView('viewProfile');
}

/* ===================================================
   DELETE
=================================================== */
function openDeleteModal(id) {
  pendingDeleteId = id;
  document.getElementById('deleteModal').classList.add('show');
}
function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById('deleteModal').classList.remove('show');
}
function confirmDelete() {
  profiles = profiles.filter(p => p.id !== pendingDeleteId);
  saveData(profiles);
  closeDeleteModal();
  showToast('Profil berhasil dihapus.');
  goBack();
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
  const [y,m,d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return d + ' ' + months[+m-1] + ' ' + y;
}
function calcAge(iso) {
  const dob = new Date(iso);
  const today = new Date();
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
renderList();
