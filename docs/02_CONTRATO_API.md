# Contrato de API del backend

Este es el contrato a implementar, no un inventario de APIs existentes. Actualmente solo existe `GET /health`. Prefijo para negocio: `/api`. JSON UTF-8; archivos usan multipart. IDs son enteros positivos de PostgreSQL.

Todas las rutas de las tablas de este contrato están incluidas individualmente en el [inventario del plan de trabajo](../PLAN_TRABAJO.md#inventario-completo-de-apis-a-implementar-e-integrar), con fase, referencia SQL y seguimiento. Son 104 endpoints en total: las rutas anteriores y los dos dashboards añadidos para defensa. Aceptar/denegar y cerrar se precisaron sobre rutas ya planificadas; no se duplican como APIs diferentes para cada botón.

## Convenciones para todas las rutas

- Éxito individual: `{ "data": { ... } }`; colección: `{ "data": [], "meta": { "pagina": 1, "limite": 20, "total": 0, "paginas": 0 } }`.
- Error: `{ "error": { "codigo": "VALIDACION", "mensaje": "Datos inválidos", "campos": [{ "campo": "correo", "mensaje": "Formato inválido" }] } }`. `campos` opcional.
- GET 200, POST 201, PATCH 200; DELETE 204 sin cuerpo. Acción sin cambios puede devolver 200 con el registro actual.
- 400 formato/campos inválidos; 401 token ausente/inválido o credenciales incorrectas; 403 rol/estado no permitido; 404 inexistente o registro ajeno; 409 duplicado/estado incompatible/referencia FK; 413 archivo grande; 415 tipo no permitido; 422 precondición de negocio incumplida; 500 inesperado; 503 base no disponible.
- Listados: `pagina=1`, `limite=20`, máximo 100. Orden estable por fecha DESC y `id DESC`, salvo catálogo por nombre. `OFFSET=(pagina-1)*limite`. Un listado vacío responde 200.
- Filtros vacíos se convierten a NULL. Booleanos solo true/false. Fechas ISO; DATE como `YYYY-MM-DD`, timestamp de la base como ISO. Definir sesión PostgreSQL en UTC y formatear para El Salvador en frontend; no alterar fechas históricas al leerlas.
- Numeric de `pg` puede llegar como texto: serializar salarios/promedios de forma consistente como número o null; contadores enteros. No convertir campos arbitrarios ni hashes.
- Aceptar solo campos enumerados. PATCH debe contener por lo menos uno y preservar lo no enviado; NULL solo en opcionales. No usar un objeto del cliente directamente para un UPDATE.
- Textos trim; límites de varchar según schema.sql. Correos normalizados a minúsculas; verificar duplicados también con lower(correo) hasta aplicar índice opcional del documento de consultas.
- Token: `Authorization: Bearer TOKEN`. Validar firma/expiración; consultar usuario/rol/estado actuales en cada petición protegida. El token identifica `sub=id`, pero no sustituye la consulta de estado.
- Permisos: P público, S sesión activa, C candidato, E empleador, A administrador. Para sesión opcional, una petición sin token puede leer contenido público; si incluye token inválido responder 401.
- Reservar rutas fijas (`/metricas`, `/destacadas`, etc.) antes de `/:id`. No montar un CRUD genérico que acepte cualquier tabla.

## Cómo armar cada endpoint

1. Ruta declara método, path, middleware y controlador.
2. Middleware de sesión obtiene usuario y verifica estado; el de rol limita C/E/A.
3. Validador convierte params/query/body y rechaza campos no permitidos.
4. Controlador llama al servicio y devuelve el código/forma acordados.
5. Servicio ejecuta consultas parametrizadas, verifica pertenencia, usa transacción si cambia varios registros y devuelve datos sanitizados.
6. Middleware final traduce errores. `23505` → 409, `23503` → 409, `23514`/`23502` → 400; no devolver SQL ni stack al cliente.

## Autenticación y diagnóstico (P-01)

| Método y ruta | Acceso | Entrada | Salida / regla |
|---|---|---|---|
| GET `/health` | P | Ninguna | Respuesta actual `{status:"ok"}`; no prueba DB |
| GET `/health/db` | P | Ninguna | Consulta `SELECT 1`; `{data:{estado:"ok"}}` o 503 sin detalle de credenciales |
| POST `/api/auth/registro` | P | nombres, apellidos, correo, contrasena, tipo_usuario | 201 usuario sin hash; tipo candidato/empleador; hash bcrypt; estado activo fijado en servidor |
| POST `/api/auth/login` | P | correo, contrasena | 200 `{data:{token,expira_en,usuario:{id,nombres,apellidos,correo,rol}}}` |
| GET `/api/auth/me` | S | Token | Usuario actual y rol; no hash |

Registro: nombres y apellidos no vacíos <=100, correo válido <=150, contraseña 8–72 bytes para bcrypt. Hash con factor 10 para el ejercicio. No permitir `rol_id`, `estado`, IDs ni hashes desde el cliente. Login compara bcrypt; correo inexistente y contraseña errónea comparten mensaje 401. Suspensión 403. Logout inicial elimina token del cliente; no hay endpoint ficticio de revocación. Para cuenta admin usar alta controlada fuera del registro público. Actualizar previamente los hashes de usuarios semilla con un script local de desarrollo; no publicar credenciales reales.

## Consultas públicas (P-01, P-02 y P-05)

| Método y ruta | Acceso | Query / entrada | Datos devueltos |
|---|---|---|---|
| GET `/api/inicio/metricas` | P | Ninguna | empresas_aprobadas, candidatos_activos, vacantes_activas, total_postulaciones |
| GET `/api/catalogos/categorias-empleo` | P | Ninguna | id, nombre |
| GET `/api/catalogos/categorias-foro` | P | Ninguna | id, nombre |
| GET `/api/vacantes` | P | q, ubicacion, modalidad, tipo_contrato, nivel_experiencia, categoria_id, salario_min, salario_max, desde, pagina, limite | Resumen de vacante + empresa; total con iguales filtros |
| GET `/api/vacantes/:id` | P | id | Todos los campos públicos de vacante + empresa pública |
| GET `/api/empresas` | P | q, pagina, limite | Empresas aprobadas + promedio/recuento aprobados |
| GET `/api/empresas/:id` | P | id | Empresa pública, promedio/recuento; vacantes se consultan aparte |
| GET `/api/empresas/:id/vacantes` | P | pagina, limite | Vacantes públicas vigentes de esa empresa |
| GET `/api/empresas/:id/valoraciones` | P | pagina, limite | Calificación, comentario, fecha y nombre del autor; solo aprobadas |

Vacantes: con `limite=3` y orden reciente se obtienen destacadas. Salarios filtran por intersección: máximo de oferta >= mínimo buscado y mínimo de oferta <= máximo buscado; si se filtra por salario, excluir ofertas sin rango conocido. `desde` es fecha ISO inclusiva sobre `fecha_publicacion`; “últimas 24h” se envía como instante ISO UTC. Texto q busca título/descripción/empresa, ubicación con ILIKE. El rango del buscador debe ser válido (min <= max). Filtros de salario/contrato nunca se mezclan en una única cadena.

Empresa pública: id, nombre_legal, descripcion, sitio_web, correo_contacto, telefono_contacto, ruta_logo, estado_verificacion, promedio, total_valoraciones. Excluir usuario_id, nit, ruta_documento_legal. Detalle de vacante excluye postulaciones y datos privados de candidatos.

## Perfil del candidato (P-03)

Todas estas rutas C, excepto notificaciones que son S. Propietario siempre es el ID de sesión.

| Método y ruta con prefijo `/api` | Entrada | Respuesta / comportamiento |
|---|---|---|
| GET `/perfil` | Ninguna | Datos personales, ruta de CV, preferencias |
| GET `/perfil/dashboard` | Ninguna | Resumen propio del candidato; contrato detallado en la sección Dashboards |
| PATCH `/perfil` | nombres, apellidos, telefono, recibe_email, recibe_sms (parciales) | Perfil actualizado; correo no editable inicialmente |
| POST `/perfil/cv` | multipart `archivo` PDF/DOCX <=5 MB | Ruta relativa y nombre; 201; conserva documentos de postulaciones previas |
| GET `/perfil/cv` | Ninguna | Archivo actual protegido o 404 |
| GET `/perfil/estadisticas` | Ninguna | total_solicitudes, visitas_7_dias, visitas_por_dia; requiere ajuste visitas |
| GET `/perfil/postulaciones` | estado, pagina, limite | id, fecha_postulacion, estado, vacante_id, título, estado_vacante, empresa, modalidad, ubicación |
| POST `/perfil/postulaciones` | vacante_id, carta_presentacion opcional | 201 nueva postulación; CV se obtiene de usuarios, no del body |
| GET `/perfil/guardados` | pagina, limite | Resumen guardado, fecha, disponible boolean |
| POST `/perfil/guardados` | vacante_id | 201 relación; duplicado 409 |
| DELETE `/perfil/guardados/:vacanteId` | id de vacante | 204; solo relación propia, ausente 404 |
| GET `/perfil/alertas` | pagina, limite | Alertas propias con criterios |
| POST `/perfil/alertas` | campos de alerta definidos abajo | 201 alerta |
| PATCH `/perfil/alertas/:id` | campos parciales de alerta | 200 alerta propia |
| DELETE `/perfil/alertas/:id` | id | 204 propia |
| GET `/notificaciones` | leida, pagina, limite | id, titulo, mensaje, tipo, leida, fecha_creacion |
| PATCH `/notificaciones/:id/leida` | Ninguna | Marca propia como leída, 200 |
| GET `/perfil/historial` | pagina, limite | Historial y empresa, verificado |
| POST `/perfil/historial` | empresa_id, cargo, fecha_inicio, fecha_fin opcional | 201; verificado=false fijado en servidor |
| PATCH `/perfil/historial/:id` | cargo, fecha_inicio, fecha_fin | 200; editar invalida verificación y oculta valoración asociada hasta revisión |
| DELETE `/perfil/historial/:id` | id | 204; si no queda otro historial verificado de esa empresa, ocultar valoración en transacción |
| GET `/perfil/valoraciones` | pagina, limite | Reseñas propias con empresa y estado |
| POST `/perfil/valoraciones` | empresa_id, calificacion, comentario | 201 pendiente con historial verificado |
| PATCH `/perfil/valoraciones/:id` | calificacion, comentario | 200; siempre vuelve a pendiente |

Campos de alerta: nombre obligatorio <=100; palabra_clave <=100, ubicacion <=150, modalidad, nivel_experiencia, categoria_id opcionales; activa boolean. Después del ajuste SQL: tipo_contrato y salario_min/max opcionales. Exigir al menos un criterio además del nombre. `activa` default true. `Guardar en Alertas` en detalle propone título/palabra, categoría, modalidad y ubicación de la vacante, pero el candidato confirma los criterios.

Postulación: no aceptar estado/ruta_cv/candidato_id; oferta publicada, empresa aprobada y fecha vigente; CV existente; duplicado 409 garantizado por UNIQUE. Retornar registro propio con resumen de vacante, no hash ni perfiles ajenos. Perfil mínimo completo (nombres/apellidos/correo) antes de postular.

## Área de empleador (P-04)

Todas E. Buscar primero empresa con `usuario_id = idSesion`; toda consulta de vacante/postulación añade esa propiedad.

| Método y ruta con prefijo `/api/empleador` | Entrada | Resultado |
|---|---|---|
| GET `/dashboard` | Ninguna | Resumen de empresa propia; 200 con ceros si no tiene empresa |
| GET `/empresa` | Ninguna | Empresa propia completa; 404 si falta |
| POST `/empresa` | nombre_legal, nit, descripcion, sitio_web, correo_contacto, telefono_contacto | 201 pendiente; usuario_id de sesión; duplicada 409 |
| PATCH `/empresa` | Los mismos campos, parciales | 200; cambio de nombre devuelve verificación a pendiente |
| POST `/empresa/logo` | multipart archivo PNG/JPG/SVG <=2 MB | Actualiza ruta_logo propia |
| POST `/empresa/documento` | multipart archivo PDF/PNG/JPG <=5 MB | Actualiza ruta_documento_legal privada |
| GET `/empresa/documento` | Ninguna | Documento propio protegido |
| GET `/vacantes` | estado, pagina, limite | Vacantes propias + número de postulaciones |
| POST `/vacantes` | Formulario de vacante | 201 pendiente; requiere empresa aprobada |
| GET `/vacantes/:id` | id | Detalle propio, incluso no público |
| PATCH `/vacantes/:id` | Formulario parcial | Actualiza propia; publicada pasa a pendiente |
| PATCH `/vacantes/:id/cerrar` | Ninguna | Cierra propia borrador/pendiente/publicada/oculta; cerrada es idempotente; rechazada 409; conserva postulaciones |
| GET `/postulaciones` | vacante_id, estado, pagina, limite | Candidatos de ofertas propias; datos de postulación y nombre |
| GET `/postulaciones/:id/candidato` | id de postulación | Contacto y perfil/historial del postulante autorizado |
| GET `/postulaciones/:id/cv` | id de postulación | Archivo de `postulaciones.ruta_cv`, no el CV actual |
| PATCH `/postulaciones/:id/estado` | estado | Cambio válido, notificación y bitácora; 200 |

Formulario vacante: titulo (5–150), categoria_id (existente), ubicacion, modalidad, tipo_contrato, nivel_experiencia, salario_min/max (opcionales no negativos), descripcion (>=50), responsabilidades (opcional), requisitos (>=10), beneficios (opcional), correo_contacto (válido), fecha_cierre (opcional, no pasada al crear). Obligatorios salvo lo indicado. Servidor fija empresa/estado/fecha_creacion; fecha_publicacion solo al aprobar. Enum literal del esquema. Cambios sobre cerrada/rechazada: devolver 409 en alcance inicial; crear otra vacante si se requiere nueva convocatoria.

Aceptar/Contratar: `PATCH /api/empleador/postulaciones/:id/estado` con `{ "estado": "contratado" }`; Denegar: misma ruta con `{ "estado": "rechazado" }`. Se permite desde nueva o en_proceso. Oferta cerrada permite resolver postulaciones ya recibidas; no admite nuevas. Actualización, notificación al candidato y bitácora ocurren en una sola transacción. Respuesta 200 incluye id, vacante_id, estado y fecha_postulacion; ID ajeno 404, cambio desde estado final distinto 409.

## Dashboards requeridos para defensa

Sin query de usuario/empresa ni rango inicial; usan identidad de sesión y totales históricos. Últimos registros: cinco ordenados por fecha DESC,id DESC. Todas las cifras se calculan dentro de un snapshot de lectura consistente para que los totales coincidan con sus desgloses (Q18/Q19). No requieren cambios de esquema.

`GET /api/perfil/dashboard`, rol C, respuesta 200:

```json
{"data":{"usuario":{"id":2,"nombres":"Ana","apellidos":"Demo","tiene_cv":true},"solicitudes":{"total":3,"nueva":1,"en_proceso":1,"contratado":1,"rechazado":0},"guardados":2,"alertas_activas":1,"notificaciones_no_leidas":2,"ultimas_postulaciones":[{"id":10,"vacante_id":4,"titulo":"Desarrollador","empresa":"Empresa Demo","estado":"contratado","estado_vacante":"cerrada","fecha_postulacion":"2026-11-13T15:00:00.000Z"}]}}
```

`GET /api/empleador/dashboard`, rol E, respuesta 200:

```json
{"data":{"empresa":{"id":1,"nombre_legal":"Empresa Demo","estado_verificacion":"aprobada"},"requiere_crear_empresa":false,"ofertas":{"total":4,"borrador":0,"pendiente":1,"publicada":2,"oculta":0,"rechazada":0,"cerrada":1,"publicadas_vigentes":2},"postulaciones":{"total":3,"nueva":1,"en_proceso":1,"contratado":1,"rechazado":0},"ultimas_postulaciones":[{"id":10,"vacante_id":4,"titulo":"Desarrollador","candidato_id":2,"nombres":"Ana","apellidos":"Demo","estado":"contratado","fecha_postulacion":"2026-11-13T15:00:00.000Z"}]}}
```

Los números ilustran la forma; las listas se han abreviado. `ofertas.total` suma los seis estados; `publicadas_vigentes` es un subconjunto de publicada, no se suma otra vez. `postulaciones.total` cuenta solicitudes, no personas únicas entre varias ofertas. Campos de candidatos únicamente para solicitudes de su empresa. Si no tiene empresa, empresa=null, requiere_crear_empresa=true, mismos campos numéricos en cero y lista vacía. Candidato nuevo conserva usuario y obtiene contadores cero/listas vacías. Usuario suspendido 403, token ausente 401 y otro rol 403. No devolver rutas privadas ni hash.

El dashboard admin existente usa `GET /api/admin/resumen` y sus rutas de gestión; no reutilizarlo para un empleador/candidato. Los estados corresponden literalmente a PostgreSQL. No crear `aceptado`, `denegado`, `inactivo` o `cancelado` como estados adicionales en el frontend o en la base.

## Comunidad y contenido (P-05)

| Método y ruta con prefijo `/api` | Acceso | Entrada | Resultado |
|---|---|---|---|
| GET `/recursos` | P | tipo, q, pagina, limite | Publicados, sin ruta_archivo privada |
| GET `/recursos/:id` | P | id | Contenido/enlace público y tiene_descarga boolean |
| GET `/recursos/:id/descarga` | S | id | Archivo local publicado, 404 si no existe |
| GET `/noticias` | P | categoria, pagina, limite | Publicadas hasta ahora |
| GET `/noticias/:id` | P | id | Noticia visible |
| GET `/foro/temas` | P | q, categoria_id, sector, modalidad, nivel_experiencia, ubicacion, pagina, limite | Temas publicados/cerrados, autor, total_respuestas y ultima_actividad |
| GET `/foro/temas/:id` | P | id | Tema público con datos del autor y total_respuestas |
| POST `/foro/temas` | S | titulo, contenido, categoria_id, sector, modalidad, nivel_experiencia, ubicacion | 201 publicado; autor de sesión |
| PATCH `/foro/temas/:id` | S autor | Los mismos campos, parciales | 200 propio publicado; cerrado/oculto 409 |
| GET `/foro/temas/:id/respuestas` | P | pagina, limite | Respuestas publicadas de tema visible |
| POST `/foro/temas/:id/respuestas` | S | contenido | 201; tema publicado, no cerrado |
| PATCH `/foro/respuestas/:id` | S autor | contenido | 200 propia publicada y tema abierto |
| POST `/reportes` | S | tipo, contenido_id, motivo | 201 reporte abierto; duplicado abierto 409 |

Contenido no vacío; respuestas >=2 caracteres; títulos foro >=10 y <=200. Tipos de reporte: vacante, valoracion, tema, respuesta. Servicio traduce tipo a UNA columna FK elegida en lista fija, nunca concatena un nombre de tabla recibido. Motivo >=5. Comprobar visibilidad del objetivo antes de reportar. El mismo usuario no cuenta más de una vez en reportes abiertos del mismo objetivo. Usar bloqueo de la fila objetivo para evitar duplicados concurrentes.

## Administración (P-06)

Todas A. Query comunes: pagina, limite, q; filtrar además por campos indicados. `motivo` obligatorio >=5 en rechazo, suspensión y ocultación. Registrar acción en bitácora con actor de sesión.

| Método y ruta con prefijo `/api/admin` | Entrada | Resultado |
|---|---|---|
| GET `/resumen` | Ninguna | Contadores descritos en alcance P-06 |
| GET `/usuarios` | rol, estado, q | Lista sin hash |
| PATCH `/usuarios/:id/estado` | estado, motivo | activo/suspendido; nunca suspenderse ni último admin activo |
| GET `/empresas` | estado_verificacion, q | Empresas completas paginadas |
| GET `/empresas/:id/documento` | id | Documento privado para revisión |
| PATCH `/empresas/:id/estado` | estado_verificacion, motivo | Aprobar requiere NIT y archivo legal existentes; notificar propietario |
| GET `/vacantes` | estado, empresa_id, reportada, q | Vacantes, empresa y reportes abiertos distintos |
| PATCH `/vacantes/:id/estado` | estado, motivo | Publicar exige empresa aprobada, campos válidos y fecha vigente; fija fecha_publicacion si faltaba |
| GET `/historial-laboral` | verificado, candidato_id | Historial con candidato y empresa |
| PATCH `/historial-laboral/:id/verificacion` | verificado boolean | Verificar o revocar; revocar oculta reseña si no queda historial verificado |
| GET `/valoraciones` | estado, empresa_id | Reseñas y autor |
| PATCH `/valoraciones/:id/estado` | estado, motivo | pendiente/aprobada/oculta/rechazada; aprobar exige historial aún verificado |
| GET `/foro/temas` | estado, q | Todos los estados |
| PATCH `/foro/temas/:id/estado` | estado, motivo | publicado/oculto/cerrado |
| GET `/foro/respuestas` | estado, tema_id | Respuestas para moderar |
| PATCH `/foro/respuestas/:id/estado` | estado, motivo | publicado/oculto |
| GET `/reportes` | estado, tipo | Reportes + objetivo/responsable |
| PATCH `/reportes/:id/estado` | estado, motivo | resuelto/descartado; no modifica automáticamente el objetivo |
| GET `/categorias-empleo` | Ninguna | id,nombre |
| POST `/categorias-empleo` | nombre | 201; único sin distinguir mayúsculas |
| PATCH `/categorias-empleo/:id` | nombre | 200 |
| DELETE `/categorias-empleo/:id` | id | 204 o 409 si usada |
| GET `/categorias-foro` | Ninguna | id,nombre |
| POST `/categorias-foro` | nombre | 201 |
| PATCH `/categorias-foro/:id` | nombre | 200 |
| DELETE `/categorias-foro/:id` | id | 204 o 409 si usada |
| GET `/recursos` | tipo, publicado, q | Incluye borradores |
| POST `/recursos` | titulo, resumen, tipo, contenido, enlace, publicado | 201 |
| PATCH `/recursos/:id` | mismos campos parciales | 200 |
| POST `/recursos/:id/archivo` | multipart archivo PDF/DOCX <=10 MB | Guarda ruta relativa |
| DELETE `/recursos/:id` | id | 204; primero comprobar reportes/referencias y archivo |
| GET `/noticias` | categoria, q | Incluye futuras |
| POST `/noticias` | titulo, categoria, resumen, enlace_fuente, fecha_publicacion | 201 |
| PATCH `/noticias/:id` | mismos campos parciales | 200 |
| DELETE `/noticias/:id` | id | 204 |
| GET `/estadisticas` | desde, hasta (ISO) | Conteos por estado, postulaciones por mes/categoría con rango aplicado |
| GET `/bitacora` | usuario_id, entidad, desde, hasta | Acciones ordenadas fecha DESC, id DESC |

No hay endpoint público para asignar administrador ni borrar la base. Recursos: título <=200, tipo articulo/tutorial/video, exigir contenido/enlace/archivo antes de publicar; noticias título <=200 y resumen obligatorio. Recurso sin contenido se crea primero con publicado=false, se sube archivo y después se publica.

## Transiciones y validaciones compartidas

| Entidad | Transiciones permitidas | Condición |
|---|---|---|
| Usuario | activo ↔ suspendido | Solo admin; proteger administración activa |
| Empresa | pendiente → aprobada/rechazada; aprobada → suspendida; suspendida/rechazada → pendiente; suspendida → aprobada | Solo admin; aprobación exige documentación; cambio de nombre la devuelve a pendiente |
| Vacante | pendiente → publicada/rechazada/cerrada; publicada → oculta/cerrada/pendiente; oculta → publicada/cerrada; borrador → pendiente/cerrada | Publicar solo admin; cierre propio permitido al empleador; edición publicada vuelve a revisión |
| Postulación | nueva → en_proceso/contratado/rechazado; en_proceso → contratado/rechazado | Solo empleador dueño; estados finales sin reapertura |
| Valoración | pendiente → aprobada/rechazada/oculta; aprobada → oculta/pendiente; oculta/rechazada → pendiente/aprobada | Admin modera; edición del autor a pendiente; aprobación exige historial verificado |
| Tema | publicado ↔ cerrado; publicado/cerrado → oculto; oculto → publicado/cerrado | Solo admin cambia estado |
| Respuesta | publicado ↔ oculto | Solo admin |
| Reporte | abierto → resuelto/descartado | Solo admin; final sin reapertura |

El mismo estado solicitado devuelve 200 sin duplicar notificación/bitácora. Una transición fuera de esta tabla devuelve 409. Campos de empresa: nombre_legal no vacío <=150; nit requerido para aprobar; correo_contacto válido <=150; sitio_web opcional https://; teléfono opcional de 8 dígitos con guion permitido. Para categorías de empleo/foro nombre no vacío <=100, comparar trim y lower. Formatos de teléfono del perfil siguen la misma regla. Validar existencia de FK antes de escribir para dar mensajes claros.

Para categorías ya referenciadas responder 409 al borrar. Para una vacante sin salario permitir ambos NULL, mínimo solo o máximo solo, siempre no negativos; si ambos existen exigir mínimo <= máximo. En alertas usar los mismos enums que en vacantes. El foro permite adicionalmente `cualquiera` en modalidad/experiencia, al no tener CHECK restrictivo en esas columnas.

## Archivos locales: reglas compartidas

Guardar en `backend/uploads/{cv,logos,documentos,recursos}` con nombre generado (UUID) y extensión validada. Nunca aceptar rutas absolutas ni `../` en un body. Solo el middleware asigna rutas. PDF/DOCX según MIME/extensión coherentes; el nombre original no se usa como nombre de archivo. Verificar existencia al descargar y capturar error de lectura.

No publicar todo uploads con `express.static`. Publicar únicamente logos; CV, documentos y recursos pasan por sus rutas protegidas. Para SVG de logo entregar como archivo descargable o sanitizar antes de permitir contenido inline. SQL guarda rutas relativas, nunca buffers ni URLs de Supabase Storage.

El sistema de archivos y PostgreSQL no comparten transacción: si falla la actualización de la ruta, eliminar el nuevo archivo; borrar el antiguo únicamente tras COMMIT y si no lo referencia otra postulación. Un fallo de limpieza no debe anular un cambio ya confirmado: registrarlo para limpieza posterior.

## Ejemplos para integrar

```http
GET /api/vacantes?q=Java&modalidad=hibrido&pagina=1&limite=20
```

```json
{"data":[{"id":1,"titulo":"Desarrollador Java","empresa":{"id":1,"nombre_legal":"Empresa Demo"},"ubicacion":"San Salvador","modalidad":"hibrido","salario_min":1200,"salario_max":1800,"fecha_publicacion":"2026-11-13T15:00:00.000Z"}],"meta":{"pagina":1,"limite":20,"total":1,"paginas":1}}
```

```http
POST /api/perfil/postulaciones
Authorization: Bearer TOKEN
Content-Type: application/json

{"vacante_id":1,"carta_presentacion":"Me interesa la oportunidad."}
```

Ejemplos ilustrativos del contrato; los IDs y textos no constituyen datos reales. El frontend debe manejar 401, 403, 404, 409 y 422 con el mensaje del servidor y refrescar la lista tras una mutación exitosa.

## Referencias técnicas

- Rutas/middleware: https://expressjs.com/en/5x/guide/routing/
- Manejo de errores asíncronos: https://expressjs.com/en/5x/guide/error-handling/
- Consultas con valores separados del SQL: https://node-postgres.com/features/queries
- Transacciones con el mismo cliente: https://node-postgres.com/features/transactions

Fuentes consultadas el 13 de noviembre de 2026. Los contratos del portal y las decisiones de alcance son específicos de este proyecto.
