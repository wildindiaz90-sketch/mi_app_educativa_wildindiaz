const router = require('express').Router();
const pool = require('../db/pool');
const { requiereAuth, asyncH } = require('../middleware');

router.use(requiereAuth);

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaOHoy = (v) => (RE_FECHA.test(v || '') ? v : null);

// Zona horaria de la República Dominicana (UTC-4, sin horario de verano)
const TZ = 'America/Santo_Domingo';

// Items del calendario (eventos + actividades) en un rango: mes y semana comparten este endpoint
router.get('/', asyncH(async (req, res) => {
  const desde = fechaOHoy(req.query.desde);
  const hasta = fechaOHoy(req.query.hasta);
  if (!desde || !hasta) return res.status(400).json({ error: 'Parámetros desde y hasta (AAAA-MM-DD) requeridos' });

  const [eventos, actividades] = await Promise.all([
    pool.query(
      `SELECT id, titulo, descripcion, tipo, fecha_inicio::text AS fecha_inicio, fecha_fin::text AS fecha_fin,
              hora_inicio::text AS hora_inicio, hora_fin::text AS hora_fin, laborable, (usuario_id IS NULL) AS global
       FROM eventos
       WHERE (usuario_id IS NULL OR usuario_id = $1) AND fecha_fin >= $2 AND fecha_inicio <= $3
       ORDER BY fecha_inicio`, [req.usuario.id, desde, hasta]),
    pool.query(
      `SELECT a.id, a.titulo, a.tipo, a.estado, a.fecha_asignacion, a.fecha_entrega,
              to_char(a.fecha_entrega AT TIME ZONE $4, 'YYYY-MM-DD') AS dia_entrega,
              to_char(a.fecha_entrega AT TIME ZONE $4, 'HH24:MI') AS hora_entrega,
              ac.nombre AS area, g.grado, g.seccion, a.puntos::float AS puntos
       FROM actividades a
       JOIN areas_curriculares ac ON ac.id = a.area_id
       JOIN grupos g ON g.id = a.grupo_id
       WHERE a.usuario_id = $1
         AND (a.fecha_entrega AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
       ORDER BY a.fecha_entrega`, [req.usuario.id, desde, hasta, TZ]),
  ]);
  res.json({ eventos: eventos.rows, actividades: actividades.rows });
}));

// Resumen del mes para las tarjetas del dashboard + entregas próximas (7 días)
router.get('/resumen', asyncH(async (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : new Date().toISOString().slice(0, 7);
  const inicio = `${mes}-01`;
  const uid = req.usuario.id;

  const [feriados, eventosMinerd, acts, vencer, proximas, periodo] = await Promise.all([
    pool.query(
      `SELECT titulo, fecha_inicio::text AS fecha FROM eventos
       WHERE tipo = 'feriado' AND fecha_inicio >= $1::date AND fecha_inicio < ($1::date + interval '1 month')
       ORDER BY fecha_inicio`, [inicio]),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM eventos WHERE tipo = 'minerd' AND (usuario_id IS NULL OR usuario_id = $2)
         AND fecha_inicio >= $1::date AND fecha_inicio < ($1::date + interval '1 month')`, [inicio, uid]),
    pool.query(
      `SELECT COUNT(*)::int AS programadas, COUNT(DISTINCT grupo_id)::int AS secciones
       FROM actividades WHERE usuario_id = $2
         AND (fecha_entrega AT TIME ZONE '${TZ}')::date >= $1::date
         AND (fecha_entrega AT TIME ZONE '${TZ}')::date < ($1::date + interval '1 month')`, [inicio, uid]),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM actividades WHERE usuario_id = $1
         AND estado IN ('pendiente','en_curso') AND fecha_entrega BETWEEN now() AND now() + interval '7 days'`, [uid]),
    pool.query(
      `SELECT * FROM (
         SELECT 'actividad' AS origen, a.id, a.titulo, a.estado,
                CONCAT(g.grado, ' ', g.seccion, ' • ', ac.nombre) AS detalle, a.fecha_entrega AS vence
         FROM actividades a JOIN grupos g ON g.id = a.grupo_id JOIN areas_curriculares ac ON ac.id = a.area_id
         WHERE a.usuario_id = $1 AND a.estado IN ('pendiente','en_curso')
           AND a.fecha_entrega BETWEEN now() AND now() + interval '7 days'
         UNION ALL
         SELECT 'minerd' AS origen, e.id, e.titulo, NULL, COALESCE(e.descripcion, ''),
                (e.fecha_inicio + COALESCE(e.hora_inicio, time '23:59'))::timestamp AT TIME ZONE '${TZ}'
         FROM eventos e
         WHERE e.tipo = 'minerd' AND (e.usuario_id IS NULL OR e.usuario_id = $1)
           AND e.fecha_inicio BETWEEN (now() AT TIME ZONE '${TZ}')::date AND (now() AT TIME ZONE '${TZ}')::date + 7
       ) t ORDER BY vence LIMIT 10`, [uid]),
    pool.query(`SELECT id, anio_escolar, codigo, nombre FROM periodos WHERE $1::date BETWEEN fecha_inicio AND fecha_fin LIMIT 1`, [inicio]),
  ]);

  // Días lectivos del mes: lunes a viernes que no son feriado
  const [anio, m] = mes.split('-').map(Number);
  const diasMes = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const setFeriados = new Set(feriados.rows.map((f) => f.fecha));
  let lectivos = 0;
  for (let d = 1; d <= diasMes; d++) {
    const dow = new Date(Date.UTC(anio, m - 1, d)).getUTCDay();
    const iso = `${mes}-${String(d).padStart(2, '0')}`;
    if (dow >= 1 && dow <= 5 && !setFeriados.has(iso)) lectivos++;
  }

  res.json({
    mes,
    periodo: periodo.rows[0] || null,
    dias_lectivos: lectivos,
    feriados: feriados.rows,
    eventos_minerd: eventosMinerd.rows[0].n,
    actividades_programadas: acts.rows[0].programadas,
    secciones: acts.rows[0].secciones,
    entregas_por_vencer: vencer.rows[0].n,
    proximas: proximas.rows,
  });
}));

module.exports = router;
