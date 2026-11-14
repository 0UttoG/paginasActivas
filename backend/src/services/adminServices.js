import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_BACKEND = path.resolve(__dirname, '..', '..');

//crear error controlado con código HTTP
const crearError = (mensaje, statusCode) => {
    const error = new Error(mensaje);
    error.statusCode = statusCode;
    return error;
};

//normalizar parámetros de paginación
const normalizarPaginacion = (query = {}) => {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limiteRaw = parseInt(query.limite, 10);
    const limite = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));

    return {
        pagina,
        limite,
        offset: (pagina - 1) * limite
    };
};

//obtener resumen de contadores para el panel administrativo (Q03, D12, T22)
export const obtenerResumenAdmin = async () => {
    const { rows } = await pool.query(
        `SELECT
            (SELECT count(*)::int FROM usuarios WHERE estado = 'activo') AS usuarios_activos,
            (SELECT count(*)::int FROM empresas WHERE estado_verificacion = 'pendiente') AS empresas_pendientes,
            (SELECT count(*)::int FROM empresas WHERE estado_verificacion = 'aprobada') AS empresas_aprobadas,
            (SELECT count(*)::int FROM vacantes WHERE estado = 'pendiente') AS vacantes_pendientes,
            (SELECT count(*)::int
                FROM vacantes v
                JOIN empresas e ON e.id = v.empresa_id
                WHERE v.estado = 'publicada'
                    AND e.estado_verificacion = 'aprobada'
                    AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= (now() AT TIME ZONE 'America/El_Salvador')::date)
            ) AS vacantes_activas,
            (SELECT count(DISTINCT vacante_id)::int
                FROM reportes_contenido
                WHERE estado = 'abierto' AND vacante_id IS NOT NULL
            ) AS vacantes_reportadas,
            (SELECT count(*)::int FROM reportes_contenido WHERE estado = 'abierto') AS reportes_abiertos,
            (SELECT count(*)::int FROM temas_foro WHERE estado = 'publicado') AS temas_publicados,
            (SELECT count(*)::int FROM respuestas_foro WHERE estado = 'publicado') AS respuestas_publicadas,
            (SELECT count(*)::int FROM postulaciones) AS total_postulaciones`
    );

    const r = rows[0] || {};
    return {
        usuarios_activos: Number(r.usuarios_activos ?? 0),
        empresas_pendientes: Number(r.empresas_pendientes ?? 0),
        empresas_aprobadas: Number(r.empresas_aprobadas ?? 0),
        vacantes_pendientes: Number(r.vacantes_pendientes ?? 0),
        vacantes_activas: Number(r.vacantes_activas ?? 0),
        vacantes_reportadas: Number(r.vacantes_reportadas ?? 0),
        reportes_abiertos: Number(r.reportes_abiertos ?? 0),
        temas_publicados: Number(r.temas_publicados ?? 0),
        respuestas_publicadas: Number(r.respuestas_publicadas ?? 0),
        total_postulaciones: Number(r.total_postulaciones ?? 0)
    };
};

