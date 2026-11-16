# Pendientes Visuales del Frontend (Para APIs ya Conectadas) — Para William

**Fecha:** 14 de noviembre de 2026  
**Proyecto:** Opportunity Bridge  
**Alcance del documento:** Detalle pantalla por pantalla de los elementos visuales (tarjetas, modales, pestañas, botones, inputs y columnas) que le hacen falta al diseño HTML/CSS actual (`frontend/*.html`) para aprovechar al 100% las **55 APIs que ya están programadas, probadas y activas en el Backend**, junto con su justificación técnica y de calificación (**Matriz de Defensa D01–D12**).

---

## 1. Contexto General: ¿Por qué hacen falta estos ajustes visuales?

El Backend ya tiene **100% implementados y conectados los 55 endpoints de los requisitos de calificación `D01–D12` (Fases 0 a 7)**. Sin embargo, al conectar el JavaScript (`frontend/js/*.js`) sobre las pantallas originales (`index.html`, `publicar-empleos.html`, `perfil-usuario.html`, `panel-administrativo.html`, `valoraciones.html`), se detectó que:
1. **Hay APIs completas cuyo contenedor HTML no existe en la maqueta** (por ejemplo, el Dashboard de Empresa `D10` en `publicar-empleos.html` o las Estadísticas detalladas `API-103` en `panel-administrativo.html`), por lo que el usuario/jurado no puede ver esos datos reales aunque el servidor ya los envía.
2. **Algunos formularios tienen menos campos o distintos valores a los que exige la base de datos** (`schema.sql`), obligando actualmente a los archivos `js/*.js` a inyectar inputs, tablas o modales por DOM de forma básica (sin maquetado propio de CSS/diseño).
3. **Algunas tarjetas estáticas muestran placeholders** que no coinciden con las capacidades reales de las APIs ya listas (como edición de categorías, filtros combinados, desglose de estados o motivos de moderación).

---

## 2. Desglose Detallado por Archivo HTML

### Archivo 1: `frontend/publicar-empleos.html` (Panel Empresarial — Requisitos `D03`, `D04`, `D07`, `D08`, `D09`, `D10`)

#### 1.1. Falta el Dashboard Visual de Empresa (`D10` — `GET /api/empleador/dashboard` `API-039`)
- **Qué falta visualmente:** Una fila de tarjetas de KPIs (por ejemplo, encima de `#employerTabs` o en una pestaña inicial `"Resumen / Dashboard"`) que muestre:
  - Total de ofertas y desglose por estado (`publicadas_vigentes`, `pendiente`, `cerrada`, `borrador`, `oculta`, `rechazada`).
  - Total de postulaciones recibidas y desglose (`nueva`, `en_proceso`, `contratado`, `rechazado`).
  - Un bloque breve de `ultimas_postulaciones` recientes (últimas 5).
- **Por qué hace falta y justificación:** Hoy `empleador.js` llama a `GET /api/empleador/dashboard`, pero como `publicar-empleos.html` no tiene ningún contenedor para estas métricas, solo lo usa para mostrar una alerta si la empresa está pendiente. El requisito **D10 de la defensa universitaria** evalúa específicamente demostrar un Dashboard de Empresa con cifras reales en pantalla.

#### 1.2. Campos y vistas previas incompletas en la pestaña "Datos de la Empresa" (`D03` — `API-040` a `API-045`)
- **Qué falta visualmente dentro de `#formDatosEmpresa`:**
  1. **Vista previa real de imagen del logo (`<img>`)** dentro del recuadro `#companyLogo`: actualmente solo muestra un icono SVG estático y el texto *"Subir LOGO"*, aunque `POST /api/empleador/empresa/logo` (`API-043`) ya sube el archivo y lo sirve públicamente en `/uploads/logos/...`.
  2. **Campo `Teléfono de contacto` (`telefono_contacto`):** El backend (`POST`/`PATCH /api/empleador/empresa`) lo recibe y la tabla `empresas` tiene la columna `telefono_contacto`, pero no existe input en el HTML.
  3. **Campos `Correo de contacto` (`correo_contacto`, obligatorio) y `NIT / Registro Comercial` (`nit`), más el bloque de Documento Legal de respaldo (`POST`/`GET /api/empleador/empresa/documento`, `API-044` y `API-045`):** En el HTML original no existían; `empleador.js` tuvo que inyectarlos dinámicamente por JS (`#companyEmail`, `#companyNit`, `#companyDoc`, `#opbBtnDownloadCompanyDoc`). Falta darles maquetación oficial y mostrar de forma clara el badge del **`estado_verificacion`** (`pendiente`, `aprobada`, `rechazada`, `suspendida`).
