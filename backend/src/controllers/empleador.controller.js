import {
    obtenerEmpresaEmpleador,
    crearEmpresaEmpleador
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
