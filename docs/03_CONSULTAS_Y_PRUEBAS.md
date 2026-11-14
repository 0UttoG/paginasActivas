# Consultas, reglas de datos y pruebas

Especificación para programar los servicios con `pg`. Los SQL de este documento son plantillas de implementación, no scripts para ejecutar completos ni migraciones ya aplicadas. `schema.sql` ya se ejecutó según el usuario; no recrear sus tablas. Ninguna consulta remota se ejecutó al redactar esta documentación.

## Reglas comunes de consultas

Usar `$1,$2,...` y un arreglo de valores; jamás interpolar texto del usuario. Los nombres de columnas de PATCH se eligen en una lista fija del servidor. Para una operación simple usar `pool.query`. Para una transacción obtener `client = await pool.connect()`, ejecutar BEGIN, todas las consultas con ese mismo client, COMMIT o ROLLBACK en catch y `release()` en finally. No usar `pool.query` para las sentencias de una transacción.

Evitar SELECT * sobre usuarios o joins: seleccionar explícitamente columnas públicas. Cero filas en un UPDATE/SELECT de un registro individual significa 404; listados vacíos 200. Deshacer todo cambio si falla una notificación/bitácora que forma parte de una acción de negocio.

Orden recomendado del servicio: validar formato → comprobar usuario/rol → buscar registro con propiedad → validar estado → escribir → notificar/auditar → confirmar → responder. En consultas protegidas filtrar por dueño en SQL, no cargar todos los registros para filtrarlos en JavaScript.

Vigencia: vacante publicada, empresa aprobada y `fecha_cierre` NULL o >= fecha local actual. Adoptar UTC para timestamp y comparar cierre con `(now() AT TIME ZONE 'America/El_Salvador')::date`.

## Q01 - Revisar conexión y columnas sin modificar datos

```sql
SELECT 1 AS conectado;
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
SELECT id, nombre FROM roles ORDER BY id;
```

Comparar 18 tablas del esquema con la base real. La existencia de los archivos locales no demuestra que datos_prueba.sql se haya ejecutado. Verificar correo/empresa antes de repetir una carga; no usar TRUNCATE para arreglar duplicados.

## Q02 - Autenticación, sesión y registro

```sql
SELECT u.id, u.nombres, u.apellidos, u.correo, u.contrasena_hash,
       u.estado, r.nombre AS rol
FROM usuarios u JOIN roles r ON r.id = u.rol_id
WHERE lower(u.correo) = lower($1);

SELECT u.id, u.nombres, u.apellidos, u.correo, u.estado, r.nombre AS rol
FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1;

INSERT INTO usuarios(rol_id,nombres,apellidos,correo,contrasena_hash,telefono)
VALUES((SELECT id FROM roles WHERE nombre=$1),$2,$3,$4,$5,$6)
RETURNING id,nombres,apellidos,correo,estado,fecha_registro;
```

Primer SELECT solo interno al login; comparar hash en Node y eliminarlo de respuesta/logs. `$1` de INSERT es candidato o empleador ya validado; `$5` es hash generado en servidor. Roles se resuelven por nombre, no asumir que sus IDs son siempre 1,2,3. Recuperar rol en respuesta por SELECT o valor ya validado.

## Q03 - Métricas de inicio y resumen administrativo

```sql
SELECT
 (SELECT count(*)::int FROM empresas WHERE estado_verificacion='aprobada') AS empresas_aprobadas,
 (SELECT count(*)::int FROM usuarios u JOIN roles r ON r.id=u.rol_id
   WHERE r.nombre='candidato' AND u.estado='activo') AS candidatos_activos,
 (SELECT count(*)::int FROM vacantes v JOIN empresas e ON e.id=v.empresa_id
   WHERE v.estado='publicada' AND e.estado_verificacion='aprobada'
   AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= (now() AT TIME ZONE 'America/El_Salvador')::date)) AS vacantes_activas,
 (SELECT count(*)::int FROM postulaciones) AS total_postulaciones;
```

Admin: usuarios activos = COUNT usuarios estado activo; empresas pendientes = COUNT estado_verificacion pendiente; vacantes reportadas = COUNT(DISTINCT vacante_id) en reportes abiertos; reportes abiertos = COUNT filas abiertas; actividad de foros = contar por separado temas/respuestas publicados en un rango. No sumar joins de varias colecciones porque multiplican los conteos.

## Q04 - Búsqueda y detalle de vacantes

Orden de parámetros: q, ubicación, modalidad, contrato, experiencia, categoría, salario mínimo buscado, salario máximo buscado, desde, límite, offset.

