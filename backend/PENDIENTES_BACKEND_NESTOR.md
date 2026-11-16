# Pendientes de Backend (APIs Fase 8) — Para Néstor

**Fecha:** 14 de noviembre de 2026  
**Proyecto:** Opportunity Bridge  
**Alcance del documento:** Inventario técnico, justificación académica/funcional y mapa tabla-endpoint de las **49 APIs pendientes (Fase 8)** necesarias para cubrir el 100% del prototipo diseñado en `frontend/` y del inventario maestro de **104 APIs**.

---

## 1. Resumen Ejecutivo y Justificación

### Estado actual comprobado del Backend
- **Fases 0 a 7 completadas (55 / 104 APIs implementadas):** Todos los endpoints requeridos para el recorrido mínimo de calificación/defensa (**D01–D12**) ya están construidos en `src/routes/`, `src/controllers/` y `src/services/`, conectados a PostgreSQL (Supabase) y sirviendo a las pantallas principales del frontend:
  - Diagnóstico (`API-001` a `API-002`): `/health`, `/health/db`.
  - Autenticación (`API-003` a `API-005`): `/api/auth/registro`, `/api/auth/login`, `/api/auth/me`.
  - Consultas públicas (`API-006`, `API-007`, `API-009` a `API-014`): métricas de inicio, categorías de empleo, vacantes públicas, empresas y lectura pública de valoraciones aprobadas.
  - Perfil del candidato y notificaciones (`API-015` a `API-019`, `API-021` a `API-025`, `API-030` a `API-031`): perfil, dashboard, CV local, postulaciones, vacantes guardadas y notificaciones internas.
  - Área de empleador (`API-039` a `API-054`): dashboard de empresa, CRUD de empresa, logo, documento legal, CRUD/cierre de vacantes, listado de postulaciones, ficha/CV del postulante y cambio de estado.
  - Panel administrativo principal (`API-068` a `API-075`, `API-086` a `API-089`, `API-103` a `API-104`): resumen, gestión de usuarios, empresas, vacantes, categorías de empleo, estadísticas y bitácora.

### ¿Por qué hace falta construir estas 49 APIs de Fase 8?
1. **Completitud del prototipo ya maquetado por William:** En `frontend/` ya existen páginas y formularios visibles que hoy están desconectados o muestran datos de maqueta porque sus APIs pertenecen a Fase 8 (`recursos.html`, `#formValoracion` en `perfil-usuario.html` y el flujo de reseñas en `valoraciones.html`, alertas configurables en `perfil-usuario.html` y la pestaña `#reportes` en `panel-administrativo.html`).
2. **Completitud del esquema de 18 tablas en Supabase (`database/schema.sql`):** Las tablas `alertas_empleo`, `historial_laboral`, `valoraciones_empresa`, `recursos`, `noticias`, `categorias_foro`, `temas_foro`, `respuestas_foro` y `reportes_contenido` ya fueron creadas en PostgreSQL; actualmente existen en la base de datos pero no tienen endpoints de escritura/gestión ni moderación.
3. **Coherencia con el Plan Maestro (104 APIs):** La documentación del proyecto establece explícitamente que completar D01–D12 (Fases 0–7) cubre la prioridad de defensa, pero el inventario completo de la guía incluye estas **49 rutas de Fase 8**.

---

## 2. Desglose Detallado de las 49 APIs Pendientes por Módulo

