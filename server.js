require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pool = require('./src/db/pool');
const { manejarErrores } = require('./src/middleware');

const app = express();
app.set('trust proxy', 1); // Render usa un proxy inverso

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Las pantallas de Stitch cargan Tailwind (CDN) y fuentes de Google
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(compression());
app.use(express.json({ limit: '200kb' }));

// Límite de peticiones a la API (más estricto en login/registro)
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/catalogos', require('./src/routes/catalogos'));
app.use('/api/eventos', require('./src/routes/eventos'));
app.use('/api/actividades', require('./src/routes/actividades'));
app.use('/api/calendario', require('./src/routes/calendario'));
app.use('/api/estudiantes', require('./src/routes/estudiantes'));
app.use('/api/calificaciones', require('./src/routes/calificaciones'));
app.use('/api/reportes', require('./src/routes/reportes'));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Frontend estático (pantallas exportadas de Stitch, conectadas a la API)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/', (_req, res) => res.redirect('/dashboard'));

app.use(manejarErrores);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Calendario Académico RD escuchando en el puerto ${PORT}`));
}

module.exports = app;
