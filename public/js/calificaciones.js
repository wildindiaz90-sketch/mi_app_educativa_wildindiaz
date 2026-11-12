/* Módulo de calificaciones por actividad */
(async function () {
  if (!App.initShell()) return;
  const { esc } = App;
  const $ = (id) => document.getElementById(id);
  const qp = new URLSearchParams(location.search);
  let actual = null;   // { actividad, estudiantes }
  let sucio = false;

  const fmt = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : (Math.round(n * 100) / 100).toString().replace('.', ','));

  /* ---- selector de actividades ---- */
  async function cargarSelector() {
    const d = await App.api('/actividades', { params: { limit: 100 } });
    let items = d.items;
    const pedida = qp.get('actividad');
    if (pedida && !items.some((a) => String(a.id) === pedida)) {
      try { items = [await App.api('/actividades/' + pedida), ...items]; } catch { /* se ignora */ }
    }
    if (!items.length) {
      $('sel-actividad').innerHTML = '<option value="">No hay actividades</option>';
      $('info-actividad').innerHTML = 'Primero <a class="text-primary font-semibold underline" href="/actividad-form">cree una actividad</a>.';
      $('btn-guardar').disabled = true;
      return null;
    }
    $('sel-actividad').innerHTML = items.map((a) =>
      `<option value="${a.id}">${esc(a.titulo)} — ${esc(a.grado)} ${esc(a.seccion)} (${esc(a.area)})</option>`).join('');
    const inicial = pedida && items.some((a) => String(a.id) === pedida) ? pedida : items[0].id;
    $('sel-actividad').value = inicial;
    return Number(inicial);
  }

  /* ---- render ---- */
  function filaEst(e, i, max) {
    const v = e.puntos === null || e.puntos === undefined ? '' : e.puntos;
    return `<tr class="hover:bg-surface-container-low" data-est="${e.estudiante_id}">
      <td class="py-2.5 px-4 text-outline">${i + 1}</td>
      <td class="py-2.5 px-4 font-semibold text-on-surface">${esc(e.nombre)}</td>
      <td class="py-2.5 px-4"><div class="flex items-center gap-2">
        <input type="number" inputmode="decimal" min="0" max="${max}" step="0.5" value="${v}" data-nota
          class="w-24 py-1.5 px-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-right" aria-label="Calificación de ${esc(e.nombre)}"/>
        <span class="text-outline">/ ${fmt(max)}</span></div></td>
      <td class="py-2.5 px-4 font-semibold" data-pct>—</td>
      <td class="py-2.5 px-4"><input type="text" maxlength="500" value="${esc(e.observacion)}" data-obs placeholder="Opcional"
          class="w-full py-1.5 px-2 border border-outline-variant rounded-lg bg-surface-container-lowest" aria-label="Observación de ${esc(e.nombre)}"/></td>
    </tr>`;
  }

  function leerNotas() {
    return [...document.querySelectorAll('#tbody-cal tr[data-est]')].map((tr) => {
      const raw = tr.querySelector('[data-nota]').value.trim().replace(',', '.');
      return { estudiante_id: Number(tr.dataset.est), puntos: raw === '' ? null : Number(raw), observacion: tr.querySelector('[data-obs]').value.trim(), tr };
    });
  }

  function recalcular() {
    const max = actual.actividad.puntos;
    const filas = leerNotas();
    const validas = filas.filter((f) => f.puntos !== null && !Number.isNaN(f.puntos));
    filas.forEach((f) => {
      const pct = f.puntos === null || Number.isNaN(f.puntos) ? null : (f.puntos / max) * 100;
      const celda = f.tr.querySelector('[data-pct]');
      celda.textContent = pct === null ? '—' : Math.round(pct) + ' %';
      celda.style.color = pct === null ? '' : pct >= 70 ? '#059669' : '#bb0112';
      const fuera = f.puntos !== null && (f.puntos < 0 || f.puntos > max);
      f.tr.querySelector('[data-nota]').classList.toggle('border-secondary', fuera);
    });
    const prom = validas.length ? validas.reduce((s, f) => s + f.puntos, 0) / validas.length : null;
    const card = (t, v, color, ic, bg) => `<div class="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex items-center justify-between shadow-sm">
      <div><span class="text-label-sm font-label-sm text-outline block">${t}</span><span class="text-headline-md font-headline-md font-bold" style="color:${color}">${v}</span></div>
      <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:${bg};color:${color}"><span class="material-symbols-outlined">${ic}</span></div></div>`;
    $('stats-cal').innerHTML =
      card('Estudiantes', filas.length, '#003876', 'groups', '#EFF6FF') +
      card('Calificados', `${validas.length} / ${filas.length}`, '#003876', 'task_alt', '#EFF6FF') +
      card('Promedio', prom === null ? '—' : `${fmt(prom)} / ${fmt(max)}`, '#059669', 'functions', '#ECFDF5') +
      card('Aprobados (≥ 70 %)', validas.length ? `${validas.filter((f) => f.puntos / max >= 0.7).length} / ${validas.length}` : '—', '#D97706', 'workspace_premium', '#FFFBEB');
  }

  function renderRoster() {
    const g = actual.actividad;
    $('roster-grupo').textContent = `— ${g.grado} ${g.seccion}`;
    $('roster-chips').innerHTML = actual.estudiantes.length ? actual.estudiantes.map((e) =>
      `<span class="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-surface-container text-on-surface text-label-md font-label-md">${esc(e.nombre)}
        <button data-borrar="${e.estudiante_id}" class="p-0.5 rounded-full hover:bg-surface-container-high" title="Quitar" aria-label="Quitar a ${esc(e.nombre)}"><span class="material-symbols-outlined text-[16px]">close</span></button></span>`).join('')
      : '<span class="text-body-sm text-outline">Aún no hay estudiantes en este grupo.</span>';
  }

  async function cargar(id) {
    sucio = false;
    try {
      actual = await App.api('/calificaciones/actividad/' + id);
    } catch (e) { $('tbody-cal').innerHTML = `<tr><td colspan="5" class="py-8 text-center text-[#BA1A1A]">${esc(e.message)}</td></tr>`; return; }
    const a = actual.actividad;
    $('info-actividad').innerHTML = `${esc(a.area)} · ${esc(a.grado)} ${esc(a.seccion)} · Valor máximo: <strong>${fmt(a.puntos)} puntos</strong> · Estado: <strong>${esc(App.ESTADOS[a.estado])}</strong>`;
    const vacio = !actual.estudiantes.length;
    $('aviso-vacio').classList.toggle('hidden', !vacio);
    $('aviso-vacio').textContent = 'Este grupo todavía no tiene estudiantes. Agregue la lista en la sección «Estudiantes del grupo» (más abajo) para poder calificar.';
    $('tbody-cal').innerHTML = vacio ? '<tr><td colspan="5" class="py-8 text-center text-outline">Sin estudiantes</td></tr>'
      : actual.estudiantes.map((e, i) => filaEst(e, i, a.puntos)).join('');
    $('btn-guardar').disabled = vacio;
    history.replaceState(null, '', '?actividad=' + id);
    recalcular(); renderRoster();
  }

  /* ---- eventos ---- */
  $('tbody-cal').addEventListener('input', () => { sucio = true; recalcular(); });
  $('sel-actividad').addEventListener('change', (e) => {
    if (sucio && !confirm('Hay cambios sin guardar. ¿Cambiar de actividad de todos modos?')) { e.target.value = actual.actividad.id; return; }
    cargar(e.target.value);
  });
  window.addEventListener('beforeunload', (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } });

  $('btn-guardar').addEventListener('click', async () => {
    const filas = leerNotas();
    const max = actual.actividad.puntos;
    const mal = filas.find((f) => f.puntos !== null && (Number.isNaN(f.puntos) || f.puntos < 0 || f.puntos > max));
    if (mal) { App.toast(`Cada calificación debe estar entre 0 y ${fmt(max)}`, 'error'); mal.tr.querySelector('[data-nota]').focus(); return; }
    $('btn-guardar').disabled = true;
    try {
      const r = await App.api('/calificaciones/actividad/' + actual.actividad.id, { method: 'PUT', body: { items: filas.map(({ estudiante_id, puntos, observacion }) => ({ estudiante_id, puntos, observacion })) } });
      sucio = false;
      App.toast(r.estado === 'evaluada' ? 'Calificaciones guardadas — actividad evaluada' : `Calificaciones guardadas (${r.calificados}/${r.total})`);
      await cargar(actual.actividad.id);
    } catch (e) { App.toast(e.detalles ? e.detalles.map((d) => d.mensaje).join('. ') : e.message, 'error'); }
    $('btn-guardar').disabled = false;
  });

  $('btn-agregar').addEventListener('click', async () => {
    const nombres = $('nuevos-nombres').value.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
    if (!nombres.length) return App.toast('Escriba al menos un nombre', 'error');
    if (sucio && !confirm('Hay cambios sin guardar que se perderán al actualizar la lista. ¿Continuar?')) return;
    try {
      await App.api('/estudiantes', { method: 'POST', body: { grupo_id: actual.actividad.grupo_id, nombres } });
      $('nuevos-nombres').value = '';
      App.toast('Estudiantes agregados');
      await cargar(actual.actividad.id);
    } catch (e) { App.toast(e.detalles ? e.detalles.map((d) => d.mensaje).join('. ') : e.message, 'error'); }
  });

  $('roster-chips').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-borrar]'); if (!b) return;
    if (!confirm('¿Quitar a este estudiante? También se eliminarán sus calificaciones en todas las actividades.')) return;
    if (sucio && !confirm('Hay cambios sin guardar que se perderán. ¿Continuar?')) return;
    try { await App.api('/estudiantes/' + b.dataset.borrar, { method: 'DELETE' }); await cargar(actual.actividad.id); }
    catch (er) { App.toast(er.message, 'error'); }
  });

  const id = await cargarSelector();
  if (id) await cargar(id);
})();
