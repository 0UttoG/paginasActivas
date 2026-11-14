import {verifyToken} from '../utils/jwt.js';


export const authHeader = (req, res, next) => {
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({error: 'Token no proporcionado'});
        }
        const token = authHeader.split(' ')[1];

        req.user = verifyToken(token);
        return next();
    } catch (error) {
        return res.status(401).json({error: error.message});
    }
};
export const permitirRoles = (...roles) => {
    return (req, res, next) => {
        if(!roles.includes(req.user.role)){
            return res.status(403).json({error: 'No tienes permiso para acceder a este recurso'});
        }
        return next();
    };
};