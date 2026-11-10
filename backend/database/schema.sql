-- OpportunityBridge - Base de datos relacional sencilla
-- PostgreSQL. Los archivos se guardan por la aplicación y aquí solo se registra su ruta.
-- Ejecutar en una base de datos nueva.

begin;

create table roles (
  id serial primary key,
  nombre varchar(20) not null unique
    check (nombre in ('candidato', 'empleador', 'administrador'))
);

create table usuarios (
  id serial primary key,
  rol_id integer not null references roles(id),
  nombres varchar(100) not null,
  apellidos varchar(100) not null,
  correo varchar(150) not null unique,
  contrasena_hash varchar(255) not null,
  telefono varchar(20),
  ruta_cv varchar(255),
  recibe_email boolean not null default true,
  recibe_sms boolean not null default false,
  estado varchar(15) not null default 'activo'
    check (estado in ('activo', 'suspendido')),
  fecha_registro timestamp not null default current_timestamp
);

create table empresas (
  id serial primary key,
  usuario_id integer not null unique references usuarios(id),
  nombre_legal varchar(150) not null,
  nit varchar(30),
  descripcion text,
  sitio_web varchar(255),
  correo_contacto varchar(150) not null,
  telefono_contacto varchar(20),
  ruta_logo varchar(255),
  ruta_documento_legal varchar(255),
  estado_verificacion varchar(15) not null default 'pendiente'
    check (estado_verificacion in ('pendiente', 'aprobada', 'rechazada', 'suspendida')),
  fecha_registro timestamp not null default current_timestamp
);

create table categorias_empleo (
  id serial primary key,
  nombre varchar(100) not null unique
);

create table vacantes (
  id serial primary key,
  empresa_id integer not null references empresas(id),
  categoria_id integer references categorias_empleo(id),
  titulo varchar(150) not null,
  ubicacion varchar(150) not null,
  modalidad varchar(15) not null check (modalidad in ('remoto', 'hibrido', 'presencial')),
  tipo_contrato varchar(20) not null check (tipo_contrato in ('tiempo_completo', 'medio_tiempo', 'proyecto', 'pasantia')),
  nivel_experiencia varchar(15) not null check (nivel_experiencia in ('sin_experiencia', 'junior', 'intermedio', 'senior')),
  salario_min numeric(10,2),
  salario_max numeric(10,2),
  descripcion text not null,
  responsabilidades text,
  requisitos text not null,
  beneficios text,
  correo_contacto varchar(150) not null,
  estado varchar(15) not null default 'pendiente'
    check (estado in ('borrador', 'pendiente', 'publicada', 'oculta', 'rechazada', 'cerrada')),
  fecha_publicacion timestamp,
  fecha_cierre date,
  fecha_creacion timestamp not null default current_timestamp,
  check (salario_min is null or salario_min >= 0),
  check (salario_max is null or salario_max >= salario_min)
);
create index idx_vacantes_empresa on vacantes(empresa_id);
create index idx_vacantes_estado on vacantes(estado);
create index idx_vacantes_busqueda on vacantes(categoria_id, ubicacion, modalidad, nivel_experiencia);

create table postulaciones (
  id serial primary key,
  vacante_id integer not null references vacantes(id),
  candidato_id integer not null references usuarios(id),
  ruta_cv varchar(255) not null,
  carta_presentacion text,
  estado varchar(15) not null default 'nueva'
    check (estado in ('nueva', 'en_proceso', 'contratado', 'rechazado')),
  fecha_postulacion timestamp not null default current_timestamp,
  unique (vacante_id, candidato_id)
);
create index idx_postulaciones_candidato on postulaciones(candidato_id);
create index idx_postulaciones_vacante on postulaciones(vacante_id);

create table vacantes_guardadas (
  candidato_id integer not null references usuarios(id) on delete cascade,
  vacante_id integer not null references vacantes(id) on delete cascade,
  fecha_guardado timestamp not null default current_timestamp,
  primary key (candidato_id, vacante_id)
);

create table alertas_empleo (
  id serial primary key,
  candidato_id integer not null references usuarios(id) on delete cascade,
  nombre varchar(100) not null,
  palabra_clave varchar(100),
  ubicacion varchar(150),
  modalidad varchar(15),
  nivel_experiencia varchar(15),
  categoria_id integer references categorias_empleo(id),
  activa boolean not null default true,
  fecha_creacion timestamp not null default current_timestamp
);

