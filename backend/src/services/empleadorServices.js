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

//actualizar datos parciales de la empresa del empleador autenticado
export const actualizarEmpresaEmpleador = async (usuarioId, datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    const camposPermitidos = ['nombre_legal', 'nit', 'descripcion', 'sitio_web', 'correo_contacto', 'telefono_contacto'];
    const tieneCampos = camposPermitidos.some((campo) => cuerpo[campo] !== undefined);

    if (!tieneCampos) {
        throw crearError('debe enviar al menos un campo para actualizar', 400);
    }

    const nuevoNombreLegal = cuerpo.nombre_legal !== undefined
        ? validarTextoRequerido(cuerpo.nombre_legal, 'nombre_legal', 150)
        : undefined;
    const nuevoCorreoContacto = cuerpo.correo_contacto !== undefined
        ? validarCorreoRequerido(cuerpo.correo_contacto, 'correo_contacto', 150)
        : undefined;
    const nuevoNit = cuerpo.nit !== undefined
        ? validarTextoOpcional(cuerpo.nit, 'nit', 30)
        : undefined;
    const nuevaDescripcion = cuerpo.descripcion !== undefined
        ? validarTextoOpcional(cuerpo.descripcion, 'descripcion')
        : undefined;
    const nuevoSitioWeb = cuerpo.sitio_web !== undefined
        ? validarTextoOpcional(cuerpo.sitio_web, 'sitio_web', 255)
        : undefined;
    const nuevoTelefonoContacto = cuerpo.telefono_contacto !== undefined
        ? validarTextoOpcional(cuerpo.telefono_contacto, 'telefono_contacto', 20)
        : undefined;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: actuales } = await client.query(
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
            FOR UPDATE`,
            [usuarioId]
        );

        if (actuales.length === 0) {
            throw crearError('empresa no encontrada para este empleador', 404);
        }

        const empresaActual = actuales[0];

        const nombreLegal = nuevoNombreLegal !== undefined ? nuevoNombreLegal : empresaActual.nombre_legal;
        const nit = nuevoNit !== undefined ? nuevoNit : empresaActual.nit;
        const descripcion = nuevaDescripcion !== undefined ? nuevaDescripcion : empresaActual.descripcion;
        const sitioWeb = nuevoSitioWeb !== undefined ? nuevoSitioWeb : empresaActual.sitio_web;
        const correoContacto = nuevoCorreoContacto !== undefined ? nuevoCorreoContacto : empresaActual.correo_contacto;
        const telefonoContacto = nuevoTelefonoContacto !== undefined ? nuevoTelefonoContacto : empresaActual.telefono_contacto;

        const cambioNombreLegal = nombreLegal !== empresaActual.nombre_legal;
        const nuevoEstadoVerificacion = cambioNombreLegal ? 'pendiente' : empresaActual.estado_verificacion;

        const { rows: actualizadas } = await client.query(
            `UPDATE empresas
            SET nombre_legal = $1,
                nit = $2,
                descripcion = $3,
                sitio_web = $4,
                correo_contacto = $5,
                telefono_contacto = $6,
                estado_verificacion = $7
            WHERE usuario_id = $8
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
            [
                nombreLegal,
                nit,
                descripcion,
                sitioWeb,
                correoContacto,
                telefonoContacto,
                nuevoEstadoVerificacion,
                usuarioId
            ]
        );

        const empresaActualizada = actualizadas[0];
        const detalle = cambioNombreLegal
            ? 'Actualización de empresa con cambio de nombre legal; verificación en estado pendiente'
            : 'Actualización de datos de empresa';

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [usuarioId, 'actualizar_empresa', 'empresa', empresaActualizada.id, detalle]
        );

        await client.query('COMMIT');
        return empresaActualizada;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

const COLUMNAS_ARCHIVO_EMPRESA = {
    ruta_logo: 'ruta_logo',
    ruta_documento_legal: 'ruta_documento_legal'
};