//listar usuarios del sistema con filtros y paginación sin exponer datos sensibles (Q15, D12, T20)
export const listarUsuariosAdmin = async (query = {}) => {
    const { pagina, limite, offset } = normalizarPaginacion(query);

    const rolesValidos = ['candidato', 'empleador', 'administrador'];
    let rol = null;
    if (query.rol !== undefined && query.rol !== null && String(query.rol).trim() !== '') {
        rol = String(query.rol).trim();
        if (!rolesValidos.includes(rol)) {
            throw crearError('rol de usuario inválido', 400);
        }
    }

    const estadosValidos = ['activo', 'suspendido'];
    let estado = null;
    if (query.estado !== undefined && query.estado !== null && String(query.estado).trim() !== '') {
        estado = String(query.estado).trim();
        if (!estadosValidos.includes(estado)) {
            throw crearError('estado de usuario inválido', 400);
        }
    }

    let q = null;
    if (query.q !== undefined && query.q !== null && String(query.q).trim() !== '') {
        q = String(query.q).trim();
    }

    const dataPromise = pool.query(
        `SELECT
            u.id,
            u.rol_id,
            r.nombre AS rol,
            u.nombres,
            u.apellidos,
            u.correo,
            u.telefono,
            u.estado,
            u.fecha_registro
        FROM usuarios u
        JOIN roles r ON r.id = u.rol_id
        WHERE ($1::text IS NULL OR r.nombre = $1)
            AND ($2::text IS NULL OR u.estado = $2)
            AND (
                $3::text IS NULL
                OR u.nombres ILIKE '%' || $3 || '%'
                OR u.apellidos ILIKE '%' || $3 || '%'
                OR (u.nombres || ' ' || u.apellidos) ILIKE '%' || $3 || '%'
                OR u.correo ILIKE '%' || $3 || '%'
            )
        ORDER BY u.fecha_registro DESC, u.id DESC
        LIMIT $4 OFFSET $5`,
        [rol, estado, q, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM usuarios u
        JOIN roles r ON r.id = u.rol_id
        WHERE ($1::text IS NULL OR r.nombre = $1)
            AND ($2::text IS NULL OR u.estado = $2)
            AND (
                $3::text IS NULL
                OR u.nombres ILIKE '%' || $3 || '%'
                OR u.apellidos ILIKE '%' || $3 || '%'
                OR (u.nombres || ' ' || u.apellidos) ILIKE '%' || $3 || '%'
                OR u.correo ILIKE '%' || $3 || '%'
            )`,
        [rol, estado, q]
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        data: dataResult.rows,
        meta: {
            pagina,
            limite,
            total,
            paginas: total === 0 ? 0 : Math.ceil(total / limite)
        }
    };
};

//activar o suspender una cuenta de usuario protegiendo autosuspensión y último admin activo (Q15, D12, T14/T23)
export const actualizarEstadoUsuarioAdmin = async (adminId, usuarioIdParam, datos = {}) => {
    const rawId = String(usuarioIdParam ?? '').trim();
    if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) {
        throw crearError('id de usuario inválido', 400);
    }
    const usuarioId = Number(rawId);

    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    if (typeof cuerpo.estado !== 'string') {
        throw crearError('estado de usuario inválido', 400);
    }
    const nuevoEstado = cuerpo.estado.trim();
    if (!['activo', 'suspendido'].includes(nuevoEstado)) {
        throw crearError('estado de usuario inválido', 400);
    }

    if (cuerpo.motivo !== undefined && cuerpo.motivo !== null && typeof cuerpo.motivo !== 'string') {
        throw crearError('motivo debe ser texto válido', 400);
    }
    const motivoLimpio = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : '';
    if (nuevoEstado === 'suspendido' && (!motivoLimpio || motivoLimpio.length < 5)) {
        throw crearError('motivo es obligatorio y debe tener al menos 5 caracteres para suspender', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT
                u.id,
                u.rol_id,
                r.nombre AS rol,
                u.nombres,
                u.apellidos,
                u.correo,
                u.telefono,
                u.estado,
                u.fecha_registro
            FROM usuarios u
            JOIN roles r ON r.id = u.rol_id
            WHERE u.id = $1
            FOR UPDATE OF u`,
            [usuarioId]
        );

        if (rows.length === 0) {
            throw crearError('usuario no encontrado', 404);
        }

        const usuarioActual = rows[0];

        if (nuevoEstado === 'suspendido' && Number(adminId) === Number(usuarioActual.id)) {
            throw crearError('no puedes suspender tu propia cuenta', 409);
        }

        //respuesta idempotente si el usuario ya se encuentra en el estado solicitado
        if (usuarioActual.estado === nuevoEstado) {
            await client.query('COMMIT');
            return usuarioActual;
        }

        //proteger que siempre permanezca al menos un administrador activo
        if (nuevoEstado === 'suspendido' && usuarioActual.rol === 'administrador') {
            const { rows: adminsActivos } = await client.query(
                `SELECT u.id
                FROM usuarios u
                JOIN roles r ON r.id = u.rol_id
                WHERE r.nombre = 'administrador' AND u.estado = 'activo'
                ORDER BY u.id ASC
                FOR UPDATE OF u`
            );
            if (adminsActivos.length <= 1) {
                throw crearError('no se puede suspender al último administrador activo', 409);
            }
        }

        const { rows: actualizados } = await client.query(
            `UPDATE usuarios
            SET estado = $1
            WHERE id = $2
            RETURNING id, rol_id, nombres, apellidos, correo, telefono, estado, fecha_registro`,
            [nuevoEstado, usuarioActual.id]
        );

        const accion = nuevoEstado === 'suspendido' ? 'suspender_usuario' : 'activar_usuario';
        const detalle = motivoLimpio
            ? `Estado de usuario cambiado de ${usuarioActual.estado} a ${nuevoEstado}: ${motivoLimpio}`
            : `Estado de usuario cambiado de ${usuarioActual.estado} a ${nuevoEstado}`;

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [adminId, accion, 'usuario', usuarioActual.id, detalle]
        );

        await client.query('COMMIT');

        return {
            ...actualizados[0],
            rol: usuarioActual.rol
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//servicio para listar empresas desde el panel administrativo con filtros y paginación
export const listarEmpresasAdmin = async (query = {}) => {
    const { pagina, limite, offset } = normalizarPaginacion(query);
    const estadosValidos = ['pendiente', 'aprobada', 'rechazada', 'suspendida'];
    const condiciones = [];
    const valores = [];

    if (query.estado_verificacion !== undefined && String(query.estado_verificacion).trim() !== '') {
        const estadoVerificacion = String(query.estado_verificacion).trim().toLowerCase();
        if (!estadosValidos.includes(estadoVerificacion)) {
            throw crearError('el filtro de estado de verificación no es válido', 400);
        }
        valores.push(estadoVerificacion);
        condiciones.push(`e.estado_verificacion = $${valores.length}`);
    }

    if (query.q !== undefined && String(query.q).trim() !== '') {
        const busqueda = `%${String(query.q).trim()}%`;
        valores.push(busqueda);
        const idx = valores.length;
        condiciones.push(
            `(e.nombre_legal ILIKE $${idx} OR e.nit ILIKE $${idx} OR e.correo_contacto ILIKE $${idx} OR u.nombres ILIKE $${idx} OR u.apellidos ILIKE $${idx} OR (u.nombres || ' ' || u.apellidos) ILIKE $${idx} OR u.correo ILIKE $${idx})`
        );
    }

    const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const paramsPaginacion = [...valores, limite, offset];
    const idxLimite = valores.length + 1;
    const idxOffset = valores.length + 2;

    const [empresasRes, totalRes] = await Promise.all([
        pool.query(
            `SELECT
                e.id,
                e.usuario_id,
                e.nombre_legal,
                e.nit,
                e.descripcion,
                e.sitio_web,
                e.correo_contacto,
                e.telefono_contacto,
                e.ruta_logo,
                e.ruta_documento_legal,
                (e.ruta_documento_legal IS NOT NULL AND e.ruta_documento_legal <> '') AS tiene_documento_legal,
                e.estado_verificacion,
                e.fecha_registro,
                u.nombres AS representante_nombres,
                u.apellidos AS representante_apellidos,
                u.correo AS representante_correo
            FROM empresas e
            JOIN usuarios u ON u.id = e.usuario_id
            ${whereSql}
            ORDER BY e.fecha_registro DESC, e.id DESC
            LIMIT $${idxLimite} OFFSET $${idxOffset}`,
            paramsPaginacion
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
            FROM empresas e
            JOIN usuarios u ON u.id = e.usuario_id
            ${whereSql}`,
            valores
        )
    ]);

    const total = Number(totalRes.rows[0]?.total ?? 0);

    return {
        data: empresasRes.rows,
        meta: {
            pagina,
            limite,
            total,
            paginas: total === 0 ? 0 : Math.ceil(total / limite)
        }
    };
};

//obtener y validar la ruta física del documento legal de una empresa para revisión administrativa (Q15, D12, T07)
export const obtenerArchivoDocumentoEmpresaAdmin = async (empresaIdParam) => {
    const rawId = String(empresaIdParam ?? '').trim();
    if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) {
        throw crearError('id de empresa inválido', 400);
    }
    const empresaId = Number(rawId);

    const { rows } = await pool.query(
        'SELECT id, ruta_documento_legal FROM empresas WHERE id = $1 LIMIT 1',
        [empresaId]
    );

    if (rows.length === 0) {
        throw crearError('empresa no encontrada', 404);
    }

    if (!rows[0].ruta_documento_legal || String(rows[0].ruta_documento_legal).trim() === '') {
        throw crearError('la empresa no tiene un documento legal registrado', 404);
    }

    const rutaAbsoluta = path.resolve(ROOT_BACKEND, String(rows[0].ruta_documento_legal).trim());
    if (!rutaAbsoluta.startsWith(ROOT_BACKEND + path.sep)) {
        throw crearError('el documento legal no se encuentra disponible', 404);
    }

    try {
        await fs.access(rutaAbsoluta);
    } catch {
        throw crearError('el documento legal no se encuentra disponible', 404);
    }

    return {
        rutaAbsoluta,
        nombreArchivo: path.basename(rutaAbsoluta)
    };
};

//validar id numérico entero positivo en parámetros de ruta
const validarIdPositivo = (valorParam, nombreEntidad) => {
    const rawId = String(valorParam ?? '').trim();
    if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) {
        throw crearError(`id de ${nombreEntidad} inválido`, 400);
    }
    return Number(rawId);
};

//convertir valores numéricos opcionales devolviendo number o null
const serializarNumeroOpcional = (valor) => (valor === null || valor === undefined ? null : Number(valor));

//serializar columnas base de vacante para respuestas administrativas
const serializarVacanteAdmin = (vacante) => ({
    id: vacante.id,
    empresa_id: vacante.empresa_id,
    categoria_id: vacante.categoria_id,
    titulo: vacante.titulo,
    ubicacion: vacante.ubicacion,
    modalidad: vacante.modalidad,
    tipo_contrato: vacante.tipo_contrato,
    nivel_experiencia: vacante.nivel_experiencia,
    salario_min: serializarNumeroOpcional(vacante.salario_min),
    salario_max: serializarNumeroOpcional(vacante.salario_max),
    descripcion: vacante.descripcion,
    responsabilidades: vacante.responsabilidades,
    requisitos: vacante.requisitos,
    beneficios: vacante.beneficios,
    correo_contacto: vacante.correo_contacto,
    estado: vacante.estado,
    fecha_publicacion: vacante.fecha_publicacion,
    fecha_cierre: vacante.fecha_cierre,
    fecha_creacion: vacante.fecha_creacion
});

const TRANSICIONES_EMPRESA = {
    pendiente: ['aprobada', 'rechazada'],
    aprobada: ['suspendida'],
    suspendida: ['pendiente', 'aprobada'],
    rechazada: ['pendiente']
};

const TRANSICIONES_VACANTE_ADMIN = {
    pendiente: ['publicada', 'rechazada', 'cerrada'],
    publicada: ['oculta', 'cerrada', 'pendiente'],
    oculta: ['publicada', 'cerrada'],
    borrador: ['pendiente', 'cerrada']
};

//aprobar, rechazar, suspender o devolver a revisión una empresa con auditoría y notificación (Q15, D12, T10/T17)
export const actualizarEstadoEmpresaAdmin = async (adminId, empresaIdParam, datos = {}) => {
    const empresaId = validarIdPositivo(empresaIdParam, 'empresa');
    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};

    const rawEstado = cuerpo.estado_verificacion !== undefined ? cuerpo.estado_verificacion : cuerpo.estado;
    if (typeof rawEstado !== 'string') {
        throw crearError('estado de verificación de empresa inválido', 400);
    }
    const nuevoEstado = rawEstado.trim();
    if (!['pendiente', 'aprobada', 'rechazada', 'suspendida'].includes(nuevoEstado)) {
        throw crearError('estado de verificación de empresa inválido', 400);
    }

    if (cuerpo.motivo !== undefined && cuerpo.motivo !== null && typeof cuerpo.motivo !== 'string') {
        throw crearError('motivo debe ser texto válido', 400);
    }
    const motivoLimpio = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : '';
    if (['rechazada', 'suspendida'].includes(nuevoEstado) && motivoLimpio.length < 5) {
        throw crearError('motivo es obligatorio y debe tener al menos 5 caracteres para rechazar o suspender', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: empresas } = await client.query(
            `SELECT
                e.id,
                e.usuario_id,
                e.nombre_legal,
                e.nit,
                e.descripcion,
                e.sitio_web,
                e.correo_contacto,
                e.telefono_contacto,
                e.ruta_logo,
                e.ruta_documento_legal,
                e.estado_verificacion,
                e.fecha_registro
            FROM empresas e
            WHERE e.id = $1
            FOR UPDATE OF e`,
            [empresaId]
        );

        if (empresas.length === 0) {
            throw crearError('empresa no encontrada', 404);
        }

        const empresaActual = empresas[0];
        if (empresaActual.estado_verificacion === nuevoEstado) {
            await client.query('COMMIT');
            return empresaActual;
        }

        const permitidos = TRANSICIONES_EMPRESA[empresaActual.estado_verificacion] || [];
        if (!permitidos.includes(nuevoEstado)) {
            throw crearError('transición de estado de verificación no permitida', 409);
        }

        if (nuevoEstado === 'aprobada') {
            if (!empresaActual.nit || String(empresaActual.nit).trim() === '') {
                throw crearError('no se puede aprobar la empresa porque no tiene NIT registrado', 422);
            }
            if (!empresaActual.ruta_documento_legal || String(empresaActual.ruta_documento_legal).trim() === '') {
                throw crearError('no se puede aprobar la empresa porque no cuenta con un documento legal válido disponible', 422);
            }

            const rutaAbsoluta = path.resolve(ROOT_BACKEND, String(empresaActual.ruta_documento_legal).trim());
            if (!rutaAbsoluta.startsWith(ROOT_BACKEND + path.sep)) {
                throw crearError('no se puede aprobar la empresa porque no cuenta con un documento legal válido disponible', 422);
            }

            try {
                await fs.access(rutaAbsoluta);
            } catch {
                throw crearError('no se puede aprobar la empresa porque no cuenta con un documento legal válido disponible', 422);
            }
        }

        const { rows: actualizadas } = await client.query(
            `UPDATE empresas
            SET estado_verificacion = $1
            WHERE id = $2
            RETURNING
                id,
                usuario_id,
                nombre_legal,
                nit,
                descripcion,
                sitio_web,
                correo_contacto,
                telefono_contacto,
                ruta_logo,
                ruta_documento_legal,
                estado_verificacion,
                fecha_registro`,
            [nuevoEstado, empresaActual.id]
        );

        const mensajeNotificacion = motivoLimpio
            ? `El estado de verificación de ${empresaActual.nombre_legal} cambió a ${nuevoEstado}: ${motivoLimpio}`
            : `El estado de verificación de ${empresaActual.nombre_legal} cambió a ${nuevoEstado}`;

        await client.query(
            `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
            VALUES ($1, $2, $3, $4)`,
            [empresaActual.usuario_id, 'Actualización de estado de empresa', mensajeNotificacion, 'empresa']
        );

        const detalleBitacora = motivoLimpio
            ? `Estado de verificación de empresa cambiado de ${empresaActual.estado_verificacion} a ${nuevoEstado}: ${motivoLimpio}`
            : `Estado de verificación de empresa cambiado de ${empresaActual.estado_verificacion} a ${nuevoEstado}`;

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [adminId, 'actualizar_estado_empresa', 'empresa', empresaActual.id, detalleBitacora]
        );

        await client.query('COMMIT');
        return actualizadas[0];
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//listar vacantes desde el panel administrativo con filtros, conteo de reportes abiertos y paginación (Q14, Q15, D12)
export const listarVacantesAdmin = async (query = {}) => {
    const { pagina, limite, offset } = normalizarPaginacion(query);
    const estadosValidos = ['borrador', 'pendiente', 'publicada', 'oculta', 'rechazada', 'cerrada'];
    const condiciones = [];
    const valores = [];

    if (query.estado !== undefined && query.estado !== null && String(query.estado).trim() !== '') {
        const estado = String(query.estado).trim();
        if (!estadosValidos.includes(estado)) {
            throw crearError('estado de vacante inválido', 400);
        }
        valores.push(estado);
        condiciones.push(`v.estado = $${valores.length}`);
    }

    if (query.empresa_id !== undefined && query.empresa_id !== null && String(query.empresa_id).trim() !== '') {
        const empresaId = validarIdPositivo(query.empresa_id, 'empresa');
        valores.push(empresaId);
        condiciones.push(`v.empresa_id = $${valores.length}`);
    }

    if (query.reportada !== undefined && query.reportada !== null && String(query.reportada).trim() !== '') {
        const rawReportada = String(query.reportada).trim().toLowerCase();
        if (rawReportada === 'true') {
            condiciones.push(
                "EXISTS (SELECT 1 FROM reportes_contenido rc WHERE rc.vacante_id = v.id AND rc.estado = 'abierto')"
            );
        } else if (rawReportada === 'false') {
            condiciones.push(
                "NOT EXISTS (SELECT 1 FROM reportes_contenido rc WHERE rc.vacante_id = v.id AND rc.estado = 'abierto')"
            );
        } else {
            throw crearError('el filtro reportada debe ser true o false', 400);
        }
    }

    if (query.q !== undefined && query.q !== null && String(query.q).trim() !== '') {
        const busqueda = `%${String(query.q).trim()}%`;
        valores.push(busqueda);
        const idx = valores.length;
        condiciones.push(
            `(v.titulo ILIKE $${idx} OR v.ubicacion ILIKE $${idx} OR v.descripcion ILIKE $${idx} OR e.nombre_legal ILIKE $${idx})`
        );
    }

    const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const paramsPaginacion = [...valores, limite, offset];
    const idxLimite = valores.length + 1;
    const idxOffset = valores.length + 2;

    const [vacantesRes, totalRes] = await Promise.all([
        pool.query(
            `SELECT
                v.id,
                v.empresa_id,
                e.nombre_legal AS empresa_nombre,
                e.estado_verificacion AS empresa_estado_verificacion,
                v.categoria_id,
                c.nombre AS categoria,
                v.titulo,
                v.ubicacion,
                v.modalidad,
                v.tipo_contrato,
                v.nivel_experiencia,
                v.salario_min,
                v.salario_max,
                v.correo_contacto,
                v.estado,
                v.fecha_publicacion,
                v.fecha_cierre,
                v.fecha_creacion,
                (
                    SELECT COUNT(DISTINCT rc.reportado_por)::int
                    FROM reportes_contenido rc
                    WHERE rc.vacante_id = v.id AND rc.estado = 'abierto'
                ) AS reportes_abiertos
            FROM vacantes v
            JOIN empresas e ON e.id = v.empresa_id
            LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
            ${whereSql}
            ORDER BY v.fecha_creacion DESC, v.id DESC
            LIMIT $${idxLimite} OFFSET $${idxOffset}`,
            paramsPaginacion
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
            FROM vacantes v
            JOIN empresas e ON e.id = v.empresa_id
            LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
            ${whereSql}`,
            valores
        )
    ]);

    const total = Number(totalRes.rows[0]?.total ?? 0);
    const data = vacantesRes.rows.map((row) => ({
        ...row,
        salario_min: serializarNumeroOpcional(row.salario_min),
        salario_max: serializarNumeroOpcional(row.salario_max),
        reportes_abiertos: Number(row.reportes_abiertos ?? 0)
    }));

    return {
        data,
        meta: {
            pagina,
            limite,
            total,
            paginas: total === 0 ? 0 : Math.ceil(total / limite)
        }
    };
};

//aprobar/publicar, ocultar, rechazar o cerrar una vacante desde administración (Q15, D04, D12, T06/T10/T17)
export const actualizarEstadoVacanteAdmin = async (adminId, vacanteIdParam, datos = {}) => {
    const vacanteId = validarIdPositivo(vacanteIdParam, 'vacante');
    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};

    if (typeof cuerpo.estado !== 'string') {
        throw crearError('estado de vacante inválido', 400);
    }
    const nuevoEstado = cuerpo.estado.trim();
    if (!['borrador', 'pendiente', 'publicada', 'oculta', 'rechazada', 'cerrada'].includes(nuevoEstado)) {
        throw crearError('estado de vacante inválido', 400);
    }

    if (cuerpo.motivo !== undefined && cuerpo.motivo !== null && typeof cuerpo.motivo !== 'string') {
        throw crearError('motivo debe ser texto válido', 400);
    }
    const motivoLimpio = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : '';
    if (['rechazada', 'oculta'].includes(nuevoEstado) && motivoLimpio.length < 5) {
        throw crearError('motivo es obligatorio y debe tener al menos 5 caracteres para rechazar u ocultar', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: vacantes } = await client.query(
            `SELECT
                v.id,
                v.empresa_id,
                v.categoria_id,
                v.titulo,
                v.ubicacion,
                v.modalidad,
                v.tipo_contrato,
                v.nivel_experiencia,
                v.salario_min,
                v.salario_max,
                v.descripcion,
                v.responsabilidades,
                v.requisitos,
                v.beneficios,
                v.correo_contacto,
                v.estado,
                v.fecha_publicacion,
                v.fecha_cierre,
                v.fecha_creacion,
                e.usuario_id AS empleador_usuario_id,
                e.nombre_legal AS empresa_nombre,
                e.estado_verificacion AS empresa_estado_verificacion,
                (v.fecha_cierre IS NOT NULL AND v.fecha_cierre < (now() AT TIME ZONE 'America/El_Salvador')::date) AS fecha_cierre_vencida
            FROM vacantes v
            JOIN empresas e ON e.id = v.empresa_id
            WHERE v.id = $1
            FOR UPDATE OF v`,
            [vacanteId]
        );

        if (vacantes.length === 0) {
            throw crearError('vacante no encontrada', 404);
        }

        const vacanteActual = vacantes[0];
        if (vacanteActual.estado === nuevoEstado) {
            await client.query('COMMIT');
            return serializarVacanteAdmin(vacanteActual);
        }

        const permitidos = TRANSICIONES_VACANTE_ADMIN[vacanteActual.estado] || [];
        if (!permitidos.includes(nuevoEstado)) {
            throw crearError('transición de estado de vacante no permitida', 409);
        }

        if (nuevoEstado === 'publicada') {
            if (vacanteActual.empresa_estado_verificacion !== 'aprobada') {
                throw crearError('no se puede publicar la vacante porque la empresa no está aprobada', 422);
            }

            const camposRequeridos = [
                vacanteActual.titulo,
                vacanteActual.ubicacion,
                vacanteActual.descripcion,
                vacanteActual.requisitos,
                vacanteActual.correo_contacto
            ];
            const faltanRequeridos = camposRequeridos.some((campo) => typeof campo !== 'string' || campo.trim() === '');
            const salarioMin = serializarNumeroOpcional(vacanteActual.salario_min);
            const salarioMax = serializarNumeroOpcional(vacanteActual.salario_max);
            const salarioInvalido = (
                (salarioMin !== null && (!Number.isFinite(salarioMin) || salarioMin < 0))
                || (salarioMax !== null && (!Number.isFinite(salarioMax) || salarioMax < 0))
                || (salarioMin !== null && salarioMax !== null && salarioMin > salarioMax)
            );

            if (faltanRequeridos || salarioInvalido) {
                throw crearError('la vacante no cumple con los campos obligatorios para publicarse', 422);
            }

            const hoySv = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date());
            const fechaCierreStr = vacanteActual.fecha_cierre instanceof Date
                ? vacanteActual.fecha_cierre.toISOString().slice(0, 10)
                : (vacanteActual.fecha_cierre ? String(vacanteActual.fecha_cierre).slice(0, 10) : null);
            const fechaVencida = Boolean(vacanteActual.fecha_cierre_vencida) || (fechaCierreStr !== null && fechaCierreStr < hoySv);

            if (fechaVencida) {
                throw crearError('no se puede publicar una vacante con fecha de cierre vencida', 422);
            }
        }

        const { rows: actualizadas } = await client.query(
            `UPDATE vacantes
            SET estado = $1,
                fecha_publicacion = CASE
                    WHEN $2::boolean THEN COALESCE(fecha_publicacion, current_timestamp)
                    ELSE fecha_publicacion
                END
            WHERE id = $3
            RETURNING
                id,
                empresa_id,
                categoria_id,
                titulo,
                ubicacion,
                modalidad,
                tipo_contrato,
                nivel_experiencia,
                salario_min,
                salario_max,
                descripcion,
                responsabilidades,
                requisitos,
                beneficios,
                correo_contacto,
                estado,
                fecha_publicacion,
                fecha_cierre,
                fecha_creacion`,
            [nuevoEstado, nuevoEstado === 'publicada', vacanteActual.id]
        );

        const mensajeNotificacion = motivoLimpio
            ? `El estado de tu vacante "${vacanteActual.titulo}" cambió a ${nuevoEstado}: ${motivoLimpio}`
            : `El estado de tu vacante "${vacanteActual.titulo}" cambió a ${nuevoEstado}`;

        await client.query(
            `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
            VALUES ($1, $2, $3, $4)`,
            [vacanteActual.empleador_usuario_id, 'Actualización de estado de vacante', mensajeNotificacion, 'vacante']
        );

        const detalleBitacora = motivoLimpio
            ? `Estado de vacante cambiado de ${vacanteActual.estado} a ${nuevoEstado}: ${motivoLimpio}`
            : `Estado de vacante cambiado de ${vacanteActual.estado} a ${nuevoEstado}`;

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [adminId, 'actualizar_estado_vacante', 'vacante', vacanteActual.id, detalleBitacora]
        );

        await client.query('COMMIT');
        return serializarVacanteAdmin(actualizadas[0]);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//validar nombre obligatorio y longitud máxima para categorías de empleo
const validarNombreCategoriaEmpleo = (datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    if (typeof cuerpo.nombre !== 'string') {
        throw crearError('el nombre de la categoría es obligatorio y no debe superar 100 caracteres', 400);
    }
    const nombreLimpio = cuerpo.nombre.trim();
    if (!nombreLimpio || nombreLimpio.length > 100) {
        throw crearError('el nombre de la categoría es obligatorio y no debe superar 100 caracteres', 400);
    }
    return nombreLimpio;
};

//listar categorías de empleo ordenadas alfabéticamente para el panel administrativo (Q05, Q15, D12)
export const listarCategoriasEmpleoAdmin = async () => {
    const { rows } = await pool.query(
        'SELECT id, nombre FROM categorias_empleo ORDER BY nombre ASC, id ASC'
    );
    return rows;
};

//crear una nueva categoría de empleo evitando duplicados sin distinguir mayúsculas y registrando bitácora (Q05, Q15, D12)
export const crearCategoriaEmpleoAdmin = async (adminId, datos = {}) => {
    const nombreLimpio = validarNombreCategoriaEmpleo(datos);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: existentes } = await client.query(
            'SELECT id FROM categorias_empleo WHERE LOWER(BTRIM(nombre)) = LOWER($1) LIMIT 1',
            [nombreLimpio]
        );
        if (existentes.length > 0) {
            throw crearError('ya existe una categoría de empleo con ese nombre', 409);
        }

        const { rows: creadas } = await client.query(
            'INSERT INTO categorias_empleo (nombre) VALUES ($1) RETURNING id, nombre',
            [nombreLimpio]
        );
        const creada = creadas[0];

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [adminId, 'crear_categoria_empleo', 'categoria_empleo', creada.id, `Categoría de empleo creada: ${creada.nombre}`]
        );

        await client.query('COMMIT');
        return creada;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            throw crearError('ya existe una categoría de empleo con ese nombre', 409);
        }
        throw error;
    } finally {
        client.release();
    }
};

