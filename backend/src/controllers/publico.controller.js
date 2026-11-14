import {
    obtenerMetricasInicio,
    obtenerCategoriasEmpleo,
    listarVacantesPublicas,
    obtenerDetalleVacantePublica,
    listarEmpresasPublicas,
    obtenerDetalleEmpresaPublica,
    listarVacantesDeEmpresaPublica,
    listarValoracionesDeEmpresaPublica
} from '../services/publicoServices.js';

//obtener métricas generales del portal
export const obtenerMetricasInicioController = async (req, res) => {
    try {
        const metricas = await obtenerMetricasInicio();
        return res.status(200).json({ data: metricas });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener métricas de inicio'
        });
    }
};

//listar catálogo de categorías de empleo
export const obtenerCategoriasEmpleoController = async (req, res) => {
    try {
        const categorias = await obtenerCategoriasEmpleo();
        return res.status(200).json({ data: categorias });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener categorías de empleo'
        });
    }
};

//listar vacantes públicas con filtros y paginación
export const listarVacantesPublicasController = async (req, res) => {
    try {
        const resultado = await listarVacantesPublicas(req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar vacantes'
        });
    }
};

//obtener detalle público de una vacante
export const obtenerDetalleVacantePublicaController = async (req, res) => {
    try {
        const vacante = await obtenerDetalleVacantePublica(req.params.id);
        return res.status(200).json({ data: vacante });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el detalle de la vacante'
        });
    }
};

//listar empresas públicas aprobadas
export const listarEmpresasPublicasController = async (req, res) => {
    try {
        const resultado = await listarEmpresasPublicas(req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar empresas'
        });
    }
};

//obtener ficha pública de una empresa
export const obtenerDetalleEmpresaPublicaController = async (req, res) => {
    try {
        const empresa = await obtenerDetalleEmpresaPublica(req.params.id);
        return res.status(200).json({ data: empresa });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el detalle de la empresa'
        });
    }
};

//listar vacantes públicas de una empresa
export const listarVacantesDeEmpresaPublicaController = async (req, res) => {
    try {
        const resultado = await listarVacantesDeEmpresaPublica(req.params.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar vacantes de la empresa'
        });
    }
};

//listar valoraciones públicas de una empresa
export const listarValoracionesDeEmpresaPublicaController = async (req, res) => {
    try {
        const resultado = await listarValoracionesDeEmpresaPublica(req.params.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener valoraciones de la empresa'
        });
    }
};
