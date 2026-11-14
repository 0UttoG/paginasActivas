import {
    obtenerPerfilCandidato,
    actualizarPerfilCandidato,
    actualizarCvCandidato,
    obtenerArchivoCvCandidato,
    crearPostulacionCandidato
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
