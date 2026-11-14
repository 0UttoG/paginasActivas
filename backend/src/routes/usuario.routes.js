import { Router } from 'express';
import {
    registrarUsuarioController,
    loginUsuarioController,
    obtenerUsuarioActualController
} from '../controllers/usuario.controller.js';
import { authHeader } from '../middlewares/authHandler.js';
import {
    runValidateRequest,
    validarRegistro,
    validarLogin
} from '../middlewares/validators.js';

const router = Router();

//rutas de autenticación y usuario actual
router.post('/registro', runValidateRequest(validarRegistro), registrarUsuarioController);
router.post('/login', runValidateRequest(validarLogin), loginUsuarioController);
router.get('/me', authHeader, obtenerUsuarioActualController);

export default router;