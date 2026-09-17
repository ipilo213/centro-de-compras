// ====== CONFIGURACIÓN — completar con los datos de tu proyecto Supabase ======
const SUPABASE_URL = 'https://bebtcltnphmqmptfqiva.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_Uw9DcWJ0nRBJvFOvwoMxjA_-PSYjIfN';
// ==============================================================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente', fg: '#7A5900', bg: '#FBF0D6', bd: '#E3C065' },
  { id: 'cotizando', label: 'Cotizando', fg: '#4A3E82', bg: '#EDEAFA', bd: '#B3A6E8' },
  { id: 'aprobada', label: 'Aprobada', fg: '#1F4368', bg: '#E4EEF8', bd: '#8FB6DA' },
  { id: 'pedida', label: 'Pedida', fg: '#155050', bg: '#DFF1EF', bd: '#7FC4BE' },
  { id: 'recibida', label: 'Recibida', fg: '#265C3D', bg: '#E4F3E9', bd: '#8FCBA8' },
  { id: 'rechazada', label: 'Rechazada', fg: '#7A2424', bg: '#FAE6E6', bd: '#E3A0A0' },
];

const PRIORIDADES = [
  { id: 'baja', label: 'Baja', color: '#9C9789' },
  { id: 'media', label: 'Media', color: '#C08A2E' },
  { id: 'alta', label: 'Alta', color: '#B4552E' },
  { id: 'urgente', label: 'Urgente', color: '#A83232' },
];

const state = {
  tab: 'compras',
  solicitudes: [],
  inventario: [],
  loading: true,
  storageError: false,
  selectedId: null,
  search: '',
  filterEstado: 'todas',
  showForm: false,
  showInvForm: false,
  nombre: localStorage.getItem('centro-compras-nombre') || '',
};

