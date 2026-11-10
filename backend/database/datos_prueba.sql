-- Datos de prueba para OpportunityBridge.
-- Ejecutar DESPUES de schema.sql y una sola vez.
-- Las contrasenas son valores temporales: deben reemplazarse por hashes reales
-- cuando se implemente el inicio de sesion.

begin;

insert into usuarios (rol_id, nombres, apellidos, correo, contrasena_hash, telefono, ruta_cv)
values
  ((select id from roles where nombre = 'administrador'), 'Nestor', 'Uto', 'admin@opportunitybridge.sv', 'HASH_PENDIENTE_ADMIN', '7000-0001', null),
  ((select id from roles where nombre = 'candidato'), 'Ana', 'Garcia', 'ana.garcia@correo.com', 'HASH_PENDIENTE_ANA', '7123-4567', 'uploads/cv/ana-garcia.pdf'),
  ((select id from roles where nombre = 'candidato'), 'Carlos', 'Lopez', 'carlos.lopez@correo.com', 'HASH_PENDIENTE_CARLOS', '7234-5678', 'uploads/cv/carlos-lopez.pdf'),
  ((select id from roles where nombre = 'candidato'), 'Lucia', 'Torres', 'lucia.torres@correo.com', 'HASH_PENDIENTE_LUCIA', '7345-6789', 'uploads/cv/lucia-torres.pdf'),
  ((select id from roles where nombre = 'empleador'), 'Maria', 'Perez', 'contacto@tecnosoluciones.sv', 'HASH_PENDIENTE_TECNO', '2250-1100', null),
  ((select id from roles where nombre = 'empleador'), 'Diego', 'Rivera', 'rrhh@creativadigital.sv', 'HASH_PENDIENTE_CREATIVA', '2400-2000', null);

insert into empresas (usuario_id, nombre_legal, nit, descripcion, sitio_web, correo_contacto, telefono_contacto, ruta_logo, ruta_documento_legal, estado_verificacion)
values
  ((select id from usuarios where correo = 'contacto@tecnosoluciones.sv'), 'TecnoSoluciones S.A. de C.V.', '0614-010101-101-1', 'Empresa salvadorena dedicada al desarrollo de software empresarial.', 'https://tecnosoluciones.sv', 'rrhh@tecnosoluciones.sv', '2250-1100', 'uploads/logos/tecnosoluciones.png', 'uploads/documentos/tecnosoluciones-nit.pdf', 'aprobada'),
  ((select id from usuarios where correo = 'rrhh@creativadigital.sv'), 'Creativa Digital S.A. de C.V.', '0614-020202-202-2', 'Agencia de diseno digital, experiencia de usuario y productos web.', 'https://creativadigital.sv', 'rrhh@creativadigital.sv', '2400-2000', 'uploads/logos/creativa-digital.png', 'uploads/documentos/creativa-digital-nit.pdf', 'aprobada');

insert into categorias_empleo (nombre) values
  ('Tecnologia'),
  ('Diseno y Creatividad'),
  ('Banca y Finanzas'),
  ('Administracion');

