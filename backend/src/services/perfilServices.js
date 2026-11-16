import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_BACKEND = path.resolve(__dirname, '..', '..');

//eliminar archivo local sin interrumpir el flujo si falla
const eliminarArchivoSeguro = async (rutaArchivo) => {
    try {
        await fs.unlink(rutaArchivo);
    } catch {
        //ignorar error de limpieza posterior
    }
};

//crear error controlado con código HTTP
const crearError = (mensaje, statusCode) => {
    const error = new Error(mensaje);
    error.statusCode = statusCode;
    return error;
};

//validar texto obligatorio con longitud máxima
const validarTextoRequerido = (valor, campo, max) => {
    if (typeof valor !== 'string') {
        throw crearError(`${campo} debe ser texto válido`, 400);
    }
    const limpio = valor.trim();
    if (!limpio) {
        throw crearError(`${campo} no puede estar vacío`, 400);
    }
    if (limpio.length > max) {
        throw crearError(`${campo} no puede exceder ${max} caracteres`, 400);
    }
    return limpio;
};

//obtener datos de perfil del candidato autenticado
export const obtenerPerfilCandidato = async (usuarioId) => {
    const { rows } = await pool.query(
        `SELECT id, nombres, apellidos, correo, telefono, ruta_cv, recibe_email, recibe_sms
        FROM usuarios
        WHERE id = $1
        LIMIT 1`,
        [usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('perfil no encontrado', 404);
    }

    return rows[0];
};

//actualizar datos parciales del perfil del candidato autenticado
export const actualizarPerfilCandidato = async (usuarioId, datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' ? datos : {};
    const camposPermitidos = ['nombres', 'apellidos', 'telefono', 'recibe_email', 'recibe_sms'];
    const tieneCampos = camposPermitidos.some((campo) => cuerpo[campo] !== undefined);

    if (!tieneCampos) {
        throw crearError('debe enviar al menos un campo para actualizar', 400);
    }

    const perfilActual = await obtenerPerfilCandidato(usuarioId);

    const nombres = cuerpo.nombres !== undefined
        ? validarTextoRequerido(cuerpo.nombres, 'nombres', 100)
        : perfilActual.nombres;

    const apellidos = cuerpo.apellidos !== undefined
        ? validarTextoRequerido(cuerpo.apellidos, 'apellidos', 100)
        : perfilActual.apellidos;

    let telefono = perfilActual.telefono;
    if (cuerpo.telefono !== undefined) {
        if (cuerpo.telefono === null) {
            telefono = null;
        } else if (typeof cuerpo.telefono !== 'string') {
            throw crearError('telefono debe ser texto válido', 400);
        } else {
            const limpio = cuerpo.telefono.trim();
            if (limpio.length > 20) {
                throw crearError('telefono no puede exceder 20 caracteres', 400);
            }
            if (limpio && !/^[0-9]{4}-?[0-9]{4}$/.test(limpio)) {
                throw crearError('telefono debe tener 8 dígitos en formato 0000-0000', 400);
            }
            telefono = limpio === '' ? null : limpio;
        }
    }

    let recibeEmail = perfilActual.recibe_email;
    if (cuerpo.recibe_email !== undefined) {
        if (typeof cuerpo.recibe_email !== 'boolean') {
            throw crearError('recibe_email debe ser booleano', 400);
        }
        recibeEmail = cuerpo.recibe_email;
    }

    let recibeSms = perfilActual.recibe_sms;
    if (cuerpo.recibe_sms !== undefined) {
        if (typeof cuerpo.recibe_sms !== 'boolean') {
            throw crearError('recibe_sms debe ser booleano', 400);
        }
        recibeSms = cuerpo.recibe_sms;
    }

    const { rows } = await pool.query(
        `UPDATE usuarios
        SET nombres = $1,
            apellidos = $2,
            telefono = $3,
            recibe_email = $4,
            recibe_sms = $5
        WHERE id = $6
        RETURNING id, nombres, apellidos, correo, telefono, ruta_cv, recibe_email, recibe_sms`,
        [nombres, apellidos, telefono, recibeEmail, recibeSms, usuarioId]
    );

    return rows[0];
};

//actualizar ruta del cv del candidato y limpiar archivo previo sin referencias
export const actualizarCvCandidato = async (usuarioId, archivoSubido) => {
    if (!archivoSubido) {
        throw crearError('debe adjuntar un archivo de cv', 400);
    }

    let rutaAnterior = null;

    try {
        const { rows: actuales } = await pool.query(
            'SELECT id, ruta_cv FROM usuarios WHERE id = $1 LIMIT 1',
            [usuarioId]
        );

        if (actuales.length === 0) {
            throw crearError('perfil no encontrado', 404);
        }

        rutaAnterior = actuales[0].ruta_cv;

        const { rows } = await pool.query(
            `UPDATE usuarios
            SET ruta_cv = $1
            WHERE id = $2
            RETURNING id, ruta_cv`,
            [archivoSubido.rutaRelativa, usuarioId]
        );

        if (rutaAnterior && rutaAnterior !== archivoSubido.rutaRelativa) {
            const { rows: enUso } = await pool.query(
                'SELECT 1 FROM postulaciones WHERE ruta_cv = $1 LIMIT 1',
                [rutaAnterior]
            );

            if (enUso.length === 0) {
                const rutaAbsolutaAnterior = path.resolve(ROOT_BACKEND, rutaAnterior);
                if (rutaAbsolutaAnterior.startsWith(ROOT_BACKEND + path.sep)) {
                    await eliminarArchivoSeguro(rutaAbsolutaAnterior);
                }
            }
        }

        return {
            id: rows[0].id,
            ruta_cv: rows[0].ruta_cv,
            nombre_archivo: archivoSubido.nombreOriginal
        };
    } catch (error) {
        await eliminarArchivoSeguro(archivoSubido.rutaAbsoluta);
        throw error;
    }
};

//obtener y validar la ruta física del cv actual del candidato
export const obtenerArchivoCvCandidato = async (usuarioId) => {
    const { rows } = await pool.query(
        'SELECT id, ruta_cv FROM usuarios WHERE id = $1 LIMIT 1',
        [usuarioId]
    );

    if (rows.length === 0 || !rows[0].ruta_cv) {
        throw crearError('no tienes un cv registrado', 404);
    }

    const rutaAbsoluta = path.resolve(ROOT_BACKEND, rows[0].ruta_cv);
    if (!rutaAbsoluta.startsWith(ROOT_BACKEND + path.sep)) {
        throw crearError('el archivo de cv no se encuentra disponible', 404);
    }

    try {
        await fs.access(rutaAbsoluta);
    } catch {
        throw crearError('el archivo de cv no se encuentra disponible', 404);
    }

    return {
        rutaAbsoluta,
        nombreArchivo: path.basename(rutaAbsoluta)
    };
};

//crear postulación a una vacante pública vigente dentro de una transacción
export const crearPostulacionCandidato = async (usuarioId, datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' ? datos : {};
    const vacanteId = Number(cuerpo.vacante_id);
    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
        throw crearError('vacante_id inválido', 400);
    }

    let cartaPresentacion = null;
    if (cuerpo.carta_presentacion !== undefined && cuerpo.carta_presentacion !== null) {
        if (typeof cuerpo.carta_presentacion !== 'string') {
            throw crearError('carta_presentacion debe ser texto válido', 400);
        }
        const limpia = cuerpo.carta_presentacion.trim();
        cartaPresentacion = limpia === '' ? null : limpia;
    }

    const { rows: candidatos } = await pool.query(
        'SELECT id, nombres, apellidos, correo, ruta_cv FROM usuarios WHERE id = $1 LIMIT 1',
        [usuarioId]
    );

    if (candidatos.length === 0) {
        throw crearError('perfil no encontrado', 404);
    }

    const candidato = candidatos[0];
    if (!candidato.ruta_cv) {
        throw crearError('debes subir tu cv antes de postular a una vacante', 422);
    }

    const rutaCvAbsoluta = path.resolve(ROOT_BACKEND, candidato.ruta_cv);
    if (!rutaCvAbsoluta.startsWith(ROOT_BACKEND + path.sep)) {
        throw crearError('debes subir tu cv antes de postular a una vacante', 422);
    }

    try {
        await fs.access(rutaCvAbsoluta);
    } catch {
        throw crearError('debes subir tu cv antes de postular a una vacante', 422);
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: vacantes } = await client.query(
            `SELECT v.id, v.titulo, v.estado,
                    e.id AS empresa_id, e.usuario_id AS empleador_usuario_id,
                    e.nombre_legal, e.estado_verificacion
            FROM vacantes v
            JOIN empresas e ON e.id = v.empresa_id
            WHERE v.id = $1
                AND v.estado = 'publicada'
                AND e.estado_verificacion = 'aprobada'
                AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
            FOR SHARE OF v, e`,
            [vacanteId]
        );

        if (vacantes.length === 0) {
            throw crearError('la vacante no existe o no está disponible para postular', 404);
        }

        const vacante = vacantes[0];

        let postulacion;
        try {
            const { rows: insertadas } = await client.query(
                `INSERT INTO postulaciones (vacante_id, candidato_id, ruta_cv, carta_presentacion)
                VALUES ($1, $2, $3, $4)
                RETURNING id, vacante_id, candidato_id, estado, fecha_postulacion`,
                [vacante.id, usuarioId, candidato.ruta_cv, cartaPresentacion]
            );
            postulacion = insertadas[0];
        } catch (error) {
            if (error.code === '23505') {
                throw crearError('ya te has postulado a esta vacante', 409);
            }
            throw error;
        }

        await client.query(
            `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
            VALUES ($1, $2, $3, $4)`,
            [
                vacante.empleador_usuario_id,
                'Nueva postulación recibida',
                `${candidato.nombres} ${candidato.apellidos} se postuló a la vacante ${vacante.titulo}.`,
                'nueva_postulacion'
            ]
        );

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [
                usuarioId,
                'Postulación enviada',
                'postulacion',
                postulacion.id,
                `Postulación a vacante ${vacante.id} (${vacante.titulo})`
            ]
        );

        await client.query('COMMIT');

        return {
            ...postulacion,
            titulo: vacante.titulo,
            nombre_legal: vacante.nombre_legal
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//listar postulaciones propias del candidato con filtro por estado y paginación
export const listarPostulacionesCandidato = async (usuarioId, query = {}) => {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limiteRaw = parseInt(query.limite, 10);
    const limite = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));
    const offset = (pagina - 1) * limite;

    const estadosValidos = ['nueva', 'en_proceso', 'contratado', 'rechazado'];
    let estado = null;
    if (query.estado !== undefined && query.estado !== null && String(query.estado).trim() !== '') {
        estado = String(query.estado).trim();
        if (!estadosValidos.includes(estado)) {
            throw crearError('estado de postulación inválido', 400);
        }
    }

    const dataPromise = pool.query(
        `SELECT p.id, p.vacante_id, p.fecha_postulacion, p.estado,
                v.titulo, v.estado AS estado_vacante, v.ubicacion, v.modalidad,
                e.nombre_legal
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        JOIN empresas e ON e.id = v.empresa_id
        WHERE p.candidato_id = $1
            AND ($2::text IS NULL OR p.estado = $2)
        ORDER BY p.fecha_postulacion DESC, p.id DESC
        LIMIT $3 OFFSET $4`,
        [usuarioId, estado, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM postulaciones p
        WHERE p.candidato_id = $1
            AND ($2::text IS NULL OR p.estado = $2)`,
        [usuarioId, estado]
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = countResult.rows[0].total;

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

//listar vacantes guardadas por el candidato indicando disponibilidad
export const listarGuardadosCandidato = async (usuarioId, query = {}) => {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limiteRaw = parseInt(query.limite, 10);
    const limite = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));
    const offset = (pagina - 1) * limite;

    const dataPromise = pool.query(
        `SELECT vg.vacante_id, vg.fecha_guardado, v.titulo, v.ubicacion, v.modalidad,
                e.nombre_legal,
                (v.estado = 'publicada'
                    AND e.estado_verificacion = 'aprobada'
                    AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)) AS disponible
        FROM vacantes_guardadas vg
        JOIN vacantes v ON v.id = vg.vacante_id
        JOIN empresas e ON e.id = v.empresa_id
        WHERE vg.candidato_id = $1
        ORDER BY vg.fecha_guardado DESC, vg.vacante_id DESC
        LIMIT $2 OFFSET $3`,
        [usuarioId, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM vacantes_guardadas
        WHERE candidato_id = $1`,
        [usuarioId]
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = countResult.rows[0].total;

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

//guardar una vacante pública en favoritos del candidato
export const guardarVacanteCandidato = async (usuarioId, datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' ? datos : {};
    const vacanteId = Number(cuerpo.vacante_id);
    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
        throw crearError('vacante_id inválido', 400);
    }

    const { rows: vacantes } = await pool.query(
        `SELECT v.id, v.titulo, e.nombre_legal
        FROM vacantes v
        JOIN empresas e ON e.id = v.empresa_id
        WHERE v.id = $1
            AND v.estado = 'publicada'
            AND e.estado_verificacion = 'aprobada'
            AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
        LIMIT 1`,
        [vacanteId]
    );

    if (vacantes.length === 0) {
        throw crearError('la vacante no existe o no está disponible', 404);
    }

    const vacante = vacantes[0];

    try {
        const { rows } = await pool.query(
            `INSERT INTO vacantes_guardadas (candidato_id, vacante_id)
            VALUES ($1, $2)
            RETURNING candidato_id, vacante_id, fecha_guardado`,
            [usuarioId, vacante.id]
        );

        return {
            ...rows[0],
            titulo: vacante.titulo,
            nombre_legal: vacante.nombre_legal
        };
    } catch (error) {
        if (error.code === '23505') {
            throw crearError('la vacante ya se encuentra guardada', 409);
        }
        throw error;
    }
};

