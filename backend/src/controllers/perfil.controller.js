import {
    obtenerPerfilCandidato,
    actualizarPerfilCandidato,
    actualizarCvCandidato,
    obtenerArchivoCvCandidato,
    crearPostulacionCandidato,
    listarPostulacionesCandidato,
    listarGuardadosCandidato,
    guardarVacanteCandidato,
    eliminarVacanteGuardadaCandidato,
    listarNotificacionesUsuario,
    marcarNotificacionLeida,
    obtenerDashboardCandidato
} from '../services/perfilServices.js';

//controlador para obtener el perfil del candidato autenticado
export const obtenerPerfilCandidatoController = async (req, res) => {
    try {
        const perfil = await obtenerPerfilCandidato(req.user.id);
        return res.status(200).json({ data: perfil });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el perfil'
        });
    }
};

//controlador para actualizar el perfil del candidato autenticado
export const actualizarPerfilCandidatoController = async (req, res) => {
    try {
        const perfilActualizado = await actualizarPerfilCandidato(req.user.id, req.body);
        return res.status(200).json({
            mensaje: 'perfil actualizado',
            data: perfilActualizado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar el perfil'
        });
    }
};

//controlador para subir o reemplazar el cv del candidato
export const subirCvCandidatoController = async (req, res) => {
    try {
        const resultado = await actualizarCvCandidato(req.user.id, req.archivoSubido);
        return res.status(201).json({
            mensaje: 'cv subido correctamente',
            data: resultado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al subir el cv'
        });
    }
};

//controlador para consultar o descargar el cv actual del candidato
export const descargarCvCandidatoController = async (req, res) => {
    try {
        const { rutaAbsoluta } = await obtenerArchivoCvCandidato(req.user.id);
        return res.sendFile(rutaAbsoluta, (err) => {
            if (err && !res.headersSent) {
                res.status(500).json({ mensaje: 'error al leer el archivo de cv' });
            }
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el cv'
        });
    }
};

//controlador para crear una postulación del candidato
export const crearPostulacionCandidatoController = async (req, res) => {
    try {
        const postulacion = await crearPostulacionCandidato(req.user.id, req.body);
        return res.status(201).json({
            mensaje: 'postulación enviada correctamente',
            data: postulacion
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al registrar la postulación'
        });
    }
};

//controlador para listar las postulaciones del candidato
export const listarPostulacionesCandidatoController = async (req, res) => {
    try {
        const resultado = await listarPostulacionesCandidato(req.user.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar las postulaciones'
        });
    }
};

//controlador para listar las vacantes guardadas del candidato
export const listarGuardadosCandidatoController = async (req, res) => {
    try {
        const resultado = await listarGuardadosCandidato(req.user.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar vacantes guardadas'
        });
    }
};

//controlador para guardar una vacante en favoritos del candidato
export const guardarVacanteCandidatoController = async (req, res) => {
    try {
        const guardado = await guardarVacanteCandidato(req.user.id, req.body);
        return res.status(201).json({
            mensaje: 'vacante guardada correctamente',
            data: guardado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al guardar la vacante'
        });
    }
};

//controlador para eliminar una vacante de guardados del candidato
export const eliminarVacanteGuardadaCandidatoController = async (req, res) => {
    try {
        await eliminarVacanteGuardadaCandidato(req.user.id, req.params.vacanteId);
        return res.status(204).send();
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al eliminar la vacante guardada'
        });
    }
};

//controlador para listar notificaciones del usuario autenticado
export const listarNotificacionesUsuarioController = async (req, res) => {
    try {
        const resultado = await listarNotificacionesUsuario(req.user.id, req.query);
        return res.status(200).json(resultado);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al listar notificaciones'
        });
    }
};

//controlador para marcar una notificación como leída
export const marcarNotificacionLeidaController = async (req, res) => {
    try {
        const notificacion = await marcarNotificacionLeida(req.user.id, req.params.id);
        return res.status(200).json({
            mensaje: 'notificación marcada como leída',
            data: notificacion
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al actualizar la notificación'
        });
    }
};

//controlador para obtener el dashboard resumen del candidato autenticado
export const obtenerDashboardCandidatoController = async (req, res) => {
    try {
        const dashboard = await obtenerDashboardCandidato(req.user.id);
        return res.status(200).json({
            data: dashboard
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el dashboard del candidato'
        });
    }
};
