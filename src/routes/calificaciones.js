const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requiereAuth, asyncH } = require('../middleware');

router.use(requiereAuth);

async function cargarActividad(client, id, usuarioId) {
  const { rows } = await client.query(
    `SELECT a.id, a.titulo, a.estado, a.puntos::float AS puntos, a.grupo_id,
            g.nivel, g.grado, g.seccion, ac.nombre AS area
     FROM actividades a
     JOIN grupos g ON g.id = a.grupo_id
     JOIN areas_curriculares ac ON ac.id = a.area_id
     WHERE a.id = $1 AND a.usuario_id = $2`, [id, usuarioId]);
  return rows[0];
}

// Estudiantes del grupo con su calificación en la actividad
router.get('/actividad/:id', asyncH(async (req, res) => {
  const act = await cargarActividad(pool, req.params.id, req.usuario.id);
  if (!act) return res.status(404).json({ error: 'Actividad no encontrada' });
  const { rows } = await pool.query(
    `SELECT e.id AS estudiante_id, e.nombre, c.puntos::float AS puntos, COALESCE(c.observacion, '') AS observacion
     FROM estudiantes e
     LEFT JOIN calificaciones c ON c.estudiante_id = e.id AND c.actividad_id = $1
     WHERE e.usuario_id = $2 AND e.grupo_id = $3
     ORDER BY e.nombre`, [act.id, req.usuario.id, act.grupo_id]);
  res.json({ actividad: act, estudiantes: rows });
}));

const guardarSchema = z.object({
  items: z.array(z.object({
    estudiante_id: z.coerce.number().int().positive(),
    puntos: z.union([z.coerce.number().min(0), z.null()]),
    observacion: z.string().trim().max(500).default(''),
  })).min(1).max(300),
});

// Guarda (inserta o actualiza) las calificaciones de la actividad
router.put('/actividad/:id', asyncH(async (req, res) => {
  const d = guardarSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const act = await cargarActividad(client, req.params.id, req.usuario.id);
    if (!act) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Actividad no encontrada' }); }

    const roster = await client.query('SELECT id FROM estudiantes WHERE usuario_id = $1 AND grupo_id = $2', [req.usuario.id, act.grupo_id]);
    const ids = new Set(roster.rows.map((r) => r.id));
    for (const it of d.items) {
      if (!ids.has(it.estudiante_id)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Hay estudiantes que no pertenecen al grupo de la actividad' }); }
      if (it.puntos !== null && it.puntos > act.puntos) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `La calificación no puede superar los ${act.puntos} puntos de la actividad` });
      }
    }
    for (const it of d.items) {
      await client.query(
        `INSERT INTO calificaciones (actividad_id, estudiante_id, puntos, observacion)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (actividad_id, estudiante_id)
         DO UPDATE SET puntos = EXCLUDED.puntos, observacion = EXCLUDED.observacion, actualizado_en = now()`,
        [act.id, it.estudiante_id, it.puntos, it.observacion]);
    }
    // Entregas recibidas = estudiantes calificados; si todos están calificados la actividad pasa a "evaluada"
    const { rows } = await client.query(
      'SELECT COUNT(puntos)::int AS calificados FROM calificaciones WHERE actividad_id = $1', [act.id]);
    const calificados = rows[0].calificados;
    const total = ids.size;
    let estado = act.estado;
    if (total > 0 && calificados === total) estado = 'evaluada';
    else if (act.estado === 'evaluada') estado = 'entregada';
    await client.query('UPDATE actividades SET entregas_recibidas = $1, estado = $2, actualizado_en = now() WHERE id = $3',
      [calificados, estado, act.id]);
    await client.query('COMMIT');
    res.json({ calificados, total, estado });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

module.exports = router;
