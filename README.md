# Calendario Académico RD — Gestor de Actividades

Calendario escolar (MINERD) y gestor de actividades docentes. Frontend exportado de Stitch,
conectado a una API **Express + PostgreSQL**.

## Pantallas
`/dashboard` (mes) · `/semana` · `/actividades` (listado y filtros) · `/actividad-form` (modelo MINERD: RA, 3 momentos, estrategias, recursos, instrumentos) · `/login`

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
| GET | `/api/health` | Estado del servicio y de la BD |

## Despliegue en Render
1. Sube el repo a GitHub.
2. En Render: **New → Blueprint** y elige el repo (usa `render.yaml`: crea el servicio web y la BD).
3. Render genera `JWT_SECRET` y conecta `DATABASE_URL`. Al arrancar se migra y se cargan los datos base.

> La base gratuita de Render caduca a los 30 días; para uso real elige un plan de pago.

## Datos a verificar
- Feriados cargados: calendario oficial 2026 del Ministerio de Trabajo (Ley 139-97). Añade los de otros años según se publiquen.
- Los períodos P1–P4 son rangos aproximados; ajústalos en la tabla `periodos` al calendario escolar oficial vigente.
- Las fechas MINERD (cierres, pruebas nacionales) no se precargan: se registran desde “Agregar Evento MINERD”.
