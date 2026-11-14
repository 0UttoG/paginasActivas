import {
    registrarUsuario,
    loginUsuario,
    obtenerUsuarioActual
} from "../services/authServices.js";

//controlador para registrar un nuevo usuario
export const registrarUsuarioController = async (req, res) => {
    try {
        const { nombres, apellidos, correo, contrasena, telefono, rol_id, tipo_usuario } = req.body;

        const usuarioCreado = await registrarUsuario({
            nombres,
            apellidos,
            correo,
            contrasena,
            telefono,
            rol_id,
            tipo_usuario
        });

        return res.status(201).json({
            mensaje: 'usuario creado',
            usuario: usuarioCreado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al registrar el usuario'
        });
    }
};

//controlador para iniciar sesión
export const loginUsuarioController = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        const resultado = await loginUsuario({ correo, contrasena });

        return res.status(200).json({
            mensaje: 'inicio de sesión exitoso',
            ...resultado
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al iniciar sesión'
        });
    }
};

//controlador para consultar la sesión actual
export const obtenerUsuarioActualController = async (req, res) => {
    try {
        const usuario = await obtenerUsuarioActual(req.user.id);
        return res.status(200).json({ usuario });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            mensaje: error.message || 'error al obtener el usuario actual'
        });
    }
};