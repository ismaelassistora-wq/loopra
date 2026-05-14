// ═══════════════════════════════════════════════════════════
//  LOOPRA — app.js  |  v1.0
//  Supabase + SPA Router + Demo Mode
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://vtlxfpthqpqkgfdiqqwn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bHhmcHRocXBxa2dmZGlxcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTAwMzksImV4cCI6MjA5MjUyNjAzOX0.Su7z-31BSFM_alcTYzQpDg27zy8WWM1-IVF8Cyeapj8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── STATE ───────────────────────────────────────────────
const state = {
  currentView: 'dashboard',
  currentFilter: 'PENDING_APPROVAL',
  client: null,
  posts: [],
  calDate: new Date(),
  rejectTargetId: null,
  pendingUploads: []
};

// ─── UTILS ───────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const tc = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${type==='success'?'✓':type==='error'?'✕':'●'}</span> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}

function typeClass(t) {
  return t === 'POST' ? 'post' : t === 'REEL' ? 'reel' : 'historia';
}

// ─── ROUTER ──────────────────────────────────────────────
function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = $(`view-${viewId}`);
  if (view) view.classList.add('active');
  const navEl = $(`nav-${viewId}`);
  if (navEl) navEl.classList.add('active');
  state.currentView = viewId;

  const titles = { dashboard:'Dashboard', bandeja:'Bandeja de aprobación', calendario:'Calendario', ajustes:'Ajustes', agencia:'Modo Agencia - Subida' };
  $('page-title').textContent = titles[viewId] || viewId;

  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'bandeja') renderBandeja();
  if (viewId === 'calendario') renderCalendar();
  if (viewId === 'ajustes') renderAjustes();
}

// ─── AUTH ────────────────────────────────────────────────
async function initApp() {
  $('page-date').textContent = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await loadClient(session.user.id);
    showApp();
  }
}

async function loadClient(userId) {
  const { data } = await sb.from('clients').select('*').eq('auth_user_id', userId).single();
  if (data) {
    state.client = data;
    $('user-name').textContent = data.name || 'Cliente';
    $('user-avatar').textContent = (data.name || 'L')[0].toUpperCase();
  }
}

function showApp() {
  $('auth-screen').classList.add('hidden');
  $('app-screen').classList.remove('hidden');
  navigate('dashboard');
  loadAllPosts();
}

function showAuth() {
  $('app-screen').classList.add('hidden');
  $('auth-screen').classList.remove('hidden');
}

// ─── DATA FETCHING ───────────────────────────────────────
async function loadAllPosts() {
  const qb = sb.from('posts').select('*').order('proposed_date', { ascending: true });
  if (state.client) qb.eq('client_id', state.client.id);
  const { data, error } = await qb;
  if (error) { toast('Error cargando posts: ' + error.message, 'error'); return; }
  state.posts = data || [];
  updateBadge();
}

function updateBadge() {
  const pending = state.posts.filter(p => p.status === 'PENDING_APPROVAL').length;
  const badge = $('pending-badge');
  badge.textContent = pending;
  badge.classList.toggle('hidden', pending === 0);
}

