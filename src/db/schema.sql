-- Calendario Académico RD — Esquema PostgreSQL (idempotente)

DO $$ BEGIN
  CREATE TYPE tipo_evento AS ENUM ('feriado', 'minerd', 'docencia', 'evaluacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_actividad AS ENUM ('tarea', 'proyecto', 'exposicion', 'prueba', 'practica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_actividad AS ENUM ('pendiente', 'en_curso', 'entregada', 'evaluada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Docentes (usuarios de la plataforma)
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'docente' CHECK (rol IN ('docente', 'admin')),
  distrito      TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Años escolares y períodos (P1..P4)
CREATE TABLE IF NOT EXISTS periodos (
  id            SERIAL PRIMARY KEY,
  anio_escolar  TEXT NOT NULL,             -- '2024-2025'
  codigo        TEXT NOT NULL,             -- 'P1'
  nombre        TEXT NOT NULL,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  UNIQUE (anio_escolar, codigo)
);

CREATE TABLE IF NOT EXISTS areas_curriculares (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);

-- Grupos: nivel + grado + sección
CREATE TABLE IF NOT EXISTS grupos (
  id           SERIAL PRIMARY KEY,
  nivel        TEXT NOT NULL,
  grado        TEXT NOT NULL,
  seccion      TEXT NOT NULL,
  estudiantes  INTEGER NOT NULL DEFAULT 30 CHECK (estudiantes >= 0),
  UNIQUE (nivel, grado, seccion)
);

-- Eventos del calendario: feriados, fechas MINERD, docencia (globales si usuario_id es NULL)
CREATE TABLE IF NOT EXISTS eventos (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  tipo          tipo_evento NOT NULL,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  hora_inicio   TIME,
  hora_fin      TIME,
  laborable     BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_eventos_fechas ON eventos (fecha_inicio, fecha_fin);

-- Actividades pedagógicas (modelo MINERD: RA + 3 momentos + estrategias + recursos + instrumentos)
CREATE TABLE IF NOT EXISTS actividades (
  id                   SERIAL PRIMARY KEY,
  usuario_id           INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo               TEXT NOT NULL,
  ra                   TEXT NOT NULL,
  area_id              INTEGER NOT NULL REFERENCES areas_curriculares(id),
  grupo_id             INTEGER NOT NULL REFERENCES grupos(id),
  periodo_id           INTEGER REFERENCES periodos(id),
  tipo                 tipo_actividad NOT NULL DEFAULT 'tarea',
  estado               estado_actividad NOT NULL DEFAULT 'pendiente',
  fecha_asignacion     TIMESTAMPTZ NOT NULL,
  fecha_entrega        TIMESTAMPTZ NOT NULL,
  puntos               NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (puntos >= 0),
  momento_inicio       TEXT NOT NULL DEFAULT '',
  momento_desarrollo   TEXT NOT NULL DEFAULT '',
  momento_cierre       TEXT NOT NULL DEFAULT '',
  estrategias          TEXT NOT NULL DEFAULT '',
  recursos             TEXT NOT NULL DEFAULT '',
  instrumentos         TEXT NOT NULL DEFAULT '',
  entregas_recibidas   INTEGER NOT NULL DEFAULT 0 CHECK (entregas_recibidas >= 0),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_entrega >= fecha_asignacion)
);
CREATE INDEX IF NOT EXISTS idx_actividades_usuario ON actividades (usuario_id, fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_actividades_estado ON actividades (usuario_id, estado);

-- Eventos globales únicos (permite re-ejecutar el seed sin duplicar)
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_globales ON eventos (titulo, fecha_inicio, tipo) WHERE usuario_id IS NULL;

-- Lista de estudiantes por docente y grupo
CREATE TABLE IF NOT EXISTS estudiantes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  grupo_id    INTEGER NOT NULL REFERENCES grupos(id),
  nombre      TEXT NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, grupo_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_estudiantes_grupo ON estudiantes (usuario_id, grupo_id);

-- Calificación de cada estudiante en cada actividad
CREATE TABLE IF NOT EXISTS calificaciones (
  actividad_id   INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  puntos         NUMERIC(5,2) CHECK (puntos >= 0),
  observacion    TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (actividad_id, estudiante_id)
);

-- Tipos de contenido trabajados en el 2.º momento (Desarrollo)
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS desarrollo_tipos TEXT[] NOT NULL DEFAULT '{}';
