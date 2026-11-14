import {
    obtenerEmpresaEmpleador,
    crearEmpresaEmpleador,
    actualizarEmpresaEmpleador,
    actualizarLogoEmpresa,
    actualizarDocumentoEmpresa,
    obtenerArchivoDocumentoEmpresa,
    listarVacantesEmpleador,
    crearVacanteEmpleador,
    obtenerVacanteEmpleador,
    actualizarVacanteEmpleador,
    cerrarVacanteEmpleador,
    listarPostulacionesEmpleador,
    obtenerCandidatoPostulacionEmpleador,
    obtenerArchivoCvPostulacionEmpleador,
    actualizarEstadoPostulacionEmpleador,
    obtenerDashboardEmpleador
} from '../services/empleadorServices.js';

//controlador para obtener la empresa del empleador autenticado
export const obtenerEmpresaEmpleadorController = async (req, res) => {
    try {
        const empresa = await obtenerEmpresaEmpleador(req.user.id);
        return res.status(200).json({
            data: empresa
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener los datos de la empresa'
        });
    }
};

//controlador para registrar la empresa del empleador autenticado
export const crearEmpresaEmpleadorController = async (req, res) => {
    try {
        const empresa = await crearEmpresaEmpleador(req.user.id, req.body);
        return res.status(201).json({
            mensaje: 'empresa registrada correctamente',
            data: empresa
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al registrar la empresa'
        });
    }
};

//controlador para actualizar los datos de la empresa del empleador autenticado
export const actualizarEmpresaEmpleadorController = async (req, res) => {
    try {
        const empresa = await actualizarEmpresaEmpleador(req.user.id, req.body);
        return res.status(200).json({
            mensaje: 'empresa actualizada correctamente',
            data: empresa
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar los datos de la empresa'
        });
    }
};

//controlador para subir o actualizar el logo de la empresa
export const subirLogoEmpresaController = async (req, res) => {
    try {
        const resultado = await actualizarLogoEmpresa(req.user.id, req.archivoSubido);
        return res.status(201).json({
            mensaje: 'logo actualizado correctamente',
            data: resultado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al subir el logo de la empresa'
        });
    }
};

//controlador para subir o actualizar el documento legal de la empresa
export const subirDocumentoEmpresaController = async (req, res) => {
    try {
        const resultado = await actualizarDocumentoEmpresa(req.user.id, req.archivoSubido);
        return res.status(201).json({
            mensaje: 'documento legal actualizado correctamente',
            data: resultado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al subir el documento legal de la empresa'
        });
    }
};

//controlador para consultar o descargar el documento legal de la empresa propia
export const descargarDocumentoEmpresaController = async (req, res) => {
    try {
        const { rutaAbsoluta } = await obtenerArchivoDocumentoEmpresa(req.user.id);
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

//controlador para listar las vacantes propias del empleador autenticado
export const listarVacantesEmpleadorController = async (req, res) => {
    try {
        const resultado = await listarVacantesEmpleador(req.user.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar las vacantes del empleador'
        });
    }
};

//controlador para crear una vacante en estado pendiente
export const crearVacanteEmpleadorController = async (req, res) => {
    try {
        const vacante = await crearVacanteEmpleador(req.user.id, req.body);
        return res.status(201).json({
            mensaje: 'vacante creada correctamente en estado pendiente',
            data: vacante
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al crear la vacante'
        });
    }
};

//controlador para obtener el detalle completo de una vacante propia
export const obtenerVacanteEmpleadorController = async (req, res) => {
    try {
        const vacante = await obtenerVacanteEmpleador(req.user.id, req.params.id);
        return res.status(200).json({
            data: vacante
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener la vacante'
        });
    }
};

//controlador para actualizar parcialmente una vacante propia
export const actualizarVacanteEmpleadorController = async (req, res) => {
    try {
        const vacante = await actualizarVacanteEmpleador(req.user.id, req.params.id, req.body);
        return res.status(200).json({
            mensaje: 'vacante actualizada correctamente',
            data: vacante
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar la vacante'
        });
    }
};

//controlador para cerrar o cancelar una vacante propia
export const cerrarVacanteEmpleadorController = async (req, res) => {
    try {
        const vacante = await cerrarVacanteEmpleador(req.user.id, req.params.id);
        return res.status(200).json({
            mensaje: 'vacante cerrada correctamente',
            data: vacante
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al cerrar la vacante'
        });
    }
};

//controlador para listar postulaciones recibidas en vacantes propias del empleador
export const listarPostulacionesEmpleadorController = async (req, res) => {
    try {
        const resultado = await listarPostulacionesEmpleador(req.user.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar las postulaciones del empleador'
        });
    }
};

//controlador para obtener el perfil e historial del candidato de una postulación propia
export const obtenerCandidatoPostulacionEmpleadorController = async (req, res) => {
    try {
        const data = await obtenerCandidatoPostulacionEmpleador(req.user.id, req.params.id);
        return res.status(200).json({
            data
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el perfil del candidato'
        });
    }
};

//controlador para consultar o descargar el cv asociado a una postulación propia
export const descargarCvPostulacionEmpleadorController = async (req, res) => {
    try {
        const { rutaAbsoluta } = await obtenerArchivoCvPostulacionEmpleador(req.user.id, req.params.id);
        return res.sendFile(rutaAbsoluta, (err) => {
            if (err && !res.headersSent) {
                res.status(500).json({ mensaje: 'error al leer el archivo de cv' });
            }
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el archivo de cv'
        });
    }
};

//controlador para actualizar el estado de una postulación recibida en una vacante propia
export const actualizarEstadoPostulacionEmpleadorController = async (req, res) => {
    try {
        const postulacion = await actualizarEstadoPostulacionEmpleador(req.user.id, req.params.id, req.body);
        return res.status(200).json({
            mensaje: 'estado de la postulación actualizado correctamente',
            data: postulacion
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar el estado de la postulación'
        });
    }
};

//controlador para obtener el resumen del dashboard de la empresa del empleador autenticado
export const obtenerDashboardEmpleadorController = async (req, res) => {
    try {
        const dashboard = await obtenerDashboardEmpleador(req.user.id);
        return res.status(200).json({
            data: dashboard
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el dashboard del empleador'
        });
    }
};