// ─── DASHBOARD ───────────────────────────────────────────
function renderDashboard() {
  const counts = { PENDING_APPROVAL:0, APPROVED:0, PUBLISHED:0, REJECTED:0 };
  state.posts.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
  $('s-pending').textContent = counts.PENDING_APPROVAL;
  $('s-approved').textContent = counts.APPROVED;
  $('s-published').textContent = counts.PUBLISHED;
  $('s-rejected').textContent = counts.REJECTED;

  const upcoming = state.posts
    .filter(p => p.status !== 'REJECTED')
    .sort((a,b) => new Date(a.proposed_date) - new Date(b.proposed_date))
    .slice(0, 3);

  const grid = $('upcoming-grid');
  if (!upcoming.length) {
    grid.innerHTML = '<p style="color:var(--text3);font-size:13px;">No hay publicaciones próximas aún.</p>';
    return;
  }
  grid.innerHTML = upcoming.map(p => `
    <div class="upcoming-card">
      <div class="upcoming-card-top">
        <span class="badge badge-${typeClass(p.content_type)}">${p.content_type}</span>
        <span class="badge badge-${p.status === 'PENDING_APPROVAL' ? 'pending' : 'approved'}">${p.status === 'PENDING_APPROVAL' ? 'Pendiente' : 'Aprobado'}</span>
      </div>
      <p class="upcoming-copy">${p.copy_text || '—'}</p>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="upcoming-date">📅 ${formatDate(p.proposed_date)} · ${p.proposed_time?.slice(0,5)||''}</span>
        <div class="upcoming-platforms">
          ${(p.platform||[]).map(pl => `<span class="platform-chip chip-${pl==='instagram'?'ig':'tt'}">${pl==='instagram'?'IG':'TK'}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ─── BANDEJA ─────────────────────────────────────────────
function renderBandeja() {
  const filtered = state.posts.filter(p => p.status === state.currentFilter);
  const grid = $('posts-grid');

  if (!filtered.length) {
    let typeName = state.currentFilter === 'PENDING_APPROVAL' ? 'pendientes' : state.currentFilter === 'APPROVED' ? 'aprobados' : state.currentFilter === 'PUBLISHED' ? 'publicados' : 'rechazados';
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No hay posts ${typeName} todavía.</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isVideo = p.content_type === 'REEL' || (p.image_url && /\.(mp4|mov|webm)$/i.test(p.image_url));
    const mediaHtml = p.image_url
      ? (isVideo
          ? `<video src="${p.image_url}" muted autoplay loop style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div class=post-card-img-placeholder>\uD83C\uDFA5</div>'"></video>`
          : `<img src="${p.image_url}" alt="Preview" loading="lazy" onerror="this.parentElement.innerHTML='<div class=post-card-img-placeholder>\uD83D\uDDBC\uFE0F</div>'">`)
      : `<div class="post-card-img-placeholder">\uD83D\uDDBC\uFE0F</div>`;
    return `
    <article class="post-card" data-id="${p.id}">
      <div class="post-card-img">
        ${mediaHtml}
        <div class="post-card-badges">
          <span class="badge badge-${typeClass(p.content_type)}">${p.content_type}</span>
        </div>
      </div>
      <div class="post-card-body">
        <div class="post-card-meta" style="flex-direction:column;align-items:flex-start;gap:6px">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
            <div id="date-display-${p.id}" style="display:flex;align-items:center;gap:6px">
              <span class="post-card-date">📅 ${formatDate(p.proposed_date)} ${p.proposed_time ? '· ' + p.proposed_time.slice(0,5) : ''}</span>
              <button onclick="loopra.editDate('${p.id}')" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:12px" title="Cambiar fecha de publicación">✏️</button>
            </div>
            <div class="upcoming-platforms">
              ${(p.platform||[]).map(pl => `<span class="platform-chip chip-${pl==='instagram'?'ig':'tt'}">${pl==='instagram'?'IG':'TK'}</span>`).join('')}
            </div>
          </div>
          <div id="date-edit-${p.id}" class="hidden" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;padding:8px;background:var(--surface);border-radius:6px;border:1px dashed var(--border)">
            <input type="date" id="input-date-${p.id}" value="${p.proposed_date}" style="padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:12px;width:115px">
            <input type="time" id="input-time-${p.id}" value="${p.proposed_time ? p.proposed_time.slice(0,5) : ''}" style="padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:12px;width:80px">
            <div style="display:flex;gap:6px">
              <button onclick="loopra.saveDate('${p.id}')" style="background:#4ade80;color:#000;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:700;font-size:12px;box-shadow:0 0 10px rgba(74,222,128,0.2)">Guardar</button>
              <button onclick="loopra.cancelEditDate('${p.id}')" style="background:var(--surface2);color:#fff;border:1px solid var(--border);border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:500;font-size:12px">Cancelar</button>
            </div>
          </div>
        </div>
        <div style="position:relative">
          <div id="copy-display-${p.id}" style="position:relative;padding-right:24px">
            <p class="post-card-copy">${p.copy_text || '—'}</p>
            <button onclick="loopra.editCopy('${p.id}')" style="position:absolute;top:-2px;right:0;background:none;border:none;cursor:pointer;opacity:0.6;font-size:13px;padding:2px" title="Editar descripción">✏️</button>
          </div>
          <div id="copy-edit-${p.id}" class="hidden" style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
            <textarea id="input-copy-${p.id}" style="width:100%;height:100px;padding:8px;border:1px dashed var(--violet);border-radius:4px;background:rgba(0,0,0,0.3);color:var(--text);font-size:12px;resize:vertical;font-family:inherit;line-height:1.5">${p.copy_text || ''}</textarea>
            <div style="display:flex;gap:6px;justify-content:flex-end">
              <button onclick="loopra.cancelEditCopy('${p.id}')" style="background:var(--surface2);color:#fff;border:1px solid var(--border);border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:500;font-size:11px">Cancelar</button>
              <button onclick="loopra.saveCopy('${p.id}')" style="background:#4ade80;color:#000;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:700;font-size:11px;box-shadow:0 0 10px rgba(74,222,128,0.2)">Guardar Texto</button>
            </div>
          </div>
        </div>
        <div class="post-card-tags">${(p.hashtags||[]).slice(0,5).map(h=>`<span class="tag">${h}</span>`).join('')}</div>
        ${p.rejection_note ? `<div style="padding:8px;background:var(--rose-g);border-radius:6px;font-size:12px;color:var(--rose)">💬 ${p.rejection_note}</div>` : ''}
      </div>
      ${p.status === 'PENDING_APPROVAL' ? `
        <div class="post-card-actions">
          <button class="btn-approve" onclick="loopra.approve('${p.id}')">✓ Aprobar</button>
          <button class="btn-reject" onclick="loopra.reject('${p.id}')">✕ Rechazar</button>
        </div>` : p.status === 'REJECTED' ? `
        <div class="post-card-actions">
          <button class="btn-approve" onclick="loopra.approve('${p.id}')" style="background:var(--emerald-g);color:var(--emerald);border:1px solid rgba(52,211,153,.2)">✓ Rescatar y Aprobar</button>
          <button class="btn-reject" id="btn-regen-${p.id}" onclick="loopra.regeneratePost('${p.id}')" style="background:var(--violet-g);color:var(--violet);border:1px solid rgba(212,175,55,.2)">🔄 Re-generar con IA</button>
        </div>` : `
        <div class="post-card-actions">
          <div style="grid-column:1/-1;text-align:center;font-size:12px;color:var(--text3);padding:4px 0">
            ${p.status === 'APPROVED' ? '✅ Aprobado · en cola de publicación' : p.status === 'PUBLISHED' ? '<span style="color:var(--emerald)">✅ Publicado correctamente</span>' : '❌ Error'}
          </div>
        </div>`
      }
    </article>
  `;
  }).join('');
}

// ─── APPROVE / REJECT ────────────────────────────────────
async function approve(postId) {
  if (state.demoMode) {
    state.posts = state.posts.map(p => p.id === postId ? {...p, status:'APPROVED'} : p);
    toast('¡Post aprobado! 🎉', 'success');
    updateBadge(); renderBandeja(); renderDashboard(); return;
  }
  const { error } = await sb.from('posts').update({ status:'APPROVED', approved_at: new Date().toISOString() }).eq('id', postId);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  await loadAllPosts();
  toast('¡Post aprobado! Listo para publicar. 🚀', 'success');
  renderBandeja(); renderDashboard();
}

function reject(postId) {
  state.rejectTargetId = postId;
  $('reject-note').value = '';
  $('modal-overlay').classList.remove('hidden');
}

async function confirmReject() {
  const note = $('reject-note').value.trim();
  if (!note) { toast('Escribe un motivo para el rechazo.', 'error'); return; }
  const id = state.rejectTargetId;
  $('modal-overlay').classList.add('hidden');

  if (state.demoMode) {
    state.posts = state.posts.map(p => p.id === id ? {...p, status:'REJECTED', rejection_note:note} : p);
    toast('Post rechazado. Tu equipo lo corregirá.', 'info');
    updateBadge(); renderBandeja(); renderDashboard(); return;
  }
  const { error } = await sb.from('posts').update({ status:'REJECTED', rejection_note:note }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  await loadAllPosts();
  toast('Post rechazado. Tu equipo ha sido notificado.', 'info');
  renderBandeja(); renderDashboard();
}

// ─── EDIT DATE/TIME ───────────────────────────────────────
function editDate(postId) {
  $(`date-display-${postId}`).classList.add('hidden');
  $(`date-edit-${postId}`).classList.remove('hidden');
}

function cancelEditDate(postId) {
  $(`date-display-${postId}`).classList.remove('hidden');
  $(`date-edit-${postId}`).classList.add('hidden');
}

async function saveDate(postId) {
  const newDate = $(`input-date-${postId}`).value;
  const newTime = $(`input-time-${postId}`).value;
  if (!newDate || !newTime) {
    toast('Debes seleccionar fecha y hora', 'error');
    return;
  }
  
  if (state.demoMode) {
    state.posts = state.posts.map(p => p.id === postId ? {...p, proposed_date: newDate, proposed_time: newTime + ':00'} : p);
    toast('Fecha actualizada', 'success');
    renderBandeja(); renderCalendar(); return;
  }

  const { error } = await sb.from('posts').update({ 
    proposed_date: newDate, 
    proposed_time: newTime.length === 5 ? newTime + ':00' : newTime 
  }).eq('id', postId);

  if (error) { toast('Error al actualizar fecha: ' + error.message, 'error'); return; }
  
  await loadAllPosts();
  toast('Fecha de publicación actualizada', 'success');
  renderBandeja();
  if (state.currentView === 'calendario') renderCalendar();
}

// ─── EDIT COPY ────────────────────────────────────────────
function editCopy(postId) {
  $(`copy-display-${postId}`).classList.add('hidden');
  $(`copy-edit-${postId}`).classList.remove('hidden');
}

function cancelEditCopy(postId) {
  $(`copy-display-${postId}`).classList.remove('hidden');
  $(`copy-edit-${postId}`).classList.add('hidden');
}

async function saveCopy(postId) {
  const newCopy = $(`input-copy-${postId}`).value;
  
  if (state.demoMode) {
    state.posts = state.posts.map(p => p.id === postId ? {...p, copy_text: newCopy} : p);
    toast('Texto actualizado', 'success');
    renderBandeja(); if (state.currentView === 'calendario') renderCalendar(); return;
  }

  const { error } = await sb.from('posts').update({ copy_text: newCopy }).eq('id', postId);

  if (error) { toast('Error al actualizar texto: ' + error.message, 'error'); return; }
  
  await loadAllPosts();
  toast('Descripción actualizada correctamente', 'success');
  renderBandeja();
  if (state.currentView === 'calendario') renderCalendar();
}

// ─── REGENERATE POST ──────────────────────────────────────
async function regeneratePost(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  const btn = $(`btn-regen-${postId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg class="spinner" width="14" height="14" viewBox="0 0 16 16" style="margin-right:6px"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg> Generando...`;
  }
  toast('⏳ La IA está buscando fotos y escribiendo el nuevo post...', 'info');

  if (state.demoMode) {
    setTimeout(() => { toast('Post regenerado (Demo)', 'success'); loadAllPosts(); }, 2000);
    return;
  }

  try {
    const res = await fetch('https://n8n-production-u68788.vm.elestio.app/webhook/loopra-regenerate-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: post.client_id,
        content_type: post.content_type,
        proposed_date: post.proposed_date,
        proposed_time: post.proposed_time,
        platform: post.platform,
        slot_label: post.ai_analysis?.slot_label || 'Regenerado a petición'
      })
    });

    if (!res.ok) throw new Error('Fallo al conectar con n8n. Asegúrate de tener el Webhook activado.');
    
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    toast('✨ ¡Nuevo post generado! Revisa la pestaña de Pendientes.', 'success');
    await loadAllPosts();
    state.currentFilter = 'PENDING_APPROVAL';
    renderBandeja();
    updateBadge();
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    $('f-pending').classList.add('active');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Re-generar con IA';
    }
  }
}

