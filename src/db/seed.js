const bcrypt = require('bcryptjs');
const pool = require('./pool');

const AREAS = [
  'Lengua Española', 'Matemáticas', 'Ciencias Sociales', 'Ciencias de la Naturaleza',
  'Educación Artística', 'Educación Física', 'Formación Integral Humana y Religiosa',
  'Inglés', 'Francés', 'Informática',
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
  ['2026-2027', 'P1', '1er Período (P1) - Ago a Oct 2026', '2026-08-24', '2026-10-30'],
  ['2026-2027', 'P2', '2do Período (P2) - Nov a Ene 2026-2027', '2026-11-02', '2027-01-29'],
  ['2026-2027', 'P3', '3er Período (P3) - Feb a Mar 2027', '2027-02-01', '2027-03-31'],
  ['2026-2027', 'P4', '4to Período (P4) - Abr a Jun 2027', '2027-04-01', '2027-06-18'],
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
// Fuente: Calendario Escolar 2026-2027 del Ministerio de Educación (MINERD) y feriados oficiales
// (Ley 139-97; fechas ratificadas por el Ministerio de Trabajo). Se cargan los hitos del año escolar,
// los feriados, vacaciones, reportes de evaluación y pruebas nacionales del Nivel Secundario.
// laborable = false marca días sin docencia (feriados, vacaciones y recesos).
const SRC = 'Calendario Escolar MINERD 2026-2027';
const EVENTOS_GLOBALES = [
  // ---- Feriados 2026
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
  // ---- Feriados 2027 (Calendario Escolar MINERD 2026-2027, p. 12)
  ['Día de los Santos Reyes', 'Trasladado desde el miércoles 6 de enero', 'feriado', '2027-01-04', '2027-01-04', false],
  ['Día de Nuestra Señora de la Altagracia', 'Feriado nacional (inamovible)', 'feriado', '2027-01-21', '2027-01-21', false],
  ['Natalicio de Juan Pablo Duarte', 'Trasladado desde el martes 26 de enero', 'feriado', '2027-01-25', '2027-01-25', false],
  ['Día de la Independencia Nacional', 'Sábado; no se traslada', 'feriado', '2027-02-27', '2027-02-27', false],
  ['Viernes Santo', 'Feriado religioso', 'feriado', '2027-03-26', '2027-03-26', false],
  ['Día del Trabajo', 'Trasladado desde el sábado 1 de mayo', 'feriado', '2027-05-03', '2027-05-03', false],
  ['Corpus Christi', 'Feriado religioso', 'feriado', '2027-05-27', '2027-05-27', false],
  // ---- Año escolar 2026-2027: hitos generales y Nivel Secundario
  ['Jornada de formación docente de verano (Nivel Secundario)', SRC, 'minerd', '2026-08-10', '2026-08-21', true],
  ['Evaluaciones especiales de asignaturas aplazadas (Nivel Secundario)', SRC, 'minerd', '2026-08-10', '2026-08-20', true],
  ['Entrega de resultados de evaluaciones especiales (Nivel Secundario)', SRC, 'minerd', '2026-08-21', '2026-08-21', true],
  ['Inicio del año escolar 2026-2027 para los estudiantes', SRC, 'minerd', '2026-08-24', '2026-08-24', true],
  ['Acogida: transición del Nivel Primario al Secundario', SRC + ' — Protocolo de Transición', 'minerd', '2026-08-24', '2026-09-11', true],
  ['Entrega del informe de la Evaluación Diagnóstica (Nivel Secundario)', SRC + ' — al distrito educativo', 'minerd', '2026-09-07', '2026-09-09', true],
  ['Elecciones de consejos de curso (Nivel Secundario)', SRC + ' — Programa de Liderazgo Educativo', 'minerd', '2026-09-07', '2026-09-11', true],
  ['Elecciones de los Consejos Estudiantiles (Nivel Secundario)', SRC + ' — Programa de Liderazgo Educativo', 'minerd', '2026-09-30', '2026-09-30', true],
  ['Día de la Evaluación', 'Último miércoles de octubre', 'minerd', '2026-10-28', '2026-10-28', true],
  ['Entrega del 1.er reporte de calificaciones (P1) — Nivel Secundario', SRC, 'evaluacion', '2026-10-30', '2026-10-30', true],
  ['Tercera convocatoria de Pruebas Nacionales (Nivel Secundario)', SRC + ' — Académica, Técnico Profesional y Artes', 'minerd', '2026-11-12', '2026-11-13', true],
  ['Vacaciones navideñas', SRC + ' — del 18 de diciembre al 6 de enero, inclusive', 'minerd', '2026-12-18', '2027-01-06', false],
  ['Entrega del 2.º reporte de calificaciones (P2) — Nivel Secundario', SRC, 'evaluacion', '2027-01-29', '2027-01-29', true],
  ['Semana Santa', SRC + ' — receso docente', 'minerd', '2027-03-22', '2027-03-26', false],
  ['Reinicio de la docencia tras Semana Santa', SRC, 'minerd', '2027-03-29', '2027-03-29', true],
  ['Entrega del 3.er reporte de calificaciones (P3) — Nivel Secundario', SRC, 'evaluacion', '2027-03-31', '2027-03-31', true],
  ['Entrega del 4.º reporte de calificaciones (P4) — Nivel Secundario', SRC, 'evaluacion', '2027-06-01', '2027-06-01', true],
  ['Cierre del año escolar 2026-2027 para los estudiantes', SRC, 'minerd', '2027-06-18', '2027-06-18', true],
  ['Primera convocatoria de Pruebas Nacionales (Nivel Secundario)', SRC + ' — Académica, Técnico Profesional y Artes', 'minerd', '2027-06-22', '2027-06-25', true],
  ['Vacaciones docentes', 'Del 29 de junio al 30 de julio de 2027 (Ordenanza del Calendario Escolar 2026-2027)', 'minerd', '2027-06-29', '2027-07-30', false],
  ['Reintegración docente y capacitación de verano', 'Lunes 2 de agosto de 2027', 'minerd', '2027-08-02', '2027-08-02', true],
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
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (anio_escolar, codigo) DO UPDATE
         SET nombre = EXCLUDED.nombre, fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin`, p);
    }
    for (const g of GRUPOS) {
      await client.query(
        `INSERT INTO grupos (nivel, grado, seccion, estudiantes) VALUES ($1,$2,$3,$4)
         ON CONFLICT (nivel, grado, seccion) DO NOTHING`, g);
    }

    // Eventos globales: idempotente (índice único por título + fecha + tipo)
    for (const e of EVENTOS_GLOBALES) {
      await client.query(
        `INSERT INTO eventos (usuario_id, titulo, descripcion, tipo, fecha_inicio, fecha_fin, laborable)
         VALUES (NULL,$1,$2,$3,$4,$5,$6)
         ON CONFLICT (titulo, fecha_inicio, tipo) WHERE usuario_id IS NULL DO NOTHING`, e);
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
