# Alcance de pantallas y responsabilidades del backend

Referencia funcional: guía del Portal de Trabajo y prototipo OpportunityBridge compartidos en esta conversación. Los códigos P-00 a P-06 conservan los del prototipo. Esta especificación completa las interacciones necesarias para trabajar con la base relacional sencilla acordada.

## P-00 - Portada, mapa y recorridos

Contenido: identificación del proyecto, autores, mapa y rutas por rol. Es contenido del frontend/documentación, sin tabla ni API propia.

Recorridos: candidato Inicio → Resultados → Detalle → Postulación/Perfil; empleador Inicio → Empresa → Vacantes → Candidatos; administrador Inicio → Panel → Gestión y moderación. El backend determina el rol mediante `/api/auth/me`; los menús usan ese dato, y cada endpoint valida también el permiso.

## P-01 - Inicio, acceso y búsqueda

Debe mostrar logo/nombre, login/registro, navegación a búsqueda, publicar empleos, recursos, valoraciones y perfil; buscador destacado; filtros de ubicación, modalidad, salario y experiencia; cuatro indicadores y tres vacantes recientes de empresas aprobadas.

Login pide correo y contraseña; registro pide nombres, apellidos, correo, contraseña y tipo candidato/empleador. Un empleador registra sus datos corporativos luego del login. El rol administrador nunca se acepta desde registro público.

APIs: auth, `/inicio/metricas`, `/vacantes`, `/catalogos/categorias-empleo`. Una búsqueda vacía devuelve todas las vacantes públicas vigentes. Buscar navega a P-02 conservando parámetros. Filtros AND; estado vacío devuelve lista vacía y total cero. Las métricas no contienen constantes del prototipo.

Aceptación: login inválido 401; suspendido 403; registro duplicado 409; solo candidatos y empleadores registrables; filtros se conservan al paginar; tres destacadas ordenadas por fecha real.

## P-02A - Resultados

Debe mostrar total, tarjetas con título, empresa, ubicación, modalidad, salario y fecha; filtros por texto, ubicación, experiencia, sector/categoría, contrato, modalidad, salario y fecha; limpiar filtros y paginación.

API: `GET /api/vacantes`. Solo incluye publicadas, de empresas aprobadas y sin cierre vencido. El total usa exactamente los mismos filtros que la lista. Una oferta sin salario muestra “No especificado”; no se convierte NULL a cero.

## P-02B - Detalle y postulación

Debe mostrar empresa/verificación, título, descripción, responsabilidades, requisitos, beneficios, modalidad, contrato, ubicación, salario, contacto, fecha; promedio y reseñas aprobadas de empresa; acciones postular, guardar, crear alerta y reportar.

APIs: `/vacantes/:id`, `/empresas/:id/valoraciones`, `/perfil/postulaciones`, `/perfil/guardados`, `/perfil/alertas`, `/reportes`. La creación de alerta guarda criterios, mientras que guardar conserva una vacante; son acciones distintas. Reseña se registra para la empresa, no para una vacante.

Postular exige candidato activo, CV real cargado y oferta disponible. Si falta CV: 422; si ya se postuló: 409. El detalle público no expone CV ni postulantes. La respuesta autenticada puede añadir `ya_postulado` y `guardada`, o el frontend cruza sus listados personales.

Aceptación: dos envíos simultáneos no duplican postulación; se captura la ruta de CV usada; contacto proviene de la vacante y empresa; oferta oculta no aparece públicamente.

## P-03 - Área del candidato

Secciones y datos:

| Sección | Contenido/acciones | Tablas |
|---|---|---|
| Dashboard | Resumen de solicitudes por estado, guardados, alertas activas, notificaciones no leídas y cinco solicitudes recientes | usuarios, postulaciones, vacantes_guardadas, alertas_empleo, notificaciones |
| Mi perfil | Nombres, apellidos, correo, teléfono; guardar datos; cargar/ver/reemplazar CV | usuarios |
| Solicitudes | Título/empresa, fecha, estado; abrir oferta | postulaciones, vacantes, empresas |
| Guardados | Listar y quitar; indicar oferta cerrada/oculta sin permitir postular | vacantes_guardadas, vacantes |
| Alertas | Nombre y criterios; crear, editar, activar/desactivar, eliminar; preferencias email/SMS | alertas_empleo, usuarios |
| Notificaciones | Listar, distinguir no leídas y marcar leída | notificaciones |
| Historial laboral | Empresa, cargo, inicio/fin y verificación; solicitar verificación al guardar | historial_laboral |
| Valoraciones | Empresa del historial verificado, 1–5 estrellas, comentario y estado | valoraciones_empresa |
| Estadísticas | Total de postulaciones y visitas registradas, últimos siete días | postulaciones, visitas_perfil (ajuste previsto) |

