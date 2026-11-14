# Plan de trabajo del backend - OpportunityBridge

Fecha de elaboración: 13 de noviembre de 2026.
Proyecto académico: portal de empleo, candidato, empleador y administrador.

## Documentación para trabajar

1. [Alcance por pantalla](docs/01_ALCANCE_PANTALLAS.md): contenido, acciones y condiciones de aceptación.
2. [Contrato de API](docs/02_CONTRATO_API.md): rutas, permisos, entradas, respuestas y reglas de implementación.
3. [Consultas y pruebas](docs/03_CONSULTAS_Y_PRUEBAS.md): SQL, transacciones, diferencias del modelo y casos de prueba.
4. [Cobertura de defensa e integración](docs/04_DEFENSA_E_INTEGRACION.md): los 12 requisitos mínimos de la U, recorrido de demostración y necesidades del frontend.

Estos archivos especifican trabajo pendiente. No significan que las APIs ya estén implementadas.

El alcance completo incluye las APIs anteriores de la guía/prototipo y las añadidas o precisadas para los 12 requisitos mínimos de defensa. El inventario de este mismo plan enumera todas; completar la defensa no da por terminados los módulos restantes.

## Punto de partida comprobado

- `backend/src/index.js`: servidor Express con `GET /health`.
- `backend/src/db.js`: Pool de `pg` que lee `DATABASE_URL`.
- Dependencias declaradas: Express, pg, dotenv y nodemon.
- `backend/database/schema.sql`: copia local del modelo de 18 tablas. El usuario indicó que ya ejecutó el esquema en Supabase; no volver a ejecutarlo.
- `datos_prueba.sql`: datos de demostración preparados. No está confirmado aquí si ya fueron cargados. Sus contraseñas `HASH_PENDIENTE_*` no sirven para iniciar sesión y sus rutas de archivos no crean archivos reales.
- Frontend pendiente. Esta entrega documenta el trabajo del backend; no implementa sus módulos.
- No se comprobó en esta revisión la conexión remota ni la estructura real de Supabase. Antes de programar, comparar columnas con `information_schema`, sin recrear tablas.

## Alcance y decisiones de implementación

Usar Node.js con módulos ES, Express, SQL directo mediante `pg` y PostgreSQL alojado en Supabase. Autenticación propia sobre `usuarios`, con contraseña hash y token Bearer. No incorporar Supabase Auth, Storage, RLS, ORM ni microservicios. El backend administra permisos y pertenencia de cada registro.

Agregar solo cuando toque la fase correspondiente: bcryptjs para contraseñas, jsonwebtoken para tokens, cors para el frontend y multer para formularios con archivos locales. Son dependencias previstas, todavía no instaladas por este plan. Validar los cuerpos con funciones pequeñas por módulo; no hace falta una arquitectura mayor.

La aplicación maneja CV, logos y documentos en carpetas locales. La base conserva rutas relativas. Para el proyecto se asume una empresa por empleador, como exige `empresas.usuario_id UNIQUE`.

## Orden de trabajo y entregables

Marcar una tarea solo al completar su implementación y comprobarla con HTTP y PostgreSQL.

| Fase | Tareas | Entregable y criterio de cierre | Depende de |
|---|---|---|---|
| 0 | Revisar tablas remotas; probar conexión; confirmar carga de datos y variables | `GET /health/db` responde 200 con consulta real o 503 si falla; no expone credenciales | Ninguna |
| 1 | Prefijo `/api`, validaciones, errores, paginación, CORS, separación app/servidor | Respuestas uniformes; ruta inexistente 404; entrada inválida 400 | 0 |
| 2 | Registro, login, token, sesión actual, roles y suspensión | Login real con hashes; sin autoasignación de administrador; pruebas 401/403 | 1 |
| 3 | Categorías, empresas públicas, vacantes, detalle, filtros, métricas de inicio | P-01 y P-02 consumibles con filtros combinados y conteos reales | 1 |
| 4 | Perfil, CV local, postulaciones, guardados y notificaciones | Recorrido completo candidato: registrar → CV → buscar → postular → ver estado | 2, 3 |
| 5 | Datos de empresa, logo/documentación, vacantes propias, candidatos y estados | Empleador solo accede a sus ofertas, solicitudes y CV autorizados | 2, 4 |
| 6 | Administración principal: usuarios, empresas, vacantes, categorías y bitácora | Aprobar empresa/oferta, activar/suspender usuarios; panel administrativo consumible | 2 a 5 |
| 7 | Dashboards de candidato/empresa y recorrido mínimo de defensa | APIs de resumen reales y 12 requisitos de la U comprobados de extremo a extremo | 0 a 6 |
| 8 | Completar guía original: recursos, noticias, valoraciones, foros, moderación, alertas y visitas | P-05 y funciones complementarias con consultas y pruebas propias | 2 a 7 |
| 9 | Pruebas finales de todos los módulos y documentación de arranque | Colección Postman sin secretos y matriz funcional/integración, con resultado real de cada caso | 0 a 8 |

