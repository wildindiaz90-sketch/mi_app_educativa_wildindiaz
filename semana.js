/* Vista semanal (lunes a viernes + resumen de fin de semana) */
(async function () {
  if (!App.initShell()) return;
  const { esc, MESES, DIAS, COLOR_EVENTO } = App;
  const $ = (id) => document.getElementById(id);
  const hoy = App.hoy();

  const lunesDe = (iso) => { const dow = App.parseIso(iso).getUTCDay(); return App.addDays(iso, dow === 0 ? -6 : 1 - dow); };
  const qf = new URLSearchParams(location.search).get('fecha');
  let lunes = lunesDe(/^\d{4}-\d{2}-\d{2}$/.test(qf || '') ? qf : hoy);

  const dia = (iso) => Number(iso.slice(8));
  const mesCorto = (iso) => MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3);

  function tituloSemana(l, v) {
    const mL = MESES[Number(l.slice(5, 7)) - 1], mV = MESES[Number(v.slice(5, 7)) - 1];
    return mL === mV ? `Semana del ${dia(l)} al ${dia(v)} de ${mL} ${v.slice(0, 4)}`
      : `Semana del ${dia(l)} de ${mL} al ${dia(v)} de ${mV} ${v.slice(0, 4)}`;
  }

  function tarjetaEvento(e) {
    const c = COLOR_EVENTO[e.tipo];
    return `<div class="p-3 rounded-lg border border-outline-variant border-l-4 shadow-sm" style="border-left-color:${c.fg};background:${e.tipo === 'feriado' ? c.bg : '#fff'}">
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-label-sm font-label-sm border" style="background:${c.bg};color:${c.txt};border-color:${c.borde}">
        <span class="w-1.5 h-1.5 rounded-full" style="background:${c.fg}"></span> ${esc(c.label)}</span>
      <h3 class="font-headline-sm text-[15px] font-bold text-on-surface leading-tight mt-1.5">${esc(e.titulo)}</h3>
      ${e.descripcion ? `<p class="text-body-sm font-body-sm text-on-surface-variant mt-1">${esc(e.descripcion)}</p>` : ''}
    </div>`;
  }
  function tarjetaActividad(a) {
    const c = COLOR_EVENTO.docencia;
    return `<a href="/actividad-form?id=${a.id}" class="block p-3 bg-surface-container-lowest rounded-lg border border-outline-variant border-l-4 shadow-sm hover:shadow-md transition-shadow" style="border-left-color:${c.fg}">
      <div class="flex items-center justify-between gap-1 mb-1.5">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-label-sm font-label-sm border" style="background:${c.bg};color:${c.txt};border-color:${c.borde}">
          <span class="w-1.5 h-1.5 rounded-full" style="background:${c.fg}"></span> ${esc(App.TIPOS[a.tipo])}</span>
        <span class="text-label-sm font-label-sm text-outline font-medium">Entrega ${esc(a.hora_entrega)}</span>
      </div>
      <h3 class="font-headline-sm text-[15px] font-bold text-on-surface leading-tight">${esc(a.titulo)}</h3>
      <p class="text-body-sm font-body-sm text-on-surface-variant mt-1">${esc(a.area)} • ${esc(a.grado)} ${esc(a.seccion)} • ${esc(App.ESTADOS[a.estado])}</p>
    </a>`;
  }

  async function cargar() {
    const viernes = App.addDays(lunes, 4), domingo = App.addDays(lunes, 6);
    $('titulo-semana').textContent = tituloSemana(lunes, viernes);
    $('week-grid').innerHTML = '<p class="col-span-5 text-center text-outline p-10">Cargando semana…</p>';
    try {
      const data = await App.api('/calendario', { params: { desde: lunes, hasta: domingo } });
      let lectivos = 0, feriados = 0, html = '';
      for (let i = 0; i < 5; i++) {
        const d = App.addDays(lunes, i);
        const evs = data.eventos.filter((e) => e.fecha_inicio <= d && e.fecha_fin >= d);
        const acts = data.actividades.filter((a) => a.dia_entrega === d);
        const esFeriado = evs.some((e) => e.tipo === 'feriado');
        esFeriado ? feriados++ : lectivos++;
        const n = acts.length;
        html += `<div class="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex flex-col min-h-[420px] overflow-hidden ${d === hoy ? 'ring-2 ring-primary' : ''}">
          <div class="p-space-sm bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <div><span class="text-label-sm font-label-sm text-outline uppercase tracking-wider block">${DIAS[App.parseIso(d).getUTCDay()]}${d === hoy ? ' • HOY' : ''}</span>
              <span class="text-headline-sm font-headline-sm font-bold ${esFeriado ? 'text-secondary' : 'text-primary'}">${dia(d)} ${mesCorto(d)}</span></div>
            <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-tertiary-container text-label-sm font-label-sm font-semibold">${n} ${n === 1 ? 'Actividad' : 'Actividades'}</span>
          </div>
          <div class="p-space-sm flex-1 flex flex-col gap-space-sm bg-surface-bright">
            ${evs.map(tarjetaEvento).join('')}${acts.map(tarjetaActividad).join('')}
            ${!evs.length && !acts.length ? '<p class="text-body-sm text-outline text-center mt-6">Sin eventos ni entregas</p>' : ''}
          </div></div>`;
      }
      $('week-grid').innerHTML = html;
      $('resumen-semana-txt').textContent = ` ${lectivos} ${lectivos === 1 ? 'Día Lectivo' : 'Días Lectivos'} / ${feriados} ${feriados === 1 ? 'Feriado' : 'Feriados'}`;

      const sab = App.addDays(lunes, 5);
      const finde = data.actividades.filter((a) => a.dia_entrega >= sab && a.dia_entrega <= domingo);
      $('fin-semana').innerHTML = `<div class="flex items-center gap-3 flex-wrap">
        <span class="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant text-label-sm font-label-sm text-outline font-bold">FIN DE SEMANA</span>
        <span class="font-semibold text-primary">Sábado ${dia(sab)} &amp; Domingo ${dia(domingo)}:</span>
        <span class="text-on-surface-variant">${finde.length ? finde.map((a) => esc(a.titulo)).join(' • ') : 'Sin entregas pautadas.'}</span></div>`;

      const ref = await App.api('/calendario/resumen', { params: { mes: lunes.slice(0, 7) } });
      if (ref.periodo) {
        document.querySelectorAll('[data-anio]').forEach((el) => (el.textContent = 'Año Escolar ' + ref.periodo.anio_escolar));
        document.querySelectorAll('[data-periodo]').forEach((el) => (el.textContent = 'Período ' + ref.periodo.codigo));
        if ($('periodo-tag')) $('periodo-tag').textContent = `Período ${ref.periodo.codigo} • ${ref.periodo.anio_escolar}`;
      }
    } catch (e) {
      $('week-grid').innerHTML = `<p class="col-span-5 text-center text-[#BA1A1A] p-10">No se pudo cargar: ${esc(e.message)}</p>`;
    }
  }

  $('btn-prev').addEventListener('click', () => { lunes = App.addDays(lunes, -7); cargar(); });
  $('btn-next').addEventListener('click', () => { lunes = App.addDays(lunes, 7); cargar(); });
  $('btn-hoy').addEventListener('click', () => { lunes = lunesDe(hoy); cargar(); });
  $('vista-mes').addEventListener('click', (e) => { e.preventDefault(); location.href = '/dashboard?mes=' + lunes.slice(0, 7); });
  $('vista-lista').addEventListener('click', (e) => { e.preventDefault(); location.href = '/actividades'; });
  if ($('vista-dia')) $('vista-dia').addEventListener('click', (e) => { e.preventDefault(); App.toast('La vista por día estará disponible próximamente'); });
  document.addEventListener('evento-creado', cargar);
  cargar();
})();