//actualizar un archivo de empresa y eliminar el anterior si fue reemplazado
const actualizarArchivoEmpresa = async ({ usuarioId, archivoSubido, campoColumna, mensajeFaltante }) => {
    if (!archivoSubido) {
        throw crearError(mensajeFaltante, 400);
    }

    const columna = COLUMNAS_ARCHIVO_EMPRESA[campoColumna];
    if (!columna) {
        await eliminarArchivoSeguro(archivoSubido.rutaAbsoluta);
        throw crearError('campo de archivo inválido', 400);
    }

    try {
        const { rows: actuales } = await pool.query(
            `SELECT id, ${columna} FROM empresas WHERE usuario_id = $1 LIMIT 1`,
            [usuarioId]
        );

        if (actuales.length === 0) {
            throw crearError('empresa no encontrada para este empleador', 404);
        }

        const rutaAnterior = actuales[0][columna];

        const { rows } = await pool.query(
            `UPDATE empresas
            SET ${columna} = $1
            WHERE usuario_id = $2
            RETURNING id, ${columna}`,
            [archivoSubido.rutaRelativa, usuarioId]
        );

        if (rutaAnterior && rutaAnterior !== archivoSubido.rutaRelativa) {
            const rutaAbsolutaAnterior = path.resolve(ROOT_BACKEND, rutaAnterior);
            if (rutaAbsolutaAnterior.startsWith(ROOT_BACKEND + path.sep)) {
                await eliminarArchivoSeguro(rutaAbsolutaAnterior);
            }
        }

        return {
            id: rows[0].id,
            [columna]: rows[0][columna],
            nombre_archivo: archivoSubido.nombreOriginal
        };
    } catch (error) {
        await eliminarArchivoSeguro(archivoSubido.rutaAbsoluta);
        throw error;
    }
};

//subir o actualizar el logo de la empresa y eliminar el anterior si existía
export const actualizarLogoEmpresa = (usuarioId, archivoSubido) => {
    return actualizarArchivoEmpresa({
        usuarioId,
        archivoSubido,
        campoColumna: 'ruta_logo',
        mensajeFaltante: 'debe adjuntar un archivo de logo'
    });
};

//subir o actualizar el documento legal de la empresa y eliminar el anterior si existía
export const actualizarDocumentoEmpresa = (usuarioId, archivoSubido) => {
    return actualizarArchivoEmpresa({
        usuarioId,
        archivoSubido,
        campoColumna: 'ruta_documento_legal',
        mensajeFaltante: 'debe adjuntar un archivo de documento legal'
    });
};

//obtener y validar la ruta física del documento legal de la empresa propia
export const obtenerArchivoDocumentoEmpresa = async (usuarioId) => {
    const { rows } = await pool.query(
        'SELECT id, ruta_documento_legal FROM empresas WHERE usuario_id = $1 LIMIT 1',
        [usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('empresa no encontrada para este empleador', 404);
    }

    if (!rows[0].ruta_documento_legal) {
        throw crearError('la empresa no tiene un documento legal registrado', 404);
    }

    const rutaAbsoluta = path.resolve(ROOT_BACKEND, rows[0].ruta_documento_legal);
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

//listar vacantes propias del empleador autenticado con filtro de estado y paginación
export const listarVacantesEmpleador = async (usuarioId, query = {}) => {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limiteRaw = parseInt(query.limite, 10);
    const limite = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));
    const offset = (pagina - 1) * limite;

    const estadosValidos = ['borrador', 'pendiente', 'publicada', 'oculta', 'rechazada', 'cerrada'];
    let estado = null;
    if (query.estado !== undefined && query.estado !== null && String(query.estado).trim() !== '') {
        estado = String(query.estado).trim();
        if (!estadosValidos.includes(estado)) {
            throw crearError('estado de vacante inválido', 400);
        }
    }

    const dataPromise = pool.query(
        `SELECT
            v.id,
            v.empresa_id,
            v.categoria_id,
            c.nombre AS categoria,
            v.titulo,
            v.ubicacion,
            v.modalidad,
            v.tipo_contrato,
            v.nivel_experiencia,
            v.salario_min,
            v.salario_max,
            v.estado,
            v.fecha_publicacion,
            v.fecha_cierre,
            v.fecha_creacion,
            (SELECT count(*)::int FROM postulaciones p WHERE p.vacante_id = v.id) AS total_postulaciones
        FROM vacantes v
        JOIN empresas e ON e.id = v.empresa_id
        LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
        WHERE e.usuario_id = $1
            AND ($2::text IS NULL OR v.estado = $2)
        ORDER BY v.fecha_creacion DESC, v.id DESC
        LIMIT $3 OFFSET $4`,
        [usuarioId, estado, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM vacantes v
        JOIN empresas e ON e.id = v.empresa_id
        WHERE e.usuario_id = $1
            AND ($2::text IS NULL OR v.estado = $2)`,
        [usuarioId, estado]
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const data = dataResult.rows.map((row) => ({
        ...row,
        salario_min: row.salario_min === null || row.salario_min === undefined ? null : Number(row.salario_min),
        salario_max: row.salario_max === null || row.salario_max === undefined ? null : Number(row.salario_max),
        total_postulaciones: Number(row.total_postulaciones ?? 0)
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