// ─── CALENDAR ────────────────────────────────────────────
function renderCalendar() {
  const year = state.calDate.getFullYear();
  const month = state.calDate.getMonth();
  $('cal-month-label').textContent = new Date(year, month).toLocaleDateString('es-ES', { month:'long', year:'numeric' });

  const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Convert to Mon-based

  const postsByDay = {};
  state.posts.forEach(p => {
    if (!p.proposed_date) return;
    const d = new Date(p.proposed_date + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(p);
    }
  });

  const today = new Date();
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cal-day other-month"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const dayPosts = postsByDay[d] || [];
    const dots = dayPosts.map(p => {
      const c = p.content_type === 'POST' ? 'dot-violet' : p.content_type === 'REEL' ? 'dot-cyan' : 'dot-amber';
      return `<div class="cal-dot ${c}"></div>`;
    }).join('');
    html += `
      <div class="cal-day ${isToday?'today':''} ${dayPosts.length?'has-posts':''}" data-day="${d}" onclick="loopra.selectDay(${d})">
        <div class="cal-day-num">${d}</div>
        <div class="cal-day-dots">${dots}</div>
      </div>`;
  }
  $('cal-body').innerHTML = html;
  $('cal-detail').classList.add('hidden');
}

function selectDay(day) {
  document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
  const el = document.querySelector(`.cal-day[data-day="${day}"]`);
  if (el) el.classList.add('selected');

  const year = state.calDate.getFullYear();
  const month = state.calDate.getMonth();
  const dayPosts = state.posts.filter(p => {
    if (!p.proposed_date) return false;
    const d = new Date(p.proposed_date + 'T12:00:00');
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  });

  if (!dayPosts.length) { $('cal-detail').classList.add('hidden'); return; }
  $('cal-detail-title').textContent = `${day} ${new Date(year, month).toLocaleDateString('es-ES', { month:'long' })} — ${dayPosts.length} publicación${dayPosts.length>1?'es':''}`;
  $('cal-detail-posts').innerHTML = dayPosts.map(p => `
    <div class="cal-post-row">
      <span class="cal-post-time">${p.proposed_time?.slice(0,5)||'—'}</span>
      <span class="badge badge-${typeClass(p.content_type)}">${p.content_type}</span>
      <span class="cal-post-copy">${p.copy_text || '—'}</span>
      <span class="badge badge-${p.status === 'PENDING_APPROVAL' ? 'pending' : p.status === 'APPROVED' ? 'approved' : p.status === 'PUBLISHED' ? 'published' : p.status === 'FAILED' ? 'failed' : 'rejected'}" style="flex-shrink:0">
        ${p.status === 'PENDING_APPROVAL' ? 'Pendiente' : p.status === 'APPROVED' ? 'Aprobado' : p.status === 'PUBLISHED' ? 'Publicado' : p.status === 'FAILED' ? 'Error' : 'Rechazado'}
      </span>
    </div>
  `).join('');
  $('cal-detail').classList.remove('hidden');
}

