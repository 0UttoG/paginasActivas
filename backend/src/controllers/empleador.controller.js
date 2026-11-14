import {
    obtenerEmpresaEmpleador,
    crearEmpresaEmpleador,
    actualizarEmpresaEmpleador,
    actualizarLogoEmpresa,
    actualizarDocumentoEmpresa,
    obtenerArchivoDocumentoEmpresa,
    listarVacantesEmpleador
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
