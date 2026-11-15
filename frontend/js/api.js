(function () {
    'use strict';

    const STORAGE_KEYS = {
        TOKEN: 'opb_token',
        USUARIO: 'opb_usuario'
    };

    // Resolver URL base del backend: cualquier origen fuera de puerto 3000 (incluyendo file://) apunta a http://localhost:3000
    function resolverApiBase() {
        if (typeof window.OPB_API_BASE === 'string' && window.OPB_API_BASE.trim()) {
            return window.OPB_API_BASE.trim().replace(/\/+$/, '');
        }
        const meta = document.querySelector('meta[name="api-base"]');
        if (meta && meta.content && meta.content.trim()) {
            return meta.content.trim().replace(/\/+$/, '');
        }
        if (window.location.protocol === 'file:' || window.location.port !== '3000') {
            return 'http://localhost:3000';
        }
        return window.location.origin;
    }

    const API_BASE = resolverApiBase();

    function buildUrl(path) {
        if (/^https?:\/\//i.test(path)) {
            return path;
        }
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return `${API_BASE}${normalized}`;
    }

    function escapeHtml(valor) {
        if (valor === null || valor === undefined) {
            return '';
        }
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getToken() {
        try {
            return window.localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
        } catch {
            return '';
        }
    }

    function setToken(token) {
        try {
            if (token) {
                window.localStorage.setItem(STORAGE_KEYS.TOKEN, token);
            } else {
                window.localStorage.removeItem(STORAGE_KEYS.TOKEN);
            }
        } catch {
            // ignorar si localStorage no está disponible
        }
    }

    function getUsuario() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEYS.USUARIO);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function setUsuario(usuario) {
        try {
            if (usuario) {
                window.localStorage.setItem(STORAGE_KEYS.USUARIO, JSON.stringify(usuario));
            } else {
                window.localStorage.removeItem(STORAGE_KEYS.USUARIO);
            }
        } catch {
            // ignorar si localStorage no está disponible
        }
    }

    function clearSession() {
        setToken('');
        setUsuario(null);
    }

    function normalizarRol(usuario) {
        if (!usuario) {
            return '';
        }
        if (usuario.rol) {
            return String(usuario.rol).trim().toLowerCase();
        }
        const mapaRoles = { 1: 'candidato', 2: 'empleador', 3: 'administrador' };
        return mapaRoles[Number(usuario.rol_id)] || '';
    }

    function getRol() {
        return normalizarRol(getUsuario());
    }

    function isAuthenticated() {
        return Boolean(getToken());
    }

    function rutaPanelPorRol(rol) {
        const normalizado = String(rol || '').toLowerCase();
        if (normalizado === 'candidato') {
            return 'perfil-usuario.html';
        }
        if (normalizado === 'empleador') {
            return 'publicar-empleos.html';
        }
        if (normalizado === 'administrador') {
            return 'panel-administrativo.html';
        }
        return 'index.html';
    }

    function extraerMensajeError(data, status) {
        if (data && Array.isArray(data.errores) && data.errores.length > 0) {
            const detalles = data.errores.map((item) => item.msg || item.message).filter(Boolean);
            if (detalles.length > 0) {
                return detalles.join('. ');
            }
        }
        if (data && typeof data === 'object') {
            const candidato = data.error || data.mensaje || data.message;
            if (typeof candidato === 'string' && candidato.trim()) {
                return candidato.trim();
            }
        }
        if (status === 401) {
            return 'Sesión no válida o expirada. Inicia sesión nuevamente.';
        }
        if (status === 403) {
            return 'No tienes permisos para realizar esta acción.';
        }
        return `Error inesperado (${status || 'red'}).`;
    }

    function asegurarContenedorToasts() {
        let contenedor = document.getElementById('opbToastContainer');
        if (!contenedor) {
            contenedor = document.createElement('div');
            contenedor.id = 'opbToastContainer';
            contenedor.className = 'position-fixed top-0 end-0 p-3';
            contenedor.style.zIndex = '1090';
            contenedor.style.maxWidth = '420px';
            document.body.appendChild(contenedor);
        }
        return contenedor;
    }

    function mostrarAlerta(mensaje, tipo = 'info') {
        const estilos = {
            success: 'alert-success border-success',
            error: 'alert-danger border-danger',
            danger: 'alert-danger border-danger',
            warning: 'alert-warning border-warning',
            info: 'alert-primary border-primary'
        };
        const clase = estilos[tipo] || estilos.info;
        const contenedor = asegurarContenedorToasts();
        const alerta = document.createElement('div');
        alerta.className = `alert ${clase} alert-dismissible fade show shadow-sm mb-2 small`;
        alerta.setAttribute('role', 'alert');
        alerta.innerHTML = `
            <div>${escapeHtml(mensaje)}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        `;
        contenedor.appendChild(alerta);

        window.setTimeout(() => {
            if (alerta.parentNode) {
                alerta.classList.remove('show');
                window.setTimeout(() => alerta.remove(), 200);
            }
        }, 5000);
    }

    async function apiFetch(path, options = {}) {
        const {
            method = 'GET',
            body = undefined,
            headers = {},
            auth = true
        } = options;

        const requestHeaders = { ...headers };
        const token = auth ? getToken() : '';
        if (auth && token && !requestHeaders.Authorization) {
            requestHeaders.Authorization = `Bearer ${token}`;
        }

        let finalBody = body;
        if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
            if (!requestHeaders['Content-Type']) {
                requestHeaders['Content-Type'] = 'application/json';
            }
            finalBody = JSON.stringify(body);
        }

        let response;
        try {
            response = await window.fetch(buildUrl(path), {
                method,
                headers: requestHeaders,
                body: finalBody
            });
        } catch {
            throw new Error('No se pudo conectar con el servidor (http://localhost:3000). Verifica que el backend esté activo.');
        }

        const contentType = response.headers.get('content-type') || '';
        let payload = null;
        if (contentType.includes('application/json')) {
            payload = await response.json().catch(() => null);
        } else {
            const text = await response.text().catch(() => '');
            payload = text ? { message: text } : null;
        }

        if (!response.ok) {
            if (response.status === 401 && auth && token) {
                clearSession();
            }
            const err = new Error(extraerMensajeError(payload, response.status));
            err.status = response.status;
            err.data = payload;
            throw err;
        }

        return payload;
    }

    async function descargarArchivoAutenticado(path, nombrePorDefecto = 'archivo') {
        const token = getToken();
        if (!token) {
            mostrarAlerta('Debes iniciar sesión para descargar el archivo.', 'warning');
            return;
        }

        let response;
        try {
            response = await window.fetch(buildUrl(path), {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        } catch {
            throw new Error('No se pudo conectar con el servidor para descargar el archivo.');
        }

        if (!response.ok) {
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }
            throw new Error(extraerMensajeError(data, response.status));
        }

        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        let filename = nombrePorDefecto;
        const matchUtf = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const matchAscii = disposition.match(/filename="?([^";]+)"?/i);
        if (matchUtf && matchUtf[1]) {
            filename = decodeURIComponent(matchUtf[1]);
        } else if (matchAscii && matchAscii[1]) {
            filename = matchAscii[1];
        }

        const objectUrl = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = objectUrl;
        enlace.download = filename;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        window.URL.revokeObjectURL(objectUrl);
    }

    function formatearFecha(iso) {
        if (!iso) {
            return 'N/D';
        }
        const fecha = new Date(iso);
        if (Number.isNaN(fecha.getTime())) {
            return String(iso);
        }
        return fecha.toLocaleDateString('es-SV', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatearMonedaSalario(min, max) {
        const tieneMin = min !== null && min !== undefined && min !== '';
        const tieneMax = max !== null && max !== undefined && max !== '';
        if (!tieneMin && !tieneMax) {
            return 'A convenir';
        }
        const fmt = (n) => `$${Number(n).toLocaleString('en-US')}`;
        if (tieneMin && tieneMax) {
            return `${fmt(min)} - ${fmt(max)}`;
        }
        if (tieneMin) {
            return `Desde ${fmt(min)}`;
        }
        return `Hasta ${fmt(max)}`;
    }

    function urlLogoPublico(rutaLogo) {
        if (!rutaLogo) {
            return '';
        }
        const limpio = String(rutaLogo).replace(/^\/+/, '');
        if (/^https?:\/\//i.test(limpio)) {
            return limpio;
        }
        return buildUrl(`/${limpio}`);
    }

    function badgeEstado(estado) {
        const normalizado = String(estado || '').toLowerCase();
        const mapa = {
            publicada: { clase: 'bg-success text-white', texto: 'Publicada' },
            aprobada: { clase: 'bg-success text-white', texto: 'Aprobada' },
            activo: { clase: 'bg-success text-white', texto: 'Activo' },
            contratado: { clase: 'bg-success text-white', texto: 'Contratado' },
            pendiente: { clase: 'bg-warning text-dark', texto: 'Pendiente' },
            en_proceso: { clase: 'bg-info text-dark', texto: 'En proceso' },
            nueva: { clase: 'bg-lime text-midnight', texto: 'Nueva' },
            borrador: { clase: 'bg-secondary text-white', texto: 'Borrador' },
            oculta: { clase: 'bg-secondary text-white', texto: 'Oculta' },
            cerrada: { clase: 'bg-dark text-white', texto: 'Cerrada' },
            rechazada: { clase: 'bg-danger text-white', texto: 'Rechazada' },
            rechazado: { clase: 'bg-danger text-white', texto: 'Rechazado' },
            suspendida: { clase: 'bg-danger text-white', texto: 'Suspendida' },
            suspendido: { clase: 'bg-danger text-white', texto: 'Suspendido' }
        };
        const info = mapa[normalizado] || { clase: 'bg-light text-dark border', texto: estado || 'N/D' };
        return `<span class="badge ${info.clase} px-3 py-2 rounded-pill">${escapeHtml(info.texto)}</span>`;
    }

    async function iniciarSesion(correo, contrasena) {
        const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            auth: false,
            body: { correo, contrasena }
        });
        setToken(res.token);
        setUsuario(res.usuario);
        return res;
    }

    async function registrarUsuario(payload) {
        return apiFetch('/api/auth/registro', {
            method: 'POST',
            auth: false,
            body: payload
        });
    }

    async function refrescarUsuarioActual() {
        if (!getToken()) {
            return null;
        }
        try {
            const res = await apiFetch('/api/auth/me');
            if (res && res.usuario) {
                setUsuario(res.usuario);
                return res.usuario;
            }
            return null;
        } catch {
            return null;
        }
    }

    function obtenerIniciales(usuario) {
        if (!usuario) {
            return 'OB';
        }
        const n = (usuario.nombres || '').trim();
        const a = (usuario.apellidos || '').trim();
        const ini = `${n.charAt(0)}${a.charAt(0)}`.toUpperCase();
        return ini || 'OB';
    }

    // Inyectar modales respetando las clases del diseño original en subpáginas que no los incluyen
    function inyectarModalesAuthSiFaltan() {
        if (!document.getElementById('loginModal')) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="modal fade" id="loginModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-0 shadow">
                            <div class="modal-header bg-light border-bottom-0">
                                <h5 class="modal-title fw-bold text-midnight">Iniciar Sesión</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <form id="formLogin">
                                    <div class="mb-3">
                                        <label class="form-label fw-medium text-midnight small">Correo electrónico</label>
                                        <input type="email" class="form-control" id="loginEmail" required>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label fw-medium text-midnight small">Contraseña</label>
                                        <input type="password" class="form-control" id="loginPassword" required>
                                    </div>
                                    <button type="submit" class="btn btn-registro text-white w-100 py-2">Ingresar a mi cuenta</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(wrapper.firstElementChild);
        }

        if (!document.getElementById('registroModal')) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="modal fade" id="registroModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content border-0 shadow">
                            <div class="modal-header bg-light border-bottom-0">
                                <h5 class="modal-title fw-bold text-midnight">Crear una cuenta nueva</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body p-4">
                                <ul class="nav nav-pills mb-4 justify-content-center" role="tablist">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active fw-medium" data-bs-toggle="pill" data-bs-target="#opb-pills-candidato" type="button" role="tab">Soy Candidato</button>
                                    </li>
                                    <li class="nav-item ms-2" role="presentation">
                                        <button class="nav-link fw-medium" data-bs-toggle="pill" data-bs-target="#opb-pills-empresa" type="button" role="tab">Soy Empresa</button>
                                    </li>
                                </ul>
                                <div class="tab-content">
                                    <div class="tab-pane fade show active" id="opb-pills-candidato" role="tabpanel">
                                        <form id="formRegistroCandidato" class="row g-3">
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Nombre completo</label>
                                                <input type="text" class="form-control" id="regCandName" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Documento (DUI/Pasaporte)</label>
                                                <input type="text" class="form-control" id="regCandDoc" required>
                                            </div>
                                            <div class="col-12">
                                                <label class="form-label fw-medium text-midnight small">Correo electrónico</label>
                                                <input type="email" class="form-control" id="regCandEmail" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Contraseña</label>
                                                <input type="password" class="form-control" id="regCandPass" placeholder="Mínimo 8 caracteres" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Confirmar contraseña</label>
                                                <input type="password" class="form-control" id="regCandPassConfirm" placeholder="Mínimo 8 caracteres" required>
                                            </div>
                                            <div class="col-12 mt-4">
                                                <button type="submit" class="btn btn-registro text-white w-100 py-2">Registrarme como Candidato</button>
                                            </div>
                                        </form>
                                    </div>
                                    <div class="tab-pane fade" id="opb-pills-empresa" role="tabpanel">
                                        <form id="formRegistroEmpresa" class="row g-3">
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Nombre de la Empresa</label>
                                                <input type="text" class="form-control" id="regEmpName" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">NIT / Registro Comercial</label>
                                                <input type="text" class="form-control" id="regEmpNit" required>
                                            </div>
                                            <div class="col-12">
                                                <label class="form-label fw-medium text-midnight small">Correo corporativo</label>
                                                <input type="email" class="form-control" id="regEmpEmail" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Contraseña</label>
                                                <input type="password" class="form-control" id="regEmpPass" placeholder="Mínimo 8 caracteres" required>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-medium text-midnight small">Confirmar contraseña</label>
                                                <input type="password" class="form-control" id="regEmpPassConfirm" placeholder="Mínimo 8 caracteres" required>
                                            </div>
                                            <div class="col-12 mt-4">
                                                <button type="submit" class="btn btn-registro text-white w-100 py-2">Registrar mi Empresa</button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(wrapper.firstElementChild);
        }
    }

    function aplicarPlaceholdersRegistro() {
        ['regCandPass', 'regCandPassConfirm', 'regEmpPass', 'regEmpPassConfirm'].forEach((id) => {
            const el = document.getElementById(id);
            if (el && !el.placeholder) {
                el.placeholder = 'Mínimo 8 caracteres';
            }
        });
    }

    function ocultarModal(id) {
        const el = document.getElementById(id);
        if (el && window.bootstrap && window.bootstrap.Modal) {
            const inst = window.bootstrap.Modal.getInstance(el) || window.bootstrap.Modal.getOrCreateInstance(el);
            inst.hide();
        }
    }

    function abrirModal(id) {
        inyectarModalesAuthSiFaltan();
        vincularModalesAuth();
        const el = document.getElementById(id);
        if (el && window.bootstrap && window.bootstrap.Modal) {
            const inst = window.bootstrap.Modal.getOrCreateInstance(el);
            inst.show();
        }
    }

    function vincularModalesAuth(onSuccessCallback) {
        inyectarModalesAuthSiFaltan();
        aplicarPlaceholdersRegistro();

        const formLogin = document.getElementById('formLogin');
        if (formLogin && !formLogin.dataset.opbBound) {
            formLogin.dataset.opbBound = 'true';
            formLogin.addEventListener('submit', async (event) => {
                event.preventDefault();
                const email = (document.getElementById('loginEmail')?.value || '').trim();
                const password = document.getElementById('loginPassword')?.value || '';
                const btn = formLogin.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                try {
                    const res = await iniciarSesion(email, password);
                    ocultarModal('loginModal');
                    mostrarAlerta(`Bienvenido, ${res.usuario.nombres || res.usuario.correo}.`, 'success');
                    actualizarNavbarPublico();
                    if (typeof onSuccessCallback === 'function') {
                        onSuccessCallback(res.usuario);
                    } else {
                        const actual = window.location.pathname.split('/').pop() || 'index.html';
                        if (actual === 'index.html' || actual === '') {
                            const destino = rutaPanelPorRol(normalizarRol(res.usuario));
                            if (destino !== 'index.html') {
                                window.setTimeout(() => {
                                    window.location.href = destino;
                                }, 500);
                            }
                        } else {
                            window.location.reload();
                        }
                    }
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }

        const formCand = document.getElementById('formRegistroCandidato');
        if (formCand && !formCand.dataset.opbBound) {
            formCand.dataset.opbBound = 'true';
            formCand.addEventListener('submit', async (event) => {
                event.preventDefault();
                const nombreCompleto = (document.getElementById('regCandName')?.value || '').trim();
                const correo = (document.getElementById('regCandEmail')?.value || '').trim();
                const pass = document.getElementById('regCandPass')?.value || '';
                const passConfirm = document.getElementById('regCandPassConfirm')?.value || '';

                if (pass !== passConfirm) {
                    mostrarAlerta('Las contraseñas no coinciden.', 'warning');
                    return;
                }
                if (pass.length < 8) {
                    mostrarAlerta('La contraseña debe tener al menos 8 caracteres.', 'warning');
                    return;
                }
                if (!nombreCompleto) {
                    mostrarAlerta('Debes ingresar tu nombre completo.', 'warning');
                    return;
                }

                const partes = nombreCompleto.split(/\s+/).filter(Boolean);
                const nombres = partes.shift();
                const apellidos = partes.length > 0 ? partes.join(' ') : 'Candidato';

                const btn = formCand.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                try {
                    await registrarUsuario({
                        nombres,
                        apellidos,
                        correo,
                        contrasena: pass,
                        tipo_usuario: 'candidato'
                    });
                    const loginRes = await iniciarSesion(correo, pass);
                    ocultarModal('registroModal');
                    mostrarAlerta('Cuenta de candidato creada e iniciada correctamente.', 'success');
                    actualizarNavbarPublico();
                    if (typeof onSuccessCallback === 'function') {
                        onSuccessCallback(loginRes.usuario);
                    } else {
                        window.setTimeout(() => {
                            window.location.href = 'perfil-usuario.html';
                        }, 600);
                    }
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }

        const formEmp = document.getElementById('formRegistroEmpresa');
        if (formEmp && !formEmp.dataset.opbBound) {
            formEmp.dataset.opbBound = 'true';
            formEmp.addEventListener('submit', async (event) => {
                event.preventDefault();
                const nombreEmpresa = (document.getElementById('regEmpName')?.value || '').trim();
                const nit = (document.getElementById('regEmpNit')?.value || '').trim();
                const correo = (document.getElementById('regEmpEmail')?.value || '').trim();
                const pass = document.getElementById('regEmpPass')?.value || '';
                const passConfirm = document.getElementById('regEmpPassConfirm')?.value || '';

                if (pass !== passConfirm) {
                    mostrarAlerta('Las contraseñas no coinciden.', 'warning');
                    return;
                }
                if (pass.length < 8) {
                    mostrarAlerta('La contraseña debe tener al menos 8 caracteres.', 'warning');
                    return;
                }
                if (!nombreEmpresa) {
                    mostrarAlerta('Debes ingresar el nombre de la empresa.', 'warning');
                    return;
                }

                const btn = formEmp.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;
                try {
                    await registrarUsuario({
                        nombres: nombreEmpresa,
                        apellidos: 'Empresa',
                        correo,
                        contrasena: pass,
                        tipo_usuario: 'empleador'
                    });
                    const loginRes = await iniciarSesion(correo, pass);
                    try {
                        await apiFetch('/api/empleador/empresa', {
                            method: 'POST',
                            body: {
                                nombre_legal: nombreEmpresa,
                                nit: nit || null,
                                correo_contacto: correo
                            }
                        });
                    } catch (empresaErr) {
                        mostrarAlerta(`Cuenta creada, revisa los datos de empresa: ${empresaErr.message}`, 'warning');
                    }
                    ocultarModal('registroModal');
                    mostrarAlerta('Cuenta empresarial creada. Redirigiendo a tu panel...', 'success');
                    actualizarNavbarPublico();
                    if (typeof onSuccessCallback === 'function') {
                        onSuccessCallback(loginRes.usuario);
                    } else {
                        window.setTimeout(() => {
                            window.location.href = 'publicar-empleos.html';
                        }, 700);
                    }
                } catch (err) {
                    mostrarAlerta(err.message, 'error');
                } finally {
                    if (btn) btn.disabled = false;
                }
            });
        }
    }

    function actualizarNavbarPublico() {
        const actionsContainer =
            document.getElementById('opbHeaderAuthArea') ||
            document.querySelector('header [data-bs-target="#loginModal"]')?.parentElement;

        if (!actionsContainer) {
            return;
        }
        actionsContainer.id = 'opbHeaderAuthArea';

        const token = getToken();
        const usuario = getUsuario();

        if (!token || !usuario) {
            actionsContainer.innerHTML = `
                <button class="btn btn-outline-light me-2 fw-medium" data-bs-toggle="modal" data-bs-target="#loginModal">Inicio de sesión</button>
                <button class="btn btn-registro fw-medium text-white" data-bs-toggle="modal" data-bs-target="#registroModal">Registro</button>
            `;
            return;
        }

        const rol = normalizarRol(usuario);
        const panelHref = rutaPanelPorRol(rol);
        const nombreCorto = (usuario.nombres || usuario.correo || 'Usuario').trim().split(/\s+/)[0];

        actionsContainer.innerHTML = `
            <a href="${escapeHtml(panelHref)}" class="btn btn-outline-light me-2 fw-medium">Mi Cuenta (${escapeHtml(nombreCorto)})</a>
            <button type="button" class="btn btn-registro fw-medium text-white" id="opbBtnLogoutNav">Cerrar sesión</button>
        `;

        const btnLogout = document.getElementById('opbBtnLogoutNav');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                clearSession();
                mostrarAlerta('Has cerrado sesión.', 'info');
                window.setTimeout(() => window.location.reload(), 400);
            });
        }
    }

    function exigirRol(rolRequerido) {
        const token = getToken();
        const usuario = getUsuario();
        if (!token || !usuario) {
            mostrarAlerta('Inicia sesión para acceder a esta sección.', 'warning');
            window.setTimeout(() => {
                window.location.href = 'index.html';
            }, 900);
            return null;
        }
        const rolActual = normalizarRol(usuario);
        if (rolRequerido && rolActual !== rolRequerido) {
            mostrarAlerta(`Esta vista corresponde al rol ${rolRequerido}. Redirigiendo a tu panel...`, 'warning');
            window.setTimeout(() => {
                window.location.href = rutaPanelPorRol(rolActual);
            }, 900);
            return null;
        }
        return usuario;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (getToken()) {
            await refrescarUsuarioActual();
        }
        actualizarNavbarPublico();
        vincularModalesAuth();
    });

    window.OPB = {
        API_BASE,
        buildUrl,
        escapeHtml,
        getToken,
        setToken,
        getUsuario,
        setUsuario,
        clearSession,
        normalizarRol,
        getRol,
        isAuthenticated,
        rutaPanelPorRol,
        obtenerIniciales,
        mostrarAlerta,
        apiFetch,
        descargarArchivoAutenticado,
        formatearFecha,
        formatearMonedaSalario,
        urlLogoPublico,
        badgeEstado,
        iniciarSesion,
        registrarUsuario,
        refrescarUsuarioActual,
        vincularModalesAuth,
        abrirModal,
        ocultarModal,
        actualizarNavbarPublico,
        exigirRol
    };
})();
