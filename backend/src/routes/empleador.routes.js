import { Router } from 'express';
import {
    obtenerEmpresaEmpleadorController,
    crearEmpresaEmpleadorController,
    actualizarEmpresaEmpleadorController,
    subirLogoEmpresaController,
    subirDocumentoEmpresaController,
    descargarDocumentoEmpresaController,
    listarVacantesEmpleadorController,
    crearVacanteEmpleadorController,
    obtenerVacanteEmpleadorController,
    actualizarVacanteEmpleadorController,
    cerrarVacanteEmpleadorController,
    listarPostulacionesEmpleadorController,
    obtenerCandidatoPostulacionEmpleadorController,
    descargarCvPostulacionEmpleadorController,
    actualizarEstadoPostulacionEmpleadorController
} from '../controllers/empleador.controller.js';
import { authHeader, permitirRoles } from '../middlewares/authHandler.js';
import { subirLogoEmpresa, subirDocumentoEmpresa } from '../middlewares/uploadHandler.js';

const router = Router();

//rutas del área de empleador
router.get('/empresa', authHeader, permitirRoles('empleador'), obtenerEmpresaEmpleadorController);
router.post('/empresa', authHeader, permitirRoles('empleador'), crearEmpresaEmpleadorController);
router.patch('/empresa', authHeader, permitirRoles('empleador'), actualizarEmpresaEmpleadorController);
router.post('/empresa/logo', authHeader, permitirRoles('empleador'), subirLogoEmpresa, subirLogoEmpresaController);
router.get('/empresa/documento', authHeader, permitirRoles('empleador'), descargarDocumentoEmpresaController);
router.post('/empresa/documento', authHeader, permitirRoles('empleador'), subirDocumentoEmpresa, subirDocumentoEmpresaController);
router.get('/vacantes', authHeader, permitirRoles('empleador'), listarVacantesEmpleadorController);
router.post('/vacantes', authHeader, permitirRoles('empleador'), crearVacanteEmpleadorController);
router.get('/vacantes/:id', authHeader, permitirRoles('empleador'), obtenerVacanteEmpleadorController);
router.patch('/vacantes/:id', authHeader, permitirRoles('empleador'), actualizarVacanteEmpleadorController);
router.patch('/vacantes/:id/cerrar', authHeader, permitirRoles('empleador'), cerrarVacanteEmpleadorController);
router.get('/postulaciones', authHeader, permitirRoles('empleador'), listarPostulacionesEmpleadorController);
router.get('/postulaciones/:id/candidato', authHeader, permitirRoles('empleador'), obtenerCandidatoPostulacionEmpleadorController);
router.get('/postulaciones/:id/cv', authHeader, permitirRoles('empleador'), descargarCvPostulacionEmpleadorController);
router.patch('/postulaciones/:id/estado', authHeader, permitirRoles('empleador'), actualizarEstadoPostulacionEmpleadorController);

export default router;