## Inventario completo de APIs a implementar e integrar

Este es el listado maestro de trabajo: **104 endpoints**, sin eliminar las APIs anteriores. Incluye **102 rutas anteriores** y **2 dashboards añadidos** para completar la defensa. Aceptar/denegar y cerrar ofertas se ejecutan mediante rutas anteriores cuyo comportamiento quedó precisado.

Leyenda: **I** = implementación de ruta, validación, permisos y servicio; **BD** = conexión funcional a consultas/transacciones de PostgreSQL; **T** = pruebas HTTP y reglas de aceptación; **F** = integración con la pantalla del frontend. Pend. significa pendiente; N/A significa que no requiere esa integración. Base existente reconoce únicamente el código de health observado, no una prueba actual de todos los módulos.

Una fila queda terminada del lado backend cuando I, BD (si aplica) y T están completos. F se cierra al comprobar el consumo real junto al responsable del frontend. Los contratos detallados siguen en documento 02 y los Qxx remiten al documento 03. Las columnas son seguimiento de tareas, no evidencia de que ya se ejecutaron.

| Fase | Cantidad de endpoints |
|---|---|
| 0 | 2 |
| 2 | 3 |
| 3 | 8 |
| 4 | 11 |
| 5 | 15 |
| 6 | 14 |
| 7 | 2 |
| 8 | 49 |

Las fases 1 y 9 no añaden endpoints: preparan infraestructura y completan pruebas globales. En fase 7 se comprueba el recorrido D01–D12; las APIs de fase 8 siguen siendo parte obligatoria del plan completo de la guía original.

### Autenticación y diagnóstico (P-01)

| ID | Método y ruta completa | Fase | Pantalla / requisito | SQL | Origen | I | BD | T | F |
|---|---|---|---|---|---|---|---|---|---|
| API-001 | `GET /health` | 0 | Diagnóstico | Q01 | Anterior | Base existente | N/A | Pend. | N/A |
| API-002 | `GET /health/db` | 0 | Diagnóstico | Q01 | Anterior | Pend. | Pend. | Pend. | N/A |
| API-003 | `POST /api/auth/registro` | 2 | P-01 / D02 | Q02 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-004 | `POST /api/auth/login` | 2 | P-01 / D02 | Q02 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-005 | `GET /api/auth/me` | 2 | P-01 / D02 | Q02 | Anterior | Pend. | Pend. | Pend. | Pend. |

### Consultas públicas (P-01, P-02 y P-05)

| ID | Método y ruta completa | Fase | Pantalla / requisito | SQL | Origen | I | BD | T | F |
|---|---|---|---|---|---|---|---|---|---|
| API-006 | `GET /api/inicio/metricas` | 3 | P-01 / D01 | Q03 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-007 | `GET /api/catalogos/categorias-empleo` | 3 | P-01/P-04 / D01,D04 | Q05 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-008 | `GET /api/catalogos/categorias-foro` | 8 | P-05 | Q05 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-009 | `GET /api/vacantes` | 3 | P-01/P-02 / D01,D05 | Q04 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-010 | `GET /api/vacantes/:id` | 3 | P-01/P-02 / D01,D05 | Q04 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-011 | `GET /api/empresas` | 3 | P-02/P-05 | Q05 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-012 | `GET /api/empresas/:id` | 3 | P-02/P-05 | Q05 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-013 | `GET /api/empresas/:id/vacantes` | 3 | P-02/P-05 | Q04 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-014 | `GET /api/empresas/:id/valoraciones` | 3 | P-02/P-05 | Q05 | Anterior | Pend. | Pend. | Pend. | Pend. |

