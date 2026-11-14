import { pool } from '../db.js';

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

//validar texto opcional convirtiendo vacíos a null
const validarTextoOpcional = (valor, campo, max = null) => {
    if (valor === undefined || valor === null) {
        return null;
    }
    if (typeof valor !== 'string') {
        throw crearError(`${campo} debe ser texto válido`, 400);
    }
    const limpio = valor.trim();
    if (!limpio) {
        return null;
    }
    if (max !== null && limpio.length > max) {
        throw crearError(`${campo} no puede exceder ${max} caracteres`, 400);
    }
    return limpio;
};

//validar correo obligatorio normalizado a minúsculas
const validarCorreoRequerido = (valor, campo = 'correo_contacto', max = 150) => {
    const correo = validarTextoRequerido(valor, campo, max).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(correo)) {
        throw crearError(`${campo} tiene formato inválido`, 400);
    }
    return correo;
};

//obtener los datos completos de la empresa asociada al empleador autenticado
export const obtenerEmpresaEmpleador = async (usuarioId) => {
    const { rows } = await pool.query(
        `SELECT
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
            fecha_registro
        FROM empresas
        WHERE usuario_id = $1
        LIMIT 1`,
        [usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('empresa no encontrada para este empleador', 404);
    }

    return rows[0];
};

//registrar la empresa del empleador autenticado en estado pendiente
export const crearEmpresaEmpleador = async (usuarioId, datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};

    const nombreLegal = validarTextoRequerido(cuerpo.nombre_legal, 'nombre_legal', 150);
    const correoContacto = validarCorreoRequerido(cuerpo.correo_contacto, 'correo_contacto', 150);
    const nit = validarTextoOpcional(cuerpo.nit, 'nit', 30);
    const descripcion = validarTextoOpcional(cuerpo.descripcion, 'descripcion');
    const sitioWeb = validarTextoOpcional(cuerpo.sitio_web, 'sitio_web', 255);
    const telefonoContacto = validarTextoOpcional(cuerpo.telefono_contacto, 'telefono_contacto', 20);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let empresa;
        try {
            const { rows } = await client.query(
                `INSERT INTO empresas (
                    usuario_id,
                    nombre_legal,
                    nit,
                    descripcion,
                    sitio_web,
                    correo_contacto,
                    telefono_contacto,
                    estado_verificacion
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
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
                [usuarioId, nombreLegal, nit, descripcion, sitioWeb, correoContacto, telefonoContacto]
            );
            empresa = rows[0];
        } catch (error) {
            if (error.code === '23505') {
                throw crearError('el empleador ya tiene una empresa registrada', 409);
            }
            throw error;
        }

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [usuarioId, 'crear_empresa', 'empresa', empresa.id, 'Registro inicial de empresa en estado pendiente']
        );

        await client.query('COMMIT');
        return empresa;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
