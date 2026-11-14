const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../db/pool');
const { firmarToken, requiereAuth, asyncH } = require('../middleware');

// Foto de perfil: imagen JPG/PNG/WebP reducida en el navegador (data URL, máx. ~110 KB)
const fotoSchema = z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Imagen no válida').max(150000, 'La imagen es demasiado grande');

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100),
  distrito: z.string().trim().max(120).optional(),
  foto: fotoSchema.optional(),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const publico = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, distrito: u.distrito, foto: u.foto || null });

router.post('/register', asyncH(async (req, res) => {
  const d = registroSchema.parse(req.body);
  const hash = await bcrypt.hash(d.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, distrito, foto) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [d.nombre, d.email, hash, d.distrito || null, d.foto || null]);
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

// Cambiar o quitar la foto de perfil
router.put('/foto', requiereAuth, asyncH(async (req, res) => {
  const d = z.object({ foto: fotoSchema }).parse(req.body);
  const { rows } = await pool.query('UPDATE usuarios SET foto = $1 WHERE id = $2 RETURNING *', [d.foto, req.usuario.id]);
  res.json(publico(rows[0]));
}));

router.delete('/foto', requiereAuth, asyncH(async (req, res) => {
  const { rows } = await pool.query('UPDATE usuarios SET foto = NULL WHERE id = $1 RETURNING *', [req.usuario.id]);
  res.json(publico(rows[0]));
}));

module.exports = router;