### Perfil del candidato (P-03)

| ID | Método y ruta completa | Fase | Pantalla / requisito | SQL | Origen | I | BD | T | F |
|---|---|---|---|---|---|---|---|---|---|
| API-015 | `GET /api/perfil` | 4 | P-03 / D06,D11 | Q06 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-016 | `GET /api/perfil/dashboard` | 7 | P-03 / D11 | Q18 | Añadida defensa | Pend. | Pend. | Pend. | Pend. |
| API-017 | `PATCH /api/perfil` | 4 | P-03 / D06,D11 | Q06 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-018 | `POST /api/perfil/cv` | 4 | P-03 / D06,D11 | Q06 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-019 | `GET /api/perfil/cv` | 4 | P-03 / D06,D11 | Q06 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-020 | `GET /api/perfil/estadisticas` | 8 | P-03 | Q07 + ajuste visitas | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-021 | `GET /api/perfil/postulaciones` | 4 | P-02/P-03 / D06,D11 | Q07 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-022 | `POST /api/perfil/postulaciones` | 4 | P-02/P-03 / D06,D11 | Q07 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-023 | `GET /api/perfil/guardados` | 4 | P-03 / D11 | Q10 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-024 | `POST /api/perfil/guardados` | 4 | P-03 / D11 | Q10 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-025 | `DELETE /api/perfil/guardados/:vacanteId` | 4 | P-03 / D11 | Q10 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-026 | `GET /api/perfil/alertas` | 8 | P-03 | Q10,Q17 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-027 | `POST /api/perfil/alertas` | 8 | P-03 | Q10,Q17 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-028 | `PATCH /api/perfil/alertas/:id` | 8 | P-03 | Q10,Q17 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-029 | `DELETE /api/perfil/alertas/:id` | 8 | P-03 | Q10,Q17 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-030 | `GET /api/notificaciones` | 4 | P-03/P-04 / D08,D11 | Q10 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-031 | `PATCH /api/notificaciones/:id/leida` | 4 | P-03/P-04 / D08,D11 | Q10 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-032 | `GET /api/perfil/historial` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-033 | `POST /api/perfil/historial` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-034 | `PATCH /api/perfil/historial/:id` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-035 | `DELETE /api/perfil/historial/:id` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-036 | `GET /api/perfil/valoraciones` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-037 | `POST /api/perfil/valoraciones` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-038 | `PATCH /api/perfil/valoraciones/:id` | 8 | P-03/P-05 | Q11 | Anterior | Pend. | Pend. | Pend. | Pend. |

### Área de empleador (P-04)

| ID | Método y ruta completa | Fase | Pantalla / requisito | SQL | Origen | I | BD | T | F |
|---|---|---|---|---|---|---|---|---|---|
| API-039 | `GET /api/empleador/dashboard` | 7 | P-04 / D10 | Q19 | Añadida defensa | Pend. | Pend. | Pend. | Pend. |
| API-040 | `GET /api/empleador/empresa` | 5 | P-04 / D03 | Q06,Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-041 | `POST /api/empleador/empresa` | 5 | P-04 / D03 | Q06,Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-042 | `PATCH /api/empleador/empresa` | 5 | P-04 / D03 | Q06,Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-043 | `POST /api/empleador/empresa/logo` | 5 | P-04 / D03 | Q06,Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-044 | `POST /api/empleador/empresa/documento` | 5 | P-04 / D03 | Q06,Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-045 | `GET /api/empleador/empresa/documento` | 5 | P-04 / D03 | Q06,Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-046 | `GET /api/empleador/vacantes` | 5 | P-04 / D04 | Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-047 | `POST /api/empleador/vacantes` | 5 | P-04 / D04 | Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-048 | `GET /api/empleador/vacantes/:id` | 5 | P-04 / D04 | Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-049 | `PATCH /api/empleador/vacantes/:id` | 5 | P-04 / D04 | Q08 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-050 | `PATCH /api/empleador/vacantes/:id/cerrar` | 5 | P-04 / D09 | Q20 | Anterior, precisada defensa | Pend. | Pend. | Pend. | Pend. |
| API-051 | `GET /api/empleador/postulaciones` | 5 | P-04 / D07 | Q09 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-052 | `GET /api/empleador/postulaciones/:id/candidato` | 5 | P-04 / D07 | Q09 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-053 | `GET /api/empleador/postulaciones/:id/cv` | 5 | P-04 / D07 | Q09 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-054 | `PATCH /api/empleador/postulaciones/:id/estado` | 5 | P-04 / D08 | Q09 | Anterior, precisada defensa | Pend. | Pend. | Pend. | Pend. |

