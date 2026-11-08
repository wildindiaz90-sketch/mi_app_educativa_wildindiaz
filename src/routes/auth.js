const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../db/pool');
const { firmarToken, requiereAuth, asyncH } = require('../middleware');

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100),
  distrito: z.string().trim().max(120).optional(),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const publico = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, distrito: u.distrito });

router.post('/register', asyncH(async (req, res) => {
  const d = registroSchema.parse(req.body);
  const hash = await bcrypt.hash(d.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, distrito) VALUES ($1,$2,$3,$4) RETURNING *`,
    [d.nombre, d.email, hash, d.distrito || null]);
  res.status(201).json({ token: firmarToken(rows[0]), usuario: publico(rows[0]) });
}));

router.post('/login', asyncH(async (req, res) => {
  const d = loginSchema.parse(req.body);
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [d.email]);
  const u = rows[0];
  const ok = u && (await bcrypt.compare(d.password, u.password_hash));
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  res.json({ token: firmarToken(u), usuario: publico(u) });
}));

router.get('/me', requiereAuth, asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });
  res.json(publico(rows[0]));
}));

module.exports = router;
