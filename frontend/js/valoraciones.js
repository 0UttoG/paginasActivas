(function () {
    'use strict';

    const {
        escapeHtml,
        mostrarAlerta,
        apiFetch,
        formatearFecha,
        formatearMonedaSalario
    } = window.OPB;

    const estado = {
        pagina: 1,
        limite: 10,
        q: ''
    };

    function renderizarEstrellas(promedio) {
        const valor = Number(promedio || 0);
        const llenas = Math.round(valor);
        let html = '';
        for (let i = 1; i <= 5; i += 1) {
            html += i <= llenas ? '★ ' : '<span class="text-muted opacity-50">★</span> ';
        }
        return html;
    }

    function asegurarModalEmpresa() {
        let modalEl = document.getElementById('empresaValoracionesModal');
        if (modalEl) {
            return modalEl;
        }
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="modal fade" id="empresaValoracionesModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header bg-light border-bottom-0">
                            <div>
                                <h5 class="modal-title fw-bold text-midnight" id="modalEmpresaTitulo">Empresa</h5>
                                <div class="small text-muted" id="modalEmpresaMeta"></div>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4" id="modalEmpresaContenido">
                            Cargando...
                        </div>
                    </div>
                </div>
            </div>
        `;
        modalEl = wrapper.firstElementChild;
        document.body.appendChild(modalEl);
        return modalEl;
    }

    async function abrirDetalleEmpresa(empresaId) {
        const modalEl = asegurarModalEmpresa();
        const bodyEl = document.getElementById('modalEmpresaContenido');
        const titleEl = document.getElementById('modalEmpresaTitulo');
        const metaEl = document.getElementById('modalEmpresaMeta');
        if (bodyEl) bodyEl.innerHTML = '<div class="text-center py-4 text-muted">Cargando perfil y valoraciones...</div>';

        if (window.bootstrap && window.bootstrap.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }

        try {
            const [empresaRes, valRes, vacRes] = await Promise.all([
                apiFetch(`/api/empresas/${empresaId}`, { auth: false }),
                apiFetch(`/api/empresas/${empresaId}/valoraciones?limite=20`, { auth: false }),
                apiFetch(`/api/empresas/${empresaId}/vacantes?limite=10`, { auth: false })
            ]);

            const emp = empresaRes?.data || {};
            const valoraciones = Array.isArray(valRes?.data) ? valRes.data : [];
            const vacantes = Array.isArray(vacRes?.data) ? vacRes.data : [];

            if (titleEl) titleEl.textContent = emp.nombre_legal || 'Empresa';
            if (metaEl) {
                const prom = Number(emp.promedio || 0).toFixed(1);
                metaEl.innerHTML = `<span class="text-olive">${renderizarEstrellas(emp.promedio)}</span> (${prom} / 5.0) - ${Number(emp.total_valoraciones || 0)} reseñas`;
            }

            const htmlValoraciones = valoraciones.length === 0
                ? '<p class="text-muted small mb-0">Esta empresa aún no tiene reseñas registradas.</p>'
                : valoraciones.map((v) => `
                    <div class="bg-light rounded-3 p-3 mb-2">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong class="text-midnight">${escapeHtml(`${v.nombres || ''} ${v.apellidos || ''}`.trim() || 'Candidato')}</strong>
                            <span class="small text-muted">${escapeHtml(formatearFecha(v.fecha_creacion))}</span>
                        </div>
                        <div class="small text-olive mb-1">${renderizarEstrellas(v.calificacion)}</div>
                        <p class="mb-0 small text-muted">${escapeHtml(v.comentario || 'Sin comentario adicional.')}</p>
                    </div>
                `).join('');

            const htmlVacantes = vacantes.length === 0
                ? '<p class="text-muted small mb-0">Sin vacantes activas actualmente.</p>'
                : vacantes.map((job) => `
                    <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                        <div>
                            <div class="fw-semibold text-midnight">${escapeHtml(job.titulo)}</div>
                            <div class="small text-muted">${escapeHtml(job.ubicacion)} • ${escapeHtml(formatearMonedaSalario(job.salario_min, job.salario_max))}</div>
                        </div>
                        <a href="index.html?vacante=${job.id}" class="btn btn-sm btn-registro text-white">Ver vacante</a>
                    </div>
                `).join('');

            bodyEl.innerHTML = `
                <div class="mb-4">
                    <p class="mb-2 text-muted">${escapeHtml(emp.descripcion || 'Empresa verificada en Opportunity Bridge.')}</p>
                    ${emp.sitio_web ? `<div class="small"><a href="${escapeHtml(emp.sitio_web)}" class="text-berry" target="_blank" rel="noopener noreferrer">${escapeHtml(emp.sitio_web)}</a></div>` : ''}
                </div>
                <h6 class="fw-bold text-midnight mb-2">Reseñas de Candidatos (${valoraciones.length})</h6>
                <div class="mb-4">${htmlValoraciones}</div>
                <h6 class="fw-bold text-midnight mb-2">Vacantes Activas (${vacantes.length})</h6>
                <div>${htmlVacantes}</div>
            `;
        } catch (err) {
            if (bodyEl) {
                bodyEl.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(err.message)}</div>`;
            }
        }
    }

    function renderizarEmpresaCard(emp) {
        const iniciales = escapeHtml((emp.nombre_legal || 'EM').slice(0, 2).toUpperCase());
        const promedio = Number(emp.promedio || 0).toFixed(1);
        const total = Number(emp.total_valoraciones || 0);

        return `
            <div class="col-md-6">
                <div class="card border-0 shadow-sm p-4 h-100 rounded-3">
                    <div class="d-flex align-items-center mb-3">
                        <div class="rounded-circle bg-light text-midnight d-flex justify-content-center align-items-center fw-bold me-3 border" style="width: 50px; height: 50px;">${iniciales}</div>
                        <div>
                            <h5 class="fw-bold text-midnight mb-0">${escapeHtml(emp.nombre_legal)}</h5>
                            <div class="text-olive fs-6">
                                ${renderizarEstrellas(emp.promedio)}
                                <span class="text-muted small ms-1">(${promedio} / 5.0) - ${total} reseñas</span>
                            </div>
                        </div>
                    </div>
                    <div class="bg-light p-3 rounded-3 mb-3">
                        <p class="text-muted small mb-0 font-italic">"${escapeHtml(emp.descripcion || 'Empresa registrada y aprobada en Opportunity Bridge.')}"</p>
                    </div>
                    <div class="mt-auto text-end">
                        <a href="#" class="text-berry fw-medium text-decoration-none small opb-ver-empresa" data-id="${emp.id}">Ver todas las opiniones &rarr;</a>
                    </div>
                </div>
            </div>
        `;
    }

    async function cargarEmpresas() {
        const container = document.getElementById('companyReviewsContainer');
        if (!container) {
            return;
        }
        container.innerHTML = '<div class="col-12 text-center py-4 text-muted">Cargando empresas verificadas...</div>';

        const params = new URLSearchParams({
            pagina: String(estado.pagina),
            limite: String(estado.limite)
        });
        if (estado.q) {
            params.set('q', estado.q);
        }

        try {
            const res = await apiFetch(`/api/empresas?${params.toString()}`, { auth: false });
            const empresas = Array.isArray(res?.data) ? res.data : [];
            if (empresas.length === 0) {
                container.innerHTML = '<div class="col-12"><div class="bg-white border rounded-3 p-4 text-center text-muted">No se encontraron empresas con ese criterio.</div></div>';
                return;
            }
            container.innerHTML = empresas.map(renderizarEmpresaCard).join('');
            container.querySelectorAll('.opb-ver-empresa').forEach((link) => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    abrirDetalleEmpresa(link.getAttribute('data-id'));
                });
            });
        } catch (err) {
            mostrarAlerta(err.message, 'error');
            container.innerHTML = `<div class="col-12"><div class="alert alert-danger">${escapeHtml(err.message)}</div></div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const searchForm = document.getElementById('searchCompanyForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const input = searchForm.querySelector('input');
                estado.q = (input?.value || '').trim();
                estado.pagina = 1;
                cargarEmpresas();
            });
        }
        cargarEmpresas();
    });
})();