//renombrar una categoría de empleo existente validando unicidad sin distinguir mayúsculas y registrando bitácora (Q05, Q15, D12)
export const actualizarCategoriaEmpleoAdmin = async (adminId, categoriaIdParam, datos = {}) => {
    const categoriaId = validarIdPositivo(categoriaIdParam, 'categoría');
    const nombreLimpio = validarNombreCategoriaEmpleo(datos);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: actuales } = await client.query(
            'SELECT id, nombre FROM categorias_empleo WHERE id = $1 FOR UPDATE',
            [categoriaId]
        );
        if (actuales.length === 0) {
            throw crearError('categoría de empleo no encontrada', 404);
        }

        const categoriaActual = actuales[0];
        if (categoriaActual.nombre === nombreLimpio) {
            await client.query('COMMIT');
            return categoriaActual;
        }

        const { rows: duplicadas } = await client.query(
            'SELECT id FROM categorias_empleo WHERE LOWER(BTRIM(nombre)) = LOWER($1) AND id <> $2 LIMIT 1',
            [nombreLimpio, categoriaId]
        );
        if (duplicadas.length > 0) {
            throw crearError('ya existe una categoría de empleo con ese nombre', 409);
        }

        const { rows: actualizadas } = await client.query(
            'UPDATE categorias_empleo SET nombre = $1 WHERE id = $2 RETURNING id, nombre',
            [nombreLimpio, categoriaId]
        );
        const actualizada = actualizadas[0];

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [
                adminId,
                'actualizar_categoria_empleo',
                'categoria_empleo',
                categoriaActual.id,
                `Categoría de empleo actualizada de "${categoriaActual.nombre}" a "${actualizada.nombre}"`
            ]
        );

        await client.query('COMMIT');
        return actualizada;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            throw crearError('ya existe una categoría de empleo con ese nombre', 409);
        }
        throw error;
    } finally {
        client.release();
    }
};

