import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../utils/jwt.js';

//crear error controlado con código HTTP
const crearError = (mensaje, statusCode) => {
    const error = new Error(mensaje);
    error.statusCode = statusCode;
    return error;
};

//registrar nuevo usuario sin permitir autoasignación de administrador
export const registrarUsuario = async ({
    nombres,
    apellidos,
    correo,
    contrasena,
    telefono = null,
    rol_id,
    tipo_usuario
}) => {
    const correoNormalizado = correo.trim().toLowerCase();
    const existe = await pool.query(
        'SELECT id FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
        [correoNormalizado]
    );

    if (existe.rows.length > 0) {
        throw crearError('ya existe una cuenta con el correo', 409);
    }

    //resolver rol evitando autoasignación de administrador
    let rolResult;
    if (rol_id !== undefined && rol_id !== null && rol_id !== '') {
        const rolIdNumero = Number(rol_id);
        if (!Number.isInteger(rolIdNumero) || rolIdNumero <= 0) {
            throw crearError('el rol especificado no es válido', 400);
        }
        rolResult = await pool.query(
            'SELECT id, nombre FROM roles WHERE id = $1 LIMIT 1',
            [rolIdNumero]
        );
    } else if (tipo_usuario) {
        rolResult = await pool.query(
            'SELECT id, nombre FROM roles WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
            [String(tipo_usuario).trim()]
        );
    } else {
        rolResult = await pool.query(
            "SELECT id, nombre FROM roles WHERE nombre = 'candidato' LIMIT 1"
        );
    }

    if (rolResult.rows.length === 0) {
        throw crearError('el rol especificado no es válido', 400);
    }

    const rol = rolResult.rows[0];
    if (rol.nombre === 'administrador') {
        throw crearError('no se permite registrar una cuenta de administrador', 403);
    }

    const hash = await bcrypt.hash(contrasena, 10);
    const telefonoNormalizado = telefono && String(telefono).trim() !== ''
        ? String(telefono).trim()
        : null;

    try {
        const { rows } = await pool.query(
            `INSERT INTO usuarios (rol_id, nombres, apellidos, correo, contrasena_hash, telefono)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, rol_id, nombres, apellidos, correo, telefono, estado, fecha_registro`,
            [rol.id, nombres.trim(), apellidos.trim(), correoNormalizado, hash, telefonoNormalizado]
        );

        return {
            ...rows[0],
            rol: rol.nombre
        };
    } catch (error) {
        if (error.code === '23505') {
            throw crearError('ya existe una cuenta con el correo', 409);
        }
        throw error;
    }
};

//autenticar usuario y generar token jwt
export const loginUsuario = async ({ correo, contrasena }) => {
    const correoNormalizado = correo.trim().toLowerCase();
    const { rows } = await pool.query(
        `SELECT u.id, u.rol_id, u.nombres, u.apellidos, u.correo, u.contrasena_hash, u.estado, r.nombre AS rol
        FROM usuarios u
        JOIN roles r ON r.id = u.rol_id
        WHERE LOWER(u.correo) = $1
        LIMIT 1`,
        [correoNormalizado]
    );

    if (rows.length === 0) {
        throw crearError('correo o contraseña incorrectos', 401);
    }

    const usuario = rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);

    if (!contrasenaValida) {
        throw crearError('correo o contraseña incorrectos', 401);
    }

    if (usuario.estado !== 'activo') {
        throw crearError('la cuenta se encuentra suspendida', 403);
    }

    const token = generateToken({
        id: usuario.id,
        sub: usuario.id,
        correo: usuario.correo,
        rol_id: usuario.rol_id,
        rol: usuario.rol,
        role: usuario.rol
    });

    return {
        token,
        expira_en: process.env.JWT_EXPIRES_IN || '8h',
        usuario: {
            id: usuario.id,
            rol_id: usuario.rol_id,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            correo: usuario.correo,
            estado: usuario.estado,
            rol: usuario.rol
        }
    };
};

//obtener datos del usuario autenticado sin contraseña
export const obtenerUsuarioActual = async (id) => {
    const { rows } = await pool.query(
        `SELECT u.id, u.rol_id, u.nombres, u.apellidos, u.correo, u.telefono, u.estado, u.fecha_registro, r.nombre AS rol
        FROM usuarios u
        JOIN roles r ON r.id = u.rol_id
        WHERE u.id = $1
        LIMIT 1`,
        [id]
    );

    if (rows.length === 0) {
        throw crearError('usuario no encontrado', 404);
    }

    const usuario = rows[0];
    if (usuario.estado !== 'activo') {
        throw crearError('la cuenta se encuentra suspendida', 403);
    }

    return usuario;
};

