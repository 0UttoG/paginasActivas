(function () {
    'use strict';

    const {
        escapeHtml,
        getUsuario,
        clearSession,
        mostrarAlerta,
        apiFetch,
        descargarArchivoAutenticado,
        formatearFecha,
        urlLogoPublico,
        badgeEstado,
        exigirRol
    } = window.OPB;

    const estado = {
        empresa: null,
        categorias: [],
        vacantes: [],
        editandoVacanteId: null
    };

    const MAPA_CONTRATO_ENVIO = {
        'tiempo-completo': 'tiempo_completo',
        'medio-tiempo': 'medio_tiempo',
        servicios: 'proyecto',
        tiempo_completo: 'tiempo_completo',
        medio_tiempo: 'medio_tiempo',
        proyecto: 'proyecto',
        pasantia: 'pasantia'
    };

    const MAPA_CONTRATO_SELECT = {
        tiempo_completo: 'tiempo-completo',
        medio_tiempo: 'medio-tiempo',
        proyecto: 'servicios',
        pasantia: 'tiempo-completo'
    };

    function parsearRangoSalario(raw) {
        if (!raw || !String(raw).trim()) {
            return { min: null, max: null };
        }
        const matches = String(raw).replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
        if (!matches || matches.length === 0) {
            return { min: null, max: null };
        }
        const min = Number(matches[0]);
        const max = matches.length > 1 ? Number(matches[1]) : null;
        return {
            min: Number.isNaN(min) ? null : min,
            max: max !== null && !Number.isNaN(max) ? max : null
        };
    }

    function inicializarCabecera(usuario) {
        const rightContainer = document.querySelector('header .d-flex.align-items-center');
        if (rightContainer && !document.getElementById('opbBtnLogoutEmp')) {
            const btnLogout = document.createElement('button');
            btnLogout.type = 'button';
            btnLogout.id = 'opbBtnLogoutEmp';
            btnLogout.className = 'btn btn-outline-light btn-sm fw-medium';
            btnLogout.textContent = 'Cerrar sesión';
            btnLogout.addEventListener('click', () => {
                clearSession();
                window.location.href = 'index.html';
            });
            rightContainer.appendChild(btnLogout);
        }

        const headerName = document.getElementById('companyNameHeader');
        if (headerName && usuario) {
            headerName.textContent = `Empresa: ${usuario.nombres || 'Mi Empresa'}`;
        }
    }

    function asegurarControlesUi() {
        const mainContainer = document.querySelector('main.container');
        if (mainContainer && !document.getElementById('opbCompanyStatusAlert')) {
            const alertDiv = document.createElement('div');
            alertDiv.id = 'opbCompanyStatusAlert';
            alertDiv.className = 'mb-3';
            const cardBox = document.querySelector('#employerTabs')?.closest('.bg-white');
            if (cardBox) {
                cardBox.insertAdjacentElement('beforebegin', alertDiv);
            }
        }

        // Solo 2 campos col-md-6 esenciales en #formPublicarOferta para conservar diseño exacto
        const formVacante = document.getElementById('formPublicarOferta');
        if (formVacante && !document.getElementById('jobCategory')) {
            const reqBox = document.getElementById('jobRequirements')?.closest('.col-12');
            const catDiv = document.createElement('div');
            catDiv.className = 'col-md-6';
            catDiv.innerHTML = `
                <label class="form-label fw-medium text-midnight">Categoría de empleo</label>
                <select class="form-select" id="jobCategory" required>
                    <option value="">Selecciona una categoría...</option>
                </select>
            `;
            const modDiv = document.createElement('div');
            modDiv.className = 'col-md-6';
            modDiv.innerHTML = `
                <label class="form-label fw-medium text-midnight">Modalidad</label>
                <select class="form-select" id="jobModality" required>
                    <option value="presencial">Presencial</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="remoto">Remoto</option>
                </select>
            `;
            if (reqBox) {
                reqBox.insertAdjacentElement('beforebegin', catDiv);
                reqBox.insertAdjacentElement('beforebegin', modDiv);
            } else {
                formVacante.appendChild(catDiv);
                formVacante.appendChild(modDiv);
            }

            const reqEl = document.getElementById('jobRequirements');
            if (reqEl) reqEl.minLength = 10;
            const descEl = document.getElementById('jobDescription');
            if (descEl) descEl.minLength = 50;

            // Listado compacto de vacantes propias debajo del formulario
            const listBox = document.createElement('div');
            listBox.id = 'opbEmployerJobsListBox';
            listBox.className = 'mt-5 pt-4 border-top';
            listBox.innerHTML = `
                <h5 class="text-midnight fw-bold mb-3">Mis Vacantes Publicadas</h5>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead class="table-light text-muted">
                            <tr>
                                <th>Título</th>
                                <th>Categoría</th>
                                <th>Estado</th>
                                <th>Postulaciones</th>
                                <th class="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="opbEmployerJobsBody">
                            <tr><td colspan="5" class="text-center text-muted py-3">Cargando vacantes...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            formVacante.insertAdjacentElement('afterend', listBox);
        }

        // Hacer clicable la caja punteada del logo y completar datos legales en #formDatosEmpresa
        const logoInput = document.getElementById('companyLogo');
        const logoBox = logoInput?.parentElement;
        if (logoBox && logoInput) {
            logoBox.style.cursor = 'pointer';
            logoBox.addEventListener('click', (event) => {
                if (event.target !== logoInput) {
                    logoInput.click();
                }
            });
            if (!document.getElementById('opbCompanyLogoStatus')) {
                const st = document.createElement('small');
                st.id = 'opbCompanyLogoStatus';
                st.className = 'text-midnight fw-medium mt-2';
                logoBox.appendChild(st);
            }
        }

        const formEmpresa = document.getElementById('formDatosEmpresa');
        if (formEmpresa && !document.getElementById('companyEmail')) {
            const descCol = document.getElementById('companyDescription')?.closest('.col-12');
            const emailDiv = document.createElement('div');
            emailDiv.className = 'col-md-6';
            emailDiv.innerHTML = `
                <label class="form-label fw-medium text-midnight">Correo de Contacto</label>
                <input type="email" class="form-control" id="companyEmail" required>
            `;
            const nitDiv = document.createElement('div');
            nitDiv.className = 'col-md-6';
            nitDiv.innerHTML = `
                <label class="form-label fw-medium text-midnight">NIT / Registro Comercial</label>
                <input type="text" class="form-control" id="companyNit" maxlength="30">
            `;
            const docDiv = document.createElement('div');
            docDiv.className = 'col-12';
            docDiv.innerHTML = `
                <label class="form-label fw-medium text-midnight">Documento Legal de Respaldo (PDF/PNG/JPG)</label>
                <div class="d-flex flex-wrap gap-2 align-items-center">
                    <input type="file" class="form-control" id="companyDoc" accept=".pdf,.png,.jpg,.jpeg" style="max-width: 360px;">
                    <button type="button" class="btn btn-sm btn-outline-secondary d-none" id="opbBtnDownloadCompanyDoc">Descargar documento actual</button>
                </div>
                <small id="opbCompanyDocStatus" class="text-muted d-block mt-1">Sin documento cargado.</small>
            `;

            if (descCol) {
                descCol.insertAdjacentElement('beforebegin', emailDiv);
                descCol.insertAdjacentElement('beforebegin', nitDiv);
                descCol.insertAdjacentElement('afterend', docDiv);
            } else {
                formEmpresa.appendChild(emailDiv);
                formEmpresa.appendChild(nitDiv);
                formEmpresa.appendChild(docDiv);
            }
        }
    }

    function actualizarHeaderEmpresa(empresa) {
        const headerName = document.getElementById('companyNameHeader');
        const initialsEl = document.getElementById('companyInitials');
        const nombre = empresa?.nombre_legal || 'Mi Empresa';
        if (headerName) {
            headerName.innerHTML = `Empresa: ${escapeHtml(nombre)} ${empresa ? badgeEstado(empresa.estado_verificacion) : ''}`;
        }
        if (initialsEl) {
            if (empresa?.ruta_logo) {
                const logoUrl = urlLogoPublico(empresa.ruta_logo);
                initialsEl.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="rounded-circle object-fit-cover w-100 h-100">`;
            } else {
                initialsEl.textContent = nombre.slice(0, 2).toUpperCase();
            }
        }
    }

    async function cargarDashboard() {
        const alertContainer = document.getElementById('opbCompanyStatusAlert');
        try {
            const res = await apiFetch('/api/empleador/dashboard');
            const d = res?.data || {};
            if (!alertContainer) return;

            if (d.requiere_crear_empresa) {
                alertContainer.innerHTML = `
                    <div class="alert alert-warning mb-0">
                        <strong>Paso requerido:</strong> Completa y guarda la pestaña <strong>Datos de la Empresa</strong> para habilitar tu perfil empresarial.
                    </div>
                `;
            } else if (d.empresa && d.empresa.estado_verificacion !== 'aprobada') {
                alertContainer.innerHTML = `
                    <div class="alert alert-info mb-0">
                        Tu empresa está en estado ${badgeEstado(d.empresa.estado_verificacion)}. Podrás publicar vacantes en cuanto sea aprobada por administración.
                    </div>
                `;
            } else {
                alertContainer.innerHTML = '';
            }
        } catch {
            // ignorar
        }
    }

    async function cargarCategorias() {
        const select = document.getElementById('jobCategory');
        if (!select) return;
        try {
            const res = await apiFetch('/api/catalogos/categorias-empleo', { auth: false });
            estado.categorias = Array.isArray(res?.data) ? res.data : [];
            const opts = estado.categorias.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
            select.innerHTML = `<option value="">Selecciona una categoría...</option>${opts}`;
            if (estado.categorias.length > 0 && !select.value) {
                select.value = String(estado.categorias[0].id);
            }
        } catch {
            // ignorar
        }
    }

    async function cargarEmpresa() {
        const usuario = getUsuario();
        try {
            const res = await apiFetch('/api/empleador/empresa');
            const emp = res?.data || res;
            estado.empresa = emp;
            actualizarHeaderEmpresa(emp);

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val ?? '';
            };
            setVal('companyName', emp.nombre_legal);
            setVal('companyNit', emp.nit);
            setVal('companyEmail', emp.correo_contacto || usuario?.correo || '');
            setVal('companyWebsite', emp.sitio_web);
            setVal('companyDescription', emp.descripcion);

            const logoStatus = document.getElementById('opbCompanyLogoStatus');
            if (logoStatus) {
                logoStatus.textContent = emp.ruta_logo
                    ? `Logo actual: ${String(emp.ruta_logo).split('/').pop()}`
                    : '';
            }

            const docStatus = document.getElementById('opbCompanyDocStatus');
            const docBtn = document.getElementById('opbBtnDownloadCompanyDoc');
            if (docStatus && docBtn) {
                if (emp.ruta_documento_legal) {
                    docStatus.textContent = `Documento cargado: ${String(emp.ruta_documento_legal).split('/').pop()}`;
                    docBtn.classList.remove('d-none');
                } else {
                    docStatus.textContent = 'Sin documento legal cargado.';
                    docBtn.classList.add('d-none');
                }
            }
        } catch (err) {
            if (err.status === 404) {
                estado.empresa = null;
                actualizarHeaderEmpresa(null);
                const compEmail = document.getElementById('companyEmail');
                if (compEmail && !compEmail.value && usuario?.correo) {
                    compEmail.value = usuario.correo;
                }
            } else {
                mostrarAlerta(err.message, 'error');
            }
        }
    }

    async function cargarVacantesEmpleador() {
        const tbody = document.getElementById('opbEmployerJobsBody');
        if (!tbody) return;
        try {
            const res = await apiFetch('/api/empleador/vacantes');
            const items = Array.isArray(res?.data) ? res.data : [];
            estado.vacantes = items;

            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Aún no has creado vacantes.</td></tr>';
                return;
            }

            tbody.innerHTML = items.map((v) => `
                <tr>
                    <td class="fw-medium">${escapeHtml(v.titulo)}</td>
                    <td class="small">${escapeHtml(v.categoria || 'General')}</td>
                    <td>${badgeEstado(v.estado)}</td>
                    <td>${Number(v.total_postulaciones || 0)}</td>
                    <td class="text-end">
                        <button type="button" class="btn btn-sm btn-outline-secondary opb-edit-job" data-id="${v.id}">Editar</button>
                        ${v.estado !== 'cerrada' ? `<button type="button" class="btn btn-sm btn-outline-danger ms-1 opb-close-job" data-id="${v.id}">Cerrar</button>` : ''}
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.opb-edit-job').forEach((btn) => {
                btn.addEventListener('click', () => prepararEdicionVacante(btn.getAttribute('data-id')));
            });
            tbody.querySelectorAll('.opb-close-job').forEach((btn) => {
                btn.addEventListener('click', () => cerrarVacante(btn.getAttribute('data-id')));
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function prepararEdicionVacante(id) {
        try {
            const res = await apiFetch(`/api/empleador/vacantes/${id}`);
            const v = res?.data || res;
            estado.editandoVacanteId = Number(v.id);

            const setVal = (elId, val) => {
                const el = document.getElementById(elId);
                if (el) el.value = val ?? '';
            };
            setVal('jobTitle', v.titulo);
            setVal('jobCategory', v.categoria_id);
            setVal('jobLocation', v.ubicacion);
            setVal('jobModality', v.modalidad);
            setVal('jobType', MAPA_CONTRATO_SELECT[v.tipo_contrato] || 'tiempo-completo');

            let salTexto = '';
            if (v.salario_min !== null && v.salario_max !== null) {
                salTexto = `${v.salario_min} - ${v.salario_max}`;
            } else if (v.salario_min !== null) {
                salTexto = String(v.salario_min);
            }
            setVal('jobSalary', salTexto);
            setVal('jobDescription', v.descripcion);
            setVal('jobRequirements', v.requisitos);

            const submitBtn = document.querySelector('#formPublicarOferta button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Guardar Cambios de Vacante';
            document.getElementById('formPublicarOferta')?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    function limpiarFormularioVacante() {
        const form = document.getElementById('formPublicarOferta');
        if (form) form.reset();
        estado.editandoVacanteId = null;
        if (estado.categorias.length > 0) {
            const cat = document.getElementById('jobCategory');
            if (cat && !cat.value) cat.value = String(estado.categorias[0].id);
        }
        const submitBtn = document.querySelector('#formPublicarOferta button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Publicar Oferta';
    }

    async function cerrarVacante(id) {
        try {
            await apiFetch(`/api/empleador/vacantes/${id}/cerrar`, { method: 'PATCH' });
            mostrarAlerta('Vacante cerrada correctamente.', 'success');
            await Promise.all([cargarVacantesEmpleador(), cargarDashboard()]);
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    function asegurarModalCandidato() {
        let modalEl = document.getElementById('opbCandidateDetailModal');
        if (modalEl) return modalEl;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="modal fade" id="opbCandidateDetailModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header bg-light border-bottom-0">
                            <h5 class="modal-title fw-bold text-midnight">Perfil del Postulante</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4" id="opbCandidateDetailBody">Cargando...</div>
                    </div>
                </div>
            </div>
        `;
        modalEl = wrapper.firstElementChild;
        document.body.appendChild(modalEl);
        return modalEl;
    }

    async function verCandidatoPostulacion(postulacionId) {
        const modalEl = asegurarModalCandidato();
        const body = document.getElementById('opbCandidateDetailBody');
        body.innerHTML = '<div class="text-center py-3 text-muted">Cargando perfil...</div>';
        if (window.bootstrap && window.bootstrap.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
        try {
            const res = await apiFetch(`/api/empleador/postulaciones/${postulacionId}/candidato`);
            const c = res?.data || res?.candidato || res;
            body.innerHTML = `
                <div class="mb-2"><strong>Nombre:</strong> ${escapeHtml(`${c.nombres || ''} ${c.apellidos || ''}`.trim())}</div>
                <div class="mb-2"><strong>Correo:</strong> ${escapeHtml(c.correo || 'N/D')}</div>
                <div class="mb-2"><strong>Teléfono:</strong> ${escapeHtml(c.telefono || 'No registrado')}</div>
                <div class="mb-2"><strong>Vacante:</strong> ${escapeHtml(c.titulo || 'N/D')}</div>
                <div class="mb-3"><strong>Carta de presentación:</strong><p class="bg-light rounded-3 p-2 small mt-1 mb-0">${escapeHtml(c.carta_presentacion || 'Sin carta adjunta.')}</p></div>
                <button type="button" class="btn btn-registro text-white btn-sm w-100" id="opbModalDownloadCandCv">Descargar CV del postulante</button>
            `;
            document.getElementById('opbModalDownloadCandCv')?.addEventListener('click', () => {
                descargarArchivoAutenticado(`/api/empleador/postulaciones/${postulacionId}/cv`, `cv-postulacion-${postulacionId}.pdf`).catch((err) => {
                    mostrarAlerta(err.message, 'error');
                });
            });
        } catch (err) {
            body.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(err.message)}</div>`;
        }
    }

    async function cambiarEstadoPostulacion(id, nuevoEstado) {
        try {
            await apiFetch(`/api/empleador/postulaciones/${id}/estado`, {
                method: 'PATCH',
                body: { estado: nuevoEstado }
            });
            mostrarAlerta('Estado de postulación actualizado.', 'success');
            await Promise.all([cargarPostulacionesEmpleador(), cargarDashboard()]);
        } catch (err) {
            mostrarAlerta(err.message, 'error');
        }
    }

    async function cargarPostulacionesEmpleador() {
        const tbody = document.getElementById('candidatesTableBody');
        if (!tbody) return;
        try {
            const res = await apiFetch('/api/empleador/postulaciones');
            const items = Array.isArray(res?.data) ? res.data : [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay postulaciones registradas todavía.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map((p) => {
                const nombre = `${p.nombres || ''} ${p.apellidos || ''}`.trim() || 'Candidato';
                let btnSiguiente = '';
                if (p.estado === 'nueva') {
                    btnSiguiente = `<button type="button" class="btn btn-sm btn-buscar text-white me-1 opb-step-post" data-id="${p.id}" data-next="en_proceso">Avanzar</button>`;
                } else if (p.estado === 'en_proceso') {
                    btnSiguiente = `<button type="button" class="btn btn-sm btn-success me-1 opb-step-post" data-id="${p.id}" data-next="contratado">Contratar</button>`;
                }
                const btnRechazar = (p.estado === 'nueva' || p.estado === 'en_proceso')
                    ? `<button type="button" class="btn btn-sm btn-outline-danger opb-step-post" data-id="${p.id}" data-next="rechazado">Rechazar</button>`
                    : '';

                return `
                    <tr>
                        <td class="fw-medium">${escapeHtml(nombre)}</td>
                        <td>${escapeHtml(p.titulo)}</td>
                        <td>${escapeHtml(formatearFecha(p.fecha_postulacion))}</td>
                        <td>${badgeEstado(p.estado)}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-outline-secondary me-1 opb-view-cand" data-id="${p.id}">Ver CV</button>
                            ${btnSiguiente}
                            ${btnRechazar}
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.opb-view-cand').forEach((btn) => {
                btn.addEventListener('click', () => verCandidatoPostulacion(btn.getAttribute('data-id')));
            });
            tbody.querySelectorAll('.opb-step-post').forEach((btn) => {
                btn.addEventListener('click', () => cambiarEstadoPostulacion(btn.getAttribute('data-id'), btn.getAttribute('data-next')));
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function vincularEventos() {
        const formEmpresa = document.getElementById('formDatosEmpresa');
        if (formEmpresa) {
            formEmpresa.addEventListener('submit', async (event) => {
                event.preventDefault();
                const payload = {
                    nombre_legal: (document.getElementById('companyName')?.value || '').trim(),
                    nit: (document.getElementById('companyNit')?.value || '').trim() || null,
                    correo_contacto: (document.getElementById('companyEmail')?.value || '').trim(),
                    sitio_web: (document.getElementById('companyWebsite')?.value || '').trim() || null,
                    descripcion: (document.getElementById('companyDescription')?.value || '').trim() || null
                };

                const btn = formEmpresa.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                try {
                    const method = estado.empresa ? 'PATCH' : 'POST';
                    await apiFetch('/api/empleador/empresa', { method, body: payload });
                    mostrarAlerta('Datos de empresa guardados correctamente.', 'success');
                    await Promise.all([cargarEmpresa(), cargarDashboard()]);
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }

        const logoInput = document.getElementById('companyLogo');
        if (logoInput) {
            logoInput.addEventListener('change', async () => {
                const file = logoInput.files && logoInput.files[0];
                if (!file) return;
                if (!estado.empresa) {
                    mostrarAlerta('Guarda primero los datos de tu empresa antes de subir el logo.', 'warning');
                    logoInput.value = '';
                    return;
                }
                const fd = new FormData();
                fd.append('archivo', file);
                try {
                    await apiFetch('/api/empleador/empresa/logo', { method: 'POST', body: fd });
                    mostrarAlerta('Logo actualizado correctamente.', 'success');
                    logoInput.value = '';
                    await cargarEmpresa();
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                }
            });
        }

        const docInput = document.getElementById('companyDoc');
        if (docInput) {
            docInput.addEventListener('change', async () => {
                const file = docInput.files && docInput.files[0];
                if (!file) return;
                if (!estado.empresa) {
                    mostrarAlerta('Guarda primero los datos de tu empresa antes de subir el documento legal.', 'warning');
                    docInput.value = '';
                    return;
                }
                const fd = new FormData();
                fd.append('archivo', file);
                try {
                    await apiFetch('/api/empleador/empresa/documento', { method: 'POST', body: fd });
                    mostrarAlerta('Documento legal cargado correctamente.', 'success');
                    docInput.value = '';
                    await cargarEmpresa();
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                }
            });
        }

        document.getElementById('opbBtnDownloadCompanyDoc')?.addEventListener('click', async () => {
            try {
                await descargarArchivoAutenticado('/api/empleador/empresa/documento', 'documento-empresa.pdf');
            } catch (err) {
                mostrarAlerta(err.message, 'error');
            }
        });

        const formVacante = document.getElementById('formPublicarOferta');
        if (formVacante) {
            formVacante.addEventListener('submit', async (event) => {
                event.preventDefault();
                const salParsed = parsearRangoSalario(document.getElementById('jobSalary')?.value || '');
                const rawContrato = document.getElementById('jobType')?.value || 'tiempo-completo';
                const correoContacto = estado.empresa?.correo_contacto || getUsuario()?.correo || '';

                const payload = {
                    titulo: (document.getElementById('jobTitle')?.value || '').trim(),
                    categoria_id: Number(document.getElementById('jobCategory')?.value),
                    ubicacion: (document.getElementById('jobLocation')?.value || '').trim(),
                    modalidad: document.getElementById('jobModality')?.value || 'presencial',
                    tipo_contrato: MAPA_CONTRATO_ENVIO[rawContrato] || 'tiempo_completo',
                    nivel_experiencia: 'intermedio',
                    salario_min: salParsed.min,
                    salario_max: salParsed.max,
                    descripcion: (document.getElementById('jobDescription')?.value || '').trim(),
                    requisitos: (document.getElementById('jobRequirements')?.value || '').trim(),
                    correo_contacto: correoContacto
                };

                if (payload.titulo.length < 5) {
                    mostrarAlerta('El título de la vacante debe tener al menos 5 caracteres.', 'warning');
                    return;
                }
                if (!Number.isInteger(payload.categoria_id) || payload.categoria_id <= 0) {
                    mostrarAlerta('Selecciona una categoría de empleo válida.', 'warning');
                    return;
                }
                if (payload.descripcion.length < 50) {
                    mostrarAlerta('La descripción del puesto debe tener al menos 50 caracteres.', 'warning');
                    return;
                }
                if (payload.requisitos.length < 10) {
                    mostrarAlerta('Los requisitos deben tener al menos 10 caracteres.', 'warning');
                    return;
                }

                const btn = formVacante.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                try {
                    if (estado.editandoVacanteId) {
                        await apiFetch(`/api/empleador/vacantes/${estado.editandoVacanteId}`, {
                            method: 'PATCH',
                            body: payload
                        });
                        mostrarAlerta('Vacante actualizada correctamente.', 'success');
                    } else {
                        await apiFetch('/api/empleador/vacantes', {
                            method: 'POST',
                            body: payload
                        });
                        mostrarAlerta('Vacante creada y enviada a revisión.', 'success');
                    }
                    limpiarFormularioVacante();
                    await Promise.all([cargarVacantesEmpleador(), cargarDashboard()]);
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }

        document.getElementById('btnCancelJob')?.addEventListener('click', limpiarFormularioVacante);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const usuario = exigirRol('empleador');
        if (!usuario) return;

        inicializarCabecera(usuario);
        asegurarControlesUi();
        vincularEventos();

        await Promise.all([
            cargarCategorias(),
            cargarEmpresa(),
            cargarDashboard(),
            cargarVacantesEmpleador(),
            cargarPostulacionesEmpleador()
        ]);
    });
})();
