const router = require('express').Router();
const pool = require('../db/pool');
const { requiereAuth, asyncH } = require('../middleware');

router.use(requiereAuth);

const APROBADO = 0.7; // mínimo aprobatorio: 70 % de los puntos de la actividad

// Todas las actividades con sus calificaciones (estadísticas + detalle por estudiante)
router.get('/actividades', asyncH(async (req, res) => {
  const q = req.query;
  const params = [req.usuario.id];
  const where = ['a.usuario_id = $1'];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };
  if (q.periodo_id) add('a.periodo_id = ?', Number(q.periodo_id));
  if (q.grupo_id) add('a.grupo_id = ?', Number(q.grupo_id));
  if (q.area_id) add('a.area_id = ?', Number(q.area_id));
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.desde || '')) add('a.fecha_entrega >= ?', q.desde);
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.hasta || '')) add('a.fecha_entrega < ?::date + 1', q.hasta);

  const { rows } = await pool.query(
    `SELECT a.id, a.titulo, a.ra, a.tipo, a.estado, a.puntos::float AS puntos, a.fecha_entrega,
            ac.nombre AS area, g.grado, g.seccion, p.codigo AS periodo_codigo,
            rs.total AS estudiantes,
            st.calificados, st.promedio, st.maximo, st.minimo, st.aprobados,
            COALESCE(det.items, '[]'::json) AS calificaciones
     FROM actividades a
     JOIN areas_curriculares ac ON ac.id = a.area_id
     JOIN grupos g ON g.id = a.grupo_id
     LEFT JOIN periodos p ON p.id = a.periodo_id
     LEFT JOIN LATERAL (SELECT COUNT(*)::int AS total FROM estudiantes e
                        WHERE e.usuario_id = a.usuario_id AND e.grupo_id = a.grupo_id) rs ON true
     LEFT JOIN LATERAL (SELECT COUNT(c.puntos)::int AS calificados,
                               AVG(c.puntos)::float AS promedio,
                               MAX(c.puntos)::float AS maximo,
                               MIN(c.puntos)::float AS minimo,
                               COUNT(*) FILTER (WHERE c.puntos >= a.puntos * ${APROBADO})::int AS aprobados
                        FROM calificaciones c JOIN estudiantes e ON e.id = c.estudiante_id
                        WHERE c.actividad_id = a.id AND c.puntos IS NOT NULL) st ON true
     LEFT JOIN LATERAL (SELECT json_agg(json_build_object('estudiante', e.nombre, 'puntos', c.puntos::float,
                                                         'observacion', COALESCE(c.observacion, '')) ORDER BY e.nombre) AS items
                        FROM estudiantes e
                        LEFT JOIN calificaciones c ON c.estudiante_id = e.id AND c.actividad_id = a.id
                        WHERE e.usuario_id = a.usuario_id AND e.grupo_id = a.grupo_id) det ON true
     WHERE ${where.join(' AND ')}
     ORDER BY a.fecha_entrega, a.id`, params);

  const conNotas = rows.filter((r) => r.calificados > 0);
  const sumaPct = conNotas.reduce((s, r) => s + (r.promedio / r.puntos) * 100, 0);
  res.json({
    umbral_aprobado: APROBADO * 100,
    resumen: {
      actividades: rows.length,
      con_calificaciones: conNotas.length,
      completas: rows.filter((r) => r.estudiantes > 0 && r.calificados === r.estudiantes).length,
      promedio_general_pct: conNotas.length ? Math.round((sumaPct / conNotas.length) * 10) / 10 : null,
    },
    items: rows,
  });
}));

module.exports = router;
