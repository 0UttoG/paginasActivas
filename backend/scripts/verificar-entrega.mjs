import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raiz = path.resolve(backend, '..');
const demo = JSON.parse(await fs.readFile(path.join(raiz, 'manual-video/cuentas-demo.local.json'), 'utf8'));
const base = 'http://127.0.0.1:3000';
const casos = [];

async function solicitar(ruta, { method = 'GET', token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const respuesta = await fetch(base + ruta, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000)
    });
    const tipo = respuesta.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await respuesta.json() : null;
    await respuesta.body?.cancel().catch(() => {});
    return { codigo: respuesta.status, tipo, datos };
}

async function ejecutar(id, nombre, esperado, prueba) {
    try {
        const observado = await prueba();
        const paso = Boolean(observado.paso);
        casos.push({ id, nombre, esperado, resultado: paso ? 'PASO' : 'FALLO', observado: observado.detalle });
        console.log(`${id} ${paso ? 'PASO' : 'FALLO'} - ${nombre}`);
    } catch (error) {
        casos.push({ id, nombre, esperado, resultado: 'FALLO', observado: `Error: ${error.message}` });
        console.log(`${id} FALLO - ${nombre}: ${error.message}`);
    }
}

function ver(paso, detalle) { return { paso, detalle }; }

try {
    const sesiones = {};
    for (const nombre of ['empresa', 'candidato', 'segundo_candidato']) {
        const cuenta = demo[nombre];
        const r = await solicitar('/api/auth/login', {
            method: 'POST', body: { correo: cuenta.correo, contrasena: cuenta.contrasena }
        });
        if (r.codigo !== 200 || !r.datos?.token) throw new Error(`No se pudo iniciar sesión de ${nombre}: HTTP ${r.codigo}`);
        sesiones[nombre] = r.datos.token;
    }
    const tokenEmpresa = sesiones.empresa;
    const tokenCandidato = sesiones.candidato;
    const tokenSegundo = sesiones.segundo_candidato;
    const adminFuente = await fs.readFile(path.join(backend, 'scripts/seed-admin.js'), 'utf8');
    const claveAdmin = adminFuente.match(/contrasena:\s*'([^']+)'/)?.[1];
    const correoAdmin = adminFuente.match(/correo:\s*'([^']+)'/)?.[1];
    if (!claveAdmin || !correoAdmin) throw new Error('No se encontró la cuenta de prueba administrativa.');
    const adminLogin = await solicitar('/api/auth/login', { method: 'POST', body: { correo: correoAdmin, contrasena: claveAdmin } });
    if (adminLogin.codigo !== 200 || !adminLogin.datos?.token) throw new Error(`No se pudo iniciar sesión administrativa: HTTP ${adminLogin.codigo}`);
    const tokenAdmin = adminLogin.datos.token;

    await ejecutar('P01', 'Servidor HTTP', 'GET /health devuelve 200', async () => {
        const r = await solicitar('/health');
        return ver(r.codigo === 200 && r.datos?.status === 'ok', `HTTP ${r.codigo}; status=${r.datos?.status}`);
    });
    await ejecutar('P02', 'Conexión PostgreSQL', 'GET /health/db devuelve 200 y tablas', async () => {
        const r = await solicitar('/health/db');
        return ver(r.codigo === 200 && r.datos?.tables?.length >= 18, `HTTP ${r.codigo}; tablas=${r.datos?.tables?.length ?? 0}`);
    });
    await ejecutar('P03', 'Página inicial servida', 'GET /index.html devuelve HTML', async () => {
        const r = await solicitar('/index.html');
        return ver(r.codigo === 200 && r.tipo.includes('html'), `HTTP ${r.codigo}; tipo=${r.tipo}`);
    });
    await ejecutar('P04', 'Inicio de sesión de los tres roles', 'Candidato, empleador y administrador reciben token', async () => {
        return ver(Boolean(tokenEmpresa && tokenCandidato && tokenSegundo && tokenAdmin), 'Cuatro sesiones de demostración iniciadas; tokens omitidos.');
    });
    await ejecutar('P05', 'Contraseña incorrecta', 'POST /api/auth/login devuelve 401', async () => {
        const r = await solicitar('/api/auth/login', { method: 'POST', body: { correo: demo.candidato.correo, contrasena: 'ClaveIncorrecta123' } });
        return ver(r.codigo === 401, `HTTP ${r.codigo}`);
    });
    await ejecutar('P06', 'Acceso sin token', 'GET /api/perfil/dashboard devuelve 401', async () => {
        const r = await solicitar('/api/perfil/dashboard');
        return ver(r.codigo === 401, `HTTP ${r.codigo}`);
    });
    await ejecutar('P07', 'Rol candidato no entra al área de empresa', 'Devuelve 403', async () => {
        const r = await solicitar('/api/empleador/dashboard', { token: tokenCandidato });
        return ver(r.codigo === 403, `HTTP ${r.codigo}`);
    });
    await ejecutar('P08', 'Rol empleador no entra al perfil candidato', 'Devuelve 403', async () => {
        const r = await solicitar('/api/perfil/dashboard', { token: tokenEmpresa });
        return ver(r.codigo === 403, `HTTP ${r.codigo}`);
    });
    await ejecutar('P09', 'Panel administrativo restringido', 'Candidato recibe 403; administrador 200', async () => {
        const ajeno = await solicitar('/api/admin/resumen', { token: tokenCandidato });
        const propio = await solicitar('/api/admin/resumen', { token: tokenAdmin });
        return ver(ajeno.codigo === 403 && propio.codigo === 200, `Candidato HTTP ${ajeno.codigo}; admin HTTP ${propio.codigo}`);
    });
    await ejecutar('P10', 'Empresa aprobada', 'La empresa del recorrido conserva estado aprobada', async () => {
        const r = await solicitar('/api/empleador/empresa', { token: tokenEmpresa });
        return ver(r.codigo === 200 && r.datos?.data?.id === demo.empresa.id && r.datos?.data?.estado_verificacion === 'aprobada', `HTTP ${r.codigo}; empresa=${r.datos?.data?.id}; estado=${r.datos?.data?.estado_verificacion}`);
    });
    await ejecutar('P11', 'Oferta cerrada desaparece de búsqueda', 'GET /api/vacantes excluye la oferta del recorrido', async () => {
        const r = await solicitar('/api/vacantes');
        return ver(r.codigo === 200 && !r.datos?.data?.some((v) => v.id === demo.vacante_id), `HTTP ${r.codigo}; oferta ${demo.vacante_id} visible=${r.datos?.data?.some((v) => v.id === demo.vacante_id)}`);
    });
    await ejecutar('P12', 'Detalle público de oferta cerrada', 'GET /api/vacantes/:id devuelve 404', async () => {
        const r = await solicitar(`/api/vacantes/${demo.vacante_id}`);
        return ver(r.codigo === 404, `HTTP ${r.codigo}`);
    });
    await ejecutar('P13', 'La oferta no admite nuevas postulaciones', 'POST /api/perfil/postulaciones rechaza oferta cerrada con 404, 409 o 422 y no crea fila', async () => {
        const r = await solicitar('/api/perfil/postulaciones', { method: 'POST', token: tokenCandidato, body: { vacante_id: demo.vacante_id, carta_presentacion: 'Reintento de prueba sobre oferta cerrada.' } });
        return ver([404, 409, 422].includes(r.codigo), `HTTP ${r.codigo}; rechazo de oferta cerrada`);
    });
    await ejecutar('P14', 'Dashboard de empresa', 'Una oferta cerrada y dos solicitudes finales', async () => {
        const r = await solicitar('/api/empleador/dashboard', { token: tokenEmpresa });
        const d = r.datos?.data;
        return ver(r.codigo === 200 && d?.ofertas?.cerrada === 1 && d?.postulaciones?.total === 2 && d?.postulaciones?.contratado === 1 && d?.postulaciones?.rechazado === 1, `HTTP ${r.codigo}; cerradas=${d?.ofertas?.cerrada}; solicitudes=${d?.postulaciones?.total}; contratado=${d?.postulaciones?.contratado}; rechazado=${d?.postulaciones?.rechazado}`);
    });
    await ejecutar('P15', 'Dashboard de candidato contratado', 'Una solicitud contratada y una vacante guardada', async () => {
        const r = await solicitar('/api/perfil/dashboard', { token: tokenCandidato });
        const d = r.datos?.data;
        return ver(r.codigo === 200 && d?.solicitudes?.contratado === 1 && d?.guardados === 1, `HTTP ${r.codigo}; contratado=${d?.solicitudes?.contratado}; guardados=${d?.guardados}`);
    });
    await ejecutar('P16', 'Dashboard de candidato rechazado', 'Una solicitud rechazada sin datos del otro candidato', async () => {
        const r = await solicitar('/api/perfil/dashboard', { token: tokenSegundo });
        const d = r.datos?.data;
        return ver(r.codigo === 200 && d?.solicitudes?.total === 1 && d?.solicitudes?.rechazado === 1 && d?.solicitudes?.contratado === 0, `HTTP ${r.codigo}; total=${d?.solicitudes?.total}; rechazado=${d?.solicitudes?.rechazado}`);
    });
    await ejecutar('P17', 'Historial de postulaciones separado por usuario', 'Cada candidato ve solo su propia solicitud', async () => {
        const a = await solicitar('/api/perfil/postulaciones', { token: tokenCandidato });
        const b = await solicitar('/api/perfil/postulaciones', { token: tokenSegundo });
        const aid = a.datos?.data?.[0]?.id;
        const bid = b.datos?.data?.[0]?.id;
        return ver(a.codigo === 200 && b.codigo === 200 && a.datos?.data?.length === 1 && b.datos?.data?.length === 1 && aid !== bid, `HTTP ${a.codigo}/${b.codigo}; solicitudes distintas=${aid !== bid}`);
    });
    await ejecutar('P18', 'Vacante guardada en perfil', 'Candidato principal ve la vacante como no disponible', async () => {
        const r = await solicitar('/api/perfil/guardados', { token: tokenCandidato });
        const fila = r.datos?.data?.find((v) => v.vacante_id === demo.vacante_id);
        return ver(r.codigo === 200 && fila?.disponible === false, `HTTP ${r.codigo}; guardada=${Boolean(fila)}; disponible=${fila?.disponible}`);
    });
    await ejecutar('P19', 'Empresa consulta a sus postulantes', 'Aparecen dos solicitudes de la oferta propia', async () => {
        const r = await solicitar('/api/empleador/postulaciones', { token: tokenEmpresa });
        const filas = r.datos?.data?.filter((p) => p.vacante_id === demo.vacante_id) || [];
        return ver(r.codigo === 200 && filas.length === 2 && filas.some((p) => p.estado === 'contratado') && filas.some((p) => p.estado === 'rechazado'), `HTTP ${r.codigo}; solicitudes=${filas.length}; estados=${filas.map((p) => p.estado).join(',')}`);
    });
    const solicitudes = (await solicitar('/api/empleador/postulaciones', { token: tokenEmpresa })).datos?.data || [];
    const solicitudContratada = solicitudes.find((p) => p.vacante_id === demo.vacante_id && p.estado === 'contratado');
    await ejecutar('P20', 'CV propio del candidato', 'GET /api/perfil/cv devuelve PDF', async () => {
        const r = await solicitar('/api/perfil/cv', { token: tokenCandidato });
        return ver(r.codigo === 200 && r.tipo.includes('pdf'), `HTTP ${r.codigo}; tipo=${r.tipo}`);
    });
    await ejecutar('P21', 'Empresa accede al CV del postulante', 'GET /api/empleador/postulaciones/:id/cv devuelve PDF', async () => {
        const r = await solicitar(`/api/empleador/postulaciones/${solicitudContratada?.id}/cv`, { token: tokenEmpresa });
        return ver(r.codigo === 200 && r.tipo.includes('pdf'), `HTTP ${r.codigo}; tipo=${r.tipo}`);
    });
    await ejecutar('P22', 'Candidato no usa ruta privada de empresa', 'GET de CV por área de empresa devuelve 403', async () => {
        const r = await solicitar(`/api/empleador/postulaciones/${solicitudContratada?.id}/cv`, { token: tokenCandidato });
        return ver(r.codigo === 403, `HTTP ${r.codigo}`);
    });
    await ejecutar('P23', 'Notificación de decisión', 'Candidato contratado recibe notificación de estado contratado', async () => {
        const r = await solicitar('/api/perfil/notificaciones', { token: tokenCandidato });
        const coincide = r.datos?.data?.some((n) => n.tipo === 'estado_postulacion' && /contratado/i.test(n.mensaje || ''));
        return ver(r.codigo === 200 && Boolean(coincide), `HTTP ${r.codigo}; notificación de contratación=${Boolean(coincide)}`);
    });
    await ejecutar('P24', 'Persistencia en PostgreSQL', 'Empresa, oferta y dos solicitudes coinciden con la API', async () => {
        const { rows } = await pool.query(`
            SELECT e.estado_verificacion AS empresa_estado, v.estado AS vacante_estado,
                   COUNT(p.id)::int AS solicitudes,
                   COUNT(p.id) FILTER (WHERE p.estado='contratado')::int AS contratadas,
                   COUNT(p.id) FILTER (WHERE p.estado='rechazado')::int AS rechazadas
            FROM empresas e JOIN vacantes v ON v.empresa_id=e.id
            LEFT JOIN postulaciones p ON p.vacante_id=v.id
            WHERE e.id=$1 AND v.id=$2
            GROUP BY e.estado_verificacion,v.estado`, [demo.empresa.id, demo.vacante_id]);
        const d = rows[0];
        return ver(d?.empresa_estado === 'aprobada' && d?.vacante_estado === 'cerrada' && d?.solicitudes === 2 && d?.contratadas === 1 && d?.rechazadas === 1, `Empresa=${d?.empresa_estado}; vacante=${d?.vacante_estado}; solicitudes=${d?.solicitudes}; contratadas=${d?.contratadas}; rechazadas=${d?.rechazadas}`);
    });
    await ejecutar('P25', 'Estadísticas administrativas', 'GET /api/admin/estadisticas devuelve resúmenes', async () => {
        const r = await solicitar('/api/admin/estadisticas', { token: tokenAdmin });
        return ver(r.codigo === 200 && Boolean(r.datos?.data?.resumen_vacantes) && Boolean(r.datos?.data?.resumen_postulaciones), `HTTP ${r.codigo}; resúmenes presentes=${Boolean(r.datos?.data?.resumen_vacantes && r.datos?.data?.resumen_postulaciones)}`);
    });
} finally {
    await pool.end();
}

const salida = path.join(raiz, 'docs/evidencia_pruebas_2026-11-17.json');
await fs.writeFile(salida, JSON.stringify({
    proyecto: 'Opportunity Bridge',
    ejecutado_en: new Date().toISOString(),
    rama: 'submain',
    commit_base: '5dd1190c0d072b26fbef6e53dab428b7e390282d',
    contexto: 'Aplicación local con PostgreSQL remoto configurado; cuentas de demostración del manual de usuario. El aislamiento del entorno no fue verificado.',
    casos
}, null, 2) + '\n');
console.log(`Resultado: ${casos.filter((c) => c.resultado === 'PASO').length}/${casos.length} casos pasaron. Evidencia: ${salida}`);
