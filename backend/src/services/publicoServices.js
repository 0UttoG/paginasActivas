import { pool } from '../db.js';

//crear error controlado con código HTTP
const crearError = (mensaje, statusCode) => {
    const error = new Error(mensaje);
    error.statusCode = statusCode;
    return error;
};

//normalizar parámetros de paginación
const normalizarPaginacion = (pagina, limite) => {
    const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
    const limiteRaw = parseInt(limite, 10);
    const limiteNum = Math.min(100, Math.max(1, Number.isNaN(limiteRaw) ? 20 : limiteRaw));

    return {
        pagina: paginaNum,
        limite: limiteNum,
        offset: (paginaNum - 1) * limiteNum
    };
};

//validar entero positivo para parámetros de ruta
const validarId = (valor, mensaje = 'id inválido') => {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) {
        throw crearError(mensaje, 400);
    }
    return numero;
};

//convertir campo numérico de pg a número o null
const aNumero = (valor) => {
    if (valor === null || valor === undefined) {
        return null;
    }
    return Number(valor);
};

//convertir texto vacío a null para filtros opcionales
const textoONull = (valor) => {
    if (valor === undefined || valor === null) {
        return null;
    }
    const limpio = String(valor).trim();
    return limpio === '' ? null : limpio;
};

//verificar que una empresa exista y esté aprobada
const verificarEmpresaAprobada = async (empresaId) => {
    const { rows } = await pool.query(
        "SELECT id FROM empresas WHERE id = $1 AND estado_verificacion = 'aprobada' LIMIT 1",
        [empresaId]
    );

    if (rows.length === 0) {
        throw crearError('empresa no encontrada', 404);
    }
};

//obtener métricas generales para la página de inicio
export const obtenerMetricasInicio = async () => {
    const { rows } = await pool.query(
        `SELECT
            (SELECT count(*)::int FROM empresas WHERE estado_verificacion = 'aprobada') AS empresas_aprobadas,
            (SELECT count(*)::int FROM usuarios u
                JOIN roles r ON r.id = u.rol_id
                WHERE r.nombre = 'candidato' AND u.estado = 'activo') AS candidatos_activos,
            (SELECT count(*)::int FROM vacantes v
                JOIN empresas e ON e.id = v.empresa_id
                WHERE v.estado = 'publicada'
                    AND e.estado_verificacion = 'aprobada'
                    AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)) AS vacantes_activas,
            (SELECT count(*)::int FROM postulaciones) AS total_postulaciones`
    );

    return rows[0];
};

//listar categorías de empleo ordenadas alfabéticamente
export const obtenerCategoriasEmpleo = async () => {
    const { rows } = await pool.query(
        'SELECT id, nombre FROM categorias_empleo ORDER BY nombre ASC'
    );
    return rows;
};

