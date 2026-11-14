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

const MODALIDADES_VACANTE = ['remoto', 'hibrido', 'presencial'];
const CONTRATOS_VACANTE = ['tiempo_completo', 'medio_tiempo', 'proyecto', 'pasantia'];
const EXPERIENCIAS_VACANTE = ['sin_experiencia', 'junior', 'intermedio', 'senior'];

//validar texto obligatorio con longitud mínima y máxima opcional
const validarTextoRango = (valor, campo, min, max = null) => {
    if (typeof valor !== 'string') {
        throw crearError(`${campo} debe ser texto válido`, 400);
    }
    const limpio = valor.trim();
    if (limpio.length < min) {
        throw crearError(`${campo} debe tener al menos ${min} caracteres`, 400);
    }
    if (max !== null && limpio.length > max) {
        throw crearError(`${campo} no puede exceder ${max} caracteres`, 400);
    }
    return limpio;
};

//validar que un valor pertenezca a los valores permitidos del esquema
const validarEnum = (valor, campo, permitidos) => {
    if (typeof valor !== 'string') {
        throw crearError(`${campo} debe ser texto válido`, 400);
    }
    const limpio = valor.trim();
    if (!permitidos.includes(limpio)) {
        throw crearError(`${campo} inválido`, 400);
    }
    return limpio;
};

//validar salario opcional numérico no negativo
const validarSalarioOpcional = (valor, campo) => {
    if (valor === undefined || valor === null) {
        return null;
    }
    if (typeof valor !== 'number' && typeof valor !== 'string') {
        throw crearError(`${campo} debe ser un número válido`, 400);
    }
    if (typeof valor === 'string' && valor.trim() === '') {
        return null;
    }
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0) {
        throw crearError(`${campo} debe ser un número no negativo`, 400);
    }
    return Number(numero.toFixed(2));
};

//validar fecha de cierre opcional YYYY-MM-DD (y no pasada al crear)
const validarFechaCierreOpcional = (valor, exigirNoPasada = true) => {
    if (valor === undefined || valor === null) {
        return null;
    }
    if (typeof valor !== 'string') {
        throw crearError('fecha_cierre debe ser texto válido', 400);
    }
    const limpio = valor.trim();
    if (!limpio) {
        return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
        throw crearError('fecha_cierre debe tener formato YYYY-MM-DD', 400);
    }
    const timestamp = Date.parse(`${limpio}T00:00:00Z`);
    if (Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== limpio) {
        throw crearError('fecha_cierre no es una fecha válida', 400);
    }
    if (exigirNoPasada) {
        const hoy = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/El_Salvador'
        }).format(new Date());
        if (limpio < hoy) {
            throw crearError('fecha_cierre no puede ser una fecha pasada', 400);
        }
    }
    return limpio;
};