### Comunidad y contenido (P-05)

| ID | Método y ruta completa | Fase | Pantalla / requisito | SQL | Origen | I | BD | T | F |
|---|---|---|---|---|---|---|---|---|---|
| API-055 | `GET /api/recursos` | 8 | P-05 | Q12 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-056 | `GET /api/recursos/:id` | 8 | P-05 | Q12 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-057 | `GET /api/recursos/:id/descarga` | 8 | P-05 | Q12 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-058 | `GET /api/noticias` | 8 | P-05 | Q12 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-059 | `GET /api/noticias/:id` | 8 | P-05 | Q12 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-060 | `GET /api/foro/temas` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-061 | `GET /api/foro/temas/:id` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-062 | `POST /api/foro/temas` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-063 | `PATCH /api/foro/temas/:id` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-064 | `GET /api/foro/temas/:id/respuestas` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-065 | `POST /api/foro/temas/:id/respuestas` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-066 | `PATCH /api/foro/respuestas/:id` | 8 | P-05 | Q13 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-067 | `POST /api/reportes` | 8 | P-02/P-05/P-06 | Q14 | Anterior | Pend. | Pend. | Pend. | Pend. |

### Administración (P-06)

| ID | Método y ruta completa | Fase | Pantalla / requisito | SQL | Origen | I | BD | T | F |
|---|---|---|---|---|---|---|---|---|---|
| API-068 | `GET /api/admin/resumen` | 6 | P-06 / D12 | Q03 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-069 | `GET /api/admin/usuarios` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-070 | `PATCH /api/admin/usuarios/:id/estado` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-071 | `GET /api/admin/empresas` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-072 | `GET /api/admin/empresas/:id/documento` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-073 | `PATCH /api/admin/empresas/:id/estado` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-074 | `GET /api/admin/vacantes` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-075 | `PATCH /api/admin/vacantes/:id/estado` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-076 | `GET /api/admin/historial-laboral` | 8 | P-06 / guía original | Q11,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-077 | `PATCH /api/admin/historial-laboral/:id/verificacion` | 8 | P-06 / guía original | Q11,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-078 | `GET /api/admin/valoraciones` | 8 | P-06 / guía original | Q11,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-079 | `PATCH /api/admin/valoraciones/:id/estado` | 8 | P-06 / guía original | Q11,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-080 | `GET /api/admin/foro/temas` | 8 | P-06 / guía original | Q13,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-081 | `PATCH /api/admin/foro/temas/:id/estado` | 8 | P-06 / guía original | Q13,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-082 | `GET /api/admin/foro/respuestas` | 8 | P-06 / guía original | Q13,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-083 | `PATCH /api/admin/foro/respuestas/:id/estado` | 8 | P-06 / guía original | Q13,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-084 | `GET /api/admin/reportes` | 8 | P-06 / guía original | Q14,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-085 | `PATCH /api/admin/reportes/:id/estado` | 8 | P-06 / guía original | Q14,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-086 | `GET /api/admin/categorias-empleo` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-087 | `POST /api/admin/categorias-empleo` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-088 | `PATCH /api/admin/categorias-empleo/:id` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-089 | `DELETE /api/admin/categorias-empleo/:id` | 6 | P-06 / D12 | Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-090 | `GET /api/admin/categorias-foro` | 8 | P-06 / guía original | Q05,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-091 | `POST /api/admin/categorias-foro` | 8 | P-06 / guía original | Q05,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-092 | `PATCH /api/admin/categorias-foro/:id` | 8 | P-06 / guía original | Q05,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-093 | `DELETE /api/admin/categorias-foro/:id` | 8 | P-06 / guía original | Q05,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-094 | `GET /api/admin/recursos` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-095 | `POST /api/admin/recursos` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-096 | `PATCH /api/admin/recursos/:id` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-097 | `POST /api/admin/recursos/:id/archivo` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-098 | `DELETE /api/admin/recursos/:id` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-099 | `GET /api/admin/noticias` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-100 | `POST /api/admin/noticias` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-101 | `PATCH /api/admin/noticias/:id` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-102 | `DELETE /api/admin/noticias/:id` | 8 | P-06 / guía original | Q12,Q15 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-103 | `GET /api/admin/estadisticas` | 6 | P-06 / D12 | Q16 | Anterior | Pend. | Pend. | Pend. | Pend. |
| API-104 | `GET /api/admin/bitacora` | 6 | P-06 / D12 | Q16 | Anterior | Pend. | Pend. | Pend. | Pend. |

