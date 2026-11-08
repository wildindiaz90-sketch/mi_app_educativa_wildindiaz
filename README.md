# Calendario Académico RD — Gestor de Actividades

Calendario escolar (MINERD) y gestor de actividades docentes. Frontend exportado de Stitch,
conectado a una API **Express + PostgreSQL**.

## Pantallas
`/dashboard` (mes) · `/semana` · `/actividades` (listado y filtros) · `/actividad-form` (modelo MINERD: RA, 3 momentos, estrategias, recursos, instrumentos) · `/calificaciones` (notas por estudiante y actividad) · `/reportes` (todas las actividades con sus calificaciones; exporta CSV e imprime) · `/login`

## Local
```bash
cp .env.example .env      # completa DATABASE_URL y JWT_SECRET
npm install
npm run setup             # crea tablas y carga catálogos + feriados 2026
npm run dev               # http://localhost:3000
```

## API (requiere `Authorization: Bearer <token>` salvo /auth y /health)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Cuenta docente y token JWT |
| GET | `/api/catalogos` | Áreas, períodos y grupos |
| GET/POST/PUT/DELETE | `/api/eventos` | Eventos (feriados y MINERD globales + propios) |
| GET/POST/PUT/PATCH/DELETE | `/api/actividades` | CRUD con filtros `q, area_id, grupo_id, periodo_id, tipo, estado, desde, hasta, page, limit` |
| GET | `/api/calendario?desde&hasta` | Eventos y actividades de un rango (mes/semana) |
| GET | `/api/calendario/resumen?mes=AAAA-MM` | Tarjetas del dashboard y entregas próximas |
| GET/POST/PUT/DELETE | `/api/estudiantes` | Lista de estudiantes por grupo (alta en bloque con `nombres[]`) |
| GET/PUT | `/api/calificaciones/actividad/:id` | Notas de los estudiantes del grupo en una actividad (0 a puntos máximos) |
| GET | `/api/reportes/actividades` | Actividades con calificaciones, promedio, máx./mín. y % de aprobados (filtros `periodo_id, grupo_id, area_id`) |
| GET | `/api/health` | Estado del servicio y de la BD |

## Despliegue en Render
1. Sube el repo a GitHub.
2. En Render: **New → Blueprint** y elige el repo (usa `render.yaml`: crea el servicio web y la BD).
3. Render genera `JWT_SECRET` y conecta `DATABASE_URL`. Al arrancar se migra y se cargan los datos base.

> La base gratuita de Render caduca a los 30 días; para uso real elige un plan de pago.

## Datos a verificar
- Calendario cargado: Calendario Escolar MINERD 2026-2027 (feriados 2026-2027, inicio/cierre del año escolar, vacaciones, Semana Santa, reportes de evaluación P1-P4 y pruebas nacionales del Nivel Secundario). No incluye las actividades propias de otros niveles/modalidades ni las efemérides; se pueden agregar desde «Eventos MINERD».
- Los períodos P1-P4 de 2026-2027 usan las fechas de reporte del Nivel Secundario. Los de años anteriores son aproximados.
- «Días lectivos» = lunes a viernes dentro de un período, sin feriados ni vacaciones; puede diferir en un día de la tabla oficial (p. 13 del calendario).
- Aprobado = 70 % o más de los puntos de la actividad.
- El seed es idempotente: se puede volver a ejecutar sin duplicar eventos.