### Módulo A: Centro de Recursos y Descargas (3 públicos + 5 admin = 8 APIs)
**Pantalla afectada en Frontend:** `frontend/recursos.html` y gestión en `frontend/panel-administrativo.html`.  
**Tabla en PostgreSQL (`schema.sql`):** `recursos` (`id`, `titulo`, `resumen`, `tipo` [`articulo`/`tutorial`/`video`], `contenido`, `enlace`, `ruta_archivo`, `publicado`, `fecha_publicacion`).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-055` | `GET /api/recursos` | Público | Lista recursos con `publicado = true` filtrables por `tipo` o búsqueda `q`, reemplazando las 3 tarjetas fijas de `recursos.html`. |
| `API-056` | `GET /api/recursos/:id` | Público | Devuelve el detalle completo (`contenido`, `enlace`, metadata) al presionar **"Leer Artículo"** en `recursos.html`. |
| `API-057` | `GET /api/recursos/:id/descarga` | Autenticado | Sirve el archivo local privado de `uploads/recursos/` (ej. plantillas de CV) al hacer clic en **"Descargar ZIP"** sin exponer rutas internas del servidor. |
| `API-094` | `GET /api/admin/recursos` | `administrador` | Permite al administrador listar todos los recursos (publicados y borradores) para gestionarlos desde el panel. |
| `API-095` | `POST /api/admin/recursos` | `administrador` | Permite crear nuevos artículos, tutoriales o guías desde el panel administrativo con registro en `bitacora`. |
| `API-096` | `PATCH /api/admin/recursos/:id` | `administrador` | Edita título, resumen, contenido o cambia el estado `publicado` (`true`/`false`). |
| `API-097` | `POST /api/admin/recursos/:id/archivo` | `administrador` | Sube o reemplaza el archivo descargable (`ruta_archivo`) mediante `multer` hacia `uploads/recursos/`. |
| `API-098` | `DELETE /api/admin/recursos/:id` | `administrador` | Elimina un recurso obsoleto y limpia/registra en `bitacora`. |

**Justificación:** Actualmente `recursos.html` tiene las 3 tarjetas estáticas de artículos y descarga ZIP sin ningún `<script>` propio conectado a servidor (solo carga `js/api.js` para el header). Con estas 8 APIs, el centro de recursos pasa de maqueta HTML a un módulo administrable real.

---

### Módulo B: Noticias Laborales (2 públicos + 4 admin = 6 APIs)
**Pantalla afectada en Frontend:** `frontend/recursos.html` (sección de noticias/actualidad) y `frontend/panel-administrativo.html`.  
**Tabla en PostgreSQL (`schema.sql`):** `noticias` (`id`, `titulo`, `categoria`, `resumen`, `enlace_fuente`, `fecha_publicacion`).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-058` | `GET /api/noticias` | Público | Lista paginada de noticias y tendencias salariales/laborales ordenadas por `fecha_publicacion DESC`. |
| `API-059` | `GET /api/noticias/:id` | Público | Devuelve el detalle de una noticia y su `enlace_fuente` externo. |
| `API-099` | `GET /api/admin/noticias` | `administrador` | Listado administrativo de noticias publicadas. |
| `API-100` | `POST /api/admin/noticias` | `administrador` | Crea una nueva noticia y registra la acción en `bitacora`. |
| `API-101` | `PATCH /api/admin/noticias/:id` | `administrador` | Actualiza categoría, resumen, título o fuente de una noticia existente. |
| `API-102` | `DELETE /api/admin/noticias/:id` | `administrador` | Elimina una noticia del portal y deja traza en `bitacora`. |

**Justificación:** La tabla `noticias` existe en PostgreSQL pero hoy no hay forma de publicar ni consultar novedades del mercado laboral fuera del texto estático de ejemplo ("Tendencias salariales 2026 en El Salvador").

---

