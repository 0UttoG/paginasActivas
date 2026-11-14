import { Router } from 'express';
import {
    obtenerResumenAdminController,
    listarUsuariosAdminController,
    actualizarEstadoUsuarioAdminController,
    listarEmpresasAdminController,
    descargarDocumentoEmpresaAdminController,
    actualizarEstadoEmpresaAdminController,
    listarVacantesAdminController,
    actualizarEstadoVacanteAdminController,
    listarCategoriasEmpleoAdminController,
    crearCategoriaEmpleoAdminController,
    actualizarCategoriaEmpleoAdminController
} from '../controllers/admin.controller.js';
import { authHeader, permitirRoles } from '../middlewares/authHandler.js';

const router = Router();

//rutas del panel administrativo
router.get('/resumen', authHeader, permitirRoles('administrador'), obtenerResumenAdminController);
router.get('/usuarios', authHeader, permitirRoles('administrador'), listarUsuariosAdminController);
router.patch('/usuarios/:id/estado', authHeader, permitirRoles('administrador'), actualizarEstadoUsuarioAdminController);
router.get('/empresas', authHeader, permitirRoles('administrador'), listarEmpresasAdminController);
router.get('/empresas/:id/documento', authHeader, permitirRoles('administrador'), descargarDocumentoEmpresaAdminController);
router.patch('/empresas/:id/estado', authHeader, permitirRoles('administrador'), actualizarEstadoEmpresaAdminController);
router.get('/vacantes', authHeader, permitirRoles('administrador'), listarVacantesAdminController);
router.patch('/vacantes/:id/estado', authHeader, permitirRoles('administrador'), actualizarEstadoVacanteAdminController);
router.get('/categorias-empleo', authHeader, permitirRoles('administrador'), listarCategoriasEmpleoAdminController);
router.post('/categorias-empleo', authHeader, permitirRoles('administrador'), crearCategoriaEmpleoAdminController);
router.patch('/categorias-empleo/:id', authHeader, permitirRoles('administrador'), actualizarCategoriaEmpleoAdminController);

export default router;