```sql
SELECT v.id,v.titulo,v.ubicacion,v.modalidad,v.tipo_contrato,
       v.nivel_experiencia,v.salario_min,v.salario_max,v.fecha_publicacion,
       e.id AS empresa_id,e.nombre_legal,e.ruta_logo
FROM vacantes v JOIN empresas e ON e.id=v.empresa_id
WHERE v.estado='publicada' AND e.estado_verificacion='aprobada'
 AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= (now() AT TIME ZONE 'America/El_Salvador')::date)
 AND ($1::text IS NULL OR v.titulo ILIKE '%'||$1||'%'
      OR v.descripcion ILIKE '%'||$1||'%' OR e.nombre_legal ILIKE '%'||$1||'%')
 AND ($2::text IS NULL OR v.ubicacion ILIKE '%'||$2||'%')
 AND ($3::text IS NULL OR v.modalidad=$3)
 AND ($4::text IS NULL OR v.tipo_contrato=$4)
 AND ($5::text IS NULL OR v.nivel_experiencia=$5)
 AND ($6::int IS NULL OR v.categoria_id=$6)
 AND ($7::numeric IS NULL OR COALESCE(v.salario_max,v.salario_min) >= $7)
 AND ($8::numeric IS NULL OR COALESCE(v.salario_min,v.salario_max) <= $8)
 AND ($9::timestamp IS NULL OR v.fecha_publicacion >= $9)
ORDER BY v.fecha_publicacion DESC,v.id DESC LIMIT $10 OFFSET $11;
```

Para total, reutilizar exactamente FROM/WHERE con `count(*)::int` y sin LIMIT/OFFSET. No usar tamaño de página como total. Los mismos filtros sirven para destacadas (límite 3). Para empresa específica añadir `v.empresa_id=$N`, parametrizado.

Detalle: misma condición pública + `v.id=$1`; seleccionar además descripción, responsabilidades, requisitos, beneficios, contacto, cierre y categoría. Si no cumple condición pública responder 404. El candidato ve su solicitud aunque la oferta se haya cerrado mediante Q07, sin reutilizar el detalle público.

## Q05 - Empresas públicas y valoraciones

```sql
SELECT e.id,e.nombre_legal,e.descripcion,e.sitio_web,e.correo_contacto,
       e.telefono_contacto,e.ruta_logo,
       COALESCE(x.total,0)::int AS total_valoraciones,x.promedio
FROM empresas e
LEFT JOIN (
 SELECT empresa_id,count(*) AS total,round(avg(calificacion),2) AS promedio
 FROM valoraciones_empresa WHERE estado='aprobada' GROUP BY empresa_id
) x ON x.empresa_id=e.id
WHERE e.estado_verificacion='aprobada'
 AND ($1::text IS NULL OR e.nombre_legal ILIKE '%'||$1||'%')
ORDER BY e.nombre_legal,e.id LIMIT $2 OFFSET $3;

SELECT ve.id,ve.calificacion,ve.comentario,ve.fecha_creacion,u.nombres,u.apellidos
FROM valoraciones_empresa ve JOIN usuarios u ON u.id=ve.candidato_id
WHERE ve.empresa_id=$1 AND ve.estado='aprobada'
ORDER BY ve.fecha_creacion DESC,ve.id DESC LIMIT $2 OFFSET $3;
```

Sin reseñas: total 0, promedio NULL. Para ficha añadir e.id, conservando aprobación; jamás incluir NIT/documento legal en consultas públicas. Categorías: SELECT id,nombre ORDER BY nombre. Creación/edición de catálogo valida nombre con trim y búsqueda lower antes de INSERT/UPDATE.

## Q06 - Perfil y archivos

```sql
SELECT id,nombres,apellidos,correo,telefono,ruta_cv,recibe_email,recibe_sms
FROM usuarios WHERE id=$1;
UPDATE usuarios SET nombres=$1,apellidos=$2,telefono=$3,
 recibe_email=$4,recibe_sms=$5 WHERE id=$6
RETURNING id,nombres,apellidos,correo,telefono,recibe_email,recibe_sms;
UPDATE usuarios SET ruta_cv=$1 WHERE id=$2 RETURNING id,ruta_cv;
```

Plantilla UPDATE perfil supone todos los valores ya combinados con el registro anterior. Para PATCH dinámico, armar columnas en lista permitida y parámetros; no hacer COALESCE para campos donde NULL signifique borrar. Ruta nueva solo desde upload middleware. Comprobar archivo real al postular/descargar. Actualizar logo/documento en empresas añade `WHERE usuario_id=$idSesion`.

## Q07 - Postulaciones: listado y creación atómica

```sql
SELECT p.id,p.vacante_id,p.fecha_postulacion,p.estado,
       v.titulo,v.estado AS estado_vacante,v.ubicacion,v.modalidad,e.nombre_legal
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id
JOIN empresas e ON e.id=v.empresa_id
WHERE p.candidato_id=$1 AND ($2::text IS NULL OR p.estado=$2)
ORDER BY p.fecha_postulacion DESC,p.id DESC LIMIT $3 OFFSET $4;
```

Creación, dentro de una transacción:

