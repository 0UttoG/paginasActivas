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
    let categoriasActuales = new Map();
    let solicitudEstadisticas = 0;

    const ESTADOS_VACANTES = [
        ['borrador', 'Borrador'], ['pendiente', 'Pendiente'],
        ['publicada', 'Publicada'], ['oculta', 'Oculta'],
        ['rechazada', 'Rechazada'], ['cerrada', 'Cerrada']
    ];
    const ESTADOS_POSTULACIONES = [
        ['nueva', 'Nueva'], ['en_proceso', 'En proceso'],
        ['contratado', 'Contratado'], ['rechazado', 'Rechazado']
    ];

    function renderizarConteos(filas, vacio) {
        if (filas.length === 0) return `<p class="text-muted mb-0">${vacio}</p>`;
        return `<div class="list-group list-group-flush">${filas.map(([nombre, total]) => `
            <div class="list-group-item px-0 py-2 d-flex justify-content-between gap-2">
                <span>${escapeHtml(nombre)}</span><strong class="text-midnight">${Number(total ?? 0).toLocaleString('es-SV')}</strong>
            </div>
        `).join('')}</div>`;
    }

    async function cargarEstadisticasAdmin() {
        const status = document.getElementById('opbStatsStatus');
        if (!status) return;
        const solicitudActual = ++solicitudEstadisticas;
        const desde = document.getElementById('opbStatsDesde')?.value || '';
        const hasta = document.getElementById('opbStatsHasta')?.value || '';
        if (desde && hasta && desde > hasta) {
            status.className = 'small text-danger mb-3';
            status.textContent = 'La fecha «Desde» no puede ser posterior a «Hasta».';
            return;
        }

        status.className = 'small text-muted mb-3';
        status.textContent = 'Cargando estadísticas...';
        const params = new URLSearchParams();
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
        const ruta = `/api/admin/estadisticas${params.size ? `?${params.toString()}` : ''}`;

        try {
            const res = await apiFetch(ruta);
            if (solicitudActual !== solicitudEstadisticas) return;
            const d = res?.data;
            if (!d?.resumen_vacantes || !d?.resumen_postulaciones) {
                throw new Error('La respuesta de estadísticas está incompleta.');
            }
            document.getElementById('opbStatsVacantesTotal').textContent = Number(d.resumen_vacantes.total ?? 0).toLocaleString('es-SV');
            document.getElementById('opbStatsPostulacionesTotal').textContent = Number(d.resumen_postulaciones.total ?? 0).toLocaleString('es-SV');
            document.getElementById('opbStatsContratadosTotal').textContent = Number(d.resumen_postulaciones.contratado ?? 0).toLocaleString('es-SV');
            document.getElementById('opbStatsVacantesEstados').innerHTML = renderizarConteos(
                ESTADOS_VACANTES.map(([clave, etiqueta]) => [etiqueta, d.resumen_vacantes[clave]]),
                'No hay vacantes.'
            );
            document.getElementById('opbStatsPostulacionesEstados').innerHTML = renderizarConteos(
                ESTADOS_POSTULACIONES.map(([clave, etiqueta]) => [etiqueta, d.resumen_postulaciones[clave]]),
                'No hay postulaciones en el rango.'
            );
            document.getElementById('opbStatsPorMes').innerHTML = renderizarConteos(
                (d.postulaciones_por_mes || []).map((fila) => [String(fila.mes || '').slice(0, 7), fila.total]),
                'No hay postulaciones en el rango.'
            );
            document.getElementById('opbStatsPorCategoria').innerHTML = renderizarConteos(
                (d.postulaciones_por_categoria || []).map((fila) => [fila.nombre || 'Sin categoría', fila.total]),
                'No hay postulaciones en el rango.'
            );
            const fechaDesde = String(d.rango?.desde || '').slice(0, 10);
            const fechaHasta = d.rango?.hasta
                ? new Date(new Date(d.rango.hasta).getTime() - 1).toISOString().slice(0, 10)
                : '';
            status.textContent = `Postulaciones del ${fechaDesde} al ${fechaHasta}. Vacantes: estado actual sin filtro de fecha.`;
        } catch (err) {
            if (solicitudActual !== solicitudEstadisticas) return;
            status.className = 'small text-danger mb-3';
            status.textContent = `No se pudieron cargar las estadísticas: ${err.message}`;
        }
    }

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

        document.getElementById('opbBtnRefreshReportadas')?.addEventListener('click', cargarVacantesReportadas);
        document.getElementById('opbFormNuevaCategoria')?.addEventListener('submit', crearCategoriaAdmin);
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
                    await Promise.all([cargarVacantesAdmin(), cargarVacantesReportadas(), cargarResumen(), cargarBitacora(), cargarEstadisticasAdmin()]);
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
            await Promise.all([cargarVacantesAdmin(), cargarVacantesReportadas(), cargarResumen(), cargarBitacora(), cargarEstadisticasAdmin()]);
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
            categoriasActuales = new Map(items.map((categoria) => [String(categoria.id), categoria]));
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
                    <div class="d-flex gap-1">
                        <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 opb-edit-cat" data-id="${c.id}">Editar</button>
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 opb-del-cat" data-id="${c.id}">Eliminar</button>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.opb-edit-cat').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const categoria = categoriasActuales.get(btn.getAttribute('data-id'));
                    if (!categoria) return;
                    document.getElementById('opbEditarCategoriaId').value = String(categoria.id);
                    document.getElementById('opbEditarCategoriaNombre').value = categoria.nombre;
                    const error = document.getElementById('opbEditarCategoriaError');
                    error.textContent = '';
                    error.hidden = true;
                    window.bootstrap.Modal.getOrCreateInstance(document.getElementById('opbEditarCategoriaModal')).show();
                });
            });
            container.querySelectorAll('.opb-del-cat').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        await apiFetch(`/api/admin/categorias-empleo/${id}`, { method: 'DELETE' });
                        mostrarAlerta('Categoría eliminada.', 'success');
                        await Promise.all([cargarCategoriasAdmin(), cargarBitacora(), cargarEstadisticasAdmin()]);
                    } catch (err) {
                        mostrarAlerta(err.message, 'error');
                    }
                });
            });
        } catch (err) {
            container.innerHTML = `<div class="text-danger">${escapeHtml(err.message)}</div>`;
        }
    }

    async function editarCategoriaAdmin(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const id = document.getElementById('opbEditarCategoriaId')?.value;
        const input = document.getElementById('opbEditarCategoriaNombre');
        const error = document.getElementById('opbEditarCategoriaError');
        const nombre = (input?.value || '').trim();
        if (!id || !nombre || nombre.length > 100) {
            error.textContent = 'Ingresa un nombre de 1 a 100 caracteres.';
            error.hidden = false;
            input?.focus();
            return;
        }
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        error.hidden = true;
        try {
            await apiFetch(`/api/admin/categorias-empleo/${id}`, {
                method: 'PATCH',
                body: { nombre }
            });
            window.bootstrap.Modal.getInstance(document.getElementById('opbEditarCategoriaModal'))?.hide();
            mostrarAlerta('Categoría actualizada correctamente.', 'success');
            await Promise.all([cargarCategoriasAdmin(), cargarBitacora(), cargarEstadisticasAdmin()]);
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        } finally {
            if (btn) btn.disabled = false;
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
            await Promise.all([cargarCategoriasAdmin(), cargarBitacora(), cargarEstadisticasAdmin()]);
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const usuario = exigirRol('administrador');
        if (!usuario) return;

        inicializarCabecera(usuario);
        asegurarContenedoresAdmin();

        document.getElementById('opbStatsFilterForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            cargarEstadisticasAdmin();
        });
        document.getElementById('opbStatsReset')?.addEventListener('click', () => {
            document.getElementById('opbStatsFilterForm')?.reset();
            cargarEstadisticasAdmin();
        });
        document.getElementById('opbFormEditarCategoria')?.addEventListener('submit', editarCategoriaAdmin);

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
            cargarCategoriasAdmin(),
            cargarEstadisticasAdmin()
        ]);
    });
})();