function estadoInfo(id) { return ESTADOS.find(e => e.id === id) || ESTADOS[0]; }
function prioridadInfo(id) { return PRIORIDADES.find(p => p.id === id) || PRIORIDADES[1]; }
function fmtFecha(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function recordarNombre(val) {
  state.nombre = val;
  try { localStorage.setItem('centro-compras-nombre', val); } catch {}
}

// ====== Carga de datos ======
async function cargarSolicitudes() {
  const { data, error } = await supabase.from('solicitudes').select('*').order('fecha', { ascending: false });
  if (error) throw error;
  state.solicitudes = data || [];
}
async function cargarInventario() {
  const { data, error } = await supabase.from('inventario').select('*').order('actualizado', { ascending: false });
  if (error) throw error;
  state.inventario = data || [];
}
async function cargarTodo(silent) {
  try {
    await Promise.all([cargarSolicitudes(), cargarInventario()]);
    state.storageError = false;
  } catch (e) {
    console.error(e);
    if (!silent) state.storageError = true;
  }
  if (!silent) state.loading = false;
  render();
}

// ====== Acciones: solicitudes ======
async function crearSolicitud(data) {
  const { error } = await supabase.from('solicitudes').insert({
    solicitante: data.solicitante, item: data.item, cantidad: data.cantidad,
    prioridad: data.prioridad, notas: data.notas, estado: 'pendiente', comentarios: [],
  });
  if (error) { alert('No se pudo crear la solicitud: ' + error.message); return; }
  state.showForm = false;
  await cargarSolicitudes();
  const nueva = state.solicitudes[0];
  state.selectedId = nueva ? nueva.id : null;
  render();
}

async function cambiarEstado(id, estado) {
  const s = state.solicitudes.find(x => x.id === id);
  if (!s) return;
  const comentarios = [...(s.comentarios || []), {
    autor: state.nombre || 'Sistemas',
    texto: `Estado actualizado a "${estadoInfo(estado).label}".`,
    fecha: new Date().toISOString(), sistema: true,
  }];
  const { error } = await supabase.from('solicitudes').update({ estado, comentarios }).eq('id', id);
  if (error) { alert('No se pudo actualizar: ' + error.message); return; }
  await cargarSolicitudes();
  render();
}

async function agregarComentario(id, texto) {
  if (!texto.trim()) return;
  const s = state.solicitudes.find(x => x.id === id);
  if (!s) return;
  const comentarios = [...(s.comentarios || []), {
    autor: state.nombre || 'Anonimo', texto: texto.trim(), fecha: new Date().toISOString(),
  }];
  const { error } = await supabase.from('solicitudes').update({ comentarios }).eq('id', id);
  if (error) { alert('No se pudo comentar: ' + error.message); return; }
  await cargarSolicitudes();
  render();
}

// ====== Acciones: inventario ======
async function agregarInventario(data) {
  const { error } = await supabase.from('inventario').insert({
    nombre: data.nombre, cantidad: data.cantidad || '1', ubicacion: data.ubicacion, notas: data.notas,
  });
  if (error) { alert('No se pudo agregar: ' + error.message); return; }
  state.showInvForm = false;
  await cargarInventario();
  render();
}
async function quitarInventario(id) {
  const { error } = await supabase.from('inventario').delete().eq('id', id);
  if (error) { alert('No se pudo quitar: ' + error.message); return; }
  await cargarInventario();
  render();
}

// ====== Render ======
function render() {
  const app = document.getElementById('app');
  if (state.loading) {
    app.innerHTML = '<div class="loading-screen">Cargando información...</div>';
    return;
  }

  app.innerHTML = `
    ${renderHeader()}
    <div class="content">
      ${state.storageError ? renderStorageError() : (state.tab === 'compras' ? renderCompras() : renderInventario())}
    </div>
    ${state.showForm ? renderModalNuevaSolicitud() : ''}
  `;
  attachEvents();
}

function renderHeader() {
  return `
  <div class="header">
    <div class="header-inner">
      <div class="header-top">
        <div class="header-title-group">
          <div class="header-icon">🗂️</div>
          <div>
            <h1>Centro de Compras</h1>
            <p>Departamento de Sistemas — solicitudes e inventario</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-ghost" id="btn-refresh">↻ Actualizar</button>
          ${state.tab === 'compras' ? '<button class="btn-primary" id="btn-nueva">+ Nueva solicitud</button>' : ''}
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn ${state.tab === 'compras' ? 'active' : ''}" data-tab="compras">📋 Compras</button>
        <button class="tab-btn ${state.tab === 'inventario' ? 'active' : ''}" data-tab="inventario">📦 Inventario</button>
      </div>
    </div>
  </div>`;
}

function renderStorageError() {
  return `<div class="storage-error">No se pudo conectar con la base de datos. Revisá que SUPABASE_URL y SUPABASE_ANON_KEY estén bien cargados en app.js, y que las tablas existan en tu proyecto Supabase.</div>`;
}

function renderCompras() {
  const conteos = {};
  ESTADOS.forEach(e => { conteos[e.id] = state.solicitudes.filter(s => s.estado === e.id).length; });

  const filtradas = state.solicitudes.filter(s => {
    if (state.filterEstado !== 'todas' && s.estado !== state.filterEstado) return false;
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      return s.item.toLowerCase().includes(q) || s.solicitante.toLowerCase().includes(q) || String(s.id).includes(q);
    }
    return true;
  });

  const seleccionada = state.solicitudes.find(s => s.id === state.selectedId) || null;

  return `
  <div class="layout-grid ${seleccionada ? 'with-detail' : ''}">
    <div>
      <div class="chip-row">
        <button class="chip" data-filter="todas" style="${state.filterEstado === 'todas' ? 'background:#E7E5DC' : ''}">Todas <span class="count">${state.solicitudes.length}</span></button>
        ${ESTADOS.map(e => `
          <button class="chip" data-filter="${e.id}" style="${state.filterEstado === e.id ? `background:${e.bg};border-color:${e.bd};color:${e.fg}` : ''}">
            ${e.label} <span class="count">${conteos[e.id] || 0}</span>
          </button>`).join('')}
      </div>

      <div class="search-wrap">
        <span class="icon">🔎</span>
        <input type="text" class="search-input" id="search-input" placeholder="Buscar por ítem, solicitante o código" value="${esc(state.search)}" />
      </div>

      ${filtradas.length === 0 ? renderEmpty(
        state.solicitudes.length === 0 ? 'Todavía no hay solicitudes' : 'Nada coincide con el filtro',
        state.solicitudes.length === 0 ? 'Cuando alguien del equipo cargue un pedido, va a aparecer acá.' : 'Probá con otro estado o buscá otro término.'
      ) : `
        <div class="list-card">
          ${filtradas.map(s => renderRow(s)).join('')}
        </div>`}
    </div>
    ${seleccionada ? renderDetail(seleccionada) : ''}
  </div>`;
}

function renderRow(s) {
  const est = estadoInfo(s.estado);
  const pri = prioridadInfo(s.prioridad);
  return `
  <div class="row fade-up ${s.id === state.selectedId ? 'selected' : ''}" data-select="${s.id}">
    <span class="row-id mono">REQ-${String(s.id).padStart(4, '0')}</span>
    <span class="dot ${pri.id === 'urgente' ? 'dot-urgente' : ''}" style="background:${pri.color}" title="Prioridad ${pri.label}"></span>
    <div class="row-main">
      <div class="row-title">${esc(s.item)} ${s.cantidad ? `<span class="qty">× ${esc(s.cantidad)}</span>` : ''}</div>
      <div class="row-sub">${esc(s.solicitante)} · ${fmtFecha(s.fecha)}</div>
    </div>
    ${s.comentarios && s.comentarios.length > 0 ? `<span class="row-comments">💬 ${s.comentarios.length}</span>` : ''}
    <span class="badge" style="background:${est.bg};color:${est.fg};border-color:${est.bd}">${est.label}</span>
    <span>›</span>
  </div>`;
}