1. Leer usuario candidato activo y CV; comprobar existencia física antes de tomar bloqueo.
2. SELECT vacante JOIN empresa `WHERE v.id=$1 FOR SHARE OF v,e`; comprobar publicada/aprobada/vigencia. El bloqueo impide aprobación/cierre concurrente durante la creación.
3. INSERT siguiente; UNIQUE(vacante_id,candidato_id) evita doble envío concurrente.
4. Crear notificación al empleador y bitácora; COMMIT. Ante 23505, ROLLBACK y 409.

```sql
INSERT INTO postulaciones(vacante_id,candidato_id,ruta_cv,carta_presentacion)
VALUES($1,$2,$3,$4)
RETURNING id,vacante_id,candidato_id,estado,fecha_postulacion;
INSERT INTO notificaciones(usuario_id,titulo,mensaje,tipo)
VALUES($1,$2,$3,$4) RETURNING id;
INSERT INTO bitacora(usuario_id,accion,entidad,entidad_id,detalle)
VALUES($1,$2,$3,$4,$5);
```

La ruta_cv se copia desde usuarios y conserva versión histórica. No permitir estado inicial elegido por cliente.

## Q08 - Empresa y ofertas propias

```sql
SELECT id,usuario_id,nombre_legal,nit,descripcion,sitio_web,correo_contacto,
 telefono_contacto,ruta_logo,ruta_documento_legal,estado_verificacion
FROM empresas WHERE usuario_id=$1;

SELECT v.id,v.titulo,v.estado,v.fecha_creacion,
 (SELECT count(*)::int FROM postulaciones p WHERE p.vacante_id=v.id) AS total_postulaciones
FROM vacantes v JOIN empresas e ON e.id=v.empresa_id
WHERE e.usuario_id=$1 AND ($2::text IS NULL OR v.estado=$2)
ORDER BY v.fecha_creacion DESC,v.id DESC LIMIT $3 OFFSET $4;
```

Empresa POST: INSERT columnas del contrato, `usuario_id` de sesión, estado pendiente por defecto. Edición: UPDATE campos permitidos WHERE usuario_id; si nombre_legal cambió fijar pendiente. Guardar cambios y bitácora en una transacción.

Vacante POST: leer empresa propia aprobada; INSERT formulario más empresa_id resuelta, estado pendiente. PATCH: SELECT vacante JOIN empresa por id y usuario_id FOR UPDATE; validar editable; UPDATE formulario permitido; si publicada, fijar pendiente. Cerrar: mismo control y UPDATE estado cerrada. No aceptar empresa_id ni fecha_publicacion del body. Empleador no puede publicar directamente.

```sql
SELECT v.id,v.estado,e.id AS empresa_id,e.estado_verificacion
FROM vacantes v JOIN empresas e ON e.id=v.empresa_id
WHERE v.id=$1 AND e.usuario_id=$2 FOR UPDATE OF v;
```

## Q09 - Candidatos, permiso de CV y cambio de estado

```sql
SELECT p.id,p.vacante_id,p.estado,p.fecha_postulacion,v.titulo,
 u.id AS candidato_id,u.nombres,u.apellidos
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id
JOIN empresas e ON e.id=v.empresa_id JOIN usuarios u ON u.id=p.candidato_id
WHERE e.usuario_id=$1 AND ($2::int IS NULL OR p.vacante_id=$2)
 AND ($3::text IS NULL OR p.estado=$3)
ORDER BY p.fecha_postulacion DESC,p.id DESC LIMIT $4 OFFSET $5;

SELECT p.id,p.candidato_id,p.ruta_cv,u.nombres,u.apellidos,u.correo,u.telefono
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id
JOIN empresas e ON e.id=v.empresa_id JOIN usuarios u ON u.id=p.candidato_id
WHERE p.id=$1 AND e.usuario_id=$2;
```

Segunda consulta autoriza el perfil y archivo de esa solicitud; ruta_cv no sale en la respuesta JSON pública. Para historial añadir candidato_id autorizado, no un usuario arbitrario del query.

Cambio de estado: BEGIN, misma propiedad `FOR UPDATE OF p`, verificar transición nueva→en_proceso/contratado/rechazado o en_proceso→contratado/rechazado, UPDATE, INSERT notificación al candidato, INSERT bitácora, COMMIT. Si estado solicitado ya es actual, devolver 200 sin notificación duplicada. Estado final a otro estado: 409. Resolver solicitudes de una oferta cerrada está permitido; crear nuevas solicitudes no.

## Q10 - Guardados, alertas y notificaciones

