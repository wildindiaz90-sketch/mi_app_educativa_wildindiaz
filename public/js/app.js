/* Calendario Académico RD — utilidades compartidas del frontend */
(function () {
  const TZ = 'America/Santo_Domingo';
  const TOKEN_KEY = 'cal_token';
  const USER_KEY = 'cal_user';

  const App = (window.App = {});

  /* ---------- Sesión ---------- */
  App.token = () => localStorage.getItem(TOKEN_KEY);
  App.user = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
  App.setSession = (token, user) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); };
  App.logout = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.href = '/login'; };

  /* ---------- API ---------- */
  App.api = async function (path, { method = 'GET', body, params } = {}) {
    let url = '/api' + path;
    if (params) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
      const s = qs.toString();
      if (s) url += '?' + s;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (App.token()) headers.Authorization = 'Bearer ' + App.token();
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && !location.pathname.startsWith('/login')) { App.logout(); throw new Error('Sesión expirada'); }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Error de servidor');
      err.detalles = data.detalles;
      throw err;
    }
    return data;
  };

  /* ---------- Utilidades ---------- */
  App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  App.DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  App.pad = (n) => String(n).padStart(2, '0');
  App.iso = (y, m, d) => `${y}-${App.pad(m + 1)}-${App.pad(d)}`; // m: 0-11
  App.hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // AAAA-MM-DD en hora de RD
  App.parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  App.toIso = (dt) => dt.toISOString().slice(0, 10);
  App.addDays = (s, n) => { const d = App.parseIso(s); d.setUTCDate(d.getUTCDate() + n); return App.toIso(d); };

  App.fmtFecha = (ts) => new Intl.DateTimeFormat('es-DO', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts)).replace('.', '');
  App.fmtCorta = (ts) => new Intl.DateTimeFormat('es-DO', { timeZone: TZ, day: '2-digit', month: 'short' }).format(new Date(ts)).replace('.', '');
  App.fmtHora = (ts) => new Intl.DateTimeFormat('es-DO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts));
  // datetime-local (sin zona) <-> ISO con zona de RD (UTC-4, sin horario de verano)
  App.localToIso = (v) => (v ? v + ':00-04:00' : null);
  App.isoToLocal = (ts) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  App.diasHasta = (ts) => Math.ceil((new Date(ts) - new Date()) / 86400000);

  App.TIPOS = { tarea: 'Tarea', proyecto: 'Proyecto', exposicion: 'Exposición', prueba: 'Prueba', practica: 'Práctica' };
  App.ESTADOS = { pendiente: 'Pendiente', en_curso: 'En curso', entregada: 'Entregada', evaluada: 'Evaluada' };
  App.ICONOS_TIPO = { tarea: 'assignment', proyecto: 'menu_book', exposicion: 'co_present', prueba: 'quiz', practica: 'architecture' };
  // Códigos de color institucionales (DESIGN.md)
  App.COLOR_EVENTO = {
    feriado: { label: 'Feriado', fg: '#DC2626', bg: '#FEF2F2', borde: '#FCA5A5', txt: '#991B1B' },
    minerd: { label: 'Oficial MINERD', fg: '#2563EB', bg: '#EFF6FF', borde: '#BFDBFE', txt: '#1E40AF' },
    docencia: { label: 'Docencia', fg: '#059669', bg: '#ECFDF5', borde: '#A7F3D0', txt: '#065F46' },
    evaluacion: { label: 'Evaluación', fg: '#D97706', bg: '#FFFBEB', borde: '#FCD34D', txt: '#92400E' },
  };

  App.toast = function (msg, tipo = 'ok') {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.className = 'fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-semibold text-white ' + (tipo === 'error' ? 'bg-[#BA1A1A]' : 'bg-[#003876]');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  /* ---------- Catálogos (con caché de sesión) ---------- */
  let _catalogos;
  App.catalogos = async () => (_catalogos ||= await App.api('/catalogos'));

  /* ---------- Shell: navegación, usuario, eventos ---------- */
  const RUTAS = { 'Dashboard Mensual': '/dashboard', 'Vista Semanal': '/semana', 'Actividades y Tareas': '/actividades', 'Calificaciones': '/calificaciones' };

  App.initShell = function () {
    if (!App.token()) { location.href = '/login'; return false; }
    const user = App.user();

    // Enlaces de la barra lateral
    document.querySelectorAll('aside a').forEach((a) => {
      const label = a.textContent.replace(/\s+/g, ' ').trim();
      const key = Object.keys(RUTAS).find((k) => label.includes(k));
      if (key) a.setAttribute('href', RUTAS[key]);
      else if (label.includes('Eventos MINERD')) { a.setAttribute('href', '#'); a.addEventListener('click', (e) => { e.preventDefault(); App.abrirModalEvento(); }); }
      else if (label.includes('Reportes')) a.setAttribute('href', '/reportes');
    });
    // Botones "Nuevo Evento"
    document.querySelectorAll('aside button').forEach((b) => {
      if (/Nuevo Evento/i.test(b.textContent)) b.addEventListener('click', () => App.abrirModalEvento());
    });
    // Navegación del encabezado y marca → dashboard
    document.querySelectorAll('header span, header a').forEach((el) => {
      if (/^Calendario Académico RD$/.test(el.textContent.trim())) { el.style.cursor = 'pointer'; el.addEventListener('click', () => (location.href = '/dashboard')); }
    });

    // Usuario en el encabezado
    if (user) {
      document.querySelectorAll('header *').forEach((el) => {
        if (el.children.length) return;
        const t = el.textContent.trim();
        if (/^Prof\./.test(t)) el.textContent = user.nombre;
        else if (/Docente Titular|Matemáticas y Física/.test(t)) el.textContent = user.distrito || 'Docente';
      });
    }
    // Avatar → cerrar sesión
    const img = document.querySelector('header img');
    if (img) {
      img.removeAttribute('alt'); img.alt = 'Perfil del docente';
      img.style.cursor = 'pointer'; img.title = 'Cerrar sesión';
      img.addEventListener('click', () => { if (confirm('¿Cerrar sesión?')) App.logout(); });
    }
    // Buscador global → listado de actividades
    document.querySelectorAll('header input[type="text"]').forEach((inp) => {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) location.href = '/actividades?q=' + encodeURIComponent(inp.value.trim()); });
    });
    // Botones de "Cambiar Modo" y notificaciones sin backend aún
    document.querySelectorAll('header button').forEach((b) => {
      if (/Cambiar Modo/i.test(b.textContent)) b.addEventListener('click', () => App.toast('El modo estudiante estará disponible próximamente'));
    });
    return true;
  };

  /* ---------- Modal: nuevo evento ---------- */
  App.abrirModalEvento = function (fechaInicial) {
    if (document.getElementById('modal-evento')) return;
    const hoy = fechaInicial || App.hoy();
    const wrap = document.createElement('div');
    wrap.id = 'modal-evento';
    wrap.className = 'fixed inset-0 z-[90] flex items-center justify-center p-4';
    wrap.style.cssText = 'background:rgba(30,41,59,.4);backdrop-filter:blur(4px)';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl w-full max-w-lg p-6 space-y-4" style="box-shadow:0 20px 25px -5px rgba(0,56,118,.1)">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-[#00234e]">Nuevo evento</h2>
          <button type="button" data-cerrar class="p-1 rounded hover:bg-slate-100" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button>
        </div>
        <label class="block text-sm font-semibold">Título *
          <input name="titulo" required minlength="2" maxlength="200" class="mt-1 w-full border border-[#c3c6d2] rounded-lg px-3 py-2 font-normal" placeholder="Ej. Cierre de Parciales P2"/></label>
        <label class="block text-sm font-semibold">Tipo de evento
          <select name="tipo" class="mt-1 w-full border border-[#c3c6d2] rounded-lg px-3 py-2 font-normal">
            <option value="minerd">Oficial MINERD</option>
            <option value="docencia">Docencia (taller, reunión, jornada)</option>
            <option value="evaluacion">Evaluación / registro de grado</option>
          </select></label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm font-semibold">Fecha inicio *
            <input type="date" name="fecha_inicio" required value="${hoy}" class="mt-1 w-full border border-[#c3c6d2] rounded-lg px-3 py-2 font-normal"/></label>
          <label class="block text-sm font-semibold">Fecha fin
            <input type="date" name="fecha_fin" value="${hoy}" class="mt-1 w-full border border-[#c3c6d2] rounded-lg px-3 py-2 font-normal"/></label>
        </div>
        <label class="block text-sm font-semibold">Descripción
          <textarea name="descripcion" rows="3" maxlength="2000" class="mt-1 w-full border border-[#c3c6d2] rounded-lg px-3 py-2 font-normal"></textarea></label>
        <p data-error class="text-sm text-[#BA1A1A] hidden"></p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-cerrar class="px-4 py-2 rounded-lg border border-[#c3c6d2] font-semibold text-sm">Cancelar</button>
          <button type="submit" class="px-4 py-2 rounded-lg bg-[#003876] text-white font-semibold text-sm">Guardar evento</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    const cerrar = () => wrap.remove();
    wrap.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) cerrar(); });
    const form = wrap.querySelector('form');
    form.fecha_inicio.addEventListener('change', () => { if (form.fecha_fin.value < form.fecha_inicio.value) form.fecha_fin.value = form.fecha_inicio.value; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('[data-error]');
      err.classList.add('hidden');
      try {
        await App.api('/eventos', { method: 'POST', body: {
          titulo: form.titulo.value, tipo: form.tipo.value, fecha_inicio: form.fecha_inicio.value,
          fecha_fin: form.fecha_fin.value || form.fecha_inicio.value, descripcion: form.descripcion.value || null,
        } });
        cerrar();
        App.toast('Evento guardado');
        document.dispatchEvent(new CustomEvent('evento-creado'));
      } catch (ex) {
        err.textContent = ex.detalles ? ex.detalles.map((d) => d.mensaje).join('. ') : ex.message;
        err.classList.remove('hidden');
      }
    });
    form.titulo.focus();
  };
})();