### Dependencias y trabajo interno que también se debe integrar

| Trabajo | Fase | Integración requerida | Estado |
|---|---|---|---|
| Manejo de errores, CORS, validación, paginación y sesión/roles | 1–2 | Aplicar a todas las rutas correspondientes; no crear una API ficticia por middleware | Pendiente |
| Hash de contraseñas de cuentas de demostración | 2 | Preparar hashes válidos antes de probar login; no volver a cargar el esquema | Pendiente |
| Acciones de negocio + notificación + bitácora | 4–6,8 | Transacción con el mismo cliente pg; sin efectos parciales | Pendiente |
| Carga y descarga de archivos locales | 4–5,8 | Multipart, rutas relativas, límites y acceso autorizado | Pendiente |
| Dashboards | 7 | Q18/Q19 sobre datos de los módulos anteriores; sin migración adicional | Pendiente |
| Visitas de perfil | 8 | Aplicar ajuste mínimo antes de implementar estadísticas de visitas; integrar al perfil autorizado del postulante | Pendiente |
| Alertas y deduplicación | 8 | Ajustes del modelo + Q17 al publicar vacantes/activar alertas; notificaciones internas reales | Pendiente |
| T01–T30 y recorrido D01–D12 | 7,9 | HTTP + PostgreSQL y comprobación posterior con frontend | Pendiente |

Email/SMS programados, respaldos automáticos y métricas operativas conservan el alcance condicionado del apartado de diferencias: no se consideran APIs implementadas ni desaparecen por omisión; requieren sus componentes externos antes de afirmar que funcionan.

### Procedimiento para ejecutar este inventario

1. Desarrollar por fases; dentro de cada módulo implementar lectura, escritura y validaciones de sus filas.
2. Conectar el servicio al SQL indicado y a los archivos locales cuando corresponda.
3. Probar permisos, propiedad, errores y resultado persistido; actualizar I/BD/T por fila con evidencia.
4. Entregar al frontend petición/respuesta y estados; comprobar la pantalla y cerrar F.
5. Repetir hasta completar las 104 filas aplicables y los trabajos internos; el mínimo de defensa no sustituye las filas restantes.

## Lista de control

La lista general se complementa con el inventario por endpoint siguiente. Un módulo no se marca completo si cualquiera de sus APIs sigue pendiente de implementar, conectar a PostgreSQL o probar. La integración de pantalla se comprueba posteriormente con el responsable del frontend.

- [ ] Conexión y esquema real confirmados.
- [ ] Infraestructura HTTP, errores y validación.
- [ ] Autenticación y permisos.
- [ ] Inicio, búsqueda y detalle.
- [ ] Perfil y archivos locales.
- [ ] Postulación, solicitudes y guardados.
- [ ] Empresas y vacantes del empleador.
- [ ] Aceptar/denegar candidatos y cerrar ofertas conservando solicitudes.
- [ ] Dashboard del candidato y dashboard de la empresa.
- [ ] Panel administrativo principal y recorrido D01–D12 de defensa.
- [ ] Recursos, noticias, valoraciones y foros.
- [ ] Moderación, categorías y bitácora.
- [ ] Alertas internas y estadísticas personales.
- [ ] Integración y pruebas finales documentadas.

## Distribución prevista de archivos