APIs: grupo `/api/perfil/*`. El usuario se toma del token. Correo se muestra de solo lectura en el alcance inicial; cambio de correo y recuperación de contraseña no están definidos en la guía y quedan fuera de este primer backend.

Entrada del candidato tras login: dashboard mediante `GET /api/perfil/dashboard`. Debe responder también con todos los contadores en cero y listas vacías si acaba de registrarse. Visitas al perfil siguen en estadísticas adicionales; no bloquean este dashboard. Una aceptación/denegación se refleja al volver a consultar el resumen y solicitudes.

CV: PDF/DOCX, máximo 5 MB; carga multipart campo `archivo`. Los archivos de las semillas son referencias, no documentos disponibles. Al sustituir CV usar nombre nuevo; conservar archivos referidos por postulaciones previas.

Valoración: una por candidato/empresa, mínimo 20 caracteres tras trim, historial de esa misma empresa verificado. Editar una valoración la devuelve a pendiente; no puede aprobarla el autor. Una solicitud puede consultar el estado de una oferta que dejó de ser pública mediante su resumen personal, sin reabrir el detalle público.

Aceptación: cada candidato solo ve/modifica sus datos; estadísticas son consultas reales; documento inválido se rechaza; las solicitudes reflejan los cambios del empleador.

## P-04 - Área del empleador

| Sección | Contenido y operaciones | APIs |
|---|---|---|
| Dashboard | Estado de empresa; ofertas por estado, publicadas vigentes, postulaciones por estado y cinco postulaciones recientes | `/empleador/dashboard` |
| Datos de empresa | Nombre legal, NIT, descripción, web, correo, teléfono, logo, documento legal, estado | `/empleador/empresa` y archivos |
| Vacantes propias | Lista con estado, categoría y número de postulaciones; crear, editar, enviar a revisión y cerrar | `/empleador/vacantes` |
| Publicación | Título, ubicación, modalidad, contrato, experiencia, categoría, salarios, descripción, responsabilidades, requisitos, beneficios, contacto, cierre | POST/PATCH vacantes propias |
| Candidatos por oferta | Nombre, vacante, fecha y estado; ver perfil/CV y cambiar estado | `/empleador/postulaciones` |

Una empresa por empleador. Solo aprobada puede enviar oferta. Crear oferta queda pendiente; solo administrador publica. Editar publicada vuelve a pendiente para revisión. Cambiar nombre legal de empresa vuelve a pendiente; mientras tanto sus ofertas dejan de aparecer públicamente por el filtro de verificación.

Estados de solicitud: nueva → en_proceso/contratado/rechazado; en_proceso → contratado/rechazado. Contratado/rechazado son finales. “Aceptar/Contratar” envía contratado y “Denegar” envía rechazado; en_proceso es opcional. Nunca convertir contratado a rechazado.

Entrada del empleador tras login: `GET /api/empleador/dashboard`. Sin empresa responde 200 con empresa=null, requiere_crear_empresa=true y contadores en cero; así el frontend muestra Crear empresa. Pendiente o suspendida: muestra su estado y bloquea publicar. Una empresa existente muestra requiere_crear_empresa=false.

“Cancelar/Inactivar oferta” llama a `PATCH /api/empleador/vacantes/:id/cerrar`. Puede cerrar borrador, pendiente, publicada u oculta propia; rechazada devuelve 409, cerrada devuelve 200 sin repetir efectos. Cierre conserva todas las postulaciones y sus estados, quita la oferta de la búsqueda e impide nuevas solicitudes. El empleador puede seguir resolviendo las existentes; cierre de oferta no significa denegar candidatos automáticamente.