//validar y normalizar rango opcional de fechas ISO (YYYY-MM-DD incluye el día completo en hasta)
const parsearRangoFechasIso = (query = {}, aplicarDefectoMesActual = false) => {
    let desdeIso = null;
    let desdeComparacionMs = null;

    if (query.desde !== undefined && query.desde !== null && String(query.desde).trim() !== '') {
        const rawDesde = String(query.desde).trim();
        const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(rawDesde);
        const fecha = new Date(esSoloFecha ? `${rawDesde}T00:00:00.000Z` : rawDesde);
        if (Number.isNaN(fecha.getTime()) || (esSoloFecha && fecha.toISOString().slice(0, 10) !== rawDesde)) {
            throw crearError('parámetro desde inválido; use formato ISO', 400);
        }
        desdeIso = fecha.toISOString();
        desdeComparacionMs = fecha.getTime();
    }

    let hastaExclusivaIso = null;
    let hastaComparacionMs = null;

    if (query.hasta !== undefined && query.hasta !== null && String(query.hasta).trim() !== '') {
        const rawHasta = String(query.hasta).trim();
        const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(rawHasta);
        const fecha = new Date(esSoloFecha ? `${rawHasta}T00:00:00.000Z` : rawHasta);
        if (Number.isNaN(fecha.getTime()) || (esSoloFecha && fecha.toISOString().slice(0, 10) !== rawHasta)) {
            throw crearError('parámetro hasta inválido; use formato ISO', 400);
        }
        hastaComparacionMs = fecha.getTime();
        hastaExclusivaIso = esSoloFecha
            ? new Date(hastaComparacionMs + 86400000).toISOString()
            : fecha.toISOString();
    }

    if (desdeComparacionMs !== null && hastaComparacionMs !== null && desdeComparacionMs > hastaComparacionMs) {
        throw crearError('rango de fechas inválido: desde no puede ser mayor que hasta', 400);
    }

    if (aplicarDefectoMesActual) {
        const ahora = new Date();
        if (desdeIso === null) {
            const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
            desdeIso = inicioMes.toISOString();
        }
        if (hastaExclusivaIso === null) {
            hastaExclusivaIso = new Date(ahora.getTime() + 1000).toISOString();
        }
        if (new Date(desdeIso).getTime() > new Date(hastaExclusivaIso).getTime()) {
            throw crearError('rango de fechas inválido: desde no puede ser mayor que hasta', 400);
        }
    }

    return {
        desdeIso,
        hastaExclusivaIso
    };
};