```sql
SELECT vg.vacante_id,vg.fecha_guardado,v.titulo,e.nombre_legal,
 (v.estado='publicada' AND e.estado_verificacion='aprobada'
  AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= (now() AT TIME ZONE 'America/El_Salvador')::date)) AS disponible
FROM vacantes_guardadas vg JOIN vacantes v ON v.id=vg.vacante_id
JOIN empresas e ON e.id=v.empresa_id WHERE vg.candidato_id=$1
ORDER BY vg.fecha_guardado DESC,vg.vacante_id DESC LIMIT $2 OFFSET $3;

INSERT INTO vacantes_guardadas(candidato_id,vacante_id) VALUES($1,$2) RETURNING *;
DELETE FROM vacantes_guardadas WHERE candidato_id=$1 AND vacante_id=$2 RETURNING vacante_id;
SELECT id,nombre,palabra_clave,ubicacion,modalidad,nivel_experiencia,categoria_id,activa
FROM alertas_empleo WHERE candidato_id=$1 ORDER BY fecha_creacion DESC,id DESC LIMIT $2 OFFSET $3;
SELECT id,titulo,mensaje,tipo,leida,fecha_creacion FROM notificaciones
WHERE usuario_id=$1 AND ($2::boolean IS NULL OR leida=$2)
ORDER BY fecha_creacion DESC,id DESC LIMIT $3 OFFSET $4;
UPDATE notificaciones SET leida=true WHERE id=$1 AND usuario_id=$2
RETURNING id,titulo,mensaje,tipo,leida,fecha_creacion;
```

Guardar exige oferta pública. Alertas INSERT incluye candidato de sesión y campos del contrato; PATCH/DELETE añade `id=$1 AND candidato_id=$2`. Preferencias email/SMS se actualizan en usuarios, no en cada alerta. Sin proveedor no afirmar que se envió correo/SMS.

## Q11 - Historial y valoraciones

```sql
SELECT h.id,h.empresa_id,e.nombre_legal,h.cargo,h.fecha_inicio,h.fecha_fin,h.verificado
FROM historial_laboral h JOIN empresas e ON e.id=h.empresa_id
WHERE h.candidato_id=$1 ORDER BY h.fecha_inicio DESC,h.id DESC LIMIT $2 OFFSET $3;
SELECT EXISTS(SELECT 1 FROM historial_laboral
 WHERE candidato_id=$1 AND empresa_id=$2 AND verificado=true) AS permitido;
INSERT INTO valoraciones_empresa(empresa_id,candidato_id,calificacion,comentario)
VALUES($1,$2,$3,$4) RETURNING id,empresa_id,calificacion,comentario,estado,fecha_creacion;
UPDATE valoraciones_empresa SET calificacion=$1,comentario=$2,estado='pendiente'
WHERE id=$3 AND candidato_id=$4 RETURNING id,calificacion,comentario,estado;
```

INSERT reseña: verificar historial en transacción; bloquear registros de historial verificado FOR SHARE para no publicar contra revocación concurrente. UNIQUE de candidato/empresa resuelve duplicados. Edición de reseña conserva empresa/candidato y exige que siga habiendo historial verificado.

Modificar/eliminar historial propio: bloquear fila, cambiar y consultar si quedan otros verificados de misma empresa; si no, UPDATE reseñas de esa pareja a oculta. Verificación/revocación solo admin. Aprobar reseña vuelve a comprobar historial; nunca inferir que el usuario trabajó allí solo porque postuló o fue contratado en una oferta.

## Q12 - Recursos y noticias

```sql
SELECT id,titulo,resumen,tipo,fecha_publicacion,
       (ruta_archivo IS NOT NULL) AS tiene_descarga
FROM recursos WHERE publicado=true
 AND ($1::text IS NULL OR tipo=$1)
 AND ($2::text IS NULL OR titulo ILIKE '%'||$2||'%')
ORDER BY fecha_publicacion DESC NULLS LAST,id DESC LIMIT $3 OFFSET $4;
SELECT id,titulo,resumen,tipo,contenido,enlace,(ruta_archivo IS NOT NULL) AS tiene_descarga
FROM recursos WHERE id=$1 AND publicado=true;
SELECT ruta_archivo FROM recursos WHERE id=$1 AND publicado=true;
SELECT id,titulo,categoria,resumen,enlace_fuente,fecha_publicacion FROM noticias
WHERE fecha_publicacion<=current_timestamp
 AND ($1::text IS NULL OR categoria=$1)
ORDER BY fecha_publicacion DESC,id DESC LIMIT $2 OFFSET $3;
```

La tercera consulta solo en descarga autenticada. Admin usa mismas tablas sin filtro público y CRUD de campos enumerados. Al publicar recurso fijar fecha_publicacion si estaba NULL. Descargar con ruta existente dentro de uploads/recursos; no retornar la ruta física al cliente.

## Q13 - Foro, conteos y actividad

