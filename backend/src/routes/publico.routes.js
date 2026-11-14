import { Router } from 'express';
import {
    obtenerMetricasInicioController,
    obtenerCategoriasEmpleoController,
    listarVacantesPublicasController,
    obtenerDetalleVacantePublicaController,
    listarEmpresasPublicasController,
    obtenerDetalleEmpresaPublicaController,
    listarVacantesDeEmpresaPublicaController,
    listarValoracionesDeEmpresaPublicaController
} from '../controllers/publico.controller.js';

const router = Router();

//rutas públicas de inicio, catálogos, vacantes y empresas
router.get('/inicio/metricas', obtenerMetricasInicioController);
router.get('/catalogos/categorias-empleo', obtenerCategoriasEmpleoController);
router.get('/vacantes', listarVacantesPublicasController);
router.get('/vacantes/:id', obtenerDetalleVacantePublicaController);
router.get('/empresas', listarEmpresasPublicasController);
router.get('/empresas/:id', obtenerDetalleEmpresaPublicaController);
router.get('/empresas/:id/vacantes', listarVacantesDeEmpresaPublicaController);
router.get('/empresas/:id/valoraciones', listarValoracionesDeEmpresaPublicaController);

export default router;
