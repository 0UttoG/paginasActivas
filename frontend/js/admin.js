(function () {
    'use strict';

    const {
        escapeHtml,
        clearSession,
        obtenerIniciales,
        mostrarAlerta,
        apiFetch,
        descargarArchivoAutenticado,
        formatearFecha,
        badgeEstado,
        exigirRol
    } = window.OPB;

    let motivoCallback = null;

    function inicializarCabecera(usuario) {
        const topRight = document.querySelector('header .d-flex.align-items-center');
        if (topRight) {
            const labelSpan = topRight.querySelector('span.fw-medium');
            if (labelSpan) {
                labelSpan.textContent = `Admin: ${`${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim() || usuario?.correo}`;
            }
            const avatar = topRight.querySelector('.rounded-circle');
            if (avatar) {
                avatar.textContent = obtenerIniciales(usuario);
            }
        }

        const exitLink = document.querySelector('header a[href="index.html"]');
        if (exitLink) {
            exitLink.addEventListener('click', (event) => {
                event.preventDefault();
                clearSession();
                window.location.href = 'index.html';
            });
        }
    }

    function asegurarModalMotivo() {
        let modalEl = document.getElementById('opbAdminMotivoModal');
        if (modalEl) {
            return modalEl;
        }
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="modal fade" id="opbAdminMotivoModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header bg-light border-bottom-0">
                            <h5 class="modal-title fw-bold text-midnight" id="opbMotivoTitle">Confirmar acción</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="opbFormAdminMotivo">
                            <div class="modal-body p-4">
                                <p class="small text-muted mb-2" id="opbMotivoDesc">Ingresa el motivo (mínimo 5 caracteres).</p>
                                <textarea class="form-control" id="opbMotivoInput" rows="3" minlength="5" required placeholder="Motivo detallado de la acción..."></textarea>
                            </div>
                            <div class="modal-footer border-top-0">
                                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-danger fw-medium">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        modalEl = wrapper.firstElementChild;
        document.body.appendChild(modalEl);

        document.getElementById('opbFormAdminMotivo')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const motivo = (document.getElementById('opbMotivoInput')?.value || '').trim();
            if (motivo.length < 5) {
                mostrarAlerta('El motivo debe tener al menos 5 caracteres.', 'warning');
                return;
            }
            const btn = event.target.querySelector('button[type="submit"]');
            if (btn) btn.disabled = true;
            try {
                if (typeof motivoCallback === 'function') {
                    await motivoCallback(motivo);
                }
                if (window.bootstrap && window.bootstrap.Modal) {
                    window.bootstrap.Modal.getInstance(modalEl)?.hide();
                }
            } catch (err) {
                mostrarAlerta(err.message, 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });

        return modalEl;
    }

    function solicitarMotivo(titulo, descripcion, callback) {
        const modalEl = asegurarModalMotivo();
        document.getElementById('opbMotivoTitle').textContent = titulo;
        document.getElementById('opbMotivoDesc').textContent = descripcion;
        const input = document.getElementById('opbMotivoInput');
        if (input) input.value = '';
        motivoCallback = callback;
        if (window.bootstrap && window.bootstrap.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    }

    function asegurarContenedoresAdmin() {
        const empresasPane = document.getElementById('empresas');
        if (empresasPane && !document.getElementById('opbAdminCompaniesSection')) {
            const sec = document.createElement('div');
            sec.id = 'opbAdminCompaniesSection';
            sec.className = 'bg-white rounded-3 shadow-sm border p-4 mb-4';
            sec.innerHTML = `
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h5 class="text-midnight fw-bold m-0">Verificación de Empresas</h5>
                    <select class="form-select form-select-sm w-auto" id="opbFilterEmpresaEstado">
                        <option value="">Todos los estados</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="aprobada">Aprobada</option>
                        <option value="rechazada">Rechazada</option>
                        <option value="suspendida">Suspendida</option>
                    </select>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light text-muted">
                            <tr>
                                <th>Empresa</th>
                                <th>Representante</th>
                                <th>Estado</th>
                                <th>Documento</th>
                                <th class="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="opbAdminCompaniesTable">
                            <tr><td colspan="5" class="text-center text-muted py-3">Cargando empresas...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            empresasPane.prepend(sec);
            document.getElementById('opbFilterEmpresaEstado')?.addEventListener('change', cargarEmpresasAdmin);
        }

        const reportesPane = document.getElementById('reportes');
        if (reportesPane && !document.getElementById('opbAdminCategoriasSection')) {
            reportesPane.innerHTML = `
                <div class="row g-4" id="opbAdminCategoriasSection">
                    <div class="col-lg-6">
                        <div class="bg-white rounded-3 shadow-sm border p-4 h-100">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="text-midnight fw-bold mb-0">Vacantes Reportadas</h5>
                                <button type="button" class="btn btn-sm btn-outline-secondary" id="opbBtnRefreshReportadas">Actualizar</button>
                            </div>
                            <div id="opbReportadasList" class="small text-muted">Cargando vacantes reportadas...</div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="bg-white rounded-3 shadow-sm border p-4 h-100">
                            <h5 class="text-midnight fw-bold mb-3">Categorías de Empleo</h5>
                            <form id="opbFormNuevaCategoria" class="d-flex gap-2 mb-3">
                                <input type="text" class="form-control form-control-sm" id="opbNuevaCatNombre" placeholder="Nombre de categoría" required maxlength="100">
                                <button type="submit" class="btn btn-sm btn-registro text-white text-nowrap">Agregar</button>
                            </form>
                            <div id="opbCategoriasList" class="small text-muted">Cargando categorías...</div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('opbBtnRefreshReportadas')?.addEventListener('click', cargarVacantesReportadas);
            document.getElementById('opbFormNuevaCategoria')?.addEventListener('submit', crearCategoriaAdmin);
        }
    }

    async function cargarResumen() {
        try {
            const res = await apiFetch('/api/admin/resumen');
            const d = res?.data || {};
            const cards = document.querySelectorAll('#dashboard .metric-card');
            const pares = [
                { titulo: 'Usuarios Activos', valor: d.usuarios_activos, nota: 'En plataforma' },
                { titulo: 'Empresas Pendientes', valor: d.empresas_pendientes, nota: `${Number(d.empresas_aprobadas ?? 0)} aprobadas` },
                { titulo: 'Vacantes Activas', valor: d.vacantes_activas, nota: `${Number(d.vacantes_pendientes ?? 0)} pendientes` },
                { titulo: 'Reportes Abiertos', valor: d.reportes_abiertos, nota: `${Number(d.total_postulaciones ?? 0)} postulaciones` }
            ];
            cards.forEach((card, idx) => {
                const info = pares[idx];
                if (!info) return;
                const h2 = card.querySelector('h2');
                const p = card.querySelector('p');
                const span = card.querySelector('span.badge');
                if (h2) h2.textContent = String(info.valor ?? 0);
                if (p) p.textContent = info.titulo;
                if (span) span.textContent = info.nota;
            });
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    async function cargarBitacora() {
        const tbody = document.getElementById('adminLogsTable');
        if (!tbody) return;
        try {
            const res = await apiFetch('/api/admin/bitacora?limite=20');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin registros recientes en bitácora.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map((b) => `
                <tr>
                    <td>${escapeHtml(formatearFecha(b.fecha))}</td>
                    <td>${escapeHtml(b.accion)}</td>
                    <td>${escapeHtml(b.entidad)} #${escapeHtml(b.entidad_id ?? '-')}</td>
                    <td><span class="badge bg-success">${escapeHtml(b.detalle ? b.detalle.slice(0, 40) : 'Registrado')}</span></td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function cargarUsuariosAdmin() {
        const tbody = document.getElementById('adminUsersTable');
        if (!tbody) return;
        const q = (document.getElementById('adminSearchUser')?.value || '').trim();
        const qs = q ? `?q=${encodeURIComponent(q)}&limite=30` : '?limite=30';
        try {
            const res = await apiFetch(`/api/admin/usuarios${qs}`);
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No se encontraron usuarios.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map((u) => {
                const accionBtn = u.estado === 'activo'
                    ? `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 opb-user-state" data-id="${u.id}" data-next="suspendido">Bloquear</button>`
                    : `<button type="button" class="btn btn-sm btn-outline-success py-0 px-2 opb-user-state" data-id="${u.id}" data-next="activo">Desbloquear</button>`;
                return `
                    <tr>
                        <td class="ps-4 text-muted small">#U-${u.id}</td>
                        <td class="fw-medium">${escapeHtml(`${u.nombres || ''} ${u.apellidos || ''}`.trim())} <span class="small text-muted">(${escapeHtml(u.rol)})</span></td>
                        <td>${escapeHtml(u.correo)}</td>
                        <td>${badgeEstado(u.estado)}</td>
                        <td class="text-end pe-4">${accionBtn}</td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.opb-user-state').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const next = btn.getAttribute('data-next');
                    if (next === 'suspendido') {
                        solicitarMotivo('Suspender usuario', 'Indica el motivo de la suspensión (mín. 5 caracteres).', async (motivo) => {
                            await apiFetch(`/api/admin/usuarios/${id}/estado`, {
                                method: 'PATCH',
                                body: { estado: next, motivo }
                            });
                            mostrarAlerta('Usuario suspendido.', 'success');
                            await Promise.all([cargarUsuariosAdmin(), cargarResumen(), cargarBitacora()]);
                        });
                    } else {
                        try {
                            await apiFetch(`/api/admin/usuarios/${id}/estado`, {
                                method: 'PATCH',
                                body: { estado: next }
                            });
                            mostrarAlerta('Usuario activado.', 'success');
                            await Promise.all([cargarUsuariosAdmin(), cargarResumen(), cargarBitacora()]);
                        } catch (err) {
                            mostrarAlerta(err.message, 'error');
                        }
                    }
                });
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function cargarEmpresasAdmin() {
        const tbody = document.getElementById('opbAdminCompaniesTable');
        if (!tbody) return;
        const est = document.getElementById('opbFilterEmpresaEstado')?.value || '';
        const qs = est ? `?estado_verificacion=${encodeURIComponent(est)}&limite=30` : '?limite=30';

        try {
            const res = await apiFetch(`/api/admin/empresas${qs}`);
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No hay empresas con ese filtro.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map((e) => {
                let acciones = '';
                if (e.estado_verificacion === 'pendiente') {
                    acciones = `
                        <button type="button" class="btn btn-sm btn-success py-0 px-2 opb-comp-state" data-id="${e.id}" data-next="aprobada">Aprobar</button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1 opb-comp-state" data-id="${e.id}" data-next="rechazada">Rechazar</button>
                    `;
                } else if (e.estado_verificacion === 'aprobada') {
                    acciones = `<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 opb-comp-state" data-id="${e.id}" data-next="suspendida">Suspender</button>`;
                } else if (e.estado_verificacion === 'suspendida') {
                    acciones = `<button type="button" class="btn btn-sm btn-outline-success py-0 px-2 opb-comp-state" data-id="${e.id}" data-next="aprobada">Reactivar</button>`;
                } else {
                    acciones = `<button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 opb-comp-state" data-id="${e.id}" data-next="pendiente">A revisión</button>`;
                }

                const docBtn = e.tiene_documento_legal
                    ? `<button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 opb-dl-emp-doc" data-id="${e.id}">Descargar</button>`
                    : '<span class="small text-muted">Sin archivo</span>';

                return `
                    <tr>
                        <td class="fw-medium">${escapeHtml(e.nombre_legal)}</td>
                        <td class="small">${escapeHtml(`${e.representante_nombres || ''} ${e.representante_apellidos || ''}`.trim())} (${escapeHtml(e.representante_correo || '')})</td>
                        <td>${badgeEstado(e.estado_verificacion)}</td>
                        <td>${docBtn}</td>
                        <td class="text-end text-nowrap">${acciones}</td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.opb-dl-emp-doc').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    descargarArchivoAutenticado(`/api/admin/empresas/${id}/documento`, `documento-empresa-${id}.pdf`).catch((err) => {
                        mostrarAlerta(err.message, 'error');
                    });
                });
            });

            tbody.querySelectorAll('.opb-comp-state').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const next = btn.getAttribute('data-next');
                    if (next === 'rechazada' || next === 'suspendida') {
                        solicitarMotivo(
                            next === 'rechazada' ? 'Rechazar empresa' : 'Suspender empresa',
                            'Ingresa el motivo (mínimo 5 caracteres).',
                            async (motivo) => {
                                await apiFetch(`/api/admin/empresas/${id}/estado`, {
                                    method: 'PATCH',
                                    body: { estado_verificacion: next, motivo }
                                });
                                mostrarAlerta(`Empresa actualizada a ${next}.`, 'success');
                                await Promise.all([cargarEmpresasAdmin(), cargarResumen(), cargarBitacora()]);
                            }
                        );
                    } else {
                        try {
                            await apiFetch(`/api/admin/empresas/${id}/estado`, {
                                method: 'PATCH',
                                body: { estado_verificacion: next }
                            });
                            mostrarAlerta(`Empresa actualizada a ${next}.`, 'success');
                            await Promise.all([cargarEmpresasAdmin(), cargarResumen(), cargarBitacora()]);
                        } catch (err) {
                            mostrarAlerta(err.message, 'error');
                        }
                    }
                });
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function construirBotonesVacante(v) {
        if (v.estado === 'pendiente') {
            return `
                <button type="button" class="btn btn-sm btn-success py-0 px-2 opb-job-state" data-id="${v.id}" data-next="publicada">Publicar</button>
                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1 opb-job-state" data-id="${v.id}" data-next="rechazada">Rechazar</button>
            `;
        }
        if (v.estado === 'publicada') {
            return `
                <button type="button" class="btn btn-sm btn-outline-warning py-0 px-2 opb-job-state" data-id="${v.id}" data-next="oculta">Ocultar</button>
                <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 ms-1 opb-job-state" data-id="${v.id}" data-next="cerrada">Cerrar</button>
            `;
        }
        if (v.estado === 'oculta') {
            return `
                <button type="button" class="btn btn-sm btn-outline-success py-0 px-2 opb-job-state" data-id="${v.id}" data-next="publicada">Publicar</button>
                <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 ms-1 opb-job-state" data-id="${v.id}" data-next="cerrada">Cerrar</button>
            `;
        }
        return '<span class="small text-muted">Sin acciones</span>';
    }

    async function cambiarEstadoVacante(id, next) {
        if (next === 'rechazada' || next === 'oculta') {
            solicitarMotivo(
                next === 'rechazada' ? 'Rechazar vacante' : 'Ocultar vacante',
                'Especifica el motivo de moderación (mínimo 5 caracteres).',
                async (motivo) => {
                    await apiFetch(`/api/admin/vacantes/${id}/estado`, {
                        method: 'PATCH',
                        body: { estado: next, motivo }
                    });
                    mostrarAlerta(`Vacante marcada como ${next}.`, 'success');
                    await Promise.all([cargarVacantesAdmin(), cargarVacantesReportadas(), cargarResumen(), cargarBitacora()]);
                }
            );
            return;
        }
        try {
            await apiFetch(`/api/admin/vacantes/${id}/estado`, {
                method: 'PATCH',
                body: { estado: next }
            });
            mostrarAlerta(`Vacante marcada como ${next}.`, 'success');
            await Promise.all([cargarVacantesAdmin(), cargarVacantesReportadas(), cargarResumen(), cargarBitacora()]);
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    async function cargarVacantesAdmin() {
        const tbody = document.getElementById('adminJobsTable');
        if (!tbody) return;
        try {
            const res = await apiFetch('/api/admin/vacantes?limite=30');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No se encontraron vacantes.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map((v) => `
                <tr>
                    <td class="fw-medium">${escapeHtml(v.empresa_nombre)}</td>
                    <td>${escapeHtml(v.titulo)}</td>
                    <td>${escapeHtml(formatearFecha(v.fecha_publicacion || v.fecha_creacion))}</td>
                    <td>${badgeEstado(v.estado)}</td>
                    <td class="text-nowrap">${construirBotonesVacante(v)}</td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.opb-job-state').forEach((btn) => {
                btn.addEventListener('click', () => cambiarEstadoVacante(btn.getAttribute('data-id'), btn.getAttribute('data-next')));
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function cargarVacantesReportadas() {
        const container = document.getElementById('opbReportadasList');
        if (!container) return;
        try {
            const res = await apiFetch('/api/admin/vacantes?reportada=true&limite=20');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                container.innerHTML = '<div class="text-muted">No hay vacantes con reportes abiertos en este momento.</div>';
                return;
            }
            container.innerHTML = items.map((v) => `
                <div class="border rounded-3 p-3 mb-2 d-flex justify-content-between align-items-center gap-2">
                    <div>
                        <div class="fw-semibold text-midnight">${escapeHtml(v.titulo)} <span class="badge bg-danger ms-1">${v.reportes_abiertos} reportes</span></div>
                        <div class="text-muted">${escapeHtml(v.empresa_nombre)} • ${badgeEstado(v.estado)}</div>
                    </div>
                    <div class="text-nowrap">${construirBotonesVacante(v)}</div>
                </div>
            `).join('');

            container.querySelectorAll('.opb-job-state').forEach((btn) => {
                btn.addEventListener('click', () => cambiarEstadoVacante(btn.getAttribute('data-id'), btn.getAttribute('data-next')));
            });
        } catch (err) {
            container.innerHTML = `<div class="text-danger">${escapeHtml(err.message)}</div>`;
        }
    }

    async function cargarCategoriasAdmin() {
        const container = document.getElementById('opbCategoriasList');
        if (!container) return;
        try {
            const res = await apiFetch('/api/admin/categorias-empleo');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                container.innerHTML = '<div class="text-muted">Sin categorías registradas.</div>';
                return;
            }
            container.innerHTML = items.map((c) => `
                <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                    <div>
                        <strong class="text-midnight">${escapeHtml(c.nombre)}</strong>
                        ${c.total_vacantes !== undefined ? `<span class="badge bg-light text-dark border ms-1">${c.total_vacantes} vacantes</span>` : ''}
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 opb-del-cat" data-id="${c.id}">Eliminar</button>
                </div>
            `).join('');

            container.querySelectorAll('.opb-del-cat').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        await apiFetch(`/api/admin/categorias-empleo/${id}`, { method: 'DELETE' });
                        mostrarAlerta('Categoría eliminada.', 'success');
                        await Promise.all([cargarCategoriasAdmin(), cargarBitacora()]);
                    } catch (err) {
                        mostrarAlerta(err.message, 'error');
                    }
                });
            });
        } catch (err) {
            container.innerHTML = `<div class="text-danger">${escapeHtml(err.message)}</div>`;
        }
    }

    async function crearCategoriaAdmin(event) {
        event.preventDefault();
        const input = document.getElementById('opbNuevaCatNombre');
        const nombre = (input?.value || '').trim();
        if (!nombre) return;
        try {
            await apiFetch('/api/admin/categorias-empleo', {
                method: 'POST',
                body: { nombre }
            });
            input.value = '';
            mostrarAlerta('Categoría creada correctamente.', 'success');
            await Promise.all([cargarCategoriasAdmin(), cargarBitacora()]);
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const usuario = exigirRol('administrador');
        if (!usuario) return;

        inicializarCabecera(usuario);
        asegurarContenedoresAdmin();

        document.getElementById('adminSearchUser')?.addEventListener('input', cargarUsuariosAdmin);
        const searchUserBtn = document.getElementById('adminSearchUser')?.parentElement?.querySelector('button');
        if (searchUserBtn) {
            searchUserBtn.addEventListener('click', cargarUsuariosAdmin);
        }

        await Promise.all([
            cargarResumen(),
            cargarBitacora(),
            cargarUsuariosAdmin(),
            cargarEmpresasAdmin(),
            cargarVacantesAdmin(),
            cargarVacantesReportadas(),
            cargarCategoriasAdmin()
        ]);
    });
})();
