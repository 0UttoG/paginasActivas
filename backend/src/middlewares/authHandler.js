import { pool } from '../db.js';
import { verifyToken } from '../utils/jwt.js';

//validar token y estado actual del usuario en la base de datos
export const authHeader = async (req, res, next) => {
    let decoded;
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        const token = header.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        decoded = verifyToken(token);
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }

    try {
        const usuarioId = decoded.id ?? decoded.sub;
        if (!usuarioId) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const { rows } = await pool.query(
            `SELECT u.id, u.rol_id, u.nombres, u.apellidos, u.correo, u.estado, r.nombre AS rol
            FROM usuarios u
            JOIN roles r ON r.id = u.rol_id
            WHERE u.id = $1
            LIMIT 1`,
            [usuarioId]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no válido' });
        }

        const usuario = rows[0];
        if (usuario.estado !== 'activo') {
            return res.status(403).json({ error: 'La cuenta se encuentra suspendida' });
        }

        req.user = {
            ...usuario,
            rol: usuario.rol,
            role: usuario.rol
        };

        return next();
    } catch (error) {
        return next(error);
    }
};

//verificar que el usuario tenga alguno de los roles permitidos
export const permitirRoles = (...roles) => {
    return (req, res, next) => {
        const rolUsuario = req.user?.rol || req.user?.role;
        if (!rolUsuario || !roles.includes(rolUsuario)) {
            return res.status(403).json({ error: 'No tienes permiso para acceder a este recurso' });
        }
        return next();
    };
};