// ─── AJUSTES ─────────────────────────────────────────────
function renderAjustes() {
  const c = state.client || {};
  $('s-name').value = c.name || '';
  $('s-industry').value = c.industry || '';
  $('s-tone').value = c.tone_of_voice || '';
  $('s-keywords').value = (c.brand_keywords || []).join(', ');
  const uploadPostEl = $('s-uploadpost');
  if (uploadPostEl) uploadPostEl.value = c.upload_post_profile || '';
  // Cargar la Memoria de Conocimiento de Empresa
  const knowledgeEl = $('s-knowledge');
  if (knowledgeEl) knowledgeEl.value = c.company_knowledge || '';
}

async function saveSettings() {
  const knowledgeEl = $('s-knowledge');
  const updates = {
    name: $('s-name').value.trim(),
    industry: $('s-industry').value.trim(),
    tone_of_voice: $('s-tone').value.trim(),
    brand_keywords: $('s-keywords').value.split(',').map(k => k.trim()).filter(Boolean),
    upload_post_profile: $('s-uploadpost') ? $('s-uploadpost').value.trim() : null,
    company_knowledge: knowledgeEl ? knowledgeEl.value.trim() : null,
  };
  if (!state.client?.id) { toast('No hay cliente asociado a tu cuenta.', 'error'); return; }
  const { error } = await sb.from('clients').update(updates).eq('id', state.client.id);
  if (error) {
    toast('Error al guardar: ' + error.message, 'error');
    console.error('Supabase update error:', error);
    return;
  }
  Object.assign(state.client, updates);
  $('user-name').textContent = updates.name;
  $('user-avatar').textContent = (updates.name || 'L')[0].toUpperCase();
  toast('✅ Configuración guardada. La IA ya usa esta memoria.', 'success');
}

