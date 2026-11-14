# Necesidades del backend para la defensa y acuerdo con frontend

Actualización: 13 de noviembre de 2026. Fuente de alcance: lista de funcionalidades de defensa publicada por la U y compartida por el usuario. Aquí se cubren únicamente funciones; los archivos de entrega quedan fuera de esta matriz.

Estado de esta entrega: necesidades y contratos documentados. No se han implementado nuevas APIs ni ejecutado migraciones con esta actualización. El backend se considera completo solo después de superar las pruebas indicadas.

## Matriz de cobertura de los 12 requisitos

Todos los paths de negocio llevan `/api`. Ningún frontend se conecta directamente a PostgreSQL. Autenticación: token Bearer; usuarios activos y rol correspondiente. Las validaciones, SQL y formatos completos están en documentos 02 y 03.

| ID | Requisito de defensa | Necesidad del backend | API principal | Comprobación esperada |
|---|---|---|---|---|
| D01 | Landing Page | Ofertas públicas vigentes, categorías y métricas reales | GET `/inicio/metricas`, `/vacantes`, `/catalogos/categorias-empleo` | Sin sesión carga datos; no incluye ofertas pendientes/cerradas |
| D02 | Crear usuario | Registro candidato/empleador, hash, unicidad y login | POST `/auth/registro`, `/auth/login`; GET `/auth/me` | Registra, inicia sesión y devuelve rol; duplicado 409 |
| D03 | Crear empresa | Asociar una empresa al empleador actual; datos/contacto y revisión | POST/GET/PATCH `/empleador/empresa` | Empresa pendiente propia; admin puede aprobarla |
| D04 | Empresa crea oferta de empleo | Crear oferta propia completa, revisión y publicación | POST `/empleador/vacantes`; PATCH `/admin/vacantes/:id/estado` | Admin publica; aparece en resultados públicos |
| D05 | Usuario busca y ve detalle | Filtros AND, paginación y detalle público | GET `/vacantes`, `/vacantes/:id` | Buscar la oferta recién creada y abrir sus datos/contacto |
| D06 | Usuario aplica a empleo | Validar candidato/CV/oferta; evitar duplicado; guardar solicitud | POST `/perfil/postulaciones`; POST `/perfil/cv` | Una solicitud persistida; duplicado 409; sin CV 422 |
| D07 | Empresa ve aplicantes | Listar por oferta y consultar perfil/CV de postulantes propios | GET `/empleador/postulaciones`, `/empleador/postulaciones/:id/candidato`, `/empleador/postulaciones/:id/cv` | Encuentra al candidato real y abre su CV; otra empresa no accede |
| D08 | Empresa acepta o deniega | contratado/rechazado desde nueva o en_proceso; notificar/auditar | PATCH `/empleador/postulaciones/:id/estado` | Aceptación/denegación se refleja en solicitud del candidato |
| D09 | Empresa inactiva/cancela o elimina ofertas | Cierre lógico propio, conservando postulaciones | PATCH `/empleador/vacantes/:id/cerrar` | Sale de búsqueda, no recibe más solicitudes y conserva historial |
| D10 | Dashboard de empresas | Resumen solo de empresa actual, ofertas/solicitudes y recientes | GET `/empleador/dashboard` | Totales reales, estados correctos, sin datos de otra empresa |
| D11 | Dashboard de usuarios | Resumen de candidato, solicitudes/guardados/alertas/notificaciones | GET `/perfil/dashboard` | Candidato nuevo en ceros; datos cambian tras postular y recibir decisión |
| D12 | Panel administrativo | Usuarios, empresas, ofertas, categorías y aprobaciones | GET `/admin/resumen` y rutas `/admin/*` | Solo admin; aprueba empresa/oferta y gestiona estados |

La redacción “inactiva/cancela o elimina” se cubre con cierre lógico. No hace falta borrar una oferta y sus postulaciones para demostrar D09. No se agregan nuevos estados al esquema actual.

## Contrato que debe respetar frontend

