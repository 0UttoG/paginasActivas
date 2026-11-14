import { Router } from 'express';
import {
    obtenerEmpresaEmpleadorController,
    crearEmpresaEmpleadorController,
    actualizarEmpresaEmpleadorController,
    subirLogoEmpresaController,
    subirDocumentoEmpresaController,
    descargarDocumentoEmpresaController,
    listarVacantesEmpleadorController
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

export default router;