//listar vacantes públicas vigentes con filtros combinados y paginación
export const listarVacantesPublicas = async (query = {}) => {
    const { pagina, limite, offset } = normalizarPaginacion(query.pagina, query.limite);

    const q = textoONull(query.q);
    const ubicacion = textoONull(query.ubicacion);
    const modalidad = textoONull(query.modalidad);
    const tipoContrato = textoONull(query.tipo_contrato);
    const nivelExperiencia = textoONull(query.nivel_experiencia);

    let categoriaId = null;
    if (textoONull(query.categoria_id) !== null) {
        categoriaId = validarId(query.categoria_id, 'categoria_id inválido');
    }

    let empresaId = null;
    if (textoONull(query.empresa_id) !== null) {
        empresaId = validarId(query.empresa_id, 'empresa_id inválido');
    }

    let salarioMin = null;
    if (textoONull(query.salario_min) !== null) {
        salarioMin = Number(query.salario_min);
        if (Number.isNaN(salarioMin) || salarioMin < 0) {
            throw crearError('salario_min inválido', 400);
        }
    }

    let salarioMax = null;
    if (textoONull(query.salario_max) !== null) {
        salarioMax = Number(query.salario_max);
        if (Number.isNaN(salarioMax) || salarioMax < 0) {
            throw crearError('salario_max inválido', 400);
        }
    }

    if (salarioMin !== null && salarioMax !== null && salarioMin > salarioMax) {
        throw crearError('salario_min no puede ser mayor que salario_max', 400);
    }

    let desde = null;
    if (textoONull(query.desde) !== null) {
        const fechaDesde = new Date(query.desde);
        if (Number.isNaN(fechaDesde.getTime())) {
            throw crearError('fecha desde inválida', 400);
        }
        desde = fechaDesde.toISOString();
    }

    const filtrosWhere = `
        FROM vacantes v
        JOIN empresas e ON e.id = v.empresa_id
        LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
        WHERE v.estado = 'publicada'
            AND e.estado_verificacion = 'aprobada'
            AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
            AND ($1::text IS NULL OR v.titulo ILIKE '%' || $1 || '%'
                OR v.descripcion ILIKE '%' || $1 || '%'
                OR e.nombre_legal ILIKE '%' || $1 || '%')
            AND ($2::text IS NULL OR v.ubicacion ILIKE '%' || $2 || '%')
            AND ($3::text IS NULL OR v.modalidad = $3)
            AND ($4::text IS NULL OR v.tipo_contrato = $4)
            AND ($5::text IS NULL OR v.nivel_experiencia = $5)
            AND ($6::int IS NULL OR v.categoria_id = $6)
            AND ($7::numeric IS NULL OR COALESCE(v.salario_max, v.salario_min) >= $7)
            AND ($8::numeric IS NULL OR COALESCE(v.salario_min, v.salario_max) <= $8)
            AND ($9::timestamp IS NULL OR v.fecha_publicacion >= $9)
            AND ($10::int IS NULL OR v.empresa_id = $10)
    `;

    const paramsFiltros = [
        q,
        ubicacion,
        modalidad,
        tipoContrato,
        nivelExperiencia,
        categoriaId,
        salarioMin,
        salarioMax,
        desde,
        empresaId
    ];

    const dataPromise = pool.query(
        `SELECT v.id, v.titulo, v.ubicacion, v.modalidad, v.tipo_contrato,
                v.nivel_experiencia, v.salario_min, v.salario_max,
                v.fecha_publicacion, v.fecha_cierre,
                v.categoria_id, c.nombre AS categoria,
                e.id AS empresa_id, e.nombre_legal, e.ruta_logo
        ${filtrosWhere}
        ORDER BY v.fecha_publicacion DESC, v.id DESC
        LIMIT $11 OFFSET $12`,
        [...paramsFiltros, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total ${filtrosWhere}`,
        paramsFiltros
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = countResult.rows[0].total;

    const data = dataResult.rows.map((vacante) => ({
        ...vacante,
        salario_min: aNumero(vacante.salario_min),
        salario_max: aNumero(vacante.salario_max)
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

//obtener detalle de una vacante pública vigente
export const obtenerDetalleVacantePublica = async (id) => {
    const vacanteId = validarId(id, 'id de vacante inválido');

    const { rows } = await pool.query(
        `SELECT v.id, v.empresa_id, v.categoria_id, c.nombre AS categoria,
                v.titulo, v.ubicacion, v.modalidad, v.tipo_contrato,
                v.nivel_experiencia, v.salario_min, v.salario_max,
                v.descripcion, v.responsabilidades, v.requisitos, v.beneficios,
                v.correo_contacto, v.fecha_publicacion, v.fecha_cierre,
                e.nombre_legal, e.descripcion AS empresa_descripcion,
                e.sitio_web, e.correo_contacto AS empresa_correo,
                e.telefono_contacto AS empresa_telefono, e.ruta_logo
        FROM vacantes v
        JOIN empresas e ON e.id = v.empresa_id
        LEFT JOIN categorias_empleo c ON c.id = v.categoria_id
        WHERE v.id = $1
            AND v.estado = 'publicada'
            AND e.estado_verificacion = 'aprobada'
            AND (v.fecha_cierre IS NULL OR v.fecha_cierre >= CURRENT_DATE)
        LIMIT 1`,
        [vacanteId]
    );

    if (rows.length === 0) {
        throw crearError('vacante no encontrada', 404);
    }

    const vacante = rows[0];
    return {
        ...vacante,
        salario_min: aNumero(vacante.salario_min),
        salario_max: aNumero(vacante.salario_max)
    };
};

//listar empresas aprobadas con promedio y total de valoraciones
export const listarEmpresasPublicas = async (query = {}) => {
    const { pagina, limite, offset } = normalizarPaginacion(query.pagina, query.limite);
    const q = textoONull(query.q);

    const dataPromise = pool.query(
        `SELECT e.id, e.nombre_legal, e.descripcion, e.sitio_web,
                e.correo_contacto, e.telefono_contacto, e.ruta_logo,
                e.estado_verificacion,
                COALESCE(x.total, 0)::int AS total_valoraciones,
                x.promedio
        FROM empresas e
        LEFT JOIN (
            SELECT empresa_id, count(*) AS total, round(avg(calificacion), 2) AS promedio
            FROM valoraciones_empresa
            WHERE estado = 'aprobada'
            GROUP BY empresa_id
        ) x ON x.empresa_id = e.id
        WHERE e.estado_verificacion = 'aprobada'
            AND ($1::text IS NULL OR e.nombre_legal ILIKE '%' || $1 || '%')
        ORDER BY e.nombre_legal ASC, e.id ASC
        LIMIT $2 OFFSET $3`,
        [q, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM empresas e
        WHERE e.estado_verificacion = 'aprobada'
            AND ($1::text IS NULL OR e.nombre_legal ILIKE '%' || $1 || '%')`,
        [q]
    );

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);
    const total = countResult.rows[0].total;

    const data = dataResult.rows.map((empresa) => ({
        ...empresa,
        promedio: aNumero(empresa.promedio)
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

//obtener ficha pública de una empresa aprobada
export const obtenerDetalleEmpresaPublica = async (id) => {
    const empresaId = validarId(id, 'id de empresa inválido');

    const { rows } = await pool.query(
        `SELECT e.id, e.nombre_legal, e.descripcion, e.sitio_web,
                e.correo_contacto, e.telefono_contacto, e.ruta_logo,
                e.estado_verificacion,
                COALESCE(x.total, 0)::int AS total_valoraciones,
                x.promedio
        FROM empresas e
        LEFT JOIN (
            SELECT empresa_id, count(*) AS total, round(avg(calificacion), 2) AS promedio
            FROM valoraciones_empresa
            WHERE estado = 'aprobada'
            GROUP BY empresa_id
        ) x ON x.empresa_id = e.id
        WHERE e.id = $1 AND e.estado_verificacion = 'aprobada'
        LIMIT 1`,
        [empresaId]
    );

    if (rows.length === 0) {
        throw crearError('empresa no encontrada', 404);
    }

    const empresa = rows[0];
    return {
        ...empresa,
        promedio: aNumero(empresa.promedio)
    };
};

//listar vacantes públicas vigentes de una empresa específica
export const listarVacantesDeEmpresaPublica = async (empresaIdParam, query = {}) => {
    const empresaId = validarId(empresaIdParam, 'id de empresa inválido');
    await verificarEmpresaAprobada(empresaId);

    return listarVacantesPublicas({
        ...query,
        empresa_id: empresaId
    });
};

//listar valoraciones aprobadas de una empresa específica
export const listarValoracionesDeEmpresaPublica = async (empresaIdParam, query = {}) => {
    const empresaId = validarId(empresaIdParam, 'id de empresa inválido');
    await verificarEmpresaAprobada(empresaId);

    const { pagina, limite, offset } = normalizarPaginacion(query.pagina, query.limite);

    const dataPromise = pool.query(
        `SELECT ve.id, ve.calificacion, ve.comentario, ve.fecha_creacion,
                u.nombres, u.apellidos
        FROM valoraciones_empresa ve
        JOIN usuarios u ON u.id = ve.candidato_id
        WHERE ve.empresa_id = $1 AND ve.estado = 'aprobada'
        ORDER BY ve.fecha_creacion DESC, ve.id DESC
        LIMIT $2 OFFSET $3`,
        [empresaId, limite, offset]
    );

    const countPromise = pool.query(
        `SELECT count(*)::int AS total
        FROM valoraciones_empresa
        WHERE empresa_id = $1 AND estado = 'aprobada'`,
        [empresaId]
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