//eliminar una categoría de empleo evitando borrar si tiene referencias en vacantes o alertas (Q15, D12, T16)
export const eliminarCategoriaEmpleoAdmin = async (adminId, categoriaIdParam) => {
    const categoriaId = validarIdPositivo(categoriaIdParam, 'categoría');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: actuales } = await client.query(
            'SELECT id, nombre FROM categorias_empleo WHERE id = $1 FOR UPDATE',
            [categoriaId]
        );
        if (actuales.length === 0) {
            throw crearError('categoría de empleo no encontrada', 404);
        }
        const categoriaActual = actuales[0];

        const { rows: usoRows } = await client.query(
            `SELECT
                EXISTS (SELECT 1 FROM vacantes WHERE categoria_id = $1)
                OR EXISTS (SELECT 1 FROM alertas_empleo WHERE categoria_id = $1) AS en_uso`,
            [categoriaId]
        );
        if (usoRows[0]?.en_uso) {
            throw crearError('no se puede eliminar la categoría porque tiene registros asociados', 409);
        }

        await client.query('DELETE FROM categorias_empleo WHERE id = $1', [categoriaId]);

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [adminId, 'eliminar_categoria_empleo', 'categoria_empleo', categoriaActual.id, `Categoría de empleo eliminada: ${categoriaActual.nombre}`]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23503') {
            throw crearError('no se puede eliminar la categoría porque tiene registros asociados', 409);
        }
        throw error;
    } finally {
        client.release();
    }
};