//crear una nueva vacante en estado pendiente para la empresa aprobada del empleador
export const crearVacanteEmpleador = async (usuarioId, datos = {}) => {
    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};

    const titulo = validarTextoRango(cuerpo.titulo, 'titulo', 5, 150);

    const categoriaIdRaw = cuerpo.categoria_id;
    const categoriaId = typeof categoriaIdRaw === 'number' || (typeof categoriaIdRaw === 'string' && categoriaIdRaw.trim() !== '')
        ? Number(categoriaIdRaw)
        : NaN;
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
        throw crearError('categoria_id debe ser un número entero positivo', 400);
    }

    const ubicacion = validarTextoRequerido(cuerpo.ubicacion, 'ubicacion', 150);
    const modalidad = validarEnum(cuerpo.modalidad, 'modalidad', MODALIDADES_VACANTE);
    const tipoContrato = validarEnum(cuerpo.tipo_contrato, 'tipo_contrato', CONTRATOS_VACANTE);
    const nivelExperiencia = validarEnum(cuerpo.nivel_experiencia, 'nivel_experiencia', EXPERIENCIAS_VACANTE);

    const salarioMin = validarSalarioOpcional(cuerpo.salario_min, 'salario_min');
    const salarioMax = validarSalarioOpcional(cuerpo.salario_max, 'salario_max');
    if (salarioMin !== null && salarioMax !== null && salarioMin > salarioMax) {
        throw crearError('salario_min no puede ser mayor que salario_max', 400);
    }

    const descripcion = validarTextoRango(cuerpo.descripcion, 'descripcion', 50);
    const responsabilidades = validarTextoOpcional(cuerpo.responsabilidades, 'responsabilidades');
    const requisitos = validarTextoRango(cuerpo.requisitos, 'requisitos', 10);
    const beneficios = validarTextoOpcional(cuerpo.beneficios, 'beneficios');
    const correoContacto = validarCorreoRequerido(cuerpo.correo_contacto, 'correo_contacto', 150);
    const fechaCierre = validarFechaCierreOpcional(cuerpo.fecha_cierre, true);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: empresas } = await client.query(
            `SELECT id, nombre_legal, estado_verificacion
            FROM empresas
            WHERE usuario_id = $1
            FOR SHARE`,
            [usuarioId]
        );

        if (empresas.length === 0) {
            throw crearError('empresa no encontrada para este empleador', 404);
        }

        const empresa = empresas[0];
        if (empresa.estado_verificacion !== 'aprobada') {
            throw crearError('la empresa debe estar aprobada para crear vacantes', 422);
        }

        const { rows: categorias } = await client.query(
            'SELECT id, nombre FROM categorias_empleo WHERE id = $1 LIMIT 1',
            [categoriaId]
        );

        if (categorias.length === 0) {
            throw crearError('la categoría de empleo seleccionada no existe', 400);
        }

        const { rows: insertadas } = await client.query(
            `INSERT INTO vacantes (
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
                fecha_cierre
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pendiente', $15)
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
            [
                empresa.id,
                categoriaId,
                titulo,
                ubicacion,
                modalidad,
                tipoContrato,
                nivelExperiencia,
                salarioMin,
                salarioMax,
                descripcion,
                responsabilidades,
                requisitos,
                beneficios,
                correoContacto,
                fechaCierre
            ]
        );

        const vacante = insertadas[0];

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [usuarioId, 'crear_vacante', 'vacante', vacante.id, 'Creación de vacante en estado pendiente']
        );

        await client.query('COMMIT');

        return {
            ...vacante,
            salario_min: vacante.salario_min === null || vacante.salario_min === undefined ? null : Number(vacante.salario_min),
            salario_max: vacante.salario_max === null || vacante.salario_max === undefined ? null : Number(vacante.salario_max)
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//obtener detalle completo de una vacante propia del empleador autenticado
export const obtenerVacanteEmpleador = async (usuarioId, vacanteIdParam) => {
    const vacanteId = Number(vacanteIdParam);
    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
        throw crearError('id de vacante inválido', 400);
    }

    const { rows } = await pool.query(
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
            v.descripcion,
            v.responsabilidades,
            v.requisitos,
            v.beneficios,
            v.correo_contacto,
            v.estado,
            v.fecha_publicacion,
            v.fecha_cierre,
            v.fecha_creacion,
            (SELECT count(*)::int FROM postulaciones p WHERE p.vacante_id = v.id) AS total_postulaciones
        FROM vacantes v
        JOIN empresas e ON e.id = v.empresa_id
        LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
        WHERE v.id = $1 AND e.usuario_id = $2
        LIMIT 1`,
        [vacanteId, usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('vacante no encontrada', 404);
    }

    const vacante = rows[0];
    return {
        ...vacante,
        salario_min: vacante.salario_min === null || vacante.salario_min === undefined ? null : Number(vacante.salario_min),
        salario_max: vacante.salario_max === null || vacante.salario_max === undefined ? null : Number(vacante.salario_max),
        total_postulaciones: Number(vacante.total_postulaciones ?? 0)
    };
};

