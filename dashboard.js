/* Dashboard mensual */
(async function () {
  if (!App.initShell()) return;
  const { esc, pad, MESES, COLOR_EVENTO } = App;

  const params = new URLSearchParams(location.search);
  const hoy = App.hoy();
  let [anio, mes] = (/^\d{4}-\d{2}$/.test(params.get('mes') || '') ? params.get('mes') : hoy.slice(0, 7)).split('-').map(Number);
  mes -= 1; // 0-11

  const $ = (id) => document.getElementById(id);
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  function rangoGrilla() {
    const primero = new Date(Date.UTC(anio, mes, 1));
    const offset = primero.getUTCDay(); // 0 = domingo
    const inicio = App.addDays(App.iso(anio, mes, 1), -offset);
    const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    const semanas = Math.ceil((offset + diasMes) / 7);
    return { inicio, fin: App.addDays(inicio, semanas * 7 - 1), semanas };
  }

  function chipEvento(e) {
    const c = COLOR_EVENTO[e.tipo];
    return `<div class="truncate text-[11px] font-semibold leading-tight px-1.5 py-0.5 rounded border-l-[3px]" title="${esc(c.label)}: ${esc(e.titulo)}"
      style="background:${c.bg};color:${c.txt};border-color:${c.fg}">${e.tipo === 'feriado' ? '<span class="material-symbols-outlined align-middle" style="font-size:11px">flag</span> ' : ''}${esc(e.titulo)}</div>`;
  }
  function chipActividad(a) {
    const c = COLOR_EVENTO.docencia;
    return `<a href="/actividad-form?id=${a.id}" class="block truncate text-[11px] font-semibold leading-tight px-1.5 py-0.5 rounded border-l-[3px] hover:brightness-95"
      title="${esc(a.titulo)} — ${esc(a.area)} ${esc(a.grado)} ${esc(a.seccion)} (${esc(App.ESTADOS[a.estado])})"
      style="background:${c.bg};color:${c.txt};border-color:${c.fg}">• ${esc(a.titulo)}</a>`;
  }

  function renderGrilla(data, rango) {
    const porDia = {};
    const push = (d, html) => (porDia[d] ||= []).push(html);
    const feriados = new Set();
    data.eventos.forEach((e) => {
      for (let d = e.fecha_inicio; d <= e.fecha_fin; d = App.addDays(d, 1)) {
        push(d, chipEvento(e));
        if (e.tipo === 'feriado') feriados.add(d);
      }
    });
    data.actividades.forEach((a) => push(a.dia_entrega, chipActividad(a)));

    let html = '';
    for (let i = 0; i < rango.semanas * 7; i++) {
      const d = App.addDays(rango.inicio, i);
      const num = Number(d.slice(8));
      const delMes = d.slice(0, 7) === `${anio}-${pad(mes + 1)}`;
      const dow = i % 7;
      const esHoy = d === hoy;
      const esFeriado = feriados.has(d);
      const numColor = dow === 0 || esFeriado ? 'text-secondary' : 'text-on-surface';
      const base = delMes ? (esFeriado ? 'bg-[#FEF2F2]' : 'bg-surface-container-lowest') : 'bg-surface-container-lowest/40 opacity-40';
      html += `<div data-fecha="${d}" class="min-h-[115px] p-1.5 ${base} ${delMes ? 'hover:bg-surface-container-low cursor-pointer' : ''} transition-colors flex flex-col gap-1 ${esHoy ? 'ring-2 ring-inset ring-primary' : ''}">
        <div class="flex items-center justify-between">
          ${esHoy ? '<span class="text-[10px] font-bold text-primary tracking-wide">HOY</span>' : (esFeriado && delMes ? '<span class="text-[10px] font-bold text-white bg-secondary rounded px-1">FERIADO</span>' : '<span></span>')}
          <span class="text-label-md font-label-md ${delMes ? numColor : 'text-outline'} ${esHoy ? 'bg-primary text-white rounded-full w-6 h-6 inline-flex items-center justify-center' : ''}">${num}</span>
        </div>
        ${(porDia[d] || []).slice(0, 3).join('')}
        ${(porDia[d] || []).length > 3 ? `<span class="text-[10px] text-outline font-semibold">+${porDia[d].length - 3} más</span>` : ''}
      </div>`;
    }
    $('cal-grid').innerHTML = html;
    $('cal-grid').querySelectorAll('[data-fecha]').forEach((cell) => {
      cell.addEventListener('click', (ev) => {
        if (ev.target.closest('a')) return;
        location.href = '/actividad-form?fecha=' + cell.dataset.fecha;
      });
    });
  }

  function renderStats(r) {
    const card = (etiqueta, valor, colorTxt, sub, icono, subIcono, bg, fg) => `
      <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div class="space-y-1">
          <span class="text-label-sm font-label-sm text-outline">${etiqueta}</span>
          <div class="text-headline-md font-headline-md font-bold" style="color:${colorTxt}">${valor}</div>
          <span class="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1">
            <span class="material-symbols-outlined text-xs" style="color:${fg}">${subIcono}</span> ${esc(sub)}</span>
        </div>
        <div class="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style="background:${bg};color:${fg}">
          <span class="material-symbols-outlined text-2xl">${icono}</span></div>
      </div>`;
    $('stats').innerHTML =
      card('Días Lectivos Programados', plural(r.dias_lectivos, 'Día de Docencia', 'Días de Docencia'), '#00234e', 'Lunes a viernes, sin feriados', 'event_available', 'check_circle', '#ECFDF5', '#059669') +
      card('Efemérides y Días Inhábiles', plural(r.feriados.length, 'Feriado Nacional', 'Feriados Nacionales'), '#bb0112',
        r.feriados.length ? r.feriados.map((f) => f.titulo).slice(0, 2).join(' • ') : 'Sin feriados este mes', 'holiday_village', 'flag', '#FEF2F2', '#bb0112') +
      card('Planificación Curricular', plural(r.actividades_programadas, 'Actividad Programada', 'Actividades Programadas'), '#003876',
        `En ${plural(r.secciones, 'sección lectiva', 'secciones lectivas')}`, 'calendar_add_on', 'task', '#EFF6FF', '#003876') +
      card('Calificaciones y Rúbricas', plural(r.entregas_por_vencer, 'Entrega Próxima a Vencer', 'Entregas Próximas a Vencer'), '#D97706',
        'Plazo de cierre: 7 días', 'pending_actions', 'timer', '#FFFBEB', '#D97706');
  }

  function renderProximas(items) {
    $('proximas-badge').textContent = plural(items.length, 'Pendiente', 'Pendientes');
    if (!items.length) {
      $('proximas').innerHTML = '<p class="text-body-sm text-outline py-6 text-center">No hay entregas en los próximos 7 días.</p>';
      return;
    }
    $('proximas').innerHTML = items.map((it) => {
      const esMinerd = it.origen === 'minerd';
      const c = COLOR_EVENTO[esMinerd ? 'minerd' : 'docencia'];
      const dias = App.diasHasta(it.vence);
      const venceTxt = dias <= 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
      const urgente = dias <= 2;
      return `<div class="border border-outline-variant rounded-lg p-3.5 bg-surface-bright hover:shadow-sm transition-all border-l-4" style="border-left-color:${c.fg}">
        <div class="flex items-start justify-between">
          <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border" style="background:${c.bg};color:${c.txt};border-color:${c.borde}">
            <span class="w-1.5 h-1.5 rounded-full" style="background:${c.fg}"></span> ${esMinerd ? 'OFICIAL MINERD' : 'DOCENCIA'}</span>
          <span class="text-label-sm font-label-sm font-bold" style="color:${urgente ? '#bb0112' : '#D97706'}">${venceTxt}</span>
        </div>
        <h4 class="font-label-lg text-label-lg font-bold text-on-surface mt-2">${esc(it.titulo)}</h4>
        ${it.detalle ? `<p class="text-body-sm font-body-sm text-on-surface-variant mt-1">${esc(it.detalle)}</p>` : ''}
        <div class="mt-3 pt-2.5 border-t border-outline-variant/60 flex items-center justify-between">
          <span class="text-body-sm font-body-sm text-outline flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">event</span> ${App.fmtCorta(it.vence)}, ${App.fmtHora(it.vence)}</span>
          ${esMinerd ? '' : `<a href="/actividad-form?id=${it.id}" class="px-2.5 py-1 text-label-sm font-label-sm border border-outline-variant text-on-surface hover:bg-surface-container transition-colors rounded">Ver Detalle</a>`}
        </div>
      </div>`;
    }).join('');
  }

  async function cargar() {
    $('titulo-mes').textContent = `${MESES[mes]} ${anio}`;
    const rango = rangoGrilla();
    const mesStr = `${anio}-${pad(mes + 1)}`;
    $('cal-grid').innerHTML = '<div class="col-span-7 p-10 text-center text-outline">Cargando calendario…</div>';
    try {
      const [cal, resumen] = await Promise.all([
        App.api('/calendario', { params: { desde: rango.inicio, hasta: rango.fin } }),
        App.api('/calendario/resumen', { params: { mes: mesStr } }),
      ]);
      renderGrilla(cal, rango);
      renderStats(resumen);
      renderProximas(resumen.proximas);
      if (resumen.periodo) {
        document.querySelectorAll('[data-anio]').forEach((el) => (el.textContent = 'Año Escolar ' + resumen.periodo.anio_escolar));
        document.querySelectorAll('[data-periodo]').forEach((el) => (el.textContent = 'Período ' + resumen.periodo.codigo));
      }
    } catch (e) {
      $('cal-grid').innerHTML = `<div class="col-span-7 p-10 text-center text-[#BA1A1A]">No se pudo cargar el calendario: ${esc(e.message)}</div>`;
    }
  }

  const mover = (delta) => { mes += delta; if (mes < 0) { mes = 11; anio--; } if (mes > 11) { mes = 0; anio++; } cargar(); };
  $('btn-prev').addEventListener('click', () => mover(-1));
  $('btn-next').addEventListener('click', () => mover(1));
  $('btn-hoy').addEventListener('click', () => { [anio, mes] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1]; cargar(); });
  $('vista-semana').addEventListener('click', () => (location.href = '/semana'));
  $('vista-lista').addEventListener('click', () => (location.href = '/actividades'));
  $('btn-evento').addEventListener('click', () => App.abrirModalEvento());
  $('btn-actividad').addEventListener('click', () => (location.href = '/actividad-form'));
  document.addEventListener('evento-creado', cargar);

  cargar();
})();