```sql
SELECT t.id,t.titulo,t.estado,t.fecha_creacion,t.sector,t.modalidad,
 t.nivel_experiencia,t.ubicacion,c.nombre AS categoria,u.nombres,u.apellidos,
 COALESCE(x.total,0)::int AS total_respuestas,
 GREATEST(t.fecha_creacion,COALESCE(x.ultima,t.fecha_creacion)) AS ultima_actividad
FROM temas_foro t JOIN categorias_foro c ON c.id=t.categoria_id
JOIN usuarios u ON u.id=t.autor_id
LEFT JOIN (SELECT tema_id,count(*) AS total,max(fecha_creacion) AS ultima
 FROM respuestas_foro WHERE estado='publicado' GROUP BY tema_id) x ON x.tema_id=t.id
WHERE t.estado IN ('publicado','cerrado')
 AND ($1::int IS NULL OR t.categoria_id=$1)
 AND ($2::text IS NULL OR t.sector=$2)
 AND ($3::text IS NULL OR t.modalidad=$3)
 AND ($4::text IS NULL OR t.nivel_experiencia=$4)
 AND ($5::text IS NULL OR t.ubicacion ILIKE '%'||$5||'%')
 AND ($6::text IS NULL OR t.titulo ILIKE '%'||$6||'%')
ORDER BY ultima_actividad DESC,t.id DESC LIMIT $7 OFFSET $8;
```

Detalle misma visibilidad + id; respuestas JOIN temas visible, JOIN autor, filtrar respuesta publicada, ordenar fecha ASC,id ASC y paginar. Crear tema fija autor de sesión/estado publicado. PATCH tema añade autor_id y estado publicado al WHERE. Respuesta POST bloquea tema FOR SHARE, exige publicado y luego INSERT; cerrado permite lectura pero no insertar. PATCH respuesta exige autor propio, publicada y tema aún abierto. Conteos no incluyen ocultas.

## Q14 - Reportes y ocultación por tres usuarios

BEGIN; elegir tabla/columna del tipo mediante mapa cerrado. Bloquear fila objetivo FOR UPDATE. Comprobar visibilidad; buscar reporte abierto del mismo usuario/objetivo; si existe 409. INSERT un solo FK. Para vacante contar DISTINCT reportado_por abiertos; si >=3 y publicada, UPDATE a oculta y crear bitácora/notificación al dueño; COMMIT.

```sql
SELECT count(DISTINCT reportado_por)::int AS total
FROM reportes_contenido WHERE vacante_id=$1 AND estado='abierto';
SELECT rc.id,rc.reportado_por,rc.vacante_id,rc.valoracion_id,rc.tema_id,
 rc.respuesta_id,rc.motivo,rc.estado,rc.fecha_reporte
FROM reportes_contenido rc
WHERE ($1::text IS NULL OR rc.estado=$1)
ORDER BY rc.fecha_reporte DESC,rc.id DESC LIMIT $2 OFFSET $3;
```

Toda inserción del servicio de reportes debe seguir el mismo bloqueo; así dos reportes simultáneos del mismo usuario no duplican fila. Admin resolver/descartar cambia solo reporte y deja detalle de resolución en bitácora, ya que la tabla no tiene columnas de resolución. Ocultar/aprobar contenido se hace por su endpoint correspondiente. Reaprobar oferta requiere resolver antes sus reportes abiertos o justificar mantenerla oculta.

## Q15 - Operaciones administrativas y borrados

Listados admin: usuarios JOIN roles (sin hash), empresas completas, vacantes JOIN empresa, historial JOIN candidato/empresa, valoraciones JOIN candidato/empresa, temas/respuestas con todos los estados. Todos con filtros parametrizados y COUNT separado. Nunca usar valores de filtro como nombres SQL.

Cambiar estado: BEGIN, SELECT entidad FOR UPDATE, comprobar transición/precondiciones, UPDATE, INSERT bitácora, notificación si aplica y COMMIT. Empresas: aprobar exige NIT y archivo legal; vacantes: publicar exige empresa aprobada y vigencia, `fecha_publicacion=COALESCE(fecha_publicacion,current_timestamp)`.

Suspender usuario no altera ni borra su historial. Middleware bloquea el token ya emitido al consultar estado actual. Para impedir suspender al último admin activo, serializar esta operación bloqueando las filas de todos los administradores activas en orden de id antes de contar/modificar.

No hay DELETE general de usuarios/empresas/vacantes en el contrato. Categoría DELETE: ejecutar y convertir 23503 a 409; no forzar cascada. Recursos/noticias pueden borrarse con auditoría en transacción y limpieza posterior del archivo. No eliminar bitácora desde endpoints de negocio.

## Q16 - Estadísticas de negocio

```sql
SELECT date_trunc('month',fecha_postulacion)::date AS mes,count(*)::int AS total
FROM postulaciones
WHERE fecha_postulacion >= $1::timestamp AND fecha_postulacion < $2::timestamp
GROUP BY 1 ORDER BY 1;
SELECT estado,count(*)::int AS total FROM postulaciones
WHERE fecha_postulacion >= $1::timestamp AND fecha_postulacion < $2::timestamp
GROUP BY estado ORDER BY estado;
SELECT c.id,c.nombre,count(p.id)::int AS total
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id
LEFT JOIN categorias_empleo c ON c.id=v.categoria_id
WHERE p.fecha_postulacion >= $1::timestamp AND p.fecha_postulacion < $2::timestamp
GROUP BY c.id,c.nombre ORDER BY total DESC;
SELECT id,usuario_id,accion,entidad,entidad_id,detalle,fecha FROM bitacora
WHERE ($1::int IS NULL OR usuario_id=$1) AND ($2::text IS NULL OR entidad=$2)
 AND ($3::timestamp IS NULL OR fecha >= $3)
 AND ($4::timestamp IS NULL OR fecha < $4)
ORDER BY fecha DESC,id DESC LIMIT $5 OFFSET $6;
```