//actualizar parcialmente una vacante propia del empleador autenticado
export const actualizarVacanteEmpleador = async (usuarioId, vacanteIdParam, datos = {}) => {
    const vacanteId = Number(vacanteIdParam);
    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
        throw crearError('id de vacante inválido', 400);
    }

    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    const camposPermitidos = [
        'titulo',
        'categoria_id',
        'ubicacion',
        'modalidad',
        'tipo_contrato',
        'nivel_experiencia',
        'salario_min',
        'salario_max',
        'descripcion',
        'responsabilidades',
        'requisitos',
        'beneficios',
        'correo_contacto',
        'fecha_cierre'
    ];
    const tieneCampos = camposPermitidos.some((campo) => cuerpo[campo] !== undefined);
    if (!tieneCampos) {
        throw crearError('debe enviar al menos un campo para actualizar', 400);
    }

    const nuevoTitulo = cuerpo.titulo !== undefined
        ? validarTextoRango(cuerpo.titulo, 'titulo', 5, 150)
        : undefined;

    let nuevaCategoriaId;
    if (cuerpo.categoria_id !== undefined) {
        const raw = cuerpo.categoria_id;
        const numero = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')
            ? Number(raw)
            : NaN;
        if (!Number.isInteger(numero) || numero <= 0) {
            throw crearError('categoria_id debe ser un número entero positivo', 400);
        }
        nuevaCategoriaId = numero;
    }

    const nuevaUbicacion = cuerpo.ubicacion !== undefined
        ? validarTextoRequerido(cuerpo.ubicacion, 'ubicacion', 150)
        : undefined;
    const nuevaModalidad = cuerpo.modalidad !== undefined
        ? validarEnum(cuerpo.modalidad, 'modalidad', MODALIDADES_VACANTE)
        : undefined;
    const nuevoTipoContrato = cuerpo.tipo_contrato !== undefined
        ? validarEnum(cuerpo.tipo_contrato, 'tipo_contrato', CONTRATOS_VACANTE)
        : undefined;
    const nuevoNivelExperiencia = cuerpo.nivel_experiencia !== undefined
        ? validarEnum(cuerpo.nivel_experiencia, 'nivel_experiencia', EXPERIENCIAS_VACANTE)
        : undefined;
    const nuevoSalarioMin = cuerpo.salario_min !== undefined
        ? validarSalarioOpcional(cuerpo.salario_min, 'salario_min')
        : undefined;
    const nuevoSalarioMax = cuerpo.salario_max !== undefined
        ? validarSalarioOpcional(cuerpo.salario_max, 'salario_max')
        : undefined;
    const nuevaDescripcion = cuerpo.descripcion !== undefined
        ? validarTextoRango(cuerpo.descripcion, 'descripcion', 50)
        : undefined;
    const nuevasResponsabilidades = cuerpo.responsabilidades !== undefined
        ? validarTextoOpcional(cuerpo.responsabilidades, 'responsabilidades')
        : undefined;
    const nuevosRequisitos = cuerpo.requisitos !== undefined
        ? validarTextoRango(cuerpo.requisitos, 'requisitos', 10)
        : undefined;
    const nuevosBeneficios = cuerpo.beneficios !== undefined
        ? validarTextoOpcional(cuerpo.beneficios, 'beneficios')
        : undefined;
    const nuevoCorreoContacto = cuerpo.correo_contacto !== undefined
        ? validarCorreoRequerido(cuerpo.correo_contacto, 'correo_contacto', 150)
        : undefined;
    const nuevaFechaCierre = cuerpo.fecha_cierre !== undefined
        ? validarFechaCierreOpcional(cuerpo.fecha_cierre, true)
        : undefined;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: actuales } = await client.query(
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
                v.fecha_creacion
            FROM vacantes v
            JOIN empresas e ON e.id = v.empresa_id
            WHERE v.id = $1 AND e.usuario_id = $2
            FOR UPDATE OF v`,
            [vacanteId, usuarioId]
        );

        if (actuales.length === 0) {
            throw crearError('vacante no encontrada', 404);
        }

        const vacanteActual = actuales[0];
        if (vacanteActual.estado === 'cerrada' || vacanteActual.estado === 'rechazada') {
            throw crearError(`no se puede editar una vacante en estado ${vacanteActual.estado}`, 409);
        }

        if (nuevaCategoriaId !== undefined) {
            const { rows: categorias } = await client.query(
                'SELECT id FROM categorias_empleo WHERE id = $1 LIMIT 1',
                [nuevaCategoriaId]
            );
            if (categorias.length === 0) {
                throw crearError('la categoría de empleo seleccionada no existe', 400);
            }
        }

        const salarioMinActual = vacanteActual.salario_min === null || vacanteActual.salario_min === undefined
            ? null
            : Number(vacanteActual.salario_min);
        const salarioMaxActual = vacanteActual.salario_max === null || vacanteActual.salario_max === undefined
            ? null
            : Number(vacanteActual.salario_max);

        const salarioMin = nuevoSalarioMin !== undefined ? nuevoSalarioMin : salarioMinActual;
        const salarioMax = nuevoSalarioMax !== undefined ? nuevoSalarioMax : salarioMaxActual;
        if (salarioMin !== null && salarioMax !== null && salarioMin > salarioMax) {
            throw crearError('salario_min no puede ser mayor que salario_max', 400);
        }

        const nuevoEstado = vacanteActual.estado === 'publicada' ? 'pendiente' : vacanteActual.estado;

        const { rows: actualizadas } = await client.query(
            `UPDATE vacantes
            SET categoria_id = $1,
                titulo = $2,
                ubicacion = $3,
                modalidad = $4,
                tipo_contrato = $5,
                nivel_experiencia = $6,
                salario_min = $7,
                salario_max = $8,
                descripcion = $9,
                responsabilidades = $10,
                requisitos = $11,
                beneficios = $12,
                correo_contacto = $13,
                fecha_cierre = $14,
                estado = $15
            WHERE id = $16
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
            [
                nuevaCategoriaId !== undefined ? nuevaCategoriaId : vacanteActual.categoria_id,
                nuevoTitulo !== undefined ? nuevoTitulo : vacanteActual.titulo,
                nuevaUbicacion !== undefined ? nuevaUbicacion : vacanteActual.ubicacion,
                nuevaModalidad !== undefined ? nuevaModalidad : vacanteActual.modalidad,
                nuevoTipoContrato !== undefined ? nuevoTipoContrato : vacanteActual.tipo_contrato,
                nuevoNivelExperiencia !== undefined ? nuevoNivelExperiencia : vacanteActual.nivel_experiencia,
                salarioMin,
                salarioMax,
                nuevaDescripcion !== undefined ? nuevaDescripcion : vacanteActual.descripcion,
                nuevasResponsabilidades !== undefined ? nuevasResponsabilidades : vacanteActual.responsabilidades,
                nuevosRequisitos !== undefined ? nuevosRequisitos : vacanteActual.requisitos,
                nuevosBeneficios !== undefined ? nuevosBeneficios : vacanteActual.beneficios,
                nuevoCorreoContacto !== undefined ? nuevoCorreoContacto : vacanteActual.correo_contacto,
                nuevaFechaCierre !== undefined ? nuevaFechaCierre : vacanteActual.fecha_cierre,
                nuevoEstado,
                vacanteId
            ]
        );

        const vacanteActualizada = actualizadas[0];
        const detalle = vacanteActual.estado === 'publicada'
            ? 'Actualización de vacante publicada; pasa a estado pendiente'
            : 'Actualización de vacante';

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [usuarioId, 'actualizar_vacante', 'vacante', vacanteActualizada.id, detalle]
        );

        await client.query('COMMIT');

        return {
            ...vacanteActualizada,
            salario_min: vacanteActualizada.salario_min === null || vacanteActualizada.salario_min === undefined
                ? null
                : Number(vacanteActualizada.salario_min),
            salario_max: vacanteActualizada.salario_max === null || vacanteActualizada.salario_max === undefined
                ? null
                : Number(vacanteActualizada.salario_max)
        };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//cerrar o cancelar una vacante propia del empleador (Q20, D09)