// ─── AGENCIA UPLOADS ───────────────────────────────────────
function handleFiles(files) {
  const newFiles = Array.from(files).filter(f => {
    if (f.type.startsWith('image/') || f.type.startsWith('video/')) return true;
    const name = f.name.toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm');
  });
  state.pendingUploads = [...state.pendingUploads, ...newFiles];
  renderUploadList();
}

function removeUpload(index) {
  state.pendingUploads.splice(index, 1);
  renderUploadList();
}

function renderUploadList() {
  const list = $('upload-list');
  const btn = $('upload-btn');
  
  if (state.pendingUploads.length === 0) {
    list.innerHTML = '';
    btn.classList.add('hidden');
    return;
  }
  
  btn.classList.remove('hidden');
  $('upload-btn-text').textContent = `Subir ${state.pendingUploads.length} fotos al Banco de Activos`;
  
  list.innerHTML = state.pendingUploads.map((f, i) => {
    const url = URL.createObjectURL(f);
    const isVideo = f.type.startsWith('video/') || f.name.toLowerCase().match(/\\.(mp4|mov|webm)$/);
    const mediaHtml = isVideo 
      ? `<video src="${url}" muted autoplay loop style="width:100%;height:100%;object-fit:cover" onloadeddata="URL.revokeObjectURL(this.src)"></video>`
      : `<img src="${url}" alt="Preview" onload="URL.revokeObjectURL(this.src)">`;
      
    return `<div class="upload-item">
      ${mediaHtml}
      <div class="upload-remove" onclick="loopra.removeUpload(${i})">✕</div>
    </div>`;
  }).join('');
}

