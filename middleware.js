const jwt = require('jsonwebtoken');
const { ZodError } = require('zod');

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret-cambiar');
if (!SECRET) {
  console.error('Falta JWT_SECRET en producción');
  process.exit(1);
}

function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, SECRET, { expiresIn: '7d' });
}

function requiereAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.usuario = { id: payload.sub, rol: payload.rol };
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

// Envoltorio para handlers async: reenvía errores a manejarErrores
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function manejarErrores(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'El registro ya existe' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referencia inválida (área, período o grupo)' });
  if (err.code === '23514') return res.status(400).json({ error: 'Los datos no cumplen las restricciones (revise las fechas)' });
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
}

module.exports = { firmarToken, requiereAuth, asyncH, manejarErrores };
