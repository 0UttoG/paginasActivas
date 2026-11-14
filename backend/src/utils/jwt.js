import jtw from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRT;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export const generateToken = (payload) => {
    return jtw.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
    try {
        return jtw.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};