create table notificaciones (
  id serial primary key,
  usuario_id integer not null references usuarios(id) on delete cascade,
  titulo varchar(150) not null,
  mensaje text not null,
  tipo varchar(30) not null,
  leida boolean not null default false,
  fecha_creacion timestamp not null default current_timestamp
);
create index idx_notificaciones_usuario on notificaciones(usuario_id, leida);

create table historial_laboral (
  id serial primary key,
  candidato_id integer not null references usuarios(id),
  empresa_id integer not null references empresas(id),
  cargo varchar(150) not null,
  fecha_inicio date not null,
  fecha_fin date,
  verificado boolean not null default false,
  check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create table valoraciones_empresa (
  id serial primary key,
  empresa_id integer not null references empresas(id),
  candidato_id integer not null references usuarios(id),
  calificacion smallint not null check (calificacion between 1 and 5),
  comentario text not null check (char_length(comentario) >= 20),
  estado varchar(15) not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'oculta', 'rechazada')),
  fecha_creacion timestamp not null default current_timestamp,
  unique (empresa_id, candidato_id)
);
create index idx_valoraciones_empresa on valoraciones_empresa(empresa_id, estado);

create table recursos (
  id serial primary key,
  titulo varchar(200) not null,
  resumen text,
  tipo varchar(15) not null check (tipo in ('articulo', 'tutorial', 'video')),
  contenido text,
  enlace varchar(255),
  ruta_archivo varchar(255),
  publicado boolean not null default false,
  fecha_publicacion timestamp
);

create table noticias (
  id serial primary key,
  titulo varchar(200) not null,
  categoria varchar(100),
  resumen text not null,
  enlace_fuente varchar(255),
  fecha_publicacion timestamp not null default current_timestamp
);

create table categorias_foro (
  id serial primary key,
  nombre varchar(100) not null unique
);

create table temas_foro (
  id serial primary key,
  autor_id integer not null references usuarios(id),
  categoria_id integer not null references categorias_foro(id),
  titulo varchar(200) not null check (char_length(titulo) >= 10),
  contenido text not null,
  sector varchar(100),
  modalidad varchar(15),
  nivel_experiencia varchar(20),
  ubicacion varchar(150),
  estado varchar(15) not null default 'publicado'
    check (estado in ('publicado', 'oculto', 'cerrado')),
  fecha_creacion timestamp not null default current_timestamp
);
create index idx_temas_foro_filtros on temas_foro(categoria_id, sector, modalidad, estado);

create table respuestas_foro (
  id serial primary key,
  tema_id integer not null references temas_foro(id) on delete cascade,
  autor_id integer not null references usuarios(id),
  contenido text not null,
  estado varchar(15) not null default 'publicado'
    check (estado in ('publicado', 'oculto')),
  fecha_creacion timestamp not null default current_timestamp
);
create index idx_respuestas_foro_tema on respuestas_foro(tema_id);

create table reportes_contenido (
  id serial primary key,
  reportado_por integer not null references usuarios(id),
  vacante_id integer references vacantes(id),
  valoracion_id integer references valoraciones_empresa(id),
  tema_id integer references temas_foro(id),
  respuesta_id integer references respuestas_foro(id),
  motivo text not null,
  estado varchar(15) not null default 'abierto'
    check (estado in ('abierto', 'resuelto', 'descartado')),
  fecha_reporte timestamp not null default current_timestamp,
  check ((case when vacante_id is not null then 1 else 0 end +
         case when valoracion_id is not null then 1 else 0 end +
         case when tema_id is not null then 1 else 0 end +
         case when respuesta_id is not null then 1 else 0 end) = 1)
);

create table bitacora (
  id serial primary key,
  usuario_id integer references usuarios(id),
  accion varchar(150) not null,
  entidad varchar(50) not null,
  entidad_id integer,
  detalle text,
  fecha timestamp not null default current_timestamp
);

-- Roles necesarios antes de registrar usuarios.
insert into roles (nombre) values
  ('candidato'),
  ('empleador'),
  ('administrador');

commit;

-- La aplicación debe validar el rol antes de permitir cada acción.
-- Ejemplo: solo empleadores crean empresas/vacantes y solo administradores
-- aprueban empresas, vacantes, valoraciones y reportes.