export const cerrarVacanteEmpleador = async (usuarioId, vacanteIdParam) => {
    const vacanteId = Number(vacanteIdParam);
    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
        throw crearError('id de vacante inválido', 400);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: vacantes } = await client.query(
            `SELECT
                v.id,
                v.titulo,
                v.estado,
                e.id AS empresa_id,
                e.estado_verificacion
            FROM vacantes v
            JOIN empresas e ON e.id = v.empresa_id
            WHERE v.id = $1 AND e.usuario_id = $2
            FOR UPDATE OF v`,
            [vacanteId, usuarioId]
        );

        if (vacantes.length === 0) {
            throw crearError('vacante no encontrada', 404);
        }

        const vacanteActual = vacantes[0];
        if (vacanteActual.estado === 'rechazada') {
            throw crearError('no se puede cerrar una vacante rechazada', 409);
        }

        //respuesta idempotente si la vacante ya estaba cerrada (T28)
        if (vacanteActual.estado === 'cerrada') {
            await client.query('COMMIT');
            return {
                id: vacanteActual.id,
                titulo: vacanteActual.titulo,
                estado: vacanteActual.estado
            };
        }

        const { rows: actualizadas } = await client.query(
            `UPDATE vacantes
            SET estado = 'cerrada'
            WHERE id = $1
            RETURNING id, titulo, estado`,
            [vacanteActual.id]
        );

        const vacanteCerrada = actualizadas[0];

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [
                usuarioId,
                'cerrar_vacante',
                'vacante',
                vacanteCerrada.id,
                `Cierre de vacante: ${vacanteCerrada.titulo}`
            ]
        );

        await client.query('COMMIT');

        return vacanteCerrada;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

