/* Crear / editar actividad (modelo MINERD) */
(async function () {
  if (!App.initShell()) return;
  const { esc } = App;
  const $ = (id) => document.getElementById(id);
  const form = $('form-actividad');
  const qp = new URLSearchParams(location.search);
  const editId = qp.get('id');

  const ESTRUCTURA = {
    'Primaria (1er Ciclo)': ['1ro de Primaria', '2do de Primaria', '3ro de Primaria'],
    'Primaria (2do Ciclo)': ['4to de Primaria', '5to de Primaria', '6to de Primaria'],
    'Secundaria (1er Ciclo)': ['1ro de Secundaria', '2do de Secundaria', '3ro de Secundaria'],
    'Secundaria (2do Ciclo)': ['4to de Secundaria', '5to de Secundaria', '6to de Secundaria'],
  };
  const opts = (arr, sel) => arr.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`).join('');

  const cat = await App.catalogos();
  $('area').innerHTML = '<option value="">Seleccione…</option>' + opts(cat.areas.map((a) => [a.id, a.nombre]));
  $('nivel').innerHTML = opts(Object.keys(ESTRUCTURA).reverse().map((n) => [n, n]));
  $('seccion').innerHTML = opts(['A', 'B', 'C', 'D', 'E'].map((s) => [s, 'Sección ' + s]));
  $('periodo').innerHTML = '<option value="">Sin período</option>' + opts(cat.periodos.map((p) => [p.id, `${p.nombre.split(' - ')[0]} · ${p.anio_escolar}`]));
  const llenarGrados = (sel) => { $('grado').innerHTML = opts(ESTRUCTURA[$('nivel').value].map((g) => [g, g]), sel); };
  $('nivel').value = 'Secundaria (2do Ciclo)'; llenarGrados();
  $('nivel').addEventListener('change', () => llenarGrados());

  // Estado
  let estado = 'en_curso';
  const pintarEstado = () => document.querySelectorAll('[data-estado]').forEach((b) => {
    const on = b.dataset.estado === estado;
    b.classList.toggle('bg-primary-container', on); b.classList.toggle('text-white', on); b.classList.toggle('ring-2', on);
    b.classList.toggle('bg-surface-container-high', !on); b.classList.toggle('text-on-surface-variant', !on);
  });
  document.querySelectorAll('[data-estado]').forEach((b) => b.addEventListener('click', () => { estado = b.dataset.estado; pintarEstado(); }));
  pintarEstado();

  // Tipo (radios): resaltar la opción elegida
  const pintarTipo = () => document.querySelectorAll('input[name=activity_type]').forEach((r) => {
    const l = r.closest('label'); l.classList.toggle('border-primary', r.checked); l.classList.toggle('bg-primary/5', r.checked); l.classList.toggle('border-outline-variant', !r.checked);
  });
  document.querySelectorAll('input[name=activity_type]').forEach((r) => r.addEventListener('change', pintarTipo));

  // Contador del título
  const cuenta = () => { if ($('titulo-count')) $('titulo-count').textContent = `${$('titulo').value.length}/120`; };
  $('titulo').maxLength = 120; $('titulo').addEventListener('input', cuenta);

  // Aviso de feriado cercano a la fecha de entrega
  async function avisoFeriado() {
    const v = $('fecha_entrega').value; const box = $('aviso-feriado');
    if (!v) return box.classList.add('hidden');
    const dia = v.slice(0, 10);
    try {
      const evs = await App.api('/eventos', { params: { desde: dia, hasta: dia, tipo: 'feriado' } });
      if (!evs.length) return box.classList.add('hidden');
      $('aviso-feriado-txt').innerHTML = `La fecha de entrega coincide con <strong>${esc(evs[0].titulo)}</strong> (feriado no laborable). Considere programarla para el día hábil anterior o siguiente.`;
      box.classList.remove('hidden');
    } catch { box.classList.add('hidden'); }
  }
  $('fecha_entrega').addEventListener('change', avisoFeriado);

  // Valores iniciales
  const ahora = App.isoToLocal(new Date());
  const fechaQ = /^\d{4}-\d{2}-\d{2}$/.test(qp.get('fecha') || '') ? qp.get('fecha') : null;
  $('fecha_asignacion').value = (fechaQ ? fechaQ + 'T08:00' : ahora);
  $('fecha_entrega').value = App.isoToLocal(new Date(Date.now() + 7 * 86400000)).slice(0, 11) + '18:00';
  if (fechaQ) $('fecha_entrega').value = App.addDays(fechaQ, 7) + 'T18:00';
  const actual = cat.periodos.find((p) => App.hoy() >= p.fecha_inicio && App.hoy() <= p.fecha_fin);
  if (actual) $('periodo').value = actual.id;

  // Edición
  if (editId) {
    try {
      const a = await App.api('/actividades/' + editId);
      $('form-titulo').textContent = 'Editar Actividad Pedagógica';
      if ($('form-crumb')) $('form-crumb').textContent = 'Editar Actividad';
      $('titulo').value = a.titulo; $('ra_input').value = a.ra; $('area').value = a.area_id;
      $('nivel').value = a.nivel; llenarGrados(a.grado); $('seccion').value = a.seccion;
      $('momento_inicio').value = a.momento_inicio; $('momento_desarrollo').value = a.momento_desarrollo; $('momento_cierre').value = a.momento_cierre;
      $('estrategias').value = a.estrategias; $('recursos').value = a.recursos; $('instrumentos').value = a.instrumentos;
      $('fecha_asignacion').value = App.isoToLocal(a.fecha_asignacion); $('fecha_entrega').value = App.isoToLocal(a.fecha_entrega);
      $('puntos').value = a.puntos; $('periodo').value = a.periodo_id || '';
      estado = a.estado; pintarEstado();
      const r = document.querySelector(`input[name=activity_type][value=${a.tipo}]`); if (r) r.checked = true;
    } catch (e) { App.toast(e.message, 'error'); setTimeout(() => (location.href = '/actividades'), 1200); return; }
  }
  pintarTipo(); cuenta(); avisoFeriado();

  // Guardar
  let guardando = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (guardando) return;
    const tipo = document.querySelector('input[name=activity_type]:checked')?.value || 'tarea';
    const body = {
      titulo: $('titulo').value, ra: $('ra_input').value, area_id: Number($('area').value) || undefined,
      nivel: $('nivel').value, grado: $('grado').value, seccion: $('seccion').value,
      periodo_id: $('periodo').value ? Number($('periodo').value) : null, tipo, estado,
      fecha_asignacion: App.localToIso($('fecha_asignacion').value), fecha_entrega: App.localToIso($('fecha_entrega').value),
      puntos: Number($('puntos').value || 0),
      momento_inicio: $('momento_inicio').value, momento_desarrollo: $('momento_desarrollo').value, momento_cierre: $('momento_cierre').value,
      estrategias: $('estrategias').value, recursos: $('recursos').value, instrumentos: $('instrumentos').value,
    };
    guardando = true;
    try {
      await App.api(editId ? '/actividades/' + editId : '/actividades', { method: editId ? 'PUT' : 'POST', body });
      App.toast('Actividad guardada');
      setTimeout(() => (location.href = '/actividades'), 600);
    } catch (er) {
      guardando = false;
      App.toast(er.detalles ? er.detalles.map((d) => d.mensaje).join('. ') : er.message, 'error');
    }
  });
  $('btn-publicar').addEventListener('click', () => form.requestSubmit());
  $('btn-cancelar').addEventListener('click', () => (location.href = '/actividades'));
  document.querySelectorAll('[data-chip-periodo]').forEach((el) => (el.textContent = actual ? `${actual.codigo} • ${actual.anio_escolar}` : 'Período'));
  document.querySelectorAll('[data-chip-periodo-carga]').forEach((el) => (el.textContent = actual ? `Carga de Actividades ${actual.codigo}` : 'Carga de Actividades'));
  document.querySelectorAll('[data-anio]').forEach((el) => (el.textContent = actual ? 'Año Escolar ' + actual.anio_escolar : 'Año Escolar'));
  document.querySelectorAll('[data-periodo]').forEach((el) => (el.textContent = actual ? 'Período ' + actual.codigo : 'Período'));
})();