### Módulo C: Foro Comunitario y Categorías de Foro (8 públicos/usuario + 8 admin = 16 APIs)
**Pantalla afectada en Frontend:** `frontend/recursos.html` (o subvista comunitaria) y `frontend/panel-administrativo.html`.  
**Tablas en PostgreSQL (`schema.sql`):** `categorias_foro`, `temas_foro` (`estado`: `publicado`, `oculto`, `cerrado`), `respuestas_foro` (`estado`: `publicado`, `oculto`).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-008` | `GET /api/catalogos/categorias-foro` | Público | Alimenta el filtro y selector de categorías al consultar o abrir un tema en el foro. |
| `API-060` | `GET /api/foro/temas` | Público | Lista temas publicados filtrables por `categoria_id`, `sector`, `modalidad`, `nivel_experiencia` y búsqueda `q`. |
| `API-061` | `GET /api/foro/temas/:id` | Público | Muestra un tema completo con su autor y metadata. |
| `API-062` | `POST /api/foro/temas` | Autenticado | Permite a candidatos/empleadores publicar nuevos temas (validando `titulo >= 10` caracteres según restricción `CHECK` de `schema.sql`). |
| `API-063` | `PATCH /api/foro/temas/:id` | Autor del tema | Permite al autor editar o cerrar su propio tema (validando pertenencia `autor_id = req.user.id`). |
| `API-064` | `GET /api/foro/temas/:id/respuestas` | Público | Lista paginada de respuestas publicadas dentro de un tema. |
| `API-065` | `POST /api/foro/temas/:id/respuestas` | Autenticado | Permite responder a un tema siempre que el tema esté en estado `publicado` (rechaza si está `cerrado` u `oculto`). |
| `API-066` | `PATCH /api/foro/respuestas/:id` | Autor respuesta | Permite al autor editar su respuesta. |
| `API-080` | `GET /api/admin/foro/temas` | `administrador` | Lista todos los temas del foro (incluidos `oculto` y `cerrado`) para moderación. |
| `API-081` | `PATCH /api/admin/foro/temas/:id/estado` | `administrador` | Modera temas cambiando estado (`publicado` / `oculto` / `cerrado`) con registro en `bitacora`. |
| `API-082` | `GET /api/admin/foro/respuestas` | `administrador` | Lista respuestas para supervisión de contenido. |
| `API-083` | `PATCH /api/admin/foro/respuestas/:id/estado` | `administrador` | Oculta o restablece respuestas del foro (`publicado` / `oculto`). |
| `API-090` | `GET /api/admin/categorias-foro` | `administrador` | Lista categorías del foro con conteo de temas. |
| `API-091` | `POST /api/admin/categorias-foro` | `administrador` | Crea nuevas categorías del foro (maneja unicidad `409`). |
| `API-092` | `PATCH /api/admin/categorias-foro/:id` | `administrador` | Renombra una categoría de foro existente. |
| `API-093` | `DELETE /api/admin/categorias-foro/:id` | `administrador` | Elimina categoría si no tiene temas vinculados (`409` si está en uso). |

**Justificación:** La comunidad y el intercambio entre postulantes forma parte del módulo `P-05` del prototipo; sus 3 tablas principales (`categorias_foro`, `temas_foro`, `respuestas_foro`) tienen índices y restricciones ya desplegadas en Supabase esperando esta capa de API.

---

### Módulo D: Historial Laboral Verificable y Escritura/Moderación de Valoraciones (7 candidato + 4 admin = 11 APIs)
**Pantallas afectadas en Frontend:** `frontend/perfil-usuario.html` (`#formValoracion`), `frontend/valoraciones.html` y `frontend/panel-administrativo.html`.  
**Tablas en PostgreSQL (`schema.sql`):** `historial_laboral` (`candidato_id`, `empresa_id`, `cargo`, `fecha_inicio`, `fecha_fin`, `verificado`), `valoraciones_empresa` (`empresa_id`, `candidato_id`, `calificacion` 1–5, `comentario >= 20` chars, `estado` [`pendiente`, `aprobada`, `oculta`, `rechazada`], `unique (empresa_id, candidato_id)`).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-032` | `GET /api/perfil/historial` | `candidato` | Lista las experiencias laborales registradas por el candidato con su estado `verificado` (`true`/`false`). |
| `API-033` | `POST /api/perfil/historial` | `candidato` | Permite declarar en qué empresa aprobada ha trabajado el candidato (`fecha_fin >= fecha_inicio`), quedando pendiente de verificación. |
| `API-034` | `PATCH /api/perfil/historial/:id` | `candidato` | Edita fechas o cargo del historial propio mientras no haya sido verificado/bloqueado. |
| `API-035` | `DELETE /api/perfil/historial/:id` | `candidato` | Elimina un registro de historial propio. |
| `API-036` | `GET /api/perfil/valoraciones` | `candidato` | Muestra al candidato sus propias reseñas enviadas y su estado de moderación (`pendiente`, `aprobada`, `rechazada`, `oculta`). |
| `API-037` | `POST /api/perfil/valoraciones` | `candidato` | Registra la valoración del formulario `#formValoracion` (`calificacion` 1..5, `comentario >= 20`). **Regla crítica:** exige que el candidato tenga un registro en `historial_laboral` con `verificado = true` para esa `empresa_id` y respeta `UNIQUE(empresa_id, candidato_id)`. |
| `API-038` | `PATCH /api/perfil/valoraciones/:id` | `candidato` | Permite al candidato corregir su reseña propia (devolviéndola a revisión si aplica). |
| `API-076` | `GET /api/admin/historial-laboral` | `administrador` | Lista historiales pendientes de verificar para que el admin valide vínculo laboral. |
| `API-077` | `PATCH /api/admin/historial-laboral/:id/verificacion` | `administrador` | Marca `verificado = true/false`, habilitando al candidato a valorar la empresa (con registro en `bitacora`). |
| `API-078` | `GET /api/admin/valoraciones` | `administrador` | Lista reseñas recibidas filtrables por `estado` (`pendiente`, `aprobada`, etc.). |
| `API-079` | `PATCH /api/admin/valoraciones/:id/estado` | `administrador` | Aprueba (`aprobada`), rechaza (`rechazada`) u oculta (`oculta`) una reseña antes de que sea visible en `valoraciones.html`. |