`hasta` se transforma al límite exclusivo del siguiente día si se recibe DATE. Rango por defecto: inicio de mes hasta ahora. Validar desde<=hasta. Completar meses/días faltantes con ceros en servicio solo si el período está definido; no rellenar métricas que nunca se midieron. Estas consultas no miden disponibilidad, latencia ni visitas al portal.

## Ajustes mínimos previstos del modelo

No ejecutados por esta documentación. Antes de aplicarlos verificar columnas/duplicados reales y guardar como migración separada de schema.sql.

1. Correos y categorías: detectar duplicados `GROUP BY lower(...) HAVING count(*)>1`; resolverlos antes de índices únicos sobre lower(correo), lower(nombre). Evita duplicados concurrentes por mayúsculas.
2. Salarios: el CHECK actual no impide salario_max negativo si salario_min es NULL. Añadir CHECK(salario_max IS NULL OR salario_max>=0). Validar también en API desde la primera fase.
3. Visitas del perfil: tabla mínima `visitas_perfil(id serial PK, candidato_id FK usuarios, empleador_id FK usuarios, fecha timestamp default current_timestamp)` y UNIQUE(candidato_id,empleador_id,fecha) no es deduplicación diaria. Para contar una visita por empleador/candidato/día usar además `dia date NOT NULL` calculado en El Salvador y UNIQUE(candidato_id,empleador_id,dia). Índice candidato_id,dia. Insertar ON CONFLICT DO NOTHING al abrir perfil autorizado desde Q09, no al descargar varias veces el CV. GET estadísticas cuenta visitas por candidato en últimos siete días; total de solicitudes viene de postulaciones.
4. Alertas: añadir tipo_contrato varchar(20), salario_min/max numeric(10,2) con CHECK de rango. No existen hoy; no escribirlas hasta aplicar ajuste.
5. Deduplícar envíos: tabla mínima `alertas_enviadas(alerta_id FK alertas_empleo ON DELETE CASCADE, vacante_id FK vacantes ON DELETE CASCADE, notificacion_id FK notificaciones ON DELETE SET NULL, fecha timestamp default current_timestamp, PRIMARY KEY(alerta_id,vacante_id))`. Su PK impide notificar repetidamente la misma coincidencia.

Visitas y alertas_enviadas serían dos tablas adicionales a las 18 actuales. No son requisito para crear las primeras APIs. Si no se implementan, visitas y coincidencias automáticas deben declararse pendientes en la entrega.

## Q17 - Generación de coincidencias (después de ajustes)

Servicio interno `generarCoincidencias`, no una ruta pública. Ejecutarlo después de publicar una oferta y, para la demostración inicial, al crear/activar una alerta. Un barrido diario solo se agrega cuando se configure el programador.

1. Consultar alertas activas de candidatos activos y vacantes públicas vigentes; cada criterio NULL significa cualquiera, demás criterios AND, misma semántica que Q04.
2. Por cada pareja usar una transacción: INSERT alertas_enviadas(alerta_id,vacante_id) ON CONFLICT DO NOTHING RETURNING alerta_id. Si no inserta, ya fue notificada; terminar sin duplicar.
3. Si inserta, crear notificación interna y asignar su id a esa pareja; COMMIT. Si falla, ROLLBACK permite reintentar.
4. No marcar enviado email/SMS porque la tabla de notificaciones solo representa notificaciones internas. Preferencias se conservan hasta integrar proveedor y registro de entrega externo.

## Q18 - Dashboard del candidato

Usar el mismo cliente y `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, consultar Q06 para usuario y las consultas siguientes, COMMIT y release. `$1` siempre es idSesion; usuario existe y está activo por middleware. Esto garantiza que contadores/listas de una misma respuesta vean el mismo estado de la base.

```sql
SELECT count(*)::int AS total,
 count(*) FILTER (WHERE estado='nueva')::int AS nueva,
 count(*) FILTER (WHERE estado='en_proceso')::int AS en_proceso,
 count(*) FILTER (WHERE estado='contratado')::int AS contratado,
 count(*) FILTER (WHERE estado='rechazado')::int AS rechazado
FROM postulaciones WHERE candidato_id=$1;

SELECT
 (SELECT count(*)::int FROM vacantes_guardadas WHERE candidato_id=$1) AS guardados,
 (SELECT count(*)::int FROM alertas_empleo WHERE candidato_id=$1 AND activa=true) AS alertas_activas,
 (SELECT count(*)::int FROM notificaciones WHERE usuario_id=$1 AND leida=false) AS notificaciones_no_leidas;

