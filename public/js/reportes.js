/* Reporte de todas las actividades con sus calificaciones */
(async function () {
  if (!App.initShell()) return;
  const { esc } = App;
  const $ = (id) => document.getElementById(id);
  const f = { periodo_id: '', grupo_id: '', area_id: '' };
  let datos = null;
  let expandido = false;

  const fmt = (n, d = 1) => (n === null || n === undefined ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ','));
  const cat = await App.catalogos();
  const hoy = App.hoy();
  const actual = cat.periodos.find((p) => hoy >= p.fecha_inicio && hoy <= p.fecha_fin);
  if (actual) f.periodo_id = String(actual.id);

  $('r-periodo').innerHTML = '<option value="">Todos los períodos</option>' + cat.periodos.map((p) => `<option value="${p.id}">${esc(p.anio_escolar)} · ${esc(p.nombre.split(' - ')[0])}</option>`).join('');
  $('r-grupo').innerHTML = '<option value="">Todos los grupos</option>' + cat.grupos.map((g) => `<option value="${g.id}">${esc(g.grado)} ${esc(g.seccion)}</option>`).join('');
  $('r-area').innerHTML = '<option value="">Todas las áreas</option>' + cat.areas.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
  $('r-periodo').value = f.periodo_id;
  if (actual) {
    document.querySelectorAll('[data-anio]').forEach((el) => (el.textContent = 'Año Escolar ' + actual.anio_escolar));
    document.querySelectorAll('[data-periodo]').forEach((el) => (el.textContent = 'Período ' + actual.codigo));
  }

  const ESTILO = {
    pendiente: 'bg-amber-50 text-amber-700 border-amber-200', en_curso: 'bg-blue-50 text-blue-700 border-blue-200',
    entregada: 'bg-purple-50 text-purple-700 border-purple-200', evaluada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  function stats(r) {
    const card = (t, v, color, ic, bg) => `<div class="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between shadow-sm">
      <div><span class="text-label-sm font-label-sm text-outline block">${t}</span><span class="text-headline-md font-headline-md font-bold" style="color:${color}">${v}</span></div>
      <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:${bg};color:${color}"><span class="material-symbols-outlined">${ic}</span></div></div>`;
    $('stats-rep').innerHTML =
      card('Actividades', r.actividades, '#003876', 'assignment', '#EFF6FF') +
      card('Con calificaciones', r.con_calificaciones, '#003876', 'grading', '#EFF6FF') +
      card('Calificadas por completo', r.completas, '#059669', 'task_alt', '#ECFDF5') +
      card('Promedio general', r.promedio_general_pct === null ? '—' : fmt(r.promedio_general_pct) + ' %', '#D97706', 'functions', '#FFFBEB');
  }

  function detalle(a) {
    if (!a.calificaciones.length) return '<p class="p-4 text-body-sm text-outline">Este grupo no tiene estudiantes registrados. Agréguelos en <a class="text-primary underline font-semibold" href="/calificaciones?actividad=' + a.id + '">Calificaciones</a>.</p>';
    return `<table class="w-full text-left text-body-sm font-body-sm"><thead class="bg-surface-container-low text-label-sm text-outline uppercase">
      <tr><th class="py-2 px-4 w-12">#</th><th class="py-2 px-4">Estudiante</th><th class="py-2 px-4 w-32">Calificación</th><th class="py-2 px-4 w-20">%</th><th class="py-2 px-4">Observación</th></tr></thead><tbody class="divide-y divide-outline-variant">
      ${a.calificaciones.map((c, i) => {
        const pct = c.puntos === null ? null : (c.puntos / a.puntos) * 100;
        return `<tr><td class="py-2 px-4 text-outline">${i + 1}</td><td class="py-2 px-4 font-semibold">${esc(c.estudiante)}</td>
          <td class="py-2 px-4">${c.puntos === null ? '<span class="text-outline">Sin calificar</span>' : `${fmt(c.puntos, 2)} / ${fmt(a.puntos, 2)}`}</td>
          <td class="py-2 px-4 font-semibold" style="color:${pct === null ? '' : pct >= 70 ? '#059669' : '#bb0112'}">${pct === null ? '—' : Math.round(pct) + ' %'}</td>
          <td class="py-2 px-4 text-on-surface-variant">${esc(c.observacion)}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function lista(items) {
    if (!items.length) { $('rep-lista').innerHTML = '<div class="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center text-outline">No hay actividades con estos filtros.</div>'; return; }
    $('rep-lista').innerHTML = items.map((a) => {
      const pctProm = a.promedio === null ? null : (a.promedio / a.puntos) * 100;
      const apr = a.calificados ? Math.round((a.aprobados / a.calificados) * 100) : null;
      return `<article class="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden" data-act="${a.id}">
        <button class="w-full text-left p-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-surface-container-low transition-colors" data-toggle aria-expanded="${expandido}">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-primary text-body-md">${esc(a.titulo)}</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm border ${ESTILO[a.estado]}">${esc(App.ESTADOS[a.estado])}</span>
            </div>
            <div class="mt-1 flex items-center gap-1.5 flex-wrap text-label-sm font-label-sm">
              <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">${esc(a.area)}</span>
              <span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">${esc(a.grado)} ${esc(a.seccion)}</span>
              <span class="text-outline">${esc(App.TIPOS[a.tipo])} · Entrega ${esc(App.fmtFecha(a.fecha_entrega))} · ${esc(a.periodo_codigo || '—')}</span>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-4 text-center shrink-0 text-body-sm">
            <div><span class="block text-label-sm text-outline">Calificados</span><strong>${a.calificados} / ${a.estudiantes}</strong></div>
            <div><span class="block text-label-sm text-outline">Promedio</span><strong>${a.promedio === null ? '—' : fmt(a.promedio, 2) + ' / ' + fmt(a.puntos, 2)}</strong>${pctProm === null ? '' : `<span class="block text-label-sm text-outline">${Math.round(pctProm)} %</span>`}</div>
            <div><span class="block text-label-sm text-outline">Máx. / Mín.</span><strong>${a.maximo === null ? '—' : fmt(a.maximo, 1) + ' / ' + fmt(a.minimo, 1)}</strong></div>
            <div><span class="block text-label-sm text-outline">Aprobados</span><strong>${apr === null ? '—' : apr + ' %'}</strong></div>
          </div>
          <span class="material-symbols-outlined text-outline no-print" data-chev>${expandido ? 'expand_less' : 'expand_more'}</span>
        </button>
        <div class="rep-detalle border-t border-outline-variant ${expandido ? '' : 'hidden'}" data-detalle>
          ${detalle(a)}
          <div class="p-3 text-right no-print"><a href="/calificaciones?actividad=${a.id}" class="text-label-md font-semibold text-primary hover:underline">Editar calificaciones</a></div>
        </div></article>`;
    }).join('');
  }

  async function cargar() {
    $('rep-lista').innerHTML = '<p class="text-center text-outline p-10">Cargando reporte…</p>';
    try {
      datos = await App.api('/reportes/actividades', { params: f });
      stats(datos.resumen); lista(datos.items);
      $('rep-nota').textContent = `Aprobado: ${datos.umbral_aprobado} % o más de los puntos de la actividad. Generado el ${App.fmtFecha(new Date())}.`;
    } catch (e) { $('rep-lista').innerHTML = `<p class="text-center text-[#BA1A1A] p-10">${esc(e.message)}</p>`; }
  }

  $('r-periodo').addEventListener('change', (e) => { f.periodo_id = e.target.value; cargar(); });
  $('r-grupo').addEventListener('change', (e) => { f.grupo_id = e.target.value; cargar(); });
  $('r-area').addEventListener('change', (e) => { f.area_id = e.target.value; cargar(); });

  $('rep-lista').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]'); if (!t) return;
    const d = t.parentElement.querySelector('[data-detalle]');
    const abierto = d.classList.toggle('hidden') === false;
    t.setAttribute('aria-expanded', abierto);
    t.querySelector('[data-chev]').textContent = abierto ? 'expand_less' : 'expand_more';
  });
  $('btn-expandir').addEventListener('click', () => {
    expandido = !expandido;
    $('btn-expandir').querySelector('span:last-child').textContent = expandido ? 'Contraer todo' : 'Expandir todo';
    lista(datos ? datos.items : []);
  });
  $('btn-imprimir').addEventListener('click', () => {
    const previo = expandido; expandido = true; lista(datos ? datos.items : []); expandido = previo;
    setTimeout(() => { window.print(); lista(datos ? datos.items : []); }, 50);
  });
  $('btn-csv').addEventListener('click', () => {
    if (!datos || !datos.items.length) return App.toast('No hay datos para exportar', 'error');
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Actividad', 'Área', 'Grupo', 'Período', 'Tipo', 'Fecha de entrega', 'Puntos máximos', 'Estudiante', 'Calificación', 'Porcentaje', 'Observación']];
    datos.items.forEach((a) => {
      const base = [a.titulo, a.area, `${a.grado} ${a.seccion}`, a.periodo_codigo || '', App.TIPOS[a.tipo], App.fmtFecha(a.fecha_entrega), a.puntos];
      if (!a.calificaciones.length) filas.push([...base, '', '', '', '']);
      a.calificaciones.forEach((c) => filas.push([...base, c.estudiante, c.puntos ?? '', c.puntos === null ? '' : Math.round((c.puntos / a.puntos) * 100), c.observacion]));
    });
    const blob = new Blob(['\ufeff' + filas.map((r) => r.map(celda).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reporte-calificaciones.csv'; a.click(); URL.revokeObjectURL(a.href);
  });

  cargar();
})();