insert into vacantes (empresa_id, categoria_id, titulo, ubicacion, modalidad, tipo_contrato, nivel_experiencia, salario_min, salario_max, descripcion, responsabilidades, requisitos, beneficios, correo_contacto, estado, fecha_publicacion)
values
  (
    (select id from empresas where nombre_legal = 'TecnoSoluciones S.A. de C.V.'),
    (select id from categorias_empleo where nombre = 'Tecnologia'),
    'Desarrollador Full Stack Java/Angular', 'San Salvador', 'hibrido', 'tiempo_completo', 'intermedio', 1800, 2200,
    'Buscamos un desarrollador Full Stack para construir aplicaciones empresariales con Spring Boot, Angular y servicios REST.',
    'Desarrollar modulos backend, crear interfaces web y participar en revisiones de codigo.',
    'Java 17, Spring Boot, Angular, TypeScript, Git y APIs REST.',
    'Seguro medico, modalidad hibrida, bono anual y certificaciones pagadas.',
    'rrhh@tecnosoluciones.sv', 'publicada', current_timestamp - interval '1 day'
  ),
  (
    (select id from empresas where nombre_legal = 'Creativa Digital S.A. de C.V.'),
    (select id from categorias_empleo where nombre = 'Diseno y Creatividad'),
    'Disenador UI/UX', 'Santa Ana', 'remoto', 'tiempo_completo', 'junior', 1100, 1500,
    'Buscamos una persona con interes en investigacion de usuarios, diseno de interfaces y creacion de prototipos digitales.',
    'Crear flujos, wireframes, prototipos y colaborar con el equipo de desarrollo.',
    'Figma, principios de UX, portafolio y comunicacion efectiva.',
    'Trabajo remoto, horario flexible y presupuesto para capacitacion.',
    'rrhh@creativadigital.sv', 'publicada', current_timestamp - interval '3 days'
  ),
  (
    (select id from empresas where nombre_legal = 'TecnoSoluciones S.A. de C.V.'),
    (select id from categorias_empleo where nombre = 'Tecnologia'),
    'Administrador de Bases de Datos PostgreSQL', 'San Salvador', 'presencial', 'tiempo_completo', 'senior', 2000, 2600,
    'Se requiere experiencia administrando bases de datos PostgreSQL, respaldos, monitoreo y optimizacion de consultas.',
    'Administrar instancias PostgreSQL, ejecutar respaldos y revisar rendimiento.',
    'PostgreSQL, SQL, respaldos, Linux y al menos cinco anos de experiencia.',
    'Seguro medico, capacitacion tecnica y bono por resultados.',
    'rrhh@tecnosoluciones.sv', 'publicada', current_timestamp - interval '6 days'
  ),
  (
    (select id from empresas where nombre_legal = 'Creativa Digital S.A. de C.V.'),
    (select id from categorias_empleo where nombre = 'Tecnologia'),
    'Desarrollador Web Frontend', 'Remoto', 'remoto', 'proyecto', 'junior', 900, 1200,
    'Proyecto para crear componentes accesibles y paginas responsivas para una plataforma de contenido digital.',
    'Implementar interfaces, consumir APIs y corregir errores visuales.',
    'HTML, CSS, JavaScript, React y control de versiones con Git.',
    'Proyecto remoto con posibilidad de renovacion.',
    'rrhh@creativadigital.sv', 'publicada', current_timestamp - interval '2 days'
  );

insert into postulaciones (vacante_id, candidato_id, ruta_cv, carta_presentacion, estado)
values
  ((select id from vacantes where titulo = 'Desarrollador Full Stack Java/Angular'), (select id from usuarios where correo = 'ana.garcia@correo.com'), 'uploads/cv/ana-garcia.pdf', 'Me interesa aportar mi experiencia con Java y Angular al equipo.', 'en_proceso'),
  ((select id from vacantes where titulo = 'Disenador UI/UX'), (select id from usuarios where correo = 'carlos.lopez@correo.com'), 'uploads/cv/carlos-lopez.pdf', 'Adjunto mi portafolio y mi experiencia en diseno de productos digitales.', 'nueva'),
  ((select id from vacantes where titulo = 'Desarrollador Web Frontend'), (select id from usuarios where correo = 'lucia.torres@correo.com'), 'uploads/cv/lucia-torres.pdf', 'Deseo participar en el proyecto y contribuir con interfaces responsivas.', 'nueva');

insert into vacantes_guardadas (candidato_id, vacante_id) values
  ((select id from usuarios where correo = 'ana.garcia@correo.com'), (select id from vacantes where titulo = 'Disenador UI/UX')),
  ((select id from usuarios where correo = 'carlos.lopez@correo.com'), (select id from vacantes where titulo = 'Desarrollador Full Stack Java/Angular'));

insert into alertas_empleo (candidato_id, nombre, palabra_clave, ubicacion, modalidad, nivel_experiencia, categoria_id) values
  ((select id from usuarios where correo = 'ana.garcia@correo.com'), 'Vacantes Java', 'Java', 'San Salvador', 'hibrido', 'intermedio', (select id from categorias_empleo where nombre = 'Tecnologia')),
  ((select id from usuarios where correo = 'carlos.lopez@correo.com'), 'Diseno remoto', 'UI UX', null, 'remoto', 'junior', (select id from categorias_empleo where nombre = 'Diseno y Creatividad'));

insert into notificaciones (usuario_id, titulo, mensaje, tipo) values
  ((select id from usuarios where correo = 'ana.garcia@correo.com'), 'Postulacion actualizada', 'Tu postulacion para Desarrollador Full Stack esta en proceso.', 'estado_postulacion'),
  ((select id from usuarios where correo = 'carlos.lopez@correo.com'), 'Nueva vacante encontrada', 'Hay una nueva vacante de Disenador UI/UX que coincide con tu alerta.', 'alerta_empleo');