- **Por qué hace falta y justificación:** El flujo `D03` + `D12` exige que la empresa suba su respaldo legal para ser aprobada por el administrador y pueda lucir su logo en el portal. Integrarlo nativamente en el HTML garantiza consistencia visual.

#### 1.3. Campos faltantes y pestaña propia de Vacantes en "Publicar Oferta" (`D04` y `D09` — `API-046` a `API-050`)
- **Qué falta visualmente en `#formPublicarOferta`:**
  1. **`Categoría de empleo` (`categoria_id`, obligatorio):** Selector alimentado por `GET /api/catalogos/categorias-empleo` (`API-007`). Hoy lo inyecta `empleador.js` por DOM.
  2. **`Modalidad` (`modalidad`: `presencial`, `hibrido`, `remoto`, obligatorio):** También inyectado hoy por DOM.
  3. **`Nivel de experiencia` (`nivel_experiencia`: `sin_experiencia`, `junior`, `intermedio`, `senior`, obligatorio):** **No existe en el HTML**, por lo que `empleador.js` se ve obligado a enviar siempre `'intermedio'` quemado.
  4. **Campos de `Salario mínimo` (`salario_min`) y `Salario máximo` (`salario_max`) separados** (numéricos): El HTML actual tiene un solo campo de texto `#jobSalary` (`"$1,500 - $2,000"`), lo que obliga al JS a intentar extraer números con expresiones regulares.
  5. **Campos detallados soportados por el backend:** `Responsabilidades` (`responsabilidades`), `Beneficios` (`beneficios`), `Correo de contacto de la vacante` (`correo_contacto`, obligatorio en `schema.sql`), `Fecha de cierre` (`fecha_cierre`, input `date`), y corregir los `value` de `#jobType` a los valores exactos de BD (`tiempo_completo`, `medio_tiempo`, `proyecto`, `pasantia`, agregando **Pasantía**).
  6. **Pestaña dedicada para "Mis Vacantes Publicadas"** con filtros por `estado` y paginación: Hoy `empleador.js` inyecta `#opbEmployerJobsListBox` al final debajo del formulario, mezclando creación/edición con administración de ofertas (botones Editar `API-049` y Cerrar `API-050`).
- **Por qué hace falta y justificación:** Los requisitos **D04** (publicar/editar oferta con todos sus criterios de búsqueda) y **D09** (cerrar oferta conservando solicitudes) quedan mucho más claros para el evaluador si la lista de ofertas tiene su propia pestaña y si el empleador puede elegir el nivel de experiencia, beneficios y fecha límite sin restricciones.

#### 1.4. Filtros y ficha enriquecida en "Gestión de Candidatos" (`D07` y `D08` — `API-051` a `API-054`)
- **Qué falta visualmente en `#candidatos`:**
  1. **Filtros sobre la tabla `#candidatesTableBody`:** Un `<select>` para filtrar por vacante (`?vacante_id=`) y otro por estado de postulación (`?estado=`: `nueva`, `en_proceso`, `contratado`, `rechazado`), más controles de paginación. Hoy muestra todas mezcladas sin filtro.
  2. **Acciones separadas y claras en cada fila:** Distinguir **"Ver Perfil y Carta"** (`GET /api/empleador/postulaciones/:id/candidato` `API-052`) de **"Descargar CV"** (`GET /api/empleador/postulaciones/:id/cv` `API-053`).
  3. **Opción de aceptación directa desde `nueva`:** El backend (`API-054`) permite aceptar/contratar (`contratado`) directamente desde `nueva` sin pasar obligatoriamente por `en_proceso`; hoy el botón en `empleador.js` solo muestra `Avanzar` cuando está en `nueva`, y `Contratar` cuando ya está en `en_proceso`.
  4. **Modal maquetado en HTML para el Perfil del Postulante (`#opbCandidateDetailModal`):** Hoy lo crea JS dinámicamente; diseñarlo en HTML mejora la presentación de `carta_presentacion`, teléfono, estado y descarga de CV.
- **Por qué hace falta y justificación:** **D07** y **D08** evalúan revisar el perfil/CV del candidato y tomar decisión de contratación o rechazo ágilmente por oferta.

---