//quitar una vacante de los guardados propios del candidato
export const eliminarVacanteGuardadaCandidato = async (usuarioId, vacanteIdParam) => {
    const vacanteId = Number(vacanteIdParam);
    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
        throw crearError('vacanteId inválido', 400);
    }

    const { rows } = await pool.query(
        `DELETE FROM vacantes_guardadas
        WHERE candidato_id = $1 AND vacante_id = $2
        RETURNING vacante_id`,
        [usuarioId, vacanteId]
    );

    if (rows.length === 0) {
        throw crearError('la vacante no se encuentra en tus guardados', 404);
    }
};

//listar notificaciones propias del usuario autenticado
export const listarNotificacionesUsuario = async (usuarioId, query = {}) => {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limiteRaw = parseInt(query.limite, 10);
    const limite = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));
    const offset = (pagina - 1) * limite;

    let leida = null;
    if (query.leida !== undefined && query.leida !== null && String(query.leida).trim() !== '') {
        const valor = String(query.leida).trim().toLowerCase();
        if (valor === 'true') {
            leida = true;
        } else if (valor === 'false') {
            leida = false;
        } else {
            throw crearError('parámetro leida inválido, use true o false', 400);
        }
    }

    const dataPromise = pool.query(
        `SELECT id, titulo, mensaje, tipo, leida, fecha_creacion
        FROM notificaciones
        WHERE usuario_id = $1
            AND ($2::boolean IS NULL OR leida = $2)
        ORDER BY fecha_creacion DESC, id DESC
        LIMIT $3 OFFSET $4`,
        [usuarioId, leida, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM notificaciones
        WHERE usuario_id = $1
            AND ($2::boolean IS NULL OR leida = $2)`,
        [usuarioId, leida]
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = countResult.rows[0].total;

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

//marcar como leída una notificación propia del usuario autenticado
export const marcarNotificacionLeida = async (usuarioId, notificacionIdParam) => {
    const notificacionId = Number(notificacionIdParam);
    if (!Number.isInteger(notificacionId) || notificacionId <= 0) {
        throw crearError('id de notificación inválido', 400);
    }

    const { rows } = await pool.query(
        `UPDATE notificaciones
        SET leida = true
        WHERE id = $1 AND usuario_id = $2
        RETURNING id, titulo, mensaje, tipo, leida, fecha_creacion`,
        [notificacionId, usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('notificación no encontrada', 404);
    }

    return rows[0];
};

//obtener resumen del dashboard para el candidato autenticado
export const obtenerDashboardCandidato = async (usuarioId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

        const { rows: usuariosRows } = await client.query(
            `SELECT id, nombres, apellidos, ruta_cv
            FROM usuarios
            WHERE id = $1
            LIMIT 1`,
            [usuarioId]
        );

        if (usuariosRows.length === 0) {
            throw crearError('perfil no encontrado', 404);
        }

        const usuario = usuariosRows[0];

        const { rows: solicitudesRows } = await client.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE estado = 'nueva')::int AS nueva,
                COUNT(*) FILTER (WHERE estado = 'en_proceso')::int AS en_proceso,
                COUNT(*) FILTER (WHERE estado = 'contratado')::int AS contratado,
                COUNT(*) FILTER (WHERE estado = 'rechazado')::int AS rechazado
            FROM postulaciones
            WHERE candidato_id = $1`,
            [usuarioId]
        );

        const { rows: conteosRows } = await client.query(
            `SELECT
                (SELECT COUNT(*)::int FROM vacantes_guardadas WHERE candidato_id = $1) AS guardados,
                (SELECT COUNT(*)::int FROM alertas_empleo WHERE candidato_id = $1 AND activa = true) AS alertas_activas,
                (SELECT COUNT(*)::int FROM notificaciones WHERE usuario_id = $1 AND leida = false) AS notificaciones_no_leidas`,
            [usuarioId]
        );

        const { rows: ultimasPostulaciones } = await client.query(
            `SELECT
                p.id,
                p.vacante_id,
                v.titulo,
                e.nombre_legal AS empresa,
                p.estado,
                v.estado AS estado_vacante,
                p.fecha_postulacion
            FROM postulaciones p
            INNER JOIN vacantes v ON v.id = p.vacante_id
            INNER JOIN empresas e ON e.id = v.empresa_id
            WHERE p.candidato_id = $1
            ORDER BY p.fecha_postulacion DESC, p.id DESC
            LIMIT 5`,
            [usuarioId]
        );

        await client.query('COMMIT');

        const sol = solicitudesRows[0] || {};
        const cnt = conteosRows[0] || {};

        return {
            usuario: {
                id: usuario.id,
                nombres: usuario.nombres,
                apellidos: usuario.apellidos,
                tiene_cv: Boolean(usuario.ruta_cv)
            },
            solicitudes: {
                total: Number(sol.total ?? 0),
                nueva: Number(sol.nueva ?? 0),
                en_proceso: Number(sol.en_proceso ?? 0),
                contratado: Number(sol.contratado ?? 0),
                rechazado: Number(sol.rechazado ?? 0)
            },
            guardados: Number(cnt.guardados ?? 0),
            alertas_activas: Number(cnt.alertas_activas ?? 0),
            notificaciones_no_leidas: Number(cnt.notificaciones_no_leidas ?? 0),
            ultimas_postulaciones: ultimasPostulaciones
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
