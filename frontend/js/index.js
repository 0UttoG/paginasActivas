(function () {
    'use strict';

    const {
        escapeHtml,
        getToken,
        getRol,
        mostrarAlerta,
        apiFetch,
        formatearFecha,
        formatearMonedaSalario,
        abrirModal,
        ocultarModal
    } = window.OPB;

    const MODALIDADES_VALIDAS = new Set(['remoto', 'hibrido', 'presencial']);
    const MAPA_CONTRATO = {
        fulltime: 'tiempo_completo',
        parttime: 'medio_tiempo',
        freelance: 'proyecto',
        tiempo_completo: 'tiempo_completo',
        medio_tiempo: 'medio_tiempo',
        proyecto: 'proyecto',
        pasantia: 'pasantia'
    };
    const MAPA_EXPERIENCIA = {
        semisenior: 'intermedio',
        sin_experiencia: 'sin_experiencia',
        junior: 'junior',
        intermedio: 'intermedio',
        senior: 'senior'
    };
    const ETIQUETAS_ENUM = {
        remoto: 'Remoto',
        hibrido: 'Híbrido',
        presencial: 'Presencial',
        tiempo_completo: 'Tiempo Completo',
        medio_tiempo: 'Medio Tiempo',
        proyecto: 'Freelance / Proyecto',
        pasantia: 'Pasantía',
        sin_experiencia: 'Sin experiencia',
        junior: 'Junior',
        intermedio: 'Semi-Senior / Intermedio',
        senior: 'Senior'
    };

    const estado = {
        pagina: 1,
        limite: 8,
        guardadosIds: new Set(),
        vacanteActualId: null
    };

    function prepararModalAplicacion() {
        const formApply = document.getElementById('formAplicarEmpleo');
        if (!formApply) {
            return;
        }
        if (!document.getElementById('applyCoverLetter')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'mb-3 text-start';
            wrapper.innerHTML = `
                <label for="applyCoverLetter" class="form-label fw-medium text-midnight small">Carta de presentación (opcional)</label>
                <textarea class="form-control form-control-sm" id="applyCoverLetter" rows="2" placeholder="Mensaje breve para el reclutador..."></textarea>
            `;
            formApply.prepend(wrapper);
        }
        if (!document.getElementById('btnSaveFromModal')) {
            const btnSave = document.createElement('button');
            btnSave.type = 'button';
            btnSave.id = 'btnSaveFromModal';
            btnSave.className = 'btn btn-outline-secondary me-2 px-3';
            btnSave.textContent = 'Guardar oferta';
            btnSave.addEventListener('click', () => {
                if (estado.vacanteActualId) {
                    alternarGuardado(estado.vacanteActualId);
                }
            });
            const submitBtn = formApply.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.parentElement.insertBefore(btnSave, submitBtn);
            }
        }
    }

    async function cargarMetricasInicio() {
        try {
            const res = await apiFetch('/api/inicio/metricas', { auth: false });
            const m = res?.data || {};
            const asignar = (id, valor) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = Number(valor ?? 0).toLocaleString('en-US');
                }
            };
            asignar('metricEmpresas', m.empresas_aprobadas);
            asignar('metricUsuarios', m.candidatos_activos);
            asignar('metricEmpleos', m.vacantes_activas);
            asignar('metricSolicitudes', m.total_postulaciones);
        } catch {
            // mantener texto existente si falla
        }
    }

    async function cargarGuardadosCandidato() {
        estado.guardadosIds.clear();
        if (!getToken() || getRol() !== 'candidato') {
            return;
        }
        try {
            const res = await apiFetch('/api/perfil/guardados?limite=100');
            const items = Array.isArray(res?.data) ? res.data : [];
            items.forEach((item) => {
                if (item.vacante_id) {
                    estado.guardadosIds.add(Number(item.vacante_id));
                }
            });
        } catch {
            // ignorar
        }
    }

    function construirQueryVacantes() {
        const params = new URLSearchParams();
        params.set('pagina', String(estado.pagina));
        params.set('limite', String(estado.limite));

        const q = (document.getElementById('keywordInput')?.value || '').trim();
        if (q) {
            params.set('q', q);
        }

        const rawLocation = (document.getElementById('locationFilter')?.value || '').trim();
        if (rawLocation) {
            if (MODALIDADES_VALIDAS.has(rawLocation.toLowerCase())) {
                params.set('modalidad', rawLocation.toLowerCase());
            } else {
                params.set('ubicacion', rawLocation);
            }
        }

        const rawContrato = (document.getElementById('typeFilter')?.value || '').trim().toLowerCase();
        if (rawContrato && MAPA_CONTRATO[rawContrato]) {
            params.set('tipo_contrato', MAPA_CONTRATO[rawContrato]);
        }

        const rawSal = (document.getElementById('salaryFilter')?.value || '').trim();
        if (rawSal === '500-1000') {
            params.set('salario_min', '500');
            params.set('salario_max', '1000');
        } else if (rawSal === '1000-2000') {
            params.set('salario_min', '1000');
            params.set('salario_max', '2000');
        } else if (rawSal === '2000+') {
            params.set('salario_min', '2000');
        } else if (rawSal && /^\d+(\.\d+)?$/.test(rawSal)) {
            params.set('salario_min', rawSal);
        }

        const rawExp = (document.getElementById('experienceFilter')?.value || '').trim().toLowerCase();
        if (rawExp && MAPA_EXPERIENCIA[rawExp]) {
            params.set('nivel_experiencia', MAPA_EXPERIENCIA[rawExp]);
        }

        return params.toString();
    }

    function renderizarPaginacion(meta) {
        const container = document.getElementById('recentJobsContainer');
        if (!container) {
            return;
        }
        let nav = document.getElementById('opbJobsPagination');
        if (!nav) {
            nav = document.createElement('nav');
            nav.id = 'opbJobsPagination';
            nav.className = 'mt-4 d-flex justify-content-center';
            container.insertAdjacentElement('afterend', nav);
        }

        const paginas = Number(meta?.paginas || 0);
        const paginaActual = Number(meta?.pagina || 1);
        if (paginas <= 1) {
            nav.innerHTML = '';
            return;
        }

        let botones = '';
        for (let p = 1; p <= paginas; p += 1) {
            const activa = p === paginaActual ? 'active' : '';
            botones += `
                <li class="page-item ${activa}">
                    <button class="page-link opb-page-btn" type="button" data-page="${p}">${p}</button>
                </li>
            `;
        }
        nav.innerHTML = `<ul class="pagination">${botones}</ul>`;
        nav.querySelectorAll('.opb-page-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                estado.pagina = Number(btn.getAttribute('data-page')) || 1;
                buscarYRenderizarVacantes();
            });
        });
    }

    function renderizarTarjetaVacante(v) {
        const modTexto = ETIQUETAS_ENUM[v.modalidad] || v.modalidad || 'Presencial';
        const contratoTexto = ETIQUETAS_ENUM[v.tipo_contrato] || v.tipo_contrato || 'Tiempo Completo';
        const expTexto = ETIQUETAS_ENUM[v.nivel_experiencia] || v.nivel_experiencia || 'Intermedio';
        const badgeClase = v.modalidad === 'remoto' ? 'bg-lime text-midnight' : 'bg-olive text-white';

        return `
            <div class="col-md-6">
                <div class="card job-card h-100 bg-white border-0 shadow-sm p-4">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5 class="fw-bold mb-1">${escapeHtml(v.titulo)}</h5>
                            <p class="text-muted mb-0">${escapeHtml(v.nombre_legal)}</p>
                        </div>
                        <span class="badge ${badgeClase} px-3 py-2 rounded-pill">${escapeHtml(modTexto)}</span>
                    </div>
                    <div class="d-flex flex-wrap gap-3 mb-3 text-muted small fw-medium">
                        <span>📍 ${escapeHtml(v.ubicacion)} (${escapeHtml(modTexto)})</span>
                        <span>💰 ${escapeHtml(formatearMonedaSalario(v.salario_min, v.salario_max))}</span>
                        <span>⏱️ ${escapeHtml(contratoTexto)}</span>
                    </div>
                    <p class="text-muted small mb-4">${escapeHtml(v.categoria || 'General')} • Nivel: ${escapeHtml(expTexto)} • Publicado: ${escapeHtml(formatearFecha(v.fecha_publicacion))}</p>
                    <div class="mt-auto">
                        <button type="button" class="btn btn-registro text-white w-100 py-2 opb-ver-vacante" data-id="${v.id}">Ver Detalles y Postularse</button>
                    </div>
                </div>
            </div>
        `;
    }

    async function buscarYRenderizarVacantes() {
        const container = document.getElementById('recentJobsContainer');
        if (!container) {
            return;
        }
        container.innerHTML = '<div class="col-12 text-center py-4 text-muted">Cargando vacantes disponibles...</div>';

        try {
            const qs = construirQueryVacantes();
            const res = await apiFetch(`/api/vacantes?${qs}`, { auth: false });
            const vacantes = Array.isArray(res?.data) ? res.data : [];

            if (vacantes.length === 0) {
                container.innerHTML = `
                    <div class="col-12">
                        <div class="bg-white border rounded-3 text-center py-4 text-muted">
                            No se encontraron vacantes activas con los filtros seleccionados.
                        </div>
                    </div>
                `;
                renderizarPaginacion(res?.meta);
                return;
            }

            container.innerHTML = vacantes.map(renderizarTarjetaVacante).join('');
            renderizarPaginacion(res?.meta);

            container.querySelectorAll('.opb-ver-vacante').forEach((btn) => {
                btn.addEventListener('click', () => abrirDetalleVacante(btn.getAttribute('data-id')));
            });
        } catch (err) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">${escapeHtml(err.message)}</div>
                </div>
            `;
        }
    }

    function actualizarBotonGuardadoModal(vacanteId) {
        const btn = document.getElementById('btnSaveFromModal');
        if (!btn) {
            return;
        }
        const guardada = estado.guardadosIds.has(Number(vacanteId));
        btn.className = guardada ? 'btn btn-warning me-2 px-3' : 'btn btn-outline-secondary me-2 px-3';
        btn.textContent = guardada ? 'Guardada ✓' : 'Guardar oferta';
    }

    async function alternarGuardado(vacanteIdParam) {
        const vacanteId = Number(vacanteIdParam);
        if (!getToken()) {
            mostrarAlerta('Inicia sesión como candidato para guardar vacantes.', 'warning');
            abrirModal('loginModal');
            return;
        }
        if (getRol() !== 'candidato') {
            mostrarAlerta('Solo los candidatos pueden guardar vacantes.', 'warning');
            return;
        }

        try {
            if (estado.guardadosIds.has(vacanteId)) {
                await apiFetch(`/api/perfil/guardados/${vacanteId}`, { method: 'DELETE' });
                estado.guardadosIds.delete(vacanteId);
                mostrarAlerta('Vacante removida de tus guardados.', 'info');
            } else {
                await apiFetch('/api/perfil/guardados', {
                    method: 'POST',
                    body: { vacante_id: vacanteId }
                });
                estado.guardadosIds.add(vacanteId);
                mostrarAlerta('Vacante guardada en tu perfil.', 'success');
            }
            actualizarBotonGuardadoModal(vacanteId);
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    function renderizarRequisitosLista(rawRequisitos) {
        const ul = document.getElementById('detailJobRequirements');
        if (!ul) {
            return;
        }
        if (!rawRequisitos || !String(rawRequisitos).trim()) {
            ul.innerHTML = '<li>No se especificaron requisitos adicionales.</li>';
            return;
        }
        const items = String(rawRequisitos)
            .split(/\r?\n|;\s*/)
            .map((linea) => linea.replace(/^[-*•]\s*/, '').trim())
            .filter(Boolean);
        const lista = items.length > 0 ? items : [String(rawRequisitos).trim()];
        ul.innerHTML = lista.map((req) => `<li>${escapeHtml(req)}</li>`).join('');
    }

    async function abrirDetalleVacante(vacanteId) {
        try {
            const res = await apiFetch(`/api/vacantes/${vacanteId}`, { auth: false });
            const v = res?.data;
            if (!v) {
                mostrarAlerta('No se encontró el detalle de la vacante.', 'warning');
                return;
            }
            estado.vacanteActualId = Number(v.id);

            const asignarTexto = (id, texto) => {
                const el = document.getElementById(id);
                if (el) el.textContent = texto || 'N/D';
            };

            const modTexto = ETIQUETAS_ENUM[v.modalidad] || v.modalidad || 'N/D';
            const contratoTexto = ETIQUETAS_ENUM[v.tipo_contrato] || v.tipo_contrato || 'N/D';
            const expTexto = ETIQUETAS_ENUM[v.nivel_experiencia] || v.nivel_experiencia || '';

            asignarTexto('detailJobTitle', v.titulo);
            asignarTexto('detailJobCompany', v.nombre_legal);
            asignarTexto('detailJobLocation', `${v.ubicacion} (${modTexto})`);
            asignarTexto('detailJobSalary', formatearMonedaSalario(v.salario_min, v.salario_max));
            asignarTexto('detailJobType', expTexto ? `${contratoTexto} • ${expTexto}` : contratoTexto);
            asignarTexto('detailJobDate', formatearFecha(v.fecha_publicacion));
            asignarTexto('detailJobDescription', v.descripcion);
            renderizarRequisitosLista(v.requisitos);

            const applyJobId = document.getElementById('applyJobId');
            if (applyJobId) {
                applyJobId.value = String(v.id);
            }
            const coverEl = document.getElementById('applyCoverLetter');
            if (coverEl) {
                coverEl.value = '';
            }

            actualizarBotonGuardadoModal(v.id);
            abrirModal('detalleEmpleoModal');
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    function vincularEventos() {
        const searchForm = document.getElementById('searchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                event.preventDefault();
                estado.pagina = 1;
                buscarYRenderizarVacantes();
            });
            ['locationFilter', 'typeFilter', 'salaryFilter', 'experienceFilter'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => {
                        estado.pagina = 1;
                        buscarYRenderizarVacantes();
                    });
                }
            });
        }

        const verTodasLink = document.querySelector('.recent-jobs-section a.text-berry');
        if (verTodasLink) {
            verTodasLink.addEventListener('click', (event) => {
                event.preventDefault();
                if (searchForm) searchForm.reset();
                estado.pagina = 1;
                estado.limite = 20;
                buscarYRenderizarVacantes();
            });
        }

        const formAplicar = document.getElementById('formAplicarEmpleo');
        if (formAplicar) {
            formAplicar.addEventListener('submit', async (event) => {
                event.preventDefault();
                const vacanteId = Number(document.getElementById('applyJobId')?.value || estado.vacanteActualId);
                if (!vacanteId) {
                    return;
                }
                if (!getToken()) {
                    mostrarAlerta('Inicia sesión como candidato para postularte.', 'warning');
                    abrirModal('loginModal');
                    return;
                }
                if (getRol() !== 'candidato') {
                    mostrarAlerta('Solo las cuentas de tipo candidato pueden postularse.', 'warning');
                    return;
                }

                const carta = (document.getElementById('applyCoverLetter')?.value || '').trim();
                const btn = formAplicar.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;

                try {
                    await apiFetch('/api/perfil/postulaciones', {
                        method: 'POST',
                        body: {
                            vacante_id: vacanteId,
                            carta_presentacion: carta || null
                        }
                    });
                    ocultarModal('detalleEmpleoModal');
                    mostrarAlerta('¡Postulación enviada correctamente!', 'success');
                    cargarMetricasInicio();
                } catch (err) {
                    mostrarAlerta(err.message, err.status === 422 ? 'warning' : 'error');
                    if (err.status === 422) {
                        window.setTimeout(() => {
                            window.location.href = 'perfil-usuario.html';
                        }, 1600);
                    }
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        prepararModalAplicacion();
        vincularEventos();
        await Promise.all([
            cargarMetricasInicio(),
            cargarGuardadosCandidato()
        ]);
        const urlParams = new URLSearchParams(window.location.search);
        const qParam = urlParams.get('q');
        const kwInput = document.getElementById('keywordInput');
        if (qParam && kwInput) {
            kwInput.value = qParam;
        }
        await buscarYRenderizarVacantes();

        const vacanteParam = urlParams.get('vacante');
        if (vacanteParam) {
            abrirDetalleVacante(vacanteParam);
        }
    });
})();
