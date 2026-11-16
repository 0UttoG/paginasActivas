(function () {
    'use strict';

    const {
        escapeHtml,
        getUsuario,
        setUsuario,
        clearSession,
        obtenerIniciales,
        mostrarAlerta,
        apiFetch,
        descargarArchivoAutenticado,
        formatearFecha,
        badgeEstado,
        exigirRol
    } = window.OPB;

    let perfilActual = null;

    function inicializarCabeceraPerfil(usuario) {
        const nameEl = document.getElementById('profileNameDisplay');
        if (nameEl && usuario) {
            nameEl.textContent = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || usuario.correo;
        }

        const headerAvatar = document.querySelector('header .rounded-circle');
        if (headerAvatar && usuario) {
            headerAvatar.classList.add('fw-bold');
            headerAvatar.textContent = obtenerIniciales(usuario);
        }

        const topRightContainer = document.querySelector('header .d-flex.align-items-center');
        if (topRightContainer && !document.getElementById('opbBtnLogoutPerfil')) {
            const btnLogout = document.createElement('button');
            btnLogout.type = 'button';
            btnLogout.id = 'opbBtnLogoutPerfil';
            btnLogout.className = 'btn btn-outline-light btn-sm fw-medium';
            btnLogout.textContent = 'Cerrar sesión';
            btnLogout.addEventListener('click', () => {
                clearSession();
                window.location.href = 'index.html';
            });
            topRightContainer.appendChild(btnLogout);
        }
    }

    function asegurarControlesFormularioPerfil() {
        const form = document.getElementById('formPerfilUsuario');
        if (form && !document.getElementById('recibeEmailCheck')) {
            const prefsDiv = document.createElement('div');
            prefsDiv.className = 'mt-3 d-flex flex-wrap gap-3 small text-muted';
            prefsDiv.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="recibeEmailCheck">
                    <label class="form-check-label" for="recibeEmailCheck">Alertas por correo</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="recibeSmsCheck">
                    <label class="form-check-label" for="recibeSmsCheck">Alertas por SMS</label>
                </div>
            `;
            const uploadArea = document.getElementById('uploadCvArea');
            if (uploadArea) {
                uploadArea.insertAdjacentElement('beforebegin', prefsDiv);
            } else {
                form.appendChild(prefsDiv);
            }
        }

        const emailInput = document.getElementById('candidateEmail');
        if (emailInput) {
            emailInput.readOnly = true;
            emailInput.classList.add('bg-light');
        }

        const uploadArea = document.getElementById('uploadCvArea');
        if (uploadArea && !document.getElementById('opbCvFilename')) {
            const info = document.createElement('p');
            info.id = 'opbCvFilename';
            info.className = 'small text-midnight fw-medium mt-2 mb-0';
            info.textContent = '';
            uploadArea.appendChild(info);

            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.id = 'opbBtnDownloadCv';
            dlBtn.className = 'btn btn-outline-secondary btn-sm mt-2 d-none';
            dlBtn.textContent = 'Descargar CV actual';
            dlBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                try {
                    await descargarArchivoAutenticado('/api/perfil/cv', 'mi-cv.pdf');
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                }
            });
            uploadArea.appendChild(dlBtn);
        }
    }

    function asegurarContenedoresCandidato() {
        const mainCol = document.querySelector('main .col-md-9');
        if (!mainCol) {
            return;
        }

        if (!document.getElementById('opbPostulacionesCard')) {
            const section = document.createElement('div');
            section.id = 'opbPostulacionesCard';
            section.className = 'bg-white rounded-3 shadow-sm border p-4 mt-4';
            section.innerHTML = `
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h5 class="text-midnight fw-bold mb-0">Mis Solicitudes Enviadas</h5>
                    <select class="form-select form-select-sm w-auto" id="opbFilterPostulacionEstado">
                        <option value="">Todos los estados</option>
                        <option value="nueva">Nueva</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="contratado">Contratado</option>
                        <option value="rechazado">Rechazado</option>
                    </select>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light text-muted">
                            <tr>
                                <th>Vacante</th>
                                <th>Empresa</th>
                                <th>Ubicación</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th class="text-end">Oferta</th>
                            </tr>
                        </thead>
                        <tbody id="opbPostulacionesBody">
                            <tr><td colspan="6" class="text-center text-muted py-3">Cargando postulaciones...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            mainCol.appendChild(section);

            document.getElementById('opbFilterPostulacionEstado')?.addEventListener('change', cargarPostulaciones);
        }

        if (!document.getElementById('opbGuardadosCard')) {
            const section = document.createElement('div');
            section.id = 'opbGuardadosCard';
            section.className = 'bg-white rounded-3 shadow-sm border p-4 mt-4';
            section.innerHTML = `
                <h5 class="text-midnight fw-bold mb-3">Vacantes Guardadas</h5>
                <div id="opbGuardadosList" class="row g-3">
                    <div class="col-12 text-muted small">Cargando vacantes guardadas...</div>
                </div>
            `;
            mainCol.appendChild(section);
        }
    }

    function vincularSidebarNavegacion() {
        const items = document.querySelectorAll('.list-group .list-group-item');
        if (!items.length) return;

        const destinos = [
            () => document.getElementById('formPerfilUsuario'),
            () => document.getElementById('opbPostulacionesCard'),
            () => document.getElementById('alertsList'),
            () => document.getElementById('formValoracion')
        ];

        items.forEach((link, idx) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                items.forEach((el) => {
                    el.className = 'list-group-item list-group-item-action text-muted';
                });
                link.className = 'list-group-item list-group-item-action active bg-light text-midnight fw-medium border-start border-4 border-midnight';
                const target = destinos[idx]?.();
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    }

    function actualizarUiCv(rutaCv) {
        const label = document.getElementById('opbCvFilename');
        const btn = document.getElementById('opbBtnDownloadCv');
        if (!label || !btn) {
            return;
        }
        if (rutaCv) {
            const nombreArchivo = String(rutaCv).split('/').pop();
            label.textContent = `CV cargado: ${nombreArchivo}`;
            btn.classList.remove('d-none');
        } else {
            label.textContent = '';
            btn.classList.add('d-none');
        }
    }

    async function cargarPerfil() {
        try {
            const res = await apiFetch('/api/perfil');
            const p = res?.perfil || res?.data || res;
            perfilActual = p;

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val ?? '';
            };

            setVal('candidateName', p.nombres);
            setVal('candidateLastName', p.apellidos);
            setVal('candidateEmail', p.correo);
            const digitosTelefono = String(p.telefono || '').replace(/\D/g, '');
            setVal('candidatePhone', digitosTelefono.length === 8
                ? `${digitosTelefono.slice(0, 4)}-${digitosTelefono.slice(4)}`
                : p.telefono);

            const emailChk = document.getElementById('recibeEmailCheck');
            if (emailChk) emailChk.checked = Boolean(p.recibe_email);
            const smsChk = document.getElementById('recibeSmsCheck');
            if (smsChk) smsChk.checked = Boolean(p.recibe_sms);

            actualizarUiCv(p.ruta_cv);

            const userSession = getUsuario();
            if (userSession) {
                const actualizado = { ...userSession, nombres: p.nombres, apellidos: p.apellidos };
                setUsuario(actualizado);
                inicializarCabeceraPerfil(actualizado);
            }
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    async function cargarDashboard() {
        try {
            const res = await apiFetch('/api/perfil/dashboard');
            const d = res?.data || res || {};
            const totalApps = d.solicitudes?.total ?? 0;
            const totalGuardados = d.guardados ?? 0;

            const statAppsEl = document.getElementById('statApplications');
            if (statAppsEl) {
                statAppsEl.textContent = String(totalApps);
            }
            const statVisitsEl = document.getElementById('statVisits');
            if (statVisitsEl) {
                statVisitsEl.textContent = String(totalGuardados);
                const siblingLabel = statVisitsEl.parentElement?.querySelector('p');
                if (siblingLabel) {
                    siblingLabel.textContent = 'Vacantes guardadas';
                }
            }
        } catch {
            // ignorar
        }
    }

    async function cargarPostulaciones() {
        const tbody = document.getElementById('opbPostulacionesBody');
        if (!tbody) {
            return;
        }
        const estadoFiltro = document.getElementById('opbFilterPostulacionEstado')?.value || '';
        const qs = estadoFiltro ? `?estado=${encodeURIComponent(estadoFiltro)}` : '';
        try {
            const res = await apiFetch(`/api/perfil/postulaciones${qs}`);
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Aún no tienes postulaciones registradas.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map((p) => `
                <tr>
                    <td class="fw-medium">${escapeHtml(p.titulo)}</td>
                    <td>${escapeHtml(p.nombre_legal)}</td>
                    <td class="small text-muted">${escapeHtml(p.ubicacion)} (${escapeHtml(p.modalidad)})</td>
                    <td class="small">${escapeHtml(formatearFecha(p.fecha_postulacion))}</td>
                    <td>${badgeEstado(p.estado)}</td>
                    <td class="text-end">
                        <a href="index.html?vacante=${p.vacante_id}" class="btn btn-sm btn-outline-secondary">Ver oferta</a>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function cargarGuardados() {
        const list = document.getElementById('opbGuardadosList');
        if (!list) {
            return;
        }
        try {
            const res = await apiFetch('/api/perfil/guardados');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                list.innerHTML = '<div class="col-12 text-muted small">No tienes vacantes guardadas por el momento.</div>';
                return;
            }
            list.innerHTML = items.map((g) => `
                <div class="col-md-6">
                    <div class="border rounded-3 p-3 h-100 d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                            <strong class="text-midnight text-truncate">${escapeHtml(g.titulo)}</strong>
                            ${g.disponible === false ? '<span class="badge bg-secondary">No disponible</span>' : '<span class="badge bg-lime text-midnight">Activa</span>'}
                        </div>
                        <div class="small text-muted mb-3">${escapeHtml(g.nombre_legal)} • ${escapeHtml(g.ubicacion || 'N/D')}</div>
                        <div class="mt-auto d-flex gap-2">
                            <a href="index.html?vacante=${g.vacante_id}" class="btn btn-sm btn-registro text-white flex-grow-1">Ver y postular</a>
                            <button type="button" class="btn btn-sm btn-outline-danger opb-remove-saved" data-vacante-id="${g.vacante_id}">Quitar</button>
                        </div>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.opb-remove-saved').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-vacante-id');
                    try {
                        await apiFetch(`/api/perfil/guardados/${id}`, { method: 'DELETE' });
                        mostrarAlerta('Vacante quitada de guardados.', 'info');
                        cargarGuardados();
                        cargarDashboard();
                    } catch (err) {
                        mostrarAlerta(err.message, 'error');
                    }
                });
            });
        } catch (err) {
            list.innerHTML = `<div class="col-12 text-danger small">${escapeHtml(err.message)}</div>`;
        }
    }

    async function cargarNotificaciones() {
        const list = document.getElementById('alertsList');
        if (!list) {
            return;
        }
        const bellSvg = '<svg width="16" height="16" fill="currentColor" class="me-2 flex-shrink-0" viewBox="0 0 16 16"><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/></svg>';

        try {
            const res = await apiFetch('/api/notificaciones?limite=10');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                list.innerHTML = '<li class="text-muted small py-2">No tienes notificaciones pendientes.</li>';
                return;
            }
            list.innerHTML = items.map((n, index) => `
                <li class="d-flex justify-content-between align-items-center ${index < items.length - 1 ? 'mb-3 pb-3 border-bottom' : ''}">
                    <div class="d-flex align-items-start text-midnight pe-2">
                        ${bellSvg}
                        <div>
                            <div class="small fw-medium">${escapeHtml(n.titulo)} ${n.leida ? '' : '<span class="badge bg-lime text-midnight ms-1">Nueva</span>'}</div>
                            <div class="small text-muted">${escapeHtml(n.mensaje)}</div>
                        </div>
                    </div>
                    ${n.leida ? '<span class="small text-muted">Leída</span>' : `<button type="button" class="btn btn-sm btn-outline-secondary opb-mark-notif" data-id="${n.id}">Marcar</button>`}
                </li>
            `).join('');

            list.querySelectorAll('.opb-mark-notif').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        await apiFetch(`/api/notificaciones/${id}/leida`, { method: 'PATCH' });
                        cargarNotificaciones();
                        cargarDashboard();
                    } catch (err) {
                        mostrarAlerta(err.message, 'error');
                    }
                });
            });
        } catch (err) {
            list.innerHTML = `<li class="text-danger small">${escapeHtml(err.message)}</li>`;
        }
    }

    async function subirArchivoCv(file) {
        if (!file) {
            return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx'].includes(ext)) {
            mostrarAlerta('Solo se permiten archivos PDF o DOCX.', 'warning');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            mostrarAlerta('El CV no puede superar los 5 MB.', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await apiFetch('/api/perfil/cv', {
                method: 'POST',
                body: formData
            });
            const ruta = res?.cv?.ruta_cv || res?.data?.ruta_cv || res?.ruta_cv || perfilActual?.ruta_cv;
            actualizarUiCv(ruta || file.name);
            mostrarAlerta('Curriculum actualizado correctamente.', 'success');
            cargarDashboard();
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    function vincularEventos() {
        const formPerfil = document.getElementById('formPerfilUsuario');
        if (formPerfil) {
            const telefonoInput = document.getElementById('candidatePhone');
            telefonoInput?.addEventListener('input', () => {
                const digitos = telefonoInput.value.replace(/\D/g, '').slice(0, 8);
                telefonoInput.value = digitos.length > 4
                    ? `${digitos.slice(0, 4)}-${digitos.slice(4)}`
                    : digitos;
                telefonoInput.setCustomValidity('');
            });
            formPerfil.addEventListener('submit', async (event) => {
                event.preventDefault();
                const telefono = telefonoInput?.value.trim() || '';
                if (telefono && !/^[0-9]{4}-[0-9]{4}$/.test(telefono)) {
                    telefonoInput.setCustomValidity('Ingresa 8 dígitos en formato 0000-0000.');
                    telefonoInput.reportValidity();
                    return;
                }
                const payload = {
                    nombres: (document.getElementById('candidateName')?.value || '').trim(),
                    apellidos: (document.getElementById('candidateLastName')?.value || '').trim(),
                    telefono,
                    recibe_email: Boolean(document.getElementById('recibeEmailCheck')?.checked),
                    recibe_sms: Boolean(document.getElementById('recibeSmsCheck')?.checked)
                };

                const btn = formPerfil.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                try {
                    await apiFetch('/api/perfil', { method: 'PATCH', body: payload });
                    mostrarAlerta('Perfil actualizado correctamente.', 'success');
                    await cargarPerfil();
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }

        const uploadArea = document.getElementById('uploadCvArea');
        const cvInput = document.getElementById('cvFile');
        if (uploadArea && cvInput) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target !== cvInput && e.target.id !== 'opbBtnDownloadCv') {
                    cvInput.click();
                }
            });
            cvInput.addEventListener('change', () => {
                const file = cvInput.files && cvInput.files[0];
                if (file) {
                    subirArchivoCv(file);
                    cvInput.value = '';
                }
            });
        }

        const formValoracion = document.getElementById('formValoracion');
        if (formValoracion) {
            formValoracion.addEventListener('submit', (event) => {
                event.preventDefault();
                mostrarAlerta('Puedes consultar las reseñas de empresas en la pestaña Valoraciones. El envío de nuevas reseñas estará disponible próximamente.', 'info');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const usuario = exigirRol('candidato');
        if (!usuario) {
            return;
        }
        inicializarCabeceraPerfil(usuario);
        asegurarControlesFormularioPerfil();
        asegurarContenedoresCandidato();
        vincularSidebarNavegacion();
        vincularEventos();

        await Promise.all([
            cargarPerfil(),
            cargarDashboard(),
            cargarPostulaciones(),
            cargarGuardados(),
            cargarNotificaciones()
        ]);
    });
})();
