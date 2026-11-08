/* Listado de actividades y tareas */
(async function () {
  if (!App.initShell()) return;
  const { esc } = App;
  const $ = (id) => document.getElementById(id);
  const qp = new URLSearchParams(location.search);
  const f = { q: qp.get('q') || '', grupo_id: '', periodo_id: '', area_id: '', tipo: '', estado: '', rango: 'todo', page: 1, limit: 10 };
  const sel = new Set();
  let ultimo = null;

  const cat = await App.catalogos();
  const hoy = App.hoy();
  const actual = cat.periodos.find((p) => hoy >= p.fecha_inicio && hoy <= p.fecha_fin);
  $('f-q').value = f.q;
  $('f-grupo').innerHTML = '<option value="">Grupo: Todos</option>' + cat.grupos.map((g) => `<option value="${g.id}">${esc(g.grado)} ${esc(g.seccion)} (${g.estudiantes} alumnos)</option>`).join('');
  $('f-periodo').innerHTML = '<option value="">Período: Todos</option>' + cat.periodos.map((p) => `<option value="${p.id}">${esc(p.anio_escolar)} · ${esc(p.nombre.split(' - ')[0])}</option>`).join('');
  $('f-areas').innerHTML = ['<button data-area="" class="chip">Todas</button>', ...cat.areas.map((a) => `<button data-area="${a.id}" class="chip">${esc(a.nombre)}</button>`)].join('');
  if (actual) {
    document.querySelectorAll('[data-anio]').forEach((el) => (el.textContent = 'Año Escolar ' + actual.anio_escolar));
    document.querySelectorAll('[data-periodo]').forEach((el) => (el.textContent = 'Período ' + actual.codigo));
    document.querySelectorAll('[data-periodo-largo]').forEach((el) => (el.textContent = actual.nombre.split(' - ')[0]));
  }

  const ON = ['bg-primary', 'text-on-primary', 'font-bold'];
  function pintarFiltros() {
    document.querySelectorAll('#f-areas .chip').forEach((b) => {
      const on = b.dataset.area === String(f.area_id);
      b.className = 'chip px-2.5 py-1 rounded-full text-label-sm font-label-sm border ' + (on ? 'bg-primary text-on-primary border-primary font-bold' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container');
    });
    document.querySelectorAll('[data-tipo]').forEach((b) => ON.forEach((c) => b.classList.toggle(c, b.dataset.tipo === f.tipo)));
    document.querySelectorAll('[data-rango]').forEach((b) => ON.forEach((c) => b.classList.toggle(c, b.dataset.rango === f.rango)));
    document.querySelectorAll('[data-estado]').forEach((b) => b.classList.toggle('ring-2', b.dataset.estado === f.estado));
  }

  function rangoFechas() {
    if (f.rango === 'semana') {
      const dow = App.parseIso(hoy).getUTCDay();
      const lunes = App.addDays(hoy, dow === 0 ? -6 : 1 - dow);
      return { desde: lunes, hasta: App.addDays(lunes, 6) };
    }
    if (f.rango === 'mes') return { desde: hoy.slice(0, 8) + '01', hasta: App.toIso(new Date(Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7), 0))) };
    return {};
  }

  const ESTILO_ESTADO = {
    pendiente: 'bg-amber-50 text-amber-700 border-amber-200', en_curso: 'bg-blue-50 text-blue-700 border-blue-200',
    entregada: 'bg-purple-50 text-purple-700 border-purple-200', evaluada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const BARRA = { pendiente: '#D97706', en_curso: '#003876', entregada: '#7C3AED', evaluada: '#059669' };

  function fila(a) {
    const dias = App.diasHasta(a.fecha_entrega);
    const urgente = ['pendiente', 'en_curso'].includes(a.estado) && dias >= 0 && dias <= 1;
    const pct = a.estudiantes ? Math.min(100, Math.round((a.entregas_recibidas / a.estudiantes) * 100)) : 0;
    return `<tr class="hover:bg-surface-container-low transition-colors group">
      <td class="py-3.5 px-4 text-center"><input type="checkbox" data-id="${a.id}" class="rounded border-outline text-primary h-4 w-4" ${sel.has(a.id) ? 'checked' : ''}/></td>
      <td class="py-3.5 px-4"><div class="flex flex-col gap-1">
        <span class="font-semibold text-primary">${esc(a.titulo)}</span>
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="px-2 py-0.5 rounded text-label-sm font-label-sm bg-blue-50 text-blue-800 border border-blue-200">${esc(a.area)}</span>
          <span class="px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container text-on-surface-variant">${esc(a.grado)} ${esc(a.seccion)}</span>
        </div></div></td>
      <td class="py-3.5 px-4"><div class="flex items-center gap-1.5 text-on-surface">
        <span class="material-symbols-outlined text-[18px] text-primary-container">${App.ICONOS_TIPO[a.tipo]}</span>
        <span class="text-label-md font-label-md">${esc(App.TIPOS[a.tipo])}</span></div></td>
      <td class="py-3.5 px-4"><div class="flex flex-col">
        <span class="text-label-sm font-label-sm text-outline">Asig: ${esc(App.fmtFecha(a.fecha_asignacion))}</span>
        <span class="text-label-sm font-semibold ${urgente ? 'text-secondary' : 'text-on-surface'}">${urgente ? '⚠ ' : ''}Límite: ${esc(App.fmtFecha(a.fecha_entrega))}, ${esc(App.fmtHora(a.fecha_entrega))}</span></div></td>
      <td class="py-3.5 px-4 text-center"><span class="px-2 py-0.5 rounded bg-surface-container-high font-bold text-label-sm text-primary">${esc(a.periodo_codigo || '—')}</span></td>
      <td class="py-3.5 px-4"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-label-sm border ${ESTILO_ESTADO[a.estado]}">
        <span class="h-2 w-2 rounded-full" style="background:${BARRA[a.estado]}"></span>${esc(App.ESTADOS[a.estado])}</span></td>
      <td class="py-3.5 px-4"><div class="flex flex-col gap-1 w-full max-w-[130px]">
        <div class="flex justify-between text-label-sm font-label-sm"><span class="font-bold text-on-surface">${a.entregas_recibidas} / ${a.estudiantes}</span><span class="text-outline">${pct}%</span></div>
        <div class="w-full bg-surface-container h-1.5 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${BARRA[a.estado]}"></div></div></div></td>
      <td class="py-3.5 px-4 text-right"><div class="flex items-center justify-end gap-1">
        <button data-editar="${a.id}" title="Editar" class="p-1.5 hover:bg-surface-container-high rounded text-on-surface hover:text-primary"><span class="material-symbols-outlined text-[18px]">edit</span></button>
        <button data-borrar="${a.id}" title="Eliminar" class="p-1.5 hover:bg-surface-container-high rounded text-outline hover:text-secondary"><span class="material-symbols-outlined text-[18px]">delete</span></button></div></td>
    </tr>`;
  }

  function renderStats(k) {
    const card = (t, v, color, ic, bg) => `<div class="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between shadow-sm">
      <div><span class="text-label-sm font-label-sm text-outline block">${t}</span><span class="text-headline-md font-headline-md font-bold" style="color:${color}">${v}</span></div>
      <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:${bg};color:${color}"><span class="material-symbols-outlined">${ic}</span></div></div>`;
    $('stats-lista').innerHTML = card('Total Registradas', k.total, '#003876', 'assignment', '#EFF6FF') + card('En Curso / Activas', k.en_curso, '#003876', 'timelapse', '#EFF6FF') +
      card('Próximas a Vencer', k.proximas, '#bb0112', 'alarm', '#FEF2F2') + card('Evaluadas', k.evaluadas, '#059669', 'fact_check', '#ECFDF5');
  }

  function renderPaginacion(d) {
    const paginas = Math.max(1, Math.ceil(d.total / d.limit));
    const desde = d.total ? (d.page - 1) * d.limit + 1 : 0, hasta = Math.min(d.page * d.limit, d.total);
    const btn = (p, txt, dis, on) => `<button data-page="${p}" ${dis ? 'disabled' : ''} class="px-3 py-1 rounded-lg font-label-md ${on ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'} disabled:opacity-40">${txt}</button>`;
    const nums = []; for (let p = Math.max(1, d.page - 2); p <= Math.min(paginas, d.page + 2); p++) nums.push(btn(p, p, false, p === d.page));
    $('paginacion').innerHTML = `<div class="flex items-center gap-2 text-body-sm text-on-surface-variant">
      <span>Mostrando <strong>${desde}-${hasta}</strong> de <strong>${d.total}</strong> actividades</span><span class="text-outline-variant">·</span>
      <label class="flex items-center gap-1 text-label-sm text-outline">Por página:
        <select id="por-pagina" class="py-0.5 px-2 border border-outline-variant rounded text-label-sm">${[5, 10, 25, 50].map((n) => `<option ${n === d.limit ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="flex items-center space-x-1">${btn(d.page - 1, '‹', d.page <= 1)}${nums.join('')}${btn(d.page + 1, '›', d.page >= paginas)}</div>`;
    $('por-pagina').addEventListener('change', (e) => { f.limit = +e.target.value; f.page = 1; cargar(); });
    $('paginacion').querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { f.page = +b.dataset.page; cargar(); }));
  }

  async function cargar() {
    pintarFiltros();
    try {
      const d = (ultimo = await App.api('/actividades', { params: { q: f.q, grupo_id: f.grupo_id, periodo_id: f.periodo_id, area_id: f.area_id, tipo: f.tipo, estado: f.estado, page: f.page, limit: f.limit, ...rangoFechas() } }));
      renderStats(d.kpis);
      $('tbody-actividades').innerHTML = d.items.length ? d.items.map(fila).join('') :
        '<tr><td colspan="8" class="py-12 text-center text-outline">No hay actividades con estos filtros. <a href="/actividad-form" class="text-primary font-semibold underline">Crear una actividad</a></td></tr>';
      const total = Object.values(d.conteos).reduce((a, b) => a + b, 0);
      document.querySelectorAll('[data-estado]').forEach((b) => {
        const n = b.dataset.estado === '' ? total : d.conteos[b.dataset.estado];
        const lbl = b.dataset.estado === '' ? 'Todos' : App.ESTADOS[b.dataset.estado];
        b.innerHTML = `${lbl} <span class="ml-1 font-bold">${n}</span>`;
      });
      document.querySelectorAll('aside a[href="/actividades"] span:last-child').forEach((s) => { if (/^\d+$/.test(s.textContent.trim())) s.textContent = d.kpis.total; });
      renderPaginacion(d);
      actualizarSel();
    } catch (e) { $('tbody-actividades').innerHTML = `<tr><td colspan="8" class="py-10 text-center text-[#BA1A1A]">${esc(e.message)}</td></tr>`; }
  }
  function actualizarSel() { $('sel-count').textContent = `${sel.size} seleccionados`; }

  // Eventos
  let t; $('f-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); f.page = 1; cargar(); }, 300); });
  $('f-grupo').addEventListener('change', (e) => { f.grupo_id = e.target.value; f.page = 1; cargar(); });
  $('f-periodo').addEventListener('change', (e) => { f.periodo_id = e.target.value; f.page = 1; cargar(); });
  $('f-areas').addEventListener('click', (e) => { const b = e.target.closest('[data-area]'); if (b) { f.area_id = b.dataset.area; f.page = 1; cargar(); } });
  document.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => { f.tipo = b.dataset.tipo; f.page = 1; cargar(); }));
  document.querySelectorAll('[data-rango]').forEach((b) => b.addEventListener('click', () => { f.rango = b.dataset.rango; f.page = 1; cargar(); }));
  document.querySelectorAll('[data-estado]').forEach((b) => b.addEventListener('click', () => { f.estado = b.dataset.estado; f.page = 1; cargar(); }));
  $('f-reset').addEventListener('click', () => { Object.assign(f, { q: '', grupo_id: '', periodo_id: '', area_id: '', tipo: '', estado: '', rango: 'todo', page: 1 }); $('f-q').value = ''; $('f-grupo').value = ''; $('f-periodo').value = ''; cargar(); });
  $('btn-nueva').addEventListener('click', () => (location.href = '/actividad-form'));
  $('chk-todos').addEventListener('change', (e) => { (ultimo?.items || []).forEach((a) => (e.target.checked ? sel.add(a.id) : sel.delete(a.id))); document.querySelectorAll('#tbody-actividades input[type=checkbox]').forEach((c) => (c.checked = e.target.checked)); actualizarSel(); });
  $('tbody-actividades').addEventListener('click', async (e) => {
    const chk = e.target.closest('input[data-id]'); if (chk) { chk.checked ? sel.add(+chk.dataset.id) : sel.delete(+chk.dataset.id); actualizarSel(); return; }
    const ed = e.target.closest('[data-editar]'); if (ed) location.href = '/actividad-form?id=' + ed.dataset.editar;
    const bo = e.target.closest('[data-borrar]');
    if (bo && confirm('¿Eliminar esta actividad? Esta acción no se puede deshacer.')) {
      try { await App.api('/actividades/' + bo.dataset.borrar, { method: 'DELETE' }); sel.delete(+bo.dataset.borrar); App.toast('Actividad eliminada'); cargar(); } catch (er) { App.toast(er.message, 'error'); }
    }
  });
  $('btn-revisadas').addEventListener('click', async () => {
    if (!sel.size) return App.toast('Seleccione al menos una actividad', 'error');
    try { await Promise.all([...sel].map((id) => App.api(`/actividades/${id}/estado`, { method: 'PATCH', body: { estado: 'evaluada' } }))); sel.clear(); App.toast('Actividades marcadas como evaluadas'); cargar(); } catch (er) { App.toast(er.message, 'error'); }
  });
  $('btn-exportar').addEventListener('click', async () => {
    const d = await App.api('/actividades', { params: { q: f.q, grupo_id: f.grupo_id, periodo_id: f.periodo_id, area_id: f.area_id, tipo: f.tipo, estado: f.estado, limit: 100, ...rangoFechas() } });
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Título', 'RA', 'Área', 'Grado', 'Sección', 'Tipo', 'Estado', 'Asignación', 'Entrega', 'Puntos'], ...d.items.map((a) => [a.titulo, a.ra, a.area, a.grado, a.seccion, App.TIPOS[a.tipo], App.ESTADOS[a.estado], a.fecha_asignacion, a.fecha_entrega, a.puntos])];
    const blob = new Blob(['\ufeff' + filas.map((r) => r.map(celda).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'actividades.csv'; a.click(); URL.revokeObjectURL(a.href);
  });
  document.addEventListener('evento-creado', () => {});
  cargar();
})();
