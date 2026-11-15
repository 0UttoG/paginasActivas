import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db.js';

const ADMIN_SEED = {
    nombres: 'Nestor',
    apellidos: 'Uto',
    correo: 'nestoruto@gmail.com',
    contrasena: '@nestoruto1'
};

//sembrar usuario administrador de forma idempotente
const sembrarAdmin = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO roles (nombre)
            VALUES ('administrador')
            ON CONFLICT (nombre) DO NOTHING`
        );

        const { rows: roles } = await client.query(
            "SELECT id, nombre FROM roles WHERE nombre = 'administrador' LIMIT 1"
        );

        if (roles.length === 0) {
            throw new Error('No se pudo resolver el rol administrador');
        }

        const rolAdmin = roles[0];
        const correoNormalizado = ADMIN_SEED.correo.trim().toLowerCase();
        const hash = await bcrypt.hash(ADMIN_SEED.contrasena, 10);

        const { rows: usuarios } = await client.query(
            `INSERT INTO usuarios (rol_id, nombres, apellidos, correo, contrasena_hash, estado)
            VALUES ($1, $2, $3, $4, $5, 'activo')
            ON CONFLICT (correo) DO UPDATE
                SET rol_id = EXCLUDED.rol_id,
                    nombres = EXCLUDED.nombres,
                    apellidos = EXCLUDED.apellidos,
                    contrasena_hash = EXCLUDED.contrasena_hash,
                    estado = 'activo'
            RETURNING id, rol_id, nombres, apellidos, correo, estado`,
            [rolAdmin.id, ADMIN_SEED.nombres, ADMIN_SEED.apellidos, correoNormalizado, hash]
        );

        await client.query('COMMIT');

        const admin = usuarios[0];
        console.log(`Administrador listo: id=${admin.id}, correo=${admin.correo}, rol=${rolAdmin.nombre}, estado=${admin.estado}`);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

sembrarAdmin().catch((error) => {
    console.error('Error al sembrar administrador:', error.message);
    process.exitCode = 1;
});
