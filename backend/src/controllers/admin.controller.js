import {
    obtenerResumenAdmin,
    listarUsuariosAdmin,
    actualizarEstadoUsuarioAdmin,
    listarEmpresasAdmin,
    obtenerArchivoDocumentoEmpresaAdmin,
    actualizarEstadoEmpresaAdmin,
    listarVacantesAdmin,
    actualizarEstadoVacanteAdmin,
    listarCategoriasEmpleoAdmin,
    crearCategoriaEmpleoAdmin,
    actualizarCategoriaEmpleoAdmin
} from '../services/adminServices.js';

//controlador para obtener el resumen de contadores del panel administrativo
export const obtenerResumenAdminController = async (req, res) => {
    try {
        const resumen = await obtenerResumenAdmin();
        return res.status(200).json({
            data: resumen
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el resumen administrativo'
        });
    }
};

//controlador para listar usuarios desde el panel administrativo con filtros y paginación
export const listarUsuariosAdminController = async (req, res) => {
    try {
        const resultado = await listarUsuariosAdmin(req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar los usuarios'
        });
    }
};

//controlador para activar o suspender una cuenta de usuario desde administración
export const actualizarEstadoUsuarioAdminController = async (req, res) => {
    try {
        const usuario = await actualizarEstadoUsuarioAdmin(req.user.id, req.params.id, req.body);
        return res.status(200).json({
            mensaje: 'estado del usuario actualizado correctamente',
            data: usuario
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar el estado del usuario'
        });
    }
};

//controlador para listar empresas desde el panel administrativo con filtros y paginación
export const listarEmpresasAdminController = async (req, res) => {
    try {
        const resultado = await listarEmpresasAdmin(req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar las empresas'
        });
    }
};

//controlador para descargar o visualizar el documento legal de una empresa desde administración
export const descargarDocumentoEmpresaAdminController = async (req, res) => {
    try {
        const { rutaAbsoluta } = await obtenerArchivoDocumentoEmpresaAdmin(req.params.id);
        return res.sendFile(rutaAbsoluta, (err) => {
            if (err && !res.headersSent) {
                res.status(500).json({ mensaje: 'error al leer el documento legal' });
            }
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el documento legal'
        });
    }
};

//controlador para aprobar, rechazar, suspender o devolver a pendiente una empresa
export const actualizarEstadoEmpresaAdminController = async (req, res) => {
    try {
        const empresa = await actualizarEstadoEmpresaAdmin(req.user.id, req.params.id, req.body);
        return res.status(200).json({
            mensaje: 'estado de verificación de la empresa actualizado correctamente',
            data: empresa
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar el estado de la empresa'
        });
    }
};

//controlador para listar vacantes desde el panel administrativo con filtros y reportes abiertos
export const listarVacantesAdminController = async (req, res) => {
    try {
        const resultado = await listarVacantesAdmin(req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar las vacantes'
        });
    }
};

//controlador para publicar, ocultar, rechazar o cerrar una vacante desde administración
export const actualizarEstadoVacanteAdminController = async (req, res) => {
    try {
        const vacante = await actualizarEstadoVacanteAdmin(req.user.id, req.params.id, req.body);
        return res.status(200).json({
            mensaje: 'estado de la vacante actualizado correctamente',
            data: vacante
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar el estado de la vacante'
        });
    }
};

//controlador para listar categorías de empleo en el panel administrativo
export const listarCategoriasEmpleoAdminController = async (req, res) => {
    try {
        const categorias = await listarCategoriasEmpleoAdmin();
        return res.status(200).json({
            data: categorias
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar las categorías de empleo'
        });
    }
};

//controlador para crear una nueva categoría de empleo
export const crearCategoriaEmpleoAdminController = async (req, res) => {
    try {
        const categoria = await crearCategoriaEmpleoAdmin(req.user.id, req.body);
        return res.status(201).json({
            mensaje: 'categoría de empleo creada correctamente',
            data: categoria
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al crear la categoría de empleo'
        });
    }
};

//controlador para actualizar el nombre de una categoría de empleo existente
export const actualizarCategoriaEmpleoAdminController = async (req, res) => {
    try {
        const categoria = await actualizarCategoriaEmpleoAdmin(req.user.id, req.params.id, req.body);
        return res.status(200).json({
            mensaje: 'categoría de empleo actualizada correctamente',
            data: categoria
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar la categoría de empleo'
        });
    }
};