//obtener estadísticas de negocio por vacantes, postulaciones y categorías aplicando rango de fechas (Q16, D12, T22)
export const obtenerEstadisticasAdmin = async (query = {}) => {
    const { desdeIso, hastaExclusivaIso } = parsearRangoFechasIso(query, true);

    const [vacEstadoRes, postMesRes, postEstadoRes, postCategoriaRes] = await Promise.all([
        pool.query(
            `SELECT estado, COUNT(*)::int AS total
            FROM vacantes
            GROUP BY estado
            ORDER BY estado`
        ),
        pool.query(
            `SELECT
                to_char(date_trunc('month', fecha_postulacion), 'YYYY-MM-DD') AS mes,
                COUNT(*)::int AS total
            FROM postulaciones
            WHERE fecha_postulacion >= $1::timestamp
                AND fecha_postulacion < $2::timestamp
            GROUP BY date_trunc('month', fecha_postulacion)
            ORDER BY date_trunc('month', fecha_postulacion)`,
            [desdeIso, hastaExclusivaIso]
        ),
        pool.query(
            `SELECT estado, COUNT(*)::int AS total
            FROM postulaciones
            WHERE fecha_postulacion >= $1::timestamp
                AND fecha_postulacion < $2::timestamp
            GROUP BY estado
            ORDER BY estado`,
            [desdeIso, hastaExclusivaIso]
        ),
        pool.query(
            `SELECT
                c.id,
                COALESCE(c.nombre, 'Sin categoría') AS nombre,
                COUNT(p.id)::int AS total
            FROM postulaciones p
            JOIN vacantes v ON v.id = p.vacante_id
            LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
            WHERE p.fecha_postulacion >= $1::timestamp
                AND p.fecha_postulacion < $2::timestamp
            GROUP BY c.id, c.nombre
            ORDER BY total DESC, nombre ASC`,
            [desdeIso, hastaExclusivaIso]
        )
    ]);

    const vacantesPorEstado = vacEstadoRes.rows.map((r) => ({
        estado: r.estado,
        total: Number(r.total ?? 0)
    }));

    const resumenVacantes = {
        total: 0,
        borrador: 0,
        pendiente: 0,
        publicada: 0,
        oculta: 0,
        rechazada: 0,
        cerrada: 0
    };
    for (const fila of vacantesPorEstado) {
        if (Object.hasOwn(resumenVacantes, fila.estado)) {
            resumenVacantes[fila.estado] = fila.total;
        }
        resumenVacantes.total += fila.total;
    }

    const postulacionesPorEstado = postEstadoRes.rows.map((r) => ({
        estado: r.estado,
        total: Number(r.total ?? 0)
    }));

    const resumenPostulaciones = {
        total: 0,
        nueva: 0,
        en_proceso: 0,
        contratado: 0,
        rechazado: 0
    };
    for (const fila of postulacionesPorEstado) {
        if (Object.hasOwn(resumenPostulaciones, fila.estado)) {
            resumenPostulaciones[fila.estado] = fila.total;
        }
        resumenPostulaciones.total += fila.total;
    }

    const postulacionesPorMes = postMesRes.rows.map((r) => ({
        mes: r.mes,
        total: Number(r.total ?? 0)
    }));

    const postulacionesPorCategoria = postCategoriaRes.rows.map((r) => ({
        id: r.id === null || r.id === undefined ? null : Number(r.id),
        nombre: r.nombre,
        total: Number(r.total ?? 0)
    }));

    return {
        rango: {
            desde: desdeIso,
            hasta: hastaExclusivaIso
        },
        vacantes_por_estado: vacantesPorEstado,
        resumen_vacantes: resumenVacantes,
        postulaciones_por_mes: postulacionesPorMes,
        postulaciones_por_estado: postulacionesPorEstado,
        resumen_postulaciones: resumenPostulaciones,
        postulaciones_por_categoria: postulacionesPorCategoria
    };
};