### Archivo 2: `frontend/perfil-usuario.html` (Panel del Candidato — Requisitos `D06`, `D11`)

#### 2.1. Desglose del Dashboard de Candidato (`D11` — `GET /api/perfil/dashboard` `API-016`)
- **Qué falta visualmente en la tarjeta "Estadísticas de perfil":**
  - El backend ya entrega el objeto completo con:
    - `solicitudes`: `{ total, nueva, en_proceso, contratado, rechazado }`
    - `guardados`: total de vacantes guardadas
    - `notificaciones_no_leidas`: total de notificaciones sin leer
    - `usuario.tiene_cv`: indicador booleano de si ya subió su currículum
    - `ultimas_postulaciones`: últimas 5 solicitudes
  - Sin embargo, el HTML actual **solo tiene dos números** (`#statVisits` y `#statApplications`). Por falta de un bloque para `guardados`, `notificaciones_no_leidas` y el **desglose de estados**, hoy `perfil.js` tiene que sustituir la etiqueta de *"Visitas al perfil"* para mostrar *"Vacantes guardadas"* y no muestra en el resumen cuántas postulaciones están contratadas, en proceso o rechazadas (además de existir un desfase de nombres de propiedad entre `perfil.js` y la respuesta real `d.solicitudes.total` / `d.guardados` que se debe alinear al rediseñar la tarjeta).
- **Por qué hace falta y justificación:** El requisito **D11** evalúa un Dashboard de Usuario con resumen real de sus solicitudes por estado, vacantes guardadas y estado de su perfil/CV.

#### 2.2. Navegación real por pestañas / secciones para Solicitudes y Vacantes Guardadas (`D06`, `D11` — `API-021`, `API-023`, `API-025`)
- **Qué falta visualmente:**
  - En el sidebar izquierdo hay enlaces (`Mi perfil`, `Solicitudes`, `Alertas`, `Valoraciones`), pero en el HTML no existían contenedores ni tablas para **"Mis Solicitudes Enviadas"** ni **"Vacantes Guardadas"**.
  - Hoy `perfil.js` inyecta `#opbPostulacionesCard` y `#opbGuardadosCard` apilados debajo de la cuadrícula de 4 tarjetas, alargando la página. Falta convertir las vistas o estructurar en el HTML una sección clara (con pestañas o paneles dedicados) para:
    - Tabla de postulaciones con filtro por estado (`API-021`) y paginación.
    - Cuadrícula de vacantes guardadas (`API-023` y `API-025`), incluyendo un enlace **"Guardados"** en el sidebar.
    - En **"Gestión de Perfil"** (`#formPerfilUsuario`), diseñar formalmente los switches de preferencias (`recibe_email`, `recibe_sms` — `API-017`) y el bloque de descarga/reemplazo de CV (`API-018`, `API-019`) que hoy también se insertan desde JS.
    - Diferenciar visualmente en el bloque de **"Panel de Alertas"** (`#alertsList`) las **Notificaciones recibidas del sistema** (`API-030` y `API-031`, que ya funcionan cuando una empresa cambia el estado de una postulación) de los futuros criterios de alertas por empleo.
- **Por qué hace falta y justificación:** Evita que la vista dependa de inyección DOM improvisada y deja limpio el recorrido de demostración **D06 → D11** (editar perfil → subir CV → ver guardados → revisar estado de solicitud y notificación recibida).

---

### Archivo 3: `frontend/panel-administrativo.html` (Panel de Administración — Requisito `D12`)

#### 3.1. Bloque visual para Estadísticas Detalladas (`D12` — `GET /api/admin/estadisticas` `API-103`)
- **Qué falta visualmente en `#dashboard`:**
  - Actualmente `#dashboard` solo tiene las 4 tarjetas principales de `GET /api/admin/resumen` (`API-068`) y la tabla de bitácora (`#adminLogsTable`).
  - **No existe ningún bloque HTML ni gráfica/tabla** para mostrar los 4 conjuntos de datos que ya calcula `GET /api/admin/estadisticas` (`API-103`):
    1. `vacantes_por_estado` / `resumen_vacantes` (borrador, pendiente, publicada, oculta, rechazada, cerrada).
    2. `postulaciones_por_estado` / `resumen_postulaciones` (nueva, en_proceso, contratado, rechazado).
    3. `postulaciones_por_mes` (evolución mensual).
    4. `postulaciones_por_categoria` (demanda por categoría).
    5. Controles de filtro por rango de fechas (`?desde=&hasta=`).
