import { Router } from 'express';
import {
    obtenerPerfilCandidatoController,
    actualizarPerfilCandidatoController,
    subirCvCandidatoController,
    descargarCvCandidatoController,
    crearPostulacionCandidatoController
} from '../controllers/perfil.controller.js';
import { authHeader, permitirRoles } from '../middlewares/authHandler.js';
import { subirCvCandidato } from '../middlewares/uploadHandler.js';

const router = Router();

//rutas del perfil del candidato
router.get('/', authHeader, permitirRoles('candidato'), obtenerPerfilCandidatoController);
router.patch('/', authHeader, permitirRoles('candidato'), actualizarPerfilCandidatoController);
router.get('/cv', authHeader, permitirRoles('candidato'), descargarCvCandidatoController);
router.post('/cv', authHeader, permitirRoles('candidato'), subirCvCandidato, subirCvCandidatoController);
router.post('/postulaciones', authHeader, permitirRoles('candidato'), crearPostulacionCandidatoController);

export default router;
