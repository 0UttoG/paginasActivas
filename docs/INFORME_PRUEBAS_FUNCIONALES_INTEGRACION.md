# Documento de Pruebas Funcionales y de Integración

**Proyecto:** Opportunity Bridge  
**Ejecución:** 17/11/2026 11:02 (El Salvador)  
**Base de código:** rama `submain`, commit base `5dd1190` con cambios locales sin confirmar  
**Resultado:** 25/25 casos aprobados

## Objetivo y método

Verificar el recorrido implementado de empresa, administración y candidatos mediante navegador (23 escenas), API HTTP y PostgreSQL de solo lectura. Se usaron cuentas sintéticas del manual; no se incluyen credenciales ni tokens.

El backend se ejecutó localmente en `127.0.0.1:3000` y se conectó al PostgreSQL remoto configurado. No se verificó si esa base está aislada de producción.

## Casos ejecutados

| ID | Caso | Resultado esperado | Observado | Estado |
|---|---|---|---|---|
| P01 | Servidor HTTP | GET /health devuelve 200 | HTTP 200; status=ok | PASO |
| P02 | Conexión PostgreSQL | GET /health/db devuelve 200 y tablas | HTTP 200; tablas=18 | PASO |
| P03 | Página inicial servida | GET /index.html devuelve HTML | HTTP 200; tipo=text/html; charset=utf-8 | PASO |
| P04 | Inicio de sesión de los tres roles | Candidato, empleador y administrador reciben token | Cuatro sesiones de demostración iniciadas; tokens omitidos. | PASO |
| P05 | Contraseña incorrecta | POST /api/auth/login devuelve 401 | HTTP 401 | PASO |
| P06 | Acceso sin token | GET /api/perfil/dashboard devuelve 401 | HTTP 401 | PASO |
| P07 | Rol candidato no entra al área de empresa | Devuelve 403 | HTTP 403 | PASO |
| P08 | Rol empleador no entra al perfil candidato | Devuelve 403 | HTTP 403 | PASO |
| P09 | Panel administrativo restringido | Candidato recibe 403; administrador 200 | Candidato HTTP 403; admin HTTP 200 | PASO |
| P10 | Empresa aprobada | La empresa del recorrido conserva estado aprobada | HTTP 200; empresa=7; estado=aprobada | PASO |
| P11 | Oferta cerrada desaparece de búsqueda | GET /api/vacantes excluye la oferta del recorrido | HTTP 200; oferta 6 visible=false | PASO |
| P12 | Detalle público de oferta cerrada | GET /api/vacantes/:id devuelve 404 | HTTP 404 | PASO |
| P13 | La oferta no admite nuevas postulaciones | POST /api/perfil/postulaciones rechaza oferta cerrada con 404, 409 o 422 y no crea fila | HTTP 404; rechazo de oferta cerrada | PASO |
| P14 | Dashboard de empresa | Una oferta cerrada y dos solicitudes finales | HTTP 200; cerradas=1; solicitudes=2; contratado=1; rechazado=1 | PASO |
| P15 | Dashboard de candidato contratado | Una solicitud contratada y una vacante guardada | HTTP 200; contratado=1; guardados=1 | PASO |
| P16 | Dashboard de candidato rechazado | Una solicitud rechazada sin datos del otro candidato | HTTP 200; total=1; rechazado=1 | PASO |
| P17 | Historial de postulaciones separado por usuario | Cada candidato ve solo su propia solicitud | HTTP 200/200; solicitudes distintas=true | PASO |
| P18 | Vacante guardada en perfil | Candidato principal ve la vacante como no disponible | HTTP 200; guardada=true; disponible=false | PASO |
| P19 | Empresa consulta a sus postulantes | Aparecen dos solicitudes de la oferta propia | HTTP 200; solicitudes=2; estados=rechazado,contratado | PASO |
| P20 | CV propio del candidato | GET /api/perfil/cv devuelve PDF | HTTP 200; tipo=application/pdf | PASO |
| P21 | Empresa accede al CV del postulante | GET /api/empleador/postulaciones/:id/cv devuelve PDF | HTTP 200; tipo=application/pdf | PASO |
| P22 | Candidato no usa ruta privada de empresa | GET de CV por área de empresa devuelve 403 | HTTP 403 | PASO |
| P23 | Notificación de decisión | Candidato contratado recibe notificación de estado contratado | HTTP 200; notificación de contratación=true | PASO |
| P24 | Persistencia en PostgreSQL | Empresa, oferta y dos solicitudes coinciden con la API | Empresa=aprobada; vacante=cerrada; solicitudes=2; contratadas=1; rechazadas=1 | PASO |
| P25 | Estadísticas administrativas | GET /api/admin/estadisticas devuelve resúmenes | HTTP 200; resúmenes presentes=true | PASO |

## Cobertura visual D01-D12

| Requisito | Recorrido | Evidencia / límite |
|---|---|---|
| D01-D02 | Inicio, registro e inicio de sesión | Observado en UI y API |
| D03-D04 | Empresa, revisión y publicación | Observado en UI y API |
| D05-D06 | Búsqueda, CV y postulación | Observado en UI y API |
| D07 | Empresa ve candidatos y su CV | Ficha en UI; descarga de CV verificada por API |
| D08-D09 | Contratar, rechazar y cerrar oferta | Observado en UI; estados y cierre corroborados en SQL |
| D10 | Dashboard de empresa | API verificada; presentación visual específica pendiente |
| D11-D12 | Perfil y panel administrativo | Observado en UI y API |

## Límites y pendientes

- El inventario vigente separa 49 APIs de Fase 8 aún pendientes: alertas, historial y valoraciones, recursos, noticias, foro, reportes de contenido y estadísticas personales. Este informe no las presenta como aprobadas.
- No se ejecutaron aquí los escenarios de concurrencia, fallos de transacción, expiración de token, usuario suspendido ni pruebas de archivos inválidos de T01-T30.
- La descarga del CV se comprobó por HTTP; falta evidenciar el clic y la apertura del archivo desde la vista empresarial. El dashboard empresarial tiene respuesta API válida, pero su visualización completa sigue pendiente.
- Las capturas y el informe pertenecen al árbol local actual. Antes de entregar GitHub/ZIP se debe confirmar que ambos reflejen el mismo código y anexar las evidencias finales al commit correspondiente.

## Archivos de evidencia

- `docs/evidencia_pruebas_2026-11-17.json`: resultados HTTP/SQL sin credenciales.
- `backend/scripts/verificar-entrega.mjs`: comprobaciones reproducibles.
- `manual-video/Manual_de_usuario_Opportunity_Bridge_narrado.mp4`: recorrido visual de referencia.
- `manual-video/capturas/`: imágenes originales locales, excluidas del repositorio.