- **Por qué hace falta y justificación:** El endpoint `API-103` es uno de los 14 endpoints ya construidos para `D12`, pero es prácticamente invisible en el frontend porque el HTML no tiene dónde renderizarlo.

#### 3.2. Tabla nativa de Verificación de Empresas y filtros/paginación en Usuarios y Vacantes (`D12` — `API-069` a `API-075`)
- **Qué falta visualmente:**
  1. **En la pestaña `#empresas` ("Empresas y Ofertas"):** El HTML original solo incluyó `#adminJobsTable` (tabla de ofertas), olvidando la tabla de **Verificación de Empresas** (`GET /api/admin/empresas` `API-071`, descargar documento `API-072`, aprobar/rechazar/suspender `API-073`). `admin.js` tuvo que crearla arriba por JS (`#opbAdminCompaniesSection`), pero aún falta un **buscador `q`** para empresas y controles de paginación.
  2. **En la tabla de ofertas (`#adminJobsTable`):** Faltan filtros por **`estado`** (`pendiente`, `publicada`, `oculta`, `rechazada`, `cerrada`), checkbox/filtro de **`solo reportadas`** (`?reportada=true`), buscador `q` y paginación. Además, el HTML estático tenía botones ficticios de *"Eliminar"*, cuando el flujo real del backend modera estados (`publicada` / `oculta` / `rechazada` / `cerrada`) conservando integridad referencial.
  3. **En `#usuarios`:** Falta selector de filtro por **rol** (`candidato`, `empleador`, `administrador`), filtro por **estado** (`activo`, `suspendido`) y paginación (`API-069`). También el HTML original tenía un botón estático *"Editar"* que confunde porque el admin solo cambia el estado (`activo`/`suspendido` vía `API-070`).
  4. **En `#adminLogsTable` (Bitácora `API-104`):** Faltan filtros por `entidad`, `accion`, rango de fechas (`desde`/`hasta`) y paginación (hoy solo carga los primeros 20).

#### 3.3. Pestaña independiente para "Categorías de Empleo" y botón de Editar Categoría (`D12` — `API-086` a `API-089`)
- **Qué falta visualmente:**
  - En `panel-administrativo.html` **no existe pestaña ni sección de Categorías de Empleo**. Como solución temporal, `admin.js` reemplazó la pestaña `#reportes` (que decía *"Exportación PDF Próximamente"*) para meter ahí juntas las *Vacantes Reportadas* y las *Categorías de Empleo*.
  - Dentro del listado de categorías (`#opbCategoriasList`), cada categoría solo tiene botón **Eliminar** (`API-089`), pero **no hay botón ni modal para Editar/Renombrar una categoría** (`PATCH /api/admin/categorias-empleo/:id`, `API-088`).
- **Por qué hace falta y justificación:** Si una categoría ya tiene vacantes asociadas, el backend protege la base de datos devolviendo error al intentar borrarla (`409`); por lo tanto, tener un botón visual **"Editar"** en el panel admin es indispensable para demostrar el CRUD completo de categorías exigido en `D12`.

---

### Archivo 4: `frontend/index.html` y Navegación Global (`D01`, `D02`, `D05`, `D06`)

#### 4.1. Alineación de filtros del buscador principal (`D05` — `API-007` y `API-009`)
- **Qué falta visualmente en `#searchForm`:**
  1. **Separar `#locationFilter` de la modalidad:** En `index.html`, el select `#locationFilter` dice *"Ubicación"* pero sus opciones son `Remoto`, `Presencial`, `Híbrido` (eso es **modalidad**, no ubicación geográfica). Por eso no existe un campo donde escribir o elegir una ciudad/departamento (ej. `San Salvador`, `Santa Ana`) combinado con modalidad (`remoto`, `presencial`, `hibrido`).
  2. **Falta el filtro por `Categoría de empleo` (`categoria_id`):** Consumiendo `GET /api/catalogos/categorias-empleo` (`API-007`), para aprovechar en la búsqueda pública las categorías administradas en `panel-administrativo.html`.
  3. **Falta filtro por fecha de publicación (`desde`)** (ej. últimas 24h, última semana, último mes) y corregir/completar valores de `#typeFilter` (agregar **Pasantía** `pasantia`) y `#experienceFilter` (agregar **Sin experiencia** `sin_experiencia`), que ya soporta `GET /api/vacantes` (`API-009`).