//listar eventos de bitácora ordenados cronológicamente con filtros y paginación (Q16, D12, T04/T20)
export const listarBitacoraAdmin = async (query = {}) => {
    const { pagina, limite, offset } = normalizarPaginacion(query);
    const condiciones = [];
    const valores = [];

    if (query.usuario_id !== undefined && query.usuario_id !== null && String(query.usuario_id).trim() !== '') {
        const usuarioId = validarIdPositivo(query.usuario_id, 'usuario');
        valores.push(usuarioId);
        condiciones.push(`b.usuario_id = $${valores.length}`);
    }

    if (query.entidad !== undefined && query.entidad !== null && String(query.entidad).trim() !== '') {
        const entidad = String(query.entidad).trim();
        valores.push(entidad);
        condiciones.push(`b.entidad = $${valores.length}`);
    }

    const { desdeIso, hastaExclusivaIso } = parsearRangoFechasIso(query, false);
    if (desdeIso !== null) {
        valores.push(desdeIso);
        condiciones.push(`b.fecha >= $${valores.length}::timestamp`);
    }
    if (hastaExclusivaIso !== null) {
        valores.push(hastaExclusivaIso);
        condiciones.push(`b.fecha < $${valores.length}::timestamp`);
    }

    const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const paramsPaginacion = [...valores, limite, offset];
    const idxLimite = valores.length + 1;
    const idxOffset = valores.length + 2;

    const [bitacoraRes, totalRes] = await Promise.all([
        pool.query(
            `SELECT
                b.id,
                b.usuario_id,
                u.nombres AS usuario_nombres,
                u.apellidos AS usuario_apellidos,
                u.correo AS usuario_correo,
                b.accion,
                b.entidad,
                b.entidad_id,
                b.detalle,
                b.fecha
            FROM bitacora b
            LEFT JOIN usuarios u ON u.id = b.usuario_id
            ${whereSql}
            ORDER BY b.fecha DESC, b.id DESC
            LIMIT $${idxLimite} OFFSET $${idxOffset}`,
            paramsPaginacion
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total
            FROM bitacora b
            ${whereSql}`,
            valores
        )
    ]);

    const total = Number(totalRes.rows[0]?.total ?? 0);

    return {
        data: bitacoraRes.rows,
        meta: {
            pagina,
            limite,
            total,
            paginas: total === 0 ? 0 : Math.ceil(total / limite)
        }
    };
};
