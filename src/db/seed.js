const bcrypt = require('bcryptjs');
const pool = require('./pool');

const AREAS = [
  'Lengua Española', 'Matemáticas', 'Ciencias Sociales', 'Ciencias de la Naturaleza',
  'Educación Artística', 'Educación Física', 'Formación Integral Humana y Religiosa',
  'Inglés', 'Francés',
];

const PERIODOS = [
  ['2024-2025', 'P1', '1er Período (P1) - Ago a Oct 2024', '2024-08-26', '2024-10-31'],
  ['2024-2025', 'P2', '2do Período (P2) - Nov a Ene 2024-2025', '2024-11-01', '2025-01-31'],
  ['2024-2025', 'P3', '3er Período (P3) - Feb a Mar 2025', '2025-02-01', '2025-03-31'],
  ['2024-2025', 'P4', '4to Período (P4) - Abr a Jun 2025', '2025-04-01', '2025-06-30'],
  ['2025-2026', 'P1', '1er Período (P1) - Ago a Oct 2025', '2025-08-25', '2025-10-31'],
  ['2025-2026', 'P2', '2do Período (P2) - Nov a Ene 2025-2026', '2025-11-01', '2026-01-31'],
  ['2025-2026', 'P3', '3er Período (P3) - Feb a Mar 2026', '2026-02-01', '2026-03-31'],
  ['2025-2026', 'P4', '4to Período (P4) - Abr a Jun 2026', '2026-04-01', '2026-06-30'],
  ['2026-2027', 'P1', '1er Período (P1) - Ago a Oct 2026', '2026-08-24', '2026-10-31'],
  ['2026-2027', 'P2', '2do Período (P2) - Nov a Ene 2026-2027', '2026-11-01', '2027-01-31'],
];

const GRUPOS = [
  ['Secundaria (2do Ciclo)', '4to de Secundaria', 'A', 30],
  ['Secundaria (2do Ciclo)', '4to de Secundaria', 'B', 32],
  ['Secundaria (2do Ciclo)', '5to de Secundaria', 'A', 29],
  ['Secundaria (2do Ciclo)', '5to de Secundaria', 'B', 31],
  ['Secundaria (1er Ciclo)', '1ro de Secundaria', 'A', 30],
  ['Secundaria (1er Ciclo)', '2do de Secundaria', 'A', 28],
  ['Secundaria (1er Ciclo)', '3ro de Secundaria', 'A', 30],
];

// [titulo, descripcion, tipo, inicio, fin, laborable]
// Feriados nacionales 2026 según el calendario oficial del Ministerio de Trabajo (Ley 139-97).
// Las fechas MINERD (inicio/cierre de períodos, pruebas nacionales, etc.) NO se precargan:
// el docente las registra desde "Agregar Evento MINERD" según el calendario escolar vigente.
const EVENTOS_GLOBALES = [
  ['Año Nuevo', 'Feriado nacional (inamovible)', 'feriado', '2026-01-01', '2026-01-01', false],
  ['Día de los Santos Reyes', 'Trasladado desde el martes 6 de enero', 'feriado', '2026-01-05', '2026-01-05', false],
  ['Día de Nuestra Señora de la Altagracia', 'Feriado nacional (inamovible)', 'feriado', '2026-01-21', '2026-01-21', false],
  ['Natalicio de Juan Pablo Duarte', 'Feriado patrio', 'feriado', '2026-01-26', '2026-01-26', false],
  ['Día de la Independencia Nacional', 'Fiesta patria no laborable (inamovible)', 'feriado', '2026-02-27', '2026-02-27', false],
  ['Viernes Santo', 'Feriado religioso', 'feriado', '2026-04-03', '2026-04-03', false],
  ['Día del Trabajo', 'Trasladado desde el viernes 1 de mayo', 'feriado', '2026-05-04', '2026-05-04', false],
  ['Corpus Christi', 'Feriado religioso', 'feriado', '2026-06-04', '2026-06-04', false],
  ['Día de la Restauración', 'Feriado patrio (domingo; no se traslada)', 'feriado', '2026-08-16', '2026-08-16', false],
  ['Día de Nuestra Señora de las Mercedes', 'Feriado nacional (inamovible)', 'feriado', '2026-09-24', '2026-09-24', false],
  ['Día de la Constitución', 'Trasladado desde el viernes 6 de noviembre', 'feriado', '2026-11-09', '2026-11-09', false],
  ['Navidad', 'Feriado nacional (inamovible)', 'feriado', '2026-12-25', '2026-12-25', false],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const nombre of AREAS) {
      await client.query('INSERT INTO areas_curriculares (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [nombre]);
    }
    for (const p of PERIODOS) {
      await client.query(
        `INSERT INTO periodos (anio_escolar, codigo, nombre, fecha_inicio, fecha_fin)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (anio_escolar, codigo) DO NOTHING`, p);
    }
    for (const g of GRUPOS) {
      await client.query(
        `INSERT INTO grupos (nivel, grado, seccion, estudiantes) VALUES ($1,$2,$3,$4)
         ON CONFLICT (nivel, grado, seccion) DO NOTHING`, g);
    }

    // Eventos globales: solo se insertan si la tabla de eventos globales está vacía (seed idempotente)
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM eventos WHERE usuario_id IS NULL');
    if (rows[0].n === 0) {
      for (const e of EVENTOS_GLOBALES) {
        await client.query(
          `INSERT INTO eventos (usuario_id, titulo, descripcion, tipo, fecha_inicio, fecha_fin, laborable)
           VALUES (NULL,$1,$2,$3,$4,$5,$6)`, e);
      }
    }

    // Usuario demo opcional (solo si se define SEED_DEMO_PASSWORD)
    if (process.env.SEED_DEMO_PASSWORD) {
      const hash = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD, 10);
      await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, distrito)
         VALUES ('Docente Demo', 'demo@calendario.local', $1, 'Distrito Educativo 10-01')
         ON CONFLICT (email) DO NOTHING`, [hash]);
      console.log('Usuario demo: demo@calendario.local');
    }

    await client.query('COMMIT');
    console.log('Datos semilla cargados correctamente.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .catch((e) => { console.error('Error en seed:', e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = seed;