function renderDetail(s) {
  const pri = prioridadInfo(s.prioridad);
  return `
  <div class="detail-panel fade-up">
    <div class="detail-top">
      <span class="mono" style="font-size:12px;color:var(--ink-soft)">REQ-${String(s.id).padStart(4, '0')}</span>
      <button class="detail-close" id="btn-close-detail">✕</button>
    </div>
    <h2>${esc(s.item)}</h2>
    <p class="detail-meta">Pedido por ${esc(s.solicitante)} el ${fmtFecha(s.fecha)}${s.cantidad ? ` · cantidad: ${esc(s.cantidad)}` : ''}</p>
    ${s.notas ? `<p class="detail-notes">${esc(s.notas)}</p>` : ''}
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:16px">
      <span style="font-size:12px;color:var(--ink-soft)">Prioridad ${pri.label}</span>
      <span class="dot" style="background:${pri.color}"></span>
    </div>
    <div>
      <p class="detail-section-label">Estado</p>
      <div class="estado-options">
        ${ESTADOS.map(e => `
          <button class="estado-btn" data-estado="${e.id}" data-id="${s.id}"
            style="${s.estado === e.id ? `background:${e.bg};color:${e.fg};border-color:${e.bd}` : ''}">${e.label}</button>`).join('')}
      </div>
    </div>
    <div>
      <p class="detail-section-label">Comentarios ${s.comentarios && s.comentarios.length ? `(${s.comentarios.length})` : ''}</p>
      <div class="comments-list">
        ${(!s.comentarios || s.comentarios.length === 0) ? '<p style="font-size:13px;color:var(--ink-soft);margin:0">Sin comentarios todavía.</p>' :
          s.comentarios.map(c => `
            <div class="comment ${c.sistema ? 'sistema' : ''}">
              <div class="comment-head">
                <span class="comment-author">${esc(c.autor)}</span>
                <span class="comment-date mono">${fmtFecha(c.fecha)}</span>
              </div>
              <p class="comment-text">${esc(c.texto)}</p>
            </div>`).join('')}
      </div>
      <div class="comment-form">
        <input type="text" id="comment-autor" placeholder="Tu nombre" value="${esc(state.nombre)}" style="margin-bottom:8px;font-size:13px" />
        <div class="comment-send-row">
          <textarea id="comment-texto" rows="2" placeholder="Agregar un comentario"></textarea>
          <button class="btn-primary" id="btn-enviar-comentario" data-id="${s.id}">➤</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderEmpty(title, body) {
  return `<div class="empty-state"><div style="font-size:22px">📦</div><p class="title">${esc(title)}</p><p class="body">${esc(body)}</p></div>`;
}

function renderModalNuevaSolicitud() {
  return `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box" id="modal-box">
      <div class="modal-head"><h2>Nueva solicitud</h2><button class="detail-close" id="btn-cerrar-modal">✕</button></div>
      <div class="field"><label>Tu nombre</label><input type="text" id="f-solicitante" value="${esc(state.nombre)}" placeholder="Nombre y apellido" /></div>
      <div class="field"><label>Qué necesitás</label><input type="text" id="f-item" placeholder="Ej: mouse inalámbrico" /></div>
      <div class="field-row">
        <div class="field"><label>Cantidad</label><input type="text" id="f-cantidad" value="1" /></div>
        <div class="field"><label>Prioridad</label>
          <select id="f-prioridad">${PRIORIDADES.map(p => `<option value="${p.id}" ${p.id === 'media' ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Notas (opcional)</label><textarea id="f-notas" rows="3" placeholder="Detalles, link de referencia, para qué es, etc."></textarea></div>
      <p class="modal-error" id="modal-error" style="display:none"></p>
      <div class="modal-actions">
        <button class="btn-ghost" id="btn-cancelar-modal">Cancelar</button>
        <button class="btn-primary" id="btn-crear-solicitud">Crear solicitud</button>
      </div>
    </div>
  </div>`;
}

function renderInventario() {
  return `
  <div class="inv-toolbar">
    <p>Base para llevar el stock del depto. Se puede seguir ampliando más adelante.</p>
    <button class="btn-primary" id="btn-toggle-inv-form">+ Agregar ítem</button>
  </div>
  ${state.showInvForm ? `
    <div class="inv-form">
      <div class="inv-form-grid">
        <input type="text" id="inv-nombre" placeholder="Ítem" />
        <input type="text" id="inv-cantidad" placeholder="Cantidad" />
        <input type="text" id="inv-ubicacion" placeholder="Ubicación" />
      </div>
      <input type="text" id="inv-notas" placeholder="Notas (opcional)" style="margin-bottom:10px" />
      <div class="modal-actions">
        <button class="btn-ghost" id="btn-cancelar-inv">Cancelar</button>
        <button class="btn-primary" id="btn-guardar-inv">Guardar</button>
      </div>
    </div>` : ''}
  ${state.inventario.length === 0 ? renderEmpty('Todavía no hay ítems cargados', 'A medida que reciban compras, se pueden ir sumando acá para tener un registro del stock.') : `
    <div class="inv-table">
      <div class="inv-head"><span>Ítem</span><span>Cantidad</span><span>Ubicación</span><span>Notas</span><span></span></div>
      ${state.inventario.map(i => `
        <div class="inv-row">
          <span class="name">${esc(i.nombre)}</span>
          <span class="mono">${esc(i.cantidad)}</span>
          <span class="muted">${esc(i.ubicacion) || '—'}</span>
          <span class="muted">${esc(i.notas) || '—'}</span>
          <button class="inv-remove" data-quitar="${i.id}">✕</button>
        </div>`).join('')}
    </div>`}
  `;
}

// ====== Eventos ======
function attachEvents() {
  document.getElementById('btn-refresh')?.addEventListener('click', () => cargarTodo(false));

  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    state.tab = b.dataset.tab; state.selectedId = null; render();
  }));

  document.getElementById('btn-nueva')?.addEventListener('click', () => { state.showForm = true; render(); });
  document.getElementById('btn-cerrar-modal')?.addEventListener('click', () => { state.showForm = false; render(); });
  document.getElementById('btn-cancelar-modal')?.addEventListener('click', () => { state.showForm = false; render(); });
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') { state.showForm = false; render(); } });
  document.getElementById('btn-crear-solicitud')?.addEventListener('click', () => {
    const solicitante = document.getElementById('f-solicitante').value.trim();
    const item = document.getElementById('f-item').value.trim();
    const cantidad = document.getElementById('f-cantidad').value.trim();
    const prioridad = document.getElementById('f-prioridad').value;
    const notas = document.getElementById('f-notas').value.trim();
    if (!solicitante || !item) {
      const err = document.getElementById('modal-error');
      err.textContent = 'Completá tu nombre y el ítem solicitado.';
      err.style.display = 'block';
      return;
    }
    recordarNombre(solicitante);
    crearSolicitud({ solicitante, item, cantidad, prioridad, notas });
  });

  document.querySelectorAll('.chip[data-filter]').forEach(c => c.addEventListener('click', () => {
    state.filterEstado = c.dataset.filter; render();
  }));

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => { state.search = e.target.value; render(); });
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  document.querySelectorAll('.row[data-select]').forEach(r => r.addEventListener('click', () => {
    const id = parseInt(r.dataset.select, 10);
    state.selectedId = state.selectedId === id ? null : id;
    render();
  }));

  document.getElementById('btn-close-detail')?.addEventListener('click', () => { state.selectedId = null; render(); });

  document.querySelectorAll('.estado-btn').forEach(b => b.addEventListener('click', () => {
    cambiarEstado(parseInt(b.dataset.id, 10), b.dataset.estado);
  }));

  document.getElementById('btn-enviar-comentario')?.addEventListener('click', (e) => {
    const id = parseInt(e.target.closest('button').dataset.id, 10);
    const autor = document.getElementById('comment-autor').value.trim();
    const texto = document.getElementById('comment-texto').value;
    if (autor) recordarNombre(autor);
    agregarComentario(id, texto);
  });

  // Inventario
  document.getElementById('btn-toggle-inv-form')?.addEventListener('click', () => { state.showInvForm = !state.showInvForm; render(); });
  document.getElementById('btn-cancelar-inv')?.addEventListener('click', () => { state.showInvForm = false; render(); });
  document.getElementById('btn-guardar-inv')?.addEventListener('click', () => {
    const nombre = document.getElementById('inv-nombre').value.trim();
    if (!nombre) return;
    agregarInventario({
      nombre,
      cantidad: document.getElementById('inv-cantidad').value.trim(),
      ubicacion: document.getElementById('inv-ubicacion').value.trim(),
      notas: document.getElementById('inv-notas').value.trim(),
    });
  });
  document.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    quitarInventario(parseInt(b.dataset.quitar, 10));
  }));
}

// ====== Init ======
cargarTodo(false);
setInterval(() => cargarTodo(true), 15000);