El perfil visible al empleador contiene nombre, correo, teléfono e historial del candidato que efectivamente postuló. No permite navegar arbitrariamente por usuarios. CV se entrega por endpoint protegido; logo puede ser público, NIT/documento legal nunca forman parte del directorio público.

Aceptación: un empleador no obtiene ofertas, solicitudes ni archivos privados de otra empresa alterando un ID; cambiar estado crea notificación y bitácora en la misma transacción.

## P-05 - Recursos, empresas y comunidad

Recursos: lista por artículo/tutorial/video, título/resumen, detalle con contenido o enlace. Descargar archivo local requiere sesión. Noticias: título, categoría, resumen, fuente y fecha. Directorio empresarial: nombre, descripción, web, contacto público, logo, promedio/recuento de valoraciones aprobadas; ficha de empresa con sus vacantes vigentes.

Foros: lista por categoría, sector, modalidad, experiencia, ubicación y texto; título, autor público (nombre), respuestas visibles y última actividad. Detalle del tema con respuestas, crear tema, responder, editar contenido propio y reportar. Título mínimo 10 caracteres; categoría y criterios obligatorios. En sector/ubicación usar “General” cuando no aplique, y en modalidad/experiencia aceptar `cualquiera`.

APIs: `/recursos`, `/noticias`, `/empresas`, `/foro/temas`, `/foro/respuestas`, `/reportes` y catálogo de categorías de foro. Tema cerrado permanece consultable y bloquea nuevas respuestas; oculto no es público.

Aceptación: solo recursos publicados y reseñas aprobadas; respuesta oculta no cuenta ni actualiza actividad pública; autor puede editar propio contenido publicado, administrador modera; no se muestran correos de autores del foro.

## P-06 - Administración

Todas las rutas bajo `/api/admin` requieren administrador activo.

| Bloque | Contenido y operaciones |
|---|---|
| Resumen | Usuarios activos, empresas pendientes, vacantes con reportes abiertos, temas/respuestas publicados, reportes abiertos |
| Usuarios | Lista/búsqueda/rol/estado; activar/suspender. No permitir suspenderse ni suspender al último administrador activo |
| Empresas | Pendientes y demás estados; consultar documentos; aprobar/rechazar/suspender; justificar acción |
| Vacantes | Lista filtrable y reportadas; aprobar, ocultar, rechazar o cerrar; motivo |
| Moderación | Valoraciones pendientes, historial por verificar, temas/respuestas y reportes; aprobar/ocultar/verificar/resolver |
| Categorías | Crear/editar/eliminar categorías de empleo/foro; duplicados sin distinción de mayúsculas; 409 si tiene referencias |
| Contenido | Crear/editar/publicar recursos, archivos y noticias |
| Estadísticas | Vacantes, postulaciones por mes, distribución por estado y categorías; bitácora paginada |

Reportar una vacante: cada usuario cuenta una vez entre reportes abiertos; al tercer usuario distinto, ocultarla y registrar el cambio. El administrador puede revisarla y resolver reportes; el frontend nunca decide ocultación automática.

Eliminar registros con referencias puede romper información relacionada. Para usuarios, empresas, vacantes y contenido con historial, el alcance operativo usa suspensión/cierre/ocultación. El borrado permanente mencionado en el prototipo queda restringido a categorías o registros sin referencias tras confirmación; un conflicto FK se devuelve como 409. No hacer cascadas improvisadas.

El prototipo también muestra respaldos automáticos y disponibilidad/latencia/tráfico. El esquema actual no almacena esas mediciones ni dispara respaldos: son extensión de infraestructura. Exponer “No disponible” hasta implementarlas; no reutilizar valores de muestra. La parte verificable de P-06 son las métricas de negocio descritas arriba.

## Acuerdo de integración con frontend

Por pantalla entregar endpoints, ejemplo de respuesta, permisos, estados de carga/vacío/error y casos de rechazo. Ocultar un botón por rol mejora la interfaz; la autorización real siempre se valida en backend. Paginación, filtros, nombres de campos y estados deben ser exactamente los del contrato siguiente.

Para los 12 puntos de defensa y el refresco entre pantallas, aplicar también [la matriz de integración](04_DEFENSA_E_INTEGRACION.md). El dashboard de empresas es el del empleador sobre su empresa; el dashboard de usuarios es el del candidato sobre sus propias solicitudes, no los listados globales del administrador.
