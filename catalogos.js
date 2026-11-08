const router = require('express').Router();
const pool = require('../db/pool');
const { asyncH } = require('../middleware');

router.get('/', asyncH(async (_req, res) => {
  const [areas, periodos, grupos] = await Promise.all([
    pool.query('SELECT id, nombre FROM areas_curriculares ORDER BY nombre'),
    pool.query(`SELECT id, anio_escolar, codigo, nombre, fecha_inicio::text AS fecha_inicio, fecha_fin::text AS fecha_fin
                FROM periodos ORDER BY fecha_inicio`),
    pool.query('SELECT id, nivel, grado, seccion, estudiantes FROM grupos ORDER BY nivel, grado, seccion'),
  ]);
  res.json({
    areas: areas.rows,
    periodos: periodos.rows,
    grupos: grupos.rows,
    tipos: ['tarea', 'proyecto', 'exposicion', 'prueba', 'practica'],
    estados: ['pendiente', 'en_curso', 'entregada', 'evaluada'],
    tiposEvento: ['feriado', 'minerd', 'docencia', 'evaluacion'],
  });
}));

module.exports = router;
