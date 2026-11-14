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