```text
backend/
  src/
    index.js                 # escucha el puerto
    app.js                   # configura Express y monta rutas
    db.js                    # Pool compartido
    routes/                  # auth, publico, perfil, empleador, comunidad, admin
    controllers/             # recibe petición y construye respuesta HTTP
    services/                # reglas y SQL parametrizado por módulo
    middleware/              # autenticar, permitirRoles, errores, archivos
    validators/              # validaciones por módulo
    utils/                   # errores y formato de respuesta
  uploads/
    cv/                      # acceso privado
    logos/                   # acceso público
    documentos/              # acceso privado
    recursos/                # descarga con sesión
  database/                  # esquema de referencia, datos y futuros ajustes
  scripts/                   # pruebas y comprobaciones
```

Este árbol es una propuesta de implementación. Las carpetas nuevas se crean al desarrollar cada fase. Mantener `.gitkeep` en las vacías. No versionar `.env`, `node_modules` ni archivos reales de uploads; sí conservar sus carpetas mediante `.gitkeep`.

Flujo único: ruta → autenticación/rol → validación → controlador → servicio/SQL → respuesta. Los servicios reciben el usuario autenticado; nunca confían en un `candidato_id`, `usuario_id` o `empresa_id` enviado para atribuir propiedad.

## Variables previstas

```dotenv
PORT=3000
DATABASE_URL=CADENA_PRIVADA_DE_CONEXION
JWT_SECRET=SECRETO_LOCAL
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=uploads
```

`FRONTEND_URL` se ajusta cuando se defina el frontend. `.env.example` debe documentar los nombres, sin valores privados. El código actual de conexión ya usa `DATABASE_URL`; revisar la plantilla al implementar fase 0. Ejecutar siempre desde `backend/`.

## Diferencias del prototipo que requieren trabajo explícito

| Elemento | Resolución |
|---|---|
| Login/registro no desplegados en el PDF | Contratos de auth definidos y formularios que consuman esos endpoints |
| Solicitudes solo como enlace/contador | Listado personal con vacante, empresa, fecha y estado |
| Contacto al publicar | `correo_contacto` obligatorio en vacante |
| Visitas de perfil | Ajuste mínimo de tabla documentado en consultas; no inventar el valor |
| Criterios de alerta incompletos | Añadir salario y contrato cuando se implementen coincidencias |
| Email/SMS cada 24 h | Preferencias ya existen; el envío real exige proveedor y programador. Llevarlo como extensión explícita, no presentarlo como implementado con solo insertar una notificación |
| Respaldos y rendimiento del sistema | Documentar respaldo manual de desarrollo. Respaldos automáticos, disponibilidad, tráfico y errores exigen configuración/medición adicional; no mostrar datos de ejemplo como reales |

Los últimos dos puntos son pendientes respecto al prototipo completo. El entregable académico mínimo implementa notificaciones internas y métricas de negocio; cualquier demostración debe identificar esa diferencia.

## Prioridad de la defensa solicitada por la U

Implementar y comprobar primero landing, registro de usuario, empresa, oferta, búsqueda/detalle, postulación, listado de aplicantes, aceptar/denegar, cerrar oferta, dashboard de empresa, dashboard de usuario y panel administrativo. La matriz D01–D12 del documento 04 es la lista de aceptación del recorrido mínimo.

Los dashboards se construyen con las tablas existentes: no dependen de agregar visitas_perfil ni alertas_enviadas. Aceptar/Contratar usa `contratado`; Denegar usa `rechazado`. El paso `en_proceso` es opcional y se permite aceptar directamente una solicitud `nueva`. Cancelar/Inactivar se representa con `cerrada` y conserva historial. El frontend ajusta pantallas, nombres de botones y consumo de datos al contrato; el backend valida todas las reglas.

La aprobación administrativa es parte del recorrido: empresa creada pendiente → admin aprueba → empleador crea oferta pendiente → admin publica → candidato la encuentra. Preparar acceso a los tres roles para demostrarlo sin actualizar estados manualmente en SQL.

## Definición de terminado

Una API está terminada cuando cumple su contrato, usa datos reales de PostgreSQL, valida entradas y pertenencia, no devuelve hashes, maneja errores y tiene casos exitosos y de rechazo comprobados. Un `node --check` o un `/health` exitoso no comprueban los demás endpoints.

La entrega final debe incluir comandos de arranque, variables, colección Postman exportada sin secretos, matriz de resultados y diferencias pendientes del prototipo. No borrar datos de la base ni volver a cargar esquema/semillas automáticamente al arrancar.