//listar postulaciones recibidas en vacantes propias del empleador (Q09, D07)
export const listarPostulacionesEmpleador = async (usuarioId, query = {}) => {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limiteRaw = parseInt(query.limite, 10);
    const limite = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));
    const offset = (pagina - 1) * limite;

    let vacanteId = null;
    if (query.vacante_id !== undefined && query.vacante_id !== null && String(query.vacante_id).trim() !== '') {
        const rawVacanteId = String(query.vacante_id).trim();
        if (!/^\d+$/.test(rawVacanteId) || Number(rawVacanteId) <= 0) {
            throw crearError('vacante_id inválido', 400);
        }
        vacanteId = Number(rawVacanteId);
    }

    const estadosValidos = ['nueva', 'en_proceso', 'contratado', 'rechazado'];
    let estado = null;
    if (query.estado !== undefined && query.estado !== null && String(query.estado).trim() !== '') {
        estado = String(query.estado).trim();
        if (!estadosValidos.includes(estado)) {
            throw crearError('estado de postulación inválido', 400);
        }
    }

    const dataPromise = pool.query(
        `SELECT
            p.id,
            p.vacante_id,
            p.estado,
            p.fecha_postulacion,
            p.carta_presentacion,
            v.titulo,
            u.id AS candidato_id,
            u.nombres,
            u.apellidos
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        JOIN empresas e ON e.id = v.empresa_id
        JOIN usuarios u ON u.id = p.candidato_id
        WHERE e.usuario_id = $1
            AND ($2::int IS NULL OR p.vacante_id = $2)
            AND ($3::text IS NULL OR p.estado = $3)
        ORDER BY p.fecha_postulacion DESC, p.id DESC
        LIMIT $4 OFFSET $5`,
        [usuarioId, vacanteId, estado, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        JOIN empresas e ON e.id = v.empresa_id
        JOIN usuarios u ON u.id = p.candidato_id
        WHERE e.usuario_id = $1
            AND ($2::int IS NULL OR p.vacante_id = $2)
            AND ($3::text IS NULL OR p.estado = $3)`,
        [usuarioId, vacanteId, estado]
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

//obtener perfil de contacto e historial laboral del candidato de una postulación propia (Q09, Q11, D07)
export const obtenerCandidatoPostulacionEmpleador = async (usuarioId, postulacionIdParam) => {
    const rawId = String(postulacionIdParam ?? '').trim();
    if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) {
        throw crearError('id de postulación inválido', 400);
    }
    const postulacionId = Number(rawId);

    const { rows } = await pool.query(
        `SELECT
            p.id AS postulacion_id,
            p.vacante_id,
            p.estado,
            p.carta_presentacion,
            p.fecha_postulacion,
            (p.ruta_cv IS NOT NULL AND p.ruta_cv <> '') AS tiene_cv,
            v.titulo AS vacante_titulo,
            u.id AS candidato_id,
            u.nombres,
            u.apellidos,
            u.correo,
            u.telefono
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        JOIN empresas e ON e.id = v.empresa_id
        JOIN usuarios u ON u.id = p.candidato_id
        WHERE p.id = $1 AND e.usuario_id = $2
        LIMIT 1`,
        [postulacionId, usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('postulación no encontrada', 404);
    }

    const postulacion = rows[0];

    const { rows: historialRows } = await pool.query(
        `SELECT
            h.id,
            h.empresa_id,
            e.nombre_legal,
            h.cargo,
            h.fecha_inicio,
            h.fecha_fin,
            h.verificado
        FROM historial_laboral h
        JOIN empresas e ON e.id = h.empresa_id
        WHERE h.candidato_id = $1
        ORDER BY h.fecha_inicio DESC, h.id DESC`,
        [postulacion.candidato_id]
    );

    return {
        postulacion_id: postulacion.postulacion_id,
        vacante_id: postulacion.vacante_id,
        vacante_titulo: postulacion.vacante_titulo,
        estado: postulacion.estado,
        carta_presentacion: postulacion.carta_presentacion,
        fecha_postulacion: postulacion.fecha_postulacion,
        tiene_cv: Boolean(postulacion.tiene_cv),
        candidato_id: postulacion.candidato_id,
        nombres: postulacion.nombres,
        apellidos: postulacion.apellidos,
        correo: postulacion.correo,
        telefono: postulacion.telefono,
        candidato: {
            id: postulacion.candidato_id,
            nombres: postulacion.nombres,
            apellidos: postulacion.apellidos,
            correo: postulacion.correo,
            telefono: postulacion.telefono,
            tiene_cv: Boolean(postulacion.tiene_cv)
        },
        historial: historialRows
    };
};

//obtener y validar la ruta física del cv asociado a una postulación propia (Q09, T07)
export const obtenerArchivoCvPostulacionEmpleador = async (usuarioId, postulacionIdParam) => {
    const rawId = String(postulacionIdParam ?? '').trim();
    if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) {
        throw crearError('id de postulación inválido', 400);
    }
    const postulacionId = Number(rawId);

    const { rows } = await pool.query(
        `SELECT
            p.id,
            p.ruta_cv
        FROM postulaciones p
        JOIN vacantes v ON v.id = p.vacante_id
        JOIN empresas e ON e.id = v.empresa_id
        WHERE p.id = $1 AND e.usuario_id = $2
        LIMIT 1`,
        [postulacionId, usuarioId]
    );

    if (rows.length === 0) {
        throw crearError('postulación no encontrada', 404);
    }

    if (!rows[0].ruta_cv) {
        throw crearError('la postulación no tiene un cv registrado', 404);
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

const ESTADOS_POSTULACION = ['nueva', 'en_proceso', 'contratado', 'rechazado'];
const TRANSICIONES_POSTULACION = {
    nueva: ['en_proceso', 'contratado', 'rechazado'],
    en_proceso: ['contratado', 'rechazado'],
    contratado: [],
    rechazado: []
};
const MENSAJES_ESTADO_POSTULACION = {
    en_proceso: (titulo, empresa) => `Tu postulación a "${titulo}" en ${empresa} pasó a estado en proceso.`,
    contratado: (titulo, empresa) => `Tu postulación a "${titulo}" en ${empresa} fue seleccionada (contratado).`,
    rechazado: (titulo, empresa) => `Tu postulación a "${titulo}" en ${empresa} fue marcada como rechazada.`
};

//actualizar el estado de una postulación propia con notificación y bitácora atómicas (Q09, D08, T09/T17/T27)
export const actualizarEstadoPostulacionEmpleador = async (usuarioId, postulacionIdParam, datos = {}) => {
    const rawId = String(postulacionIdParam ?? '').trim();
    if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) {
        throw crearError('id de postulación inválido', 400);
    }
    const postulacionId = Number(rawId);

    const cuerpo = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    const nuevoEstado = validarEnum(cuerpo.estado, 'estado', ESTADOS_POSTULACION);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT
                p.id,
                p.vacante_id,
                p.candidato_id,
                p.estado,
                p.fecha_postulacion,
                v.titulo AS vacante_titulo,
                e.nombre_legal
            FROM postulaciones p
            JOIN vacantes v ON v.id = p.vacante_id
            JOIN empresas e ON e.id = v.empresa_id
            WHERE p.id = $1 AND e.usuario_id = $2
            FOR UPDATE OF p`,
            [postulacionId, usuarioId]
        );

        if (rows.length === 0) {
            throw crearError('postulación no encontrada', 404);
        }

        const actual = rows[0];

        //respuesta idempotente si ya tenía el mismo estado sin duplicar notificación ni bitácora
        if (actual.estado === nuevoEstado) {
            await client.query('COMMIT');
            return {
                id: actual.id,
                vacante_id: actual.vacante_id,
                candidato_id: actual.candidato_id,
                estado: actual.estado,
                fecha_postulacion: actual.fecha_postulacion
            };
        }

        const permitidos = TRANSICIONES_POSTULACION[actual.estado] || [];
        if (!permitidos.includes(nuevoEstado)) {
            throw crearError(`no se permite cambiar el estado de ${actual.estado} a ${nuevoEstado}`, 409);
        }

        const { rows: actualizadas } = await client.query(
            `UPDATE postulaciones
            SET estado = $1
            WHERE id = $2
            RETURNING id, vacante_id, candidato_id, estado, fecha_postulacion`,
            [nuevoEstado, actual.id]
        );

        const generarMensaje = MENSAJES_ESTADO_POSTULACION[nuevoEstado];
        const mensajeNotificacion = generarMensaje
            ? generarMensaje(actual.vacante_titulo, actual.nombre_legal)
            : `Tu postulación a "${actual.vacante_titulo}" en ${actual.nombre_legal} cambió a ${nuevoEstado}.`;

        await client.query(
            `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
            VALUES ($1, $2, $3, $4)`,
            [actual.candidato_id, 'Actualización de tu postulación', mensajeNotificacion, 'estado_postulacion']
        );

        await client.query(
            `INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle)
            VALUES ($1, $2, $3, $4, $5)`,
            [
                usuarioId,
                'cambiar_estado_postulacion',
                'postulacion',
                actual.id,
                `Cambio de estado de postulación (${actual.vacante_titulo}): ${actual.estado} -> ${nuevoEstado}`
            ]
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
