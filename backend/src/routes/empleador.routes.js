import { Router } from 'express';
import {
    obtenerEmpresaEmpleadorController,
    crearEmpresaEmpleadorController
} from '../controllers/empleador.controller.js';
import { authHeader, permitirRoles } from '../middlewares/authHandler.js';

const router = Router();

//rutas del área de empleador
router.get('/empresa', authHeader, permitirRoles('empleador'), obtenerEmpresaEmpleadorController);
router.post('/empresa', authHeader, permitirRoles('empleador'), crearEmpresaEmpleadorController);

export default router;
