const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requiereAuth, asyncH } = require('../middleware');

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD');
const hora = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional();
const eventoSchema = z.object({
  titulo: z.string().trim().min(2).max(200),
  descripcion: z.string().trim().max(2000).nullable().optional(),
  tipo: z.enum(['minerd', 'docencia', 'evaluacion']), // 'feriado' solo lo gestiona el sistema
  fecha_inicio: fecha,
  fecha_fin: fecha.optional(),
  hora_inicio: hora,
  hora_fin: hora,
  laborable: z.boolean().optional(),
});

const COLS = `id, usuario_id, titulo, descripcion, tipo, fecha_inicio::text AS fecha_inicio,
  fecha_fin::text AS fecha_fin, hora_inicio::text AS hora_inicio, hora_fin::text AS hora_fin, laborable`;

// Lectura: eventos globales (feriados/MINERD del sistema) + los propios del docente
router.get('/', requiereAuth, asyncH(async (req, res) => {
  const { desde, hasta, tipo } = req.query;
  const params = [req.usuario.id];
  let where = '(usuario_id IS NULL OR usuario_id = $1)';
  if (desde) { params.push(fecha.parse(desde)); where += ` AND fecha_fin >= $${params.length}`; }
  if (hasta) { params.push(fecha.parse(hasta)); where += ` AND fecha_inicio <= $${params.length}`; }
  if (tipo) { params.push(String(tipo)); where += ` AND tipo = $${params.length}::tipo_evento`; }
  const { rows } = await pool.query(`SELECT ${COLS} FROM eventos WHERE ${where} ORDER BY fecha_inicio, hora_inicio NULLS FIRST`, params);
  res.json(rows);
}));

router.post('/', requiereAuth, asyncH(async (req, res) => {
  const d = eventoSchema.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO eventos (usuario_id, titulo, descripcion, tipo, fecha_inicio, fecha_fin, hora_inicio, hora_fin, laborable)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLS}`,
    [req.usuario.id, d.titulo, d.descripcion ?? null, d.tipo, d.fecha_inicio, d.fecha_fin || d.fecha_inicio,
     d.hora_inicio ?? null, d.hora_fin ?? null, d.laborable ?? true]);
  res.status(201).json(rows[0]);
}));

router.put('/:id', requiereAuth, asyncH(async (req, res) => {
  const d = eventoSchema.parse(req.body);
  const { rows } = await pool.query(
    `UPDATE eventos SET titulo=$1, descripcion=$2, tipo=$3, fecha_inicio=$4, fecha_fin=$5, hora_inicio=$6, hora_fin=$7, laborable=$8
     WHERE id=$9 AND usuario_id=$10 RETURNING ${COLS}`,
    [d.titulo, d.descripcion ?? null, d.tipo, d.fecha_inicio, d.fecha_fin || d.fecha_inicio,
     d.hora_inicio ?? null, d.hora_fin ?? null, d.laborable ?? true, req.params.id, req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Evento no encontrado o no editable' });
  res.json(rows[0]);
}));

router.delete('/:id', requiereAuth, asyncH(async (req, res) => {
  const r = await pool.query('DELETE FROM eventos WHERE id=$1 AND usuario_id=$2', [req.params.id, req.usuario.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Evento no encontrado o no editable' });
  res.status(204).end();
}));

module.exports = router;