**Justificación:** Hoy en `valoraciones.html` la **lectura pública** (`API-011` a `API-014`) funciona al 100%, pero en `perfil-usuario.html` el formulario `#formValoracion` muestra un aviso temporal en `perfil.js` porque falta el flujo de escritura (`API-037`), verificación de vínculo laboral (`API-032..035`, `API-076..077`) y aprobación administrativa (`API-078..079`). Sin esto, no pueden crearse nuevas reseñas desde la aplicación.

---

### Módulo E: Alertas de Empleo Configurables (4 APIs)
**Pantalla afectada en Frontend:** `frontend/perfil-usuario.html` (`#alertsList` y configuración de alertas).  
**Tabla en PostgreSQL (`schema.sql`):** `alertas_empleo` (`id`, `candidato_id`, `nombre`, `palabra_clave`, `ubicacion`, `modalidad`, `nivel_experiencia`, `categoria_id`, `activa`).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-026` | `GET /api/perfil/alertas` | `candidato` | Lista las alertas personalizadas guardadas por el candidato. |
| `API-027` | `POST /api/perfil/alertas` | `candidato` | Crea una nueva regla de alerta (por palabra clave, ubicación, modalidad, nivel y categoría). |
| `API-028` | `PATCH /api/perfil/alertas/:id` | `candidato` | Activa o desactiva (`activa: true/false`) el switch de una alerta o actualiza sus criterios. |
| `API-029` | `DELETE /api/perfil/alertas/:id` | `candidato` | Elimina una alerta configurada por el candidato. |

**Justificación:** En `perfil-usuario.html`, William maquetó el **"Panel de Alertas"** con un switch (`form-check form-switch`) por cada alerta de búsqueda (ej. *"Desarrollador Web"*, *"Diseñador UI/UX"*). Actualmente `perfil.js` solo muestra `notificaciones` (`API-030`/`031`); estas 4 APIs permiten gestionar los criterios de búsqueda en `alertas_empleo` (y enlazar el conteo `alertas_activas` que ya consulta `GET /api/perfil/dashboard`), más la lógica de coincidencia al publicar vacantes (`Q17`).

---

### Módulo F: Reportes de Contenido Inapropiado (1 usuario + 2 admin = 3 APIs)
**Pantallas afectadas en Frontend:** `index.html`, `valoraciones.html`, `recursos.html` (botón reportar) y `frontend/panel-administrativo.html` (pestaña `#reportes`).  
**Tabla en PostgreSQL (`schema.sql`):** `reportes_contenido` (`reportado_por`, `vacante_id` | `valoracion_id` | `tema_id` | `respuesta_id`, `motivo`, `estado` [`abierto`, `resuelto`, `descartado`]).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-067` | `POST /api/reportes` | Autenticado | Permite a cualquier usuario autenticado reportar exactamente un objetivo (`vacante_id`, `valoracion_id`, `tema_id` o `respuesta_id` según la regla `CHECK` de `schema.sql`) con un `motivo`. |
| `API-084` | `GET /api/admin/reportes` | `administrador` | Lista todos los reportes de contenido filtrables por `estado` (`abierto`, `resuelto`, `descartado`) y tipo de contenido. |
| `API-085` | `PATCH /api/admin/reportes/:id/estado` | `administrador` | Resuelve o descarta un reporte abierto, actualizando el KPI **`reportes_abiertos`** que ya consume `GET /api/admin/resumen` y registrando en `bitacora`. |

**Justificación:** Actualmente `GET /api/admin/resumen` y `GET /api/admin/vacantes?reportada=true` ya leen de `reportes_contenido`, pero **no hay endpoint para crear reportes ni para cerrar/resolver un reporte individual** (`API-067`, `API-084`, `API-085`).

---

### Módulo G: Estadísticas Personales / Visitas al Perfil (1 API)
**Pantalla afectada en Frontend:** `frontend/perfil-usuario.html` (`#statVisits`).  
**Tabla afectada:** `usuarios` / ajuste mínimo documentado (`Q07`).

