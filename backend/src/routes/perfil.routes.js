import { Router } from 'express';
import {
    obtenerPerfilCandidatoController,
    obtenerDashboardCandidatoController,
    actualizarPerfilCandidatoController,
    subirCvCandidatoController,
    descargarCvCandidatoController,
    crearPostulacionCandidatoController,
    listarPostulacionesCandidatoController,
    listarGuardadosCandidatoController,
    guardarVacanteCandidatoController,
    eliminarVacanteGuardadaCandidatoController,
    listarNotificacionesUsuarioController,
    marcarNotificacionLeidaController
} from '../controllers/perfil.controller.js';
import { authHeader, permitirRoles } from '../middlewares/authHandler.js';
import { subirCvCandidato } from '../middlewares/uploadHandler.js';

const router = Router();

//rutas del perfil del candidato
router.get('/', authHeader, permitirRoles('candidato'), obtenerPerfilCandidatoController);
router.get('/dashboard', authHeader, permitirRoles('candidato'), obtenerDashboardCandidatoController);
router.patch('/', authHeader, permitirRoles('candidato'), actualizarPerfilCandidatoController);
router.get('/cv', authHeader, permitirRoles('candidato'), descargarCvCandidatoController);
router.post('/cv', authHeader, permitirRoles('candidato'), subirCvCandidato, subirCvCandidatoController);
router.get('/postulaciones', authHeader, permitirRoles('candidato'), listarPostulacionesCandidatoController);
router.post('/postulaciones', authHeader, permitirRoles('candidato'), crearPostulacionCandidatoController);
router.get('/guardados', authHeader, permitirRoles('candidato'), listarGuardadosCandidatoController);
router.post('/guardados', authHeader, permitirRoles('candidato'), guardarVacanteCandidatoController);
router.delete('/guardados/:vacanteId', authHeader, permitirRoles('candidato'), eliminarVacanteGuardadaCandidatoController);
router.get('/notificaciones', authHeader, listarNotificacionesUsuarioController);
router.patch('/notificaciones/:id/leida', authHeader, marcarNotificacionLeidaController);

export default router;