SELECT p.id,p.vacante_id,v.titulo,e.nombre_legal AS empresa,p.estado,
 v.estado AS estado_vacante,p.fecha_postulacion
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id
JOIN empresas e ON e.id=v.empresa_id
WHERE p.candidato_id=$1
ORDER BY p.fecha_postulacion DESC,p.id DESC LIMIT 5;
```

Servicio arma `{usuario,solicitudes,guardados,alertas_activas,notificaciones_no_leidas,ultimas_postulaciones}`. `usuario.tiene_cv` indica si hay ruta registrada; al postular se comprueba también existencia física mediante el servicio de archivos. No devolver ruta del CV en dashboard. Guardados cuenta relaciones propias incluso si una vacante se cerró; el listado de guardados informa disponibilidad.

## Q19 - Dashboard del empleador

Mismo snapshot de lectura consistente que Q18. Primero resolver empresa por usuario_id de sesión con Q08. Si no existe devolver contrato vacío 200; no permitir que el cliente elija empresa_id. En consultas siguientes `$1` es id de empresa resuelto, no el id del usuario.

```sql
SELECT count(*)::int AS total,
 count(*) FILTER (WHERE estado='borrador')::int AS borrador,
 count(*) FILTER (WHERE estado='pendiente')::int AS pendiente,
 count(*) FILTER (WHERE estado='publicada')::int AS publicada,
 count(*) FILTER (WHERE estado='oculta')::int AS oculta,
 count(*) FILTER (WHERE estado='rechazada')::int AS rechazada,
 count(*) FILTER (WHERE estado='cerrada')::int AS cerrada,
 count(*) FILTER (WHERE estado='publicada'
  AND (fecha_cierre IS NULL OR fecha_cierre >= (now() AT TIME ZONE 'America/El_Salvador')::date)
  AND EXISTS(SELECT 1 FROM empresas e WHERE e.id=$1 AND e.estado_verificacion='aprobada'))::int AS publicadas_vigentes
FROM vacantes WHERE empresa_id=$1;

SELECT count(*)::int AS total,
 count(*) FILTER (WHERE p.estado='nueva')::int AS nueva,
 count(*) FILTER (WHERE p.estado='en_proceso')::int AS en_proceso,
 count(*) FILTER (WHERE p.estado='contratado')::int AS contratado,
 count(*) FILTER (WHERE p.estado='rechazado')::int AS rechazado
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id WHERE v.empresa_id=$1;

SELECT p.id,p.vacante_id,v.titulo,p.candidato_id,u.nombres,u.apellidos,
 p.estado,p.fecha_postulacion
