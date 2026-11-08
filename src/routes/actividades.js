const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requiereAuth, asyncH } = require('../middleware');

router.use(requiereAuth);

const TIPOS = ['tarea', 'proyecto', 'exposicion', 'prueba', 'practica'];
const ESTADOS = ['pendiente', 'en_curso', 'entregada', 'evaluada'];

const texto = z.string().trim().max(5000).default('');
const actividadSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  ra: z.string().trim().min(2).max(500),
  area_id: z.coerce.number().int().positive(),
  // El grupo se identifica por nivel + grado + sección (se crea si no existe) o por grupo_id
  grupo_id: z.coerce.number().int().positive().optional(),
  nivel: z.string().trim().min(1).max(80).optional(),
  grado: z.string().trim().min(1).max(80).optional(),
  seccion: z.string().trim().min(1).max(10).optional(),
  periodo_id: z.coerce.number().int().positive().nullable().optional(),
  tipo: z.enum(TIPOS).default('tarea'),
  estado: z.enum(ESTADOS).default('pendiente'),
  fecha_asignacion: z.string().datetime({ offset: true }),
  fecha_entrega: z.string().datetime({ offset: true }),
  puntos: z.coerce.number().min(0).max(100).default(20),
  momento_inicio: texto,
  momento_desarrollo: texto,
  momento_cierre: texto,
  estrategias: texto,
  recursos: texto,
  instrumentos: texto,
  entregas_recibidas: z.coerce.number().int().min(0).optional(),
}).refine((d) => d.grupo_id || (d.nivel && d.grado && d.seccion), {
  message: 'Indique grupo_id o nivel, grado y sección', path: ['grupo_id'],
}).refine((d) => new Date(d.fecha_entrega) >= new Date(d.fecha_asignacion), {
  message: 'La fecha de entrega no puede ser anterior a la de asignación', path: ['fecha_entrega'],
});

const SELECT = `
  SELECT a.id, a.titulo, a.ra, a.tipo, a.estado, a.puntos::float AS puntos,
         a.fecha_asignacion, a.fecha_entrega,
         a.momento_inicio, a.momento_desarrollo, a.momento_cierre,
         a.estrategias, a.recursos, a.instrumentos, a.entregas_recibidas,
         a.area_id, ac.nombre AS area,
         a.grupo_id, g.nivel, g.grado, g.seccion, g.estudiantes,
         a.periodo_id, p.codigo AS periodo_codigo, p.nombre AS periodo_nombre
  FROM actividades a
  JOIN areas_curriculares ac ON ac.id = a.area_id
  JOIN grupos g ON g.id = a.grupo_id
  LEFT JOIN periodos p ON p.id = a.periodo_id`;

async function resolverGrupo(client, d) {
  if (d.grupo_id) return d.grupo_id;
  const { rows } = await client.query(
    `INSERT INTO grupos (nivel, grado, seccion) VALUES ($1,$2,$3)
     ON CONFLICT (nivel, grado, seccion) DO UPDATE SET nivel = EXCLUDED.nivel RETURNING id`,
    [d.nivel, d.grado, d.seccion]);
  return rows[0].id;
}

// Listado con filtros, paginación y conteo por estado
router.get('/', asyncH(async (req, res) => {
  const q = req.query;
  const params = [req.usuario.id];
  const where = ['a.usuario_id = $1'];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };

  if (q.q) {
    params.push(`%${String(q.q).slice(0, 100)}%`);
    const n = `$${params.length}`;
    where.push(`(a.titulo ILIKE ${n} OR a.ra ILIKE ${n} OR ac.nombre ILIKE ${n})`);
  }
  if (q.area_id) add('a.area_id = ?', Number(q.area_id));
  if (q.grupo_id) add('a.grupo_id = ?', Number(q.grupo_id));
  if (q.periodo_id) add('a.periodo_id = ?', Number(q.periodo_id));
  if (q.tipo && TIPOS.includes(q.tipo)) add('a.tipo = ?::tipo_actividad', q.tipo);
  if (q.desde) add('a.fecha_entrega >= ?', q.desde);
  if (q.hasta) add('a.fecha_entrega < ?::date + 1', q.hasta);

  const whereSinEstado = where.join(' AND ');
  const paramsSinEstado = [...params];
  if (q.estado && ESTADOS.includes(q.estado)) add('a.estado = ?::estado_actividad', q.estado);

  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 100);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const orden = q.orden === 'asc' ? 'ASC' : 'DESC';

  const base = `FROM actividades a JOIN areas_curriculares ac ON ac.id = a.area_id JOIN grupos g ON g.id = a.grupo_id`;
  const [lista, total, porEstado, kpis] = await Promise.all([
    pool.query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY a.fecha_entrega ${orden}, a.id DESC
                LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
    pool.query(`SELECT COUNT(*)::int AS n ${base} WHERE ${where.join(' AND ')}`, params),
    pool.query(`SELECT a.estado, COUNT(*)::int AS n ${base} WHERE ${whereSinEstado} GROUP BY a.estado`, paramsSinEstado),
    pool.query(`SELECT COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE estado = 'en_curso')::int AS en_curso,
                       COUNT(*) FILTER (WHERE estado IN ('pendiente','en_curso') AND fecha_entrega BETWEEN now() AND now() + interval '7 days')::int AS proximas,
                       COUNT(*) FILTER (WHERE estado = 'evaluada')::int AS evaluadas
                FROM actividades WHERE usuario_id = $1`, [req.usuario.id]),
  ]);
  const conteos = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  porEstado.rows.forEach((r) => { conteos[r.estado] = r.n; });
  res.json({ items: lista.rows, total: total.rows[0].n, page, limit, conteos, kpis: kpis.rows[0] });
}));