| ID | Método y Ruta | Rol / Acceso | Qué resuelve y por qué se necesita |
|---|---|---|---|
| `API-020` | `GET /api/perfil/estadisticas` | `candidato` | Devuelve estadísticas personales del candidato, incluyendo el conteo real de **visitas al perfil** (requiere agregar la columna/registro de visitas documentado en Fase 8 y que los empleadores incrementen dicha visita al consultar la ficha del postulante, sin inventar cifras). |

**Justificación:** En `perfil-usuario.html` William diseñó explícitamente el contador `#statVisits` con etiqueta *"Visitas al perfil"*. Como todavía no existe la columna ni la consulta `API-020`, `perfil.js` tuvo que reutilizar ese espacio visual para mostrar `Vacantes guardadas`.

---

## 3. Orden Recomendado de Implementación para Néstor

1. **Prioridad 1 — Reportes (`API-067`, `084`, `085`) y Alertas (`API-026` a `029`):** Son solo 7 endpoints, reutilizan la estructura actual de `perfil` y `admin` y completan botones/contadores que ya existen en `perfil-usuario.html` y `panel-administrativo.html`.
2. **Prioridad 2 — Historial Laboral y Valoraciones (`API-032` a `038`, `API-076` a `079`):** Activa `#formValoracion` y el ciclo completo de reseñas verificadas en `valoraciones.html`.
3. **Prioridad 3 — Recursos y Noticias (`API-055` a `059`, `API-094` a `102`):** Activa por completo `recursos.html` y su publicación desde `panel-administrativo.html`.
4. **Prioridad 4 — Foro Comunitario (`API-008`, `API-060` a `066`, `API-080` a `083`, `API-090` a `093`) y `API-020`:** Completa las 104 APIs del inventario maestro y deja todo el sistema al 100% para pruebas finales (`Fase 9`).