| Acción o pantalla | Consumo / ajuste requerido |
|---|---|
| Entrada tras login | Consultar `/auth/me`; candidato al dashboard personal, empleador al dashboard de empresa y admin a su panel |
| Crear empresa | Si dashboard indica requiere_crear_empresa=true, mostrar formulario; si pendiente, mostrar aviso de revisión |
| Publicar empleo | Separar salario mínimo/máximo, modalidad, contrato y experiencia; correo de contacto obligatorio; mostrar pendiente tras crear |
| Filtros | Enviar nombres/enums del contrato; limpiar reinicia página 1; paginar conserva filtros |
| Postular | Subir CV primero si falta; enviar vacante_id y carta opcional; mostrar confirmación y prevenir doble envío mientras procesa |
| Aplicantes | Seleccionar vacante_id para filtrar; CV con petición autenticada, no URL pública de uploads |
| Aceptar/Contratar | Enviar `{estado:"contratado"}`; la aceptación significa selección/contratación en este proyecto |
| Denegar | Enviar `{estado:"rechazado"}`; no usar `denegado` como estado de la base |
| Cancelar/Inactivar oferta | Confirmar y llamar `/cerrar`; mostrar estado cerrada; no enviar `cancelada` ni borrar historial en la interfaz |
| Dashboard empresa | Mostrar total de ofertas, vigentes y estados; postulaciones por estado y cinco recientes |
| Dashboard candidato | Mostrar solicitudes por estado, guardados, alertas activas, no leídas y cinco recientes |
| Panel admin | Aprobar empresa antes de oferta; distinguir pendiente/aprobada y pendiente/publicada según entidad |
| Respuestas y errores | Leer `data`/`meta`; mostrar carga/vacío/error; ante 401 pedir sesión; ante 403 mostrar falta de permiso; 409/422 explicar la regla |

Después de crear oferta, postular, decidir un candidato, cerrar oferta o aprobar desde admin, volver a consultar los listados y dashboards afectados. No incrementar contadores manualmente sin respuesta del servidor. Los dos roles pueden actualizar al volver a la pantalla o mediante botón Actualizar; tiempo real no es obligatorio.

Frontend conserva libertad de diseño y distribución visual; los campos, permisos, estados y acciones se guían por el contrato. Los dos dashboards pueden ser la primera sección de P-03 y P-04, sin necesidad de módulos visuales independientes.

## Datos y casos para una demostración real

- Un administrador con hash válido y dos empleadores con empresas diferentes para comprobar aislamiento.
- Dos candidatos con CVs válidos disponibles en carpetas locales: uno será aceptado y otro denegado.
- Una empresa nueva pendiente, su documento legal y NIT de demostración, aprobada desde panel admin.
- Una oferta creada durante la defensa, publicada por admin y vigente; categoría existente.
- Las cuentas de datos_prueba.sql tienen marcadores de hash y referencias a archivos inexistentes hasta prepararlos; no sirven por sí solas para este recorrido.

## Orden de demostración integrado

1. Abrir landing y mostrar ofertas, filtros y métricas (D01).
2. Registrar/iniciar sesión como empleador, consultar dashboard vacío y crear empresa (D02, D03, D10).
3. Admin aprueba empresa; empleador crea oferta; admin publica (D04, D12).
4. Candidato se registra, sube CV, busca y abre detalle de la oferta (D02, D05).
5. Candidato aplica y revisa solicitudes/dashboard (D06, D11).
6. Segundo candidato aplica; empleador ve ambos, abre CV y acepta uno/deniega otro (D07, D08).
7. Candidatos consultan estado y notificación; dashboard de empresa refleja ambas decisiones (D10, D11).
8. Empleador cancela/cierra oferta; comprobar que desaparece de búsqueda y siguen sus postulaciones (D09).
9. Mostrar administración y permisos; segunda empresa no puede abrir los candidatos de la primera (D12 y aislamiento).

Cada paso debe persistir en PostgreSQL. No editar estados manualmente en SQL para simular que la API funciona. Las consultas SQL sirven como evidencia adicional de lo realizado por la aplicación.

## Criterios para dar por cubierta la defensa desde backend

- D01–D12 comprobados mediante peticiones HTTP reales y datos de desarrollo.
- Dashboards devuelven los contratos de documento 02, con conteos de Q18/Q19 y pruebas T24–T26.
- D08 pasa con T27; D09 con Q20/T28/T29, incluso cierre repetido y solicitud concurrente.
- Las decisiones se muestran al candidato y los cambios administrativos tienen efecto en resultados públicos.
- Integración posterior del frontend verifica formularios, botones, mensajes y refresco; un endpoint exitoso aislado no demuestra que la pantalla esté integrada.

Todos los puntos quedan inicialmente PENDIENTES de implementación/prueba. Las funcionalidades de la guía original (foros, recursos, noticias, valoraciones y alertas) conservan su plan; esta matriz prioriza el recorrido mínimo de la defensa sin declararlas eliminadas del proyecto.

El alcance total se ejecuta desde el [inventario completo del plan](../PLAN_TRABAJO.md#inventario-completo-de-apis-a-implementar-e-integrar): contiene individualmente los 104 endpoints anteriores y añadidos, con estado de implementación, conexión a base de datos, prueba HTTP e integración frontend. La matriz D01–D12 no reemplaza ese inventario ni reduce el proyecto a los mínimos de defensa.