async function uploadToSupabase() {
  if (!state.client) { toast('Error: No hay cliente asociado.', 'error'); return; }
  
  $('upload-btn-text').classList.add('hidden');
  $('upload-spinner').classList.remove('hidden');
  $('upload-btn').disabled = true;
  
  let successCount = 0;
  let lastError = null;

  // --- Helper: captura el fotograma del segundo 1 de un vídeo y devuelve un Blob JPEG ---
  function captureVideoThumbnail(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      let resolved = false;
      let seekTimer = null;

      // Función que captura el frame actual del vídeo y resuelve la Promise
      function captureFrame() {
        if (resolved) return;
        resolved = true;
        clearTimeout(seekTimer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = video.videoWidth  || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objectUrl);
            resolve(blob);
          }, 'image/jpeg', 0.85);
        } catch (e) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }
      }

      // Timeout global: si en 10s no se resuelve, abortar sin miniatura
      const globalTimeout = setTimeout(() => {
        if (!resolved) { resolved = true; URL.revokeObjectURL(objectUrl); resolve(null); }
      }, 10000);

      // Cuando tenemos metadatos (duración disponible), hacer seek
      video.addEventListener('loadedmetadata', () => {
        const seekTo = Math.min(1, (video.duration || 0) * 0.1);
        video.currentTime = seekTo > 0 ? seekTo : 0;

        // Si seeked no dispara en 3s, forzamos la captura del frame actual
        seekTimer = setTimeout(() => { captureFrame(); clearTimeout(globalTimeout); }, 3000);
      });

      // Cuando el seek termina, capturar el frame
      video.addEventListener('seeked', () => {
        clearTimeout(globalTimeout);
        captureFrame();
      });

      // Si el vídeo no carga, resolver sin miniatura
      video.addEventListener('error', () => {
        clearTimeout(globalTimeout);
        if (!resolved) { resolved = true; URL.revokeObjectURL(objectUrl); resolve(null); }
      });

      // Iniciar la carga del vídeo
      video.load();
    });
  }

  
  for (const file of state.pendingUploads) {
    const ext = file.name.split('.').pop();
    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|mov|webm|avi|mkv)$/);
    
    let filePrefix = isVideo ? 'reel' : 'post';
    
    if (!isVideo) {
      // Detectar formato leyendo las dimensiones
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Si es formato vertical (tipo 9:16 o similar), lo consideramos historia
          if (img.height > img.width * 1.2) filePrefix = 'historia';
          URL.revokeObjectURL(img.src);
          resolve();
        };
        img.onerror = resolve; // En caso de error, continuar como post
        img.src = URL.createObjectURL(file);
      });
    }

    const baseName = `${filePrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fileName = `${baseName}.${ext}`;
    const filePath = `${state.client.id}/banco_bruto/${fileName}`;
    
    // Subir el archivo original (imagen o vídeo)
    const { error } = await sb.storage.from('loopra').upload(filePath, file);
    if (!error) {
      successCount++;

      // Si es un vídeo, capturar y subir también la miniatura
      if (isVideo) {
        try {
          const thumbBlob = await captureVideoThumbnail(file);
          if (thumbBlob) {
            const thumbPath = `${state.client.id}/banco_bruto/${baseName}_thumb.jpg`;
            const thumbResult = await sb.storage.from('loopra').upload(thumbPath, thumbBlob, { contentType: 'image/jpeg' });
            if (thumbResult.error) {
              console.warn('No se pudo subir la miniatura del vídeo:', thumbResult.error.message);
            } else {
              console.log(`✅ Miniatura del vídeo guardada: ${baseName}_thumb.jpg`);
            }
          }
        } catch (thumbErr) {
          console.warn('Error generando miniatura del vídeo:', thumbErr);
        }
      }
    } else {
      console.error("Supabase Storage Error:", error);
      lastError = error.message;
    }
  }
  
  $('upload-btn-text').classList.remove('hidden');
  $('upload-spinner').classList.add('hidden');
  $('upload-btn').disabled = false;
  
  if (successCount > 0) {
    toast(`✅ ${successCount} archivos guardados en el Banco de Activos.`);
    state.pendingUploads = [];
    renderUploadList();
    if (lastError) toast(`Error en algunos archivos: ${lastError}`, 'error');
  } else {
    toast(`Error subiendo los archivos: ${lastError || 'Desconocido'}`, 'error');
  }
}


// ─── EVENT LISTENERS ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Login
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    $('login-label').classList.add('hidden');
    $('login-spinner').classList.remove('hidden');
    $('auth-error').classList.add('hidden');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    $('login-label').classList.remove('hidden');
    $('login-spinner').classList.add('hidden');

    if (error) {
      $('auth-error').textContent = 'Credenciales incorrectas. Inténtalo de nuevo.';
      $('auth-error').classList.remove('hidden');
      return;
    }
    await loadClient(data.user.id);
    showApp();
    toast(`Bienvenido de vuelta 👋`, 'success');
  });

  // Logout
  $('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    state.client = null; state.posts = [];
    showAuth();
  });

  // Nav
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.view);
    });
  });

  document.querySelectorAll('.section-link[data-view]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.view); });
  });

  // Filter tabs
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderBandeja();
    });
  });

  // Calendar nav
  $('cal-prev').addEventListener('click', () => { state.calDate.setMonth(state.calDate.getMonth() - 1); renderCalendar(); });
  $('cal-next').addEventListener('click', () => { state.calDate.setMonth(state.calDate.getMonth() + 1); renderCalendar(); });

  // Modal
  $('cancel-reject').addEventListener('click', () => $('modal-overlay').classList.add('hidden'));
  $('confirm-reject').addEventListener('click', confirmReject);
  $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) $('modal-overlay').classList.add('hidden'); });

  // Settings save
  $('save-settings-btn').addEventListener('click', saveSettings);

  // Upload Zone Events
  const dropZone = $('upload-zone');
  const fileInput = $('file-input');
  const folderInput = $('folder-input');
  
  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files) handleFiles(e.target.files);
      fileInput.value = '';
    });
    folderInput.addEventListener('change', e => {
      if (e.target.files) handleFiles(e.target.files);
      folderInput.value = '';
    });
    $('upload-btn').addEventListener('click', uploadToSupabase);
  }

  // Supabase realtime
  sb.channel('posts-changes').on('postgres_changes', { event:'*', schema:'public', table:'posts' }, async () => {
    await loadAllPosts();
    if (state.currentView === 'dashboard') renderDashboard();
    if (state.currentView === 'bandeja') renderBandeja();
    if (state.currentView === 'calendario') renderCalendar();
  }).subscribe();

  initApp();
});

// ─── GLOBAL API (para los botones en HTML dinámico) ──────
window.loopra = { approve, reject, selectDay, removeUpload, editDate, cancelEditDate, saveDate, editCopy, cancelEditCopy, saveCopy, regeneratePost };