- **Por qué hace falta y justificación:** El requisito **D05** evalúa filtros combinados reales; hoy un usuario no puede buscar *"Vacantes de Tecnología (categoría) en San Salvador (ubicación) bajo modalidad Remoto"* al mismo tiempo porque faltan esos controles en el formulario.

#### 4.2. Detalle completo de vacante y acciones del candidato en `#detalleEmpleoModal` (`D05`, `D06` — `API-010`, `API-022`, `API-024`)
- **Qué falta visualmente:**
  - En el HTML original del modal solo hay espacios para descripción y requisitos, dejando fuera campos que `GET /api/vacantes/:id` (`API-010`) ya entrega: **`responsabilidades`**, **`beneficios`**, **`fecha_cierre`**, **`correo_contacto`**, **`categoria`**, **`logo` de la empresa** y un **enlace a `valoraciones.html`** para ver reseñas de esa empresa.
  - Tampoco existían en el HTML original el botón **"Guardar oferta"** (`API-024`/`API-025`) ni el `<textarea>` de **"Carta de presentación (opcional)"** (`API-022`); ambos los tuvo que inyectar `index.js` por código.

#### 4.3. Ajustes en `#registroModal` y Barra de Navegación (`D02` — `API-003`)
- **Qué falta visualmente:**
  1. **Campos del formulario de registro (`#formRegistroCandidato` y `#formRegistroEmpresa`):** El HTML pide `Documento (DUI/Pasaporte)` (`#regCandDoc`), campo que **no existe en la tabla `usuarios`** de PostgreSQL y el backend ignora; en cambio, pide un solo campo *"Nombre completo"* (obligando al JS a partir nombres y apellidos) y **no incluye campo de `Teléfono` (`telefono`)** que sí soporta `POST /api/auth/registro` (`API-003`).
  2. **Enlace condicional al Panel Administrativo en `<nav class="navbar">`:** Todas las páginas listan siempre los 5 enlaces públicos (`Búsqueda`, `Publicar empleos`, `Recursos`, `Valoraciones`, `Mi perfil`), pero no muestran el acceso a **`panel-administrativo.html`** cuando inicia sesión un administrador (solo aparece en el botón *"Mi Cuenta"* del header superior derecho).

---

### Archivo 5: `frontend/valoraciones.html` (`P-02/P-05` — `API-011` a `API-014`)

#### 5.1. Paginación y logos reales en tarjetas de empresas
- **Qué falta visualmente:**
  1. **Controles de paginación** debajo de `#companyReviewsContainer`: la API `GET /api/empresas` (`API-011`) responde paginada (`meta.pagina`, `meta.paginas`), pero no hay barra de paginación en la página.
  2. **Contenedor de `<img>` para logo de empresa** cuando `ruta_logo` existe (actualmente tanto el HTML como `valoraciones.js` solo renderizan iniciales en círculo).
  3. **Soporte para abrir una empresa por URL** (`valoraciones.html?empresaId=...`), enlazado desde el detalle de vacantes en `index.html`.
- **Justificación:** Aprovecha al 100% los datos reales que ya devuelve el backend público de empresas y logos subidos por empleadores.

---

## 3. Lista Corta de Prioridades Visuales para William (Antes de la Defensa)

Para dejar el **100% de la Matriz de Defensa (`D01–D12`)** visualmente impecable con las APIs ya activas:
1. **`publicar-empleos.html`:** Agregar tarjetas del Dashboard (`D10`), campo `nivel_experiencia` + `salario_min/max` + `fecha_cierre` + pestaña de *"Mis Vacantes"*, vista previa de logo y filtros por vacante/estado en *"Gestión de Candidatos"*.
2. **`panel-administrativo.html`:** Agregar bloque de Estadísticas (`API-103`), pestaña dedicada de *"Categorías de Empleo"* con botón **Editar** (`API-088`), tabla formal de Verificación de Empresas y filtros/paginación en tablas.
3. **`perfil-usuario.html`:** Mostrar el desglose real por estado del Dashboard (`D11`: `nueva`, `en_proceso`, `contratado`, `rechazado`, `tiene_cv`, `notificaciones_no_leidas`) y dar pestañas/diseño formal a Solicitudes y Guardados.
4. **`index.html`:** Separar Ubicación de Modalidad, agregar selector de Categoría (`API-007`), enriquecer `#detalleEmpleoModal` y alinear campos de `#registroModal`.