insert into historial_laboral (candidato_id, empresa_id, cargo, fecha_inicio, fecha_fin, verificado) values
  ((select id from usuarios where correo = 'ana.garcia@correo.com'), (select id from empresas where nombre_legal = 'TecnoSoluciones S.A. de C.V.'), 'Desarrolladora Frontend', '2023-01-01', '2025-01-31', true),
  ((select id from usuarios where correo = 'carlos.lopez@correo.com'), (select id from empresas where nombre_legal = 'Creativa Digital S.A. de C.V.'), 'Disenador Grafico', '2022-06-01', '2024-12-31', true);

insert into valoraciones_empresa (empresa_id, candidato_id, calificacion, comentario, estado) values
  ((select id from empresas where nombre_legal = 'TecnoSoluciones S.A. de C.V.'), (select id from usuarios where correo = 'ana.garcia@correo.com'), 5, 'Excelente ambiente de aprendizaje, mentoria y procesos claros para el equipo.', 'aprobada'),
  ((select id from empresas where nombre_legal = 'Creativa Digital S.A. de C.V.'), (select id from usuarios where correo = 'carlos.lopez@correo.com'), 4, 'Buen ambiente de trabajo y proyectos variados con oportunidad de aprendizaje.', 'aprobada');

insert into recursos (titulo, resumen, tipo, enlace, publicado, fecha_publicacion) values
  ('Como optimizar tu CV para filtros ATS', 'Consejos para mejorar palabras clave, formato y estructura del curriculo.', 'articulo', 'https://ejemplo.com/recursos/cv-ats', true, current_timestamp),
  ('Preguntas clave en entrevistas de software', 'Guia practica con ejercicios de entrevistas tecnicas y conductuales.', 'tutorial', 'https://ejemplo.com/recursos/entrevistas-software', true, current_timestamp),
  ('Tendencias salariales TI', 'Video sobre rangos salariales por rol y experiencia.', 'video', 'https://ejemplo.com/recursos/tendencias-ti', true, current_timestamp);

insert into noticias (titulo, categoria, resumen, enlace_fuente) values
  ('Crecimiento del empleo formal en tecnologia', 'Empleo formal', 'El sector tecnologico mantiene crecimiento en nuevas contrataciones durante el trimestre.', 'https://ejemplo.com/noticias/empleo-tecnologia'),
  ('Nuevas becas de certificacion en la nube', 'Formacion', 'Se anunciaron becas para jovenes interesados en certificaciones de computacion en la nube.', 'https://ejemplo.com/noticias/becas-nube');

insert into categorias_foro (nombre) values
  ('Desarrollo de carrera'),
  ('Entrevistas'),
  ('Salarios'),
  ('Diseno');

insert into temas_foro (autor_id, categoria_id, titulo, contenido, sector, modalidad, nivel_experiencia, ubicacion) values
  ((select id from usuarios where correo = 'ana.garcia@correo.com'), (select id from categorias_foro where nombre = 'Desarrollo de carrera'), 'Vale la pena certificarse en AWS siendo junior?', 'Quiero conocer experiencias sobre certificaciones que realmente ayuden a conseguir el primer empleo.', 'Tecnologia', 'remoto', 'junior', 'San Salvador'),
  ((select id from usuarios where correo = 'carlos.lopez@correo.com'), (select id from categorias_foro where nombre = 'Entrevistas'), 'Experiencias con entrevistas tecnicas en Applaudo', 'Compartan recomendaciones para prepararse para entrevistas tecnicas de desarrollo web.', 'Tecnologia', 'hibrido', 'junior', 'Santa Ana');

insert into respuestas_foro (tema_id, autor_id, contenido) values
  ((select id from temas_foro where titulo = 'Vale la pena certificarse en AWS siendo junior?'), (select id from usuarios where correo = 'carlos.lopez@correo.com'), 'Si tienes proyectos practicos, una certificacion basica puede ayudarte a reforzar el perfil.'),
  ((select id from temas_foro where titulo = 'Experiencias con entrevistas tecnicas en Applaudo'), (select id from usuarios where correo = 'ana.garcia@correo.com'), 'Practica estructuras de datos, explica tus decisiones y prepara ejemplos de proyectos reales.');

insert into reportes_contenido (reportado_por, vacante_id, motivo) values
  ((select id from usuarios where correo = 'lucia.torres@correo.com'), (select id from vacantes where titulo = 'Administrador de Bases de Datos PostgreSQL'), 'El salario publicado requiere verificacion.');

insert into bitacora (usuario_id, accion, entidad, entidad_id, detalle) values
  ((select id from usuarios where correo = 'admin@opportunitybridge.sv'), 'Carga inicial', 'sistema', null, 'Se cargaron los datos de prueba del portal.');

commit;
