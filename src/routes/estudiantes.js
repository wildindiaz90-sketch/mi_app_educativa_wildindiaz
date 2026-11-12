const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requiereAuth, asyncH } = require('../middleware');

router.use(requiereAuth);

const nombreSchema = z.string().trim().min(2).max(120);

router.get('/', asyncH(async (req, res) => {
  const grupoId = Number(req.query.grupo_id);
  if (!grupoId) return res.status(400).json({ error: 'grupo_id requerido' });
  const { rows } = await pool.query(
    'SELECT id, grupo_id, nombre FROM estudiantes WHERE usuario_id = $1 AND grupo_id = $2 ORDER BY nombre',
    [req.usuario.id, grupoId]);
  res.json(rows);
}));

// Alta en bloque: una lista de nombres (los duplicados se ignoran)
router.post('/', asyncH(async (req, res) => {
  const d = z.object({
    grupo_id: z.coerce.number().int().positive(),
    nombres: z.array(nombreSchema).min(1).max(100),
  }).parse(req.body);
  const unicos = [...new Set(d.nombres)];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const n of unicos) {
      await client.query(
        'INSERT INTO estudiantes (usuario_id, grupo_id, nombre) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [req.usuario.id, d.grupo_id, n]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  const { rows } = await pool.query(
    'SELECT id, grupo_id, nombre FROM estudiantes WHERE usuario_id = $1 AND grupo_id = $2 ORDER BY nombre',
    [req.usuario.id, d.grupo_id]);
  res.status(201).json(rows);
}));

router.put('/:id', asyncH(async (req, res) => {
  const d = z.object({ nombre: nombreSchema }).parse(req.body);
  const { rows } = await pool.query(
    'UPDATE estudiantes SET nombre = $1 WHERE id = $2 AND usuario_id = $3 RETURNING id, grupo_id, nombre',
    [d.nombre, req.params.id, req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Estudiante no encontrado' });
  res.json(rows[0]);
}));

router.delete('/:id', asyncH(async (req, res) => {
  const r = await pool.query('DELETE FROM estudiantes WHERE id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Estudiante no encontrado' });
  res.status(204).end();
}));

module.exports = router;