FROM postulaciones p JOIN vacantes v ON v.id=p.vacante_id
JOIN usuarios u ON u.id=p.candidato_id
WHERE v.empresa_id=$1
ORDER BY p.fecha_postulacion DESC,p.id DESC LIMIT 5;
```

Servicio arma `{empresa,requiere_crear_empresa,ofertas,postulaciones,ultimas_postulaciones}`. `publicada` cuenta estado almacenado, mientras `publicadas_vigentes` descuenta vencidas o empresa no aprobada. No unir notificaciones/guardados al agregado de solicitudes: multiplicaría filas. Empresa suspendida conserva estadísticas propias aunque no pueda publicar.

## Q20 - Cerrar/cancelar una oferta propia

BEGIN; SELECT de Q08 por vacante y usuario con FOR UPDATE OF v. Si no existe: 404. Si ya cerrada: devolver estado actual y confirmar sin nuevos efectos. Si rechazada: 409. En borrador/pendiente/publicada/oculta:

```sql
UPDATE vacantes SET estado='cerrada' WHERE id=$1
RETURNING id,titulo,estado;
```

El servicio usa el id ya autorizado; insertar bitácora de cierre y COMMIT. No borrar ni actualizar postulaciones. Al consultar Q04 la oferta ya no aparece, Q07 conserva la solicitud y Q19 muestra una cerrada más. Ante una postulación concurrente, los bloqueos de Q07 y Q20 definen el orden: si cierre se confirmó primero, rechazar postulación; si postulación se confirmó antes, conservarla.

## Índice de servicios por grupo de API

| Grupo | Consultas/recetas |
|---|---|
| health y verificación | Q01 |
| auth | Q02 |
| inicio/resumen admin | Q03 |
| vacantes públicas y destacadas | Q04 |
| directorio/reseñas públicas/catálogos | Q05 |
| perfil y CV | Q06 |
| solicitudes propias/crear | Q07 |
| empresa propia/gestión de vacantes | Q08 |
| candidatos/CV/estados | Q09 |
| guardados/alertas/notificaciones | Q10 |
| historial/valoraciones propias/verificación | Q11 |
| recursos/noticias y CRUD admin | Q12, Q15 |
| foro | Q13 |
| reportes/moderación automática | Q14, Q15 |
| administración/categorías/estados | Q15 |
| estadísticas/bitácora | Q16 |
| alertas automáticas | Q17 |
| dashboard candidato | Q18 |
| dashboard empleador | Q19 |
| cierre/cancelación de oferta propia | Q20 |

## Pruebas de aceptación para completar el backend

Ejecutar en un proyecto/base de desarrollo. Preparar dos candidatos, dos empleadores con empresas, un administrador y un usuario suspendido con hashes reales. Crear archivos de muestra válidos; no asumir que existen los archivos nombrados en las semillas. Guardar IDs devueltos por la API; no asumir IDs autoincrementales concretos.

| Caso | Acción | Resultado esperado |
|---|---|---|
| T01 | Arrancar y consultar health/db; probar conexión inválida controlada | 200 real / 503 sin secreto; no confundir health con prueba de DB |
| T02 | Registrar candidato/empleador; intentar admin y correo duplicado | 201 / 400 / 409; contraseña guardada como hash |
| T03 | Login correcto, incorrecto, token vencido, usuario suspendido | 200 / 401 / 401 / 403 |
| T04 | Probar rol indebido e IDs ajenos en perfil/empresa/solicitud/archivo | 403 por rol; 404 por ajeno; sin fuga de datos |
| T05 | Buscar por cada filtro y combinaciones; paginar; sin resultados | Total coincide, orden estable, lista vacía 200 |
| T06 | Oferta pendiente/cerrada/vencida/empresa suspendida | No pública ni postulable |
| T07 | CV válido, inválido y >5 MB; sustituir CV | Acepta/rechaza; solicitud previa conserva versión anterior |
| T08 | Postular sin CV y dos solicitudes simultáneas iguales | 422 y una sola fila; segunda 409 |
| T09 | Empleador cambia solicitud válida, final o ajena | 200 y una notificación / 409 / 404 |
| T10 | Publicar como empleador y aprobar como admin | Empresa no aprobada 422; oferta pendiente hasta aprobación; fecha real |
| T11 | Historial sin verificar, reseña duplicada, editar/revocar historial | Reseña bloqueada / 409 / reseña deja de ser pública |
| T12 | Tema abierto/cerrado/oculto y respuesta oculta | Respeta visibilidad, cierre y conteos |
| T13 | Reportar repetido y por tres usuarios distintos | No duplica abierto; tercera persona oculta vacante y audita |
| T14 | Admin suspende usuario con token previo | La siguiente operación protegida 403 |
| T15 | Editar publicada, cambiar nombre de empresa | Vacante a pendiente; empresa a pendiente; ambas se reflejan públicamente |
| T16 | Eliminar categoría en uso | 409 y sus registros relacionados intactos |
| T17 | Simular fallo antes de COMMIT en cambio con notificación | No persiste cambio parcial |
| T18 | Alertas: ejecutar dos veces y con concurrencia | Una notificación por pareja alerta/vacante |
| T19 | Abrir dos veces perfil por mismo empleador/día | Una visita si se implementó ajuste; cuenta personal correcta |
| T20 | Inspeccionar respuestas/logs y archivos privados | Ningún hash/credencial; privados solo por rutas autorizadas |
| T21 | CRUD recursos/noticias y descarga con/sin token | Publicados correctos; descarga 401 sin sesión; archivo ausente 404 |
| T22 | Consultar métricas con datos controlados | Coinciden con SQL, rango mensual correcto, sin duplicación por joins |
| T23 | Suspenderse o suspender al último administrador | 409; sigue existiendo administración activa |
| T24 | Candidato recién creado consulta dashboard | 200, usuario propio, contadores cero y listas vacías |
| T25 | Empleador sin empresa y luego con empresa pendiente/aprobada consulta dashboard | 200 en todos; empresa=null inicialmente; estado y contadores correctos después |
| T26 | Dos empresas y dos candidatos con datos diferentes consultan dashboards | Cada resumen solo contiene sus datos; totales coinciden con desgloses |
| T27 | Aceptar desde nueva y denegar otra solicitud | contratado/rechazado, notificaciones únicas y actualización de ambos dashboards |
| T28 | Cerrar oferta con solicitudes y volver a cerrar | Deja de admitir solicitudes, conserva anteriores, repetir no duplica bitácora |
| T29 | Intentar cerrar oferta ajena y resolver solicitud ajena | 404, sin cambios |
| T30 | Recorrido D01–D12 del documento 04 | Los 12 requisitos se comprueban por HTTP, SQL y posterior integración visual |

Registrar cada caso con fecha, petición, código, respuesta resumida, verificación SQL y estado PASÓ/FALLÓ/PENDIENTE. No guardar token, contraseña ni DATABASE_URL en la colección Postman exportada. Las consultas aquí descritas no han sido probadas contra la base remota en esta entrega documental.

## Fuentes técnicas

Usar valores parametrizados según https://node-postgres.com/features/queries y un solo cliente por transacción según https://node-postgres.com/features/transactions. Manejo HTTP de errores según https://expressjs.com/en/5x/guide/error-handling/. Consultadas el 13 de noviembre de 2026.