router.get('/:id', asyncH(async (req, res) => {
  const { rows } = await pool.query(`${SELECT} WHERE a.id = $1 AND a.usuario_id = $2`, [req.params.id, req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Actividad no encontrada' });
  res.json(rows[0]);
}));

router.post('/', asyncH(async (req, res) => {
  const d = actividadSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupoId = await resolverGrupo(client, d);
    const ins = await client.query(
      `INSERT INTO actividades (usuario_id, titulo, ra, area_id, grupo_id, periodo_id, tipo, estado,
         fecha_asignacion, fecha_entrega, puntos, momento_inicio, momento_desarrollo, momento_cierre,
         estrategias, recursos, instrumentos, entregas_recibidas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [req.usuario.id, d.titulo, d.ra, d.area_id, grupoId, d.periodo_id ?? null, d.tipo, d.estado,
       d.fecha_asignacion, d.fecha_entrega, d.puntos, d.momento_inicio, d.momento_desarrollo, d.momento_cierre,
       d.estrategias, d.recursos, d.instrumentos, d.entregas_recibidas ?? 0]);
    await client.query('COMMIT');
    const { rows } = await pool.query(`${SELECT} WHERE a.id = $1`, [ins.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

router.put('/:id', asyncH(async (req, res) => {
  const d = actividadSchema.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupoId = await resolverGrupo(client, d);
    const upd = await client.query(
      `UPDATE actividades SET titulo=$1, ra=$2, area_id=$3, grupo_id=$4, periodo_id=$5, tipo=$6, estado=$7,
         fecha_asignacion=$8, fecha_entrega=$9, puntos=$10, momento_inicio=$11, momento_desarrollo=$12,
         momento_cierre=$13, estrategias=$14, recursos=$15, instrumentos=$16,
         entregas_recibidas=COALESCE($17, entregas_recibidas), actualizado_en=now()
       WHERE id=$18 AND usuario_id=$19 RETURNING id`,
      [d.titulo, d.ra, d.area_id, grupoId, d.periodo_id ?? null, d.tipo, d.estado, d.fecha_asignacion,
       d.fecha_entrega, d.puntos, d.momento_inicio, d.momento_desarrollo, d.momento_cierre, d.estrategias,
       d.recursos, d.instrumentos, d.entregas_recibidas ?? null, req.params.id, req.usuario.id]);
    await client.query('COMMIT');
    if (!upd.rows[0]) return res.status(404).json({ error: 'Actividad no encontrada' });
    const { rows } = await pool.query(`${SELECT} WHERE a.id = $1`, [upd.rows[0].id]);
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));

router.patch('/:id/estado', asyncH(async (req, res) => {
  const d = z.object({ estado: z.enum(ESTADOS), entregas_recibidas: z.coerce.number().int().min(0).optional() }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE actividades SET estado=$1, entregas_recibidas=COALESCE($2, entregas_recibidas), actualizado_en=now()
     WHERE id=$3 AND usuario_id=$4 RETURNING id`, [d.estado, d.entregas_recibidas ?? null, req.params.id, req.usuario.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Actividad no encontrada' });
  const r = await pool.query(`${SELECT} WHERE a.id = $1`, [rows[0].id]);
  res.json(r.rows[0]);
}));

router.delete('/:id', asyncH(async (req, res) => {
  const r = await pool.query('DELETE FROM actividades WHERE id=$1 AND usuario_id=$2', [req.params.id, req.usuario.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Actividad no encontrada' });
  res.status(204).end();
}));

module.exports = router;
