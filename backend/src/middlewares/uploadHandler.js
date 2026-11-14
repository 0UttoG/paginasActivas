import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_BACKEND = path.resolve(__dirname, '..', '..');
const LIMITE_CV_BYTES = 5 * 1024 * 1024;
const HOLGURA_MULTIPART = 64 * 1024;
const CAMPOS_CV = ['archivo', 'cv', 'file'];

const TIPOS_CV_PERMITIDOS = {
    '.pdf': ['application/pdf'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

//extraer partes de un cuerpo multipart/form-data sin perder datos binarios
const extraerPartesMultipart = (buffer, boundary) => {
    const delimitador = Buffer.from(`--${boundary}`);
    const separadorCabecera = Buffer.from('\r\n\r\n');
    const partes = [];

    let inicio = buffer.indexOf(delimitador);
    while (inicio !== -1) {
        const despuesDelimitador = inicio + delimitador.length;
        if (buffer.subarray(despuesDelimitador, despuesDelimitador + 2).equals(Buffer.from('--'))) {
            break;
        }

        const inicioParte = buffer.subarray(despuesDelimitador, despuesDelimitador + 2).equals(Buffer.from('\r\n'))
            ? despuesDelimitador + 2
            : despuesDelimitador;

        const siguiente = buffer.indexOf(delimitador, inicioParte);
        if (siguiente === -1) {
            break;
        }

        let finParte = siguiente;
        if (buffer.subarray(finParte - 2, finParte).equals(Buffer.from('\r\n'))) {
            finParte -= 2;
        }

        const contenidoParte = buffer.subarray(inicioParte, finParte);
        const finCabeceras = contenidoParte.indexOf(separadorCabecera);
        if (finCabeceras !== -1) {
            const cabecerasTexto = contenidoParte.subarray(0, finCabeceras).toString('utf8');
            const datos = contenidoParte.subarray(finCabeceras + separadorCabecera.length);

            const nombreMatch = cabecerasTexto.match(/name="([^"]+)"/i);
            const archivoMatch = cabecerasTexto.match(/filename="([^"]*)"/i);
            const tipoMatch = cabecerasTexto.match(/content-type:\s*([^\r\n;]+)/i);

            if (archivoMatch) {
                partes.push({
                    campo: nombreMatch ? nombreMatch[1] : '',
                    nombreOriginal: path.basename(archivoMatch[1]),
                    mimeType: tipoMatch ? tipoMatch[1].trim().toLowerCase() : '',
                    datos
                });
            }
        }

        inicio = siguiente;
    }

    return partes;
};

//middleware para recibir y validar el archivo de cv del candidato
export const subirCvCandidato = (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
        return res.status(400).json({ mensaje: 'se requiere formato multipart/form-data' });
    }

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
    const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
    if (!boundary) {
        return res.status(400).json({ mensaje: 'cabecera multipart inválida' });
    }

    const fragmentos = [];
    let totalBytes = 0;
    let excedido = false;
    let respondido = false;

    req.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > LIMITE_CV_BYTES + HOLGURA_MULTIPART) {
            excedido = true;
            if (totalBytes > LIMITE_CV_BYTES + 1024 * 1024 && !respondido) {
                respondido = true;
                res.status(413).json({ mensaje: 'el archivo supera el tamaño máximo de 5 MB' });
                req.destroy();
            }
            return;
        }
        if (!excedido) {
            fragmentos.push(chunk);
        }
    });

    req.on('error', () => {
        if (!respondido) {
            respondido = true;
            res.status(400).json({ mensaje: 'error al leer el archivo enviado' });
        }
    });

    req.on('end', async () => {
        if (respondido) {
            return;
        }

        if (excedido) {
            return res.status(413).json({ mensaje: 'el archivo supera el tamaño máximo de 5 MB' });
        }

        try {
            const cuerpo = Buffer.concat(fragmentos);
            const partes = extraerPartesMultipart(cuerpo, boundary);
            const archivo = partes.find((p) => CAMPOS_CV.includes(p.campo)) || partes[0];

            if (!archivo || !archivo.nombreOriginal || archivo.datos.length === 0) {
                return res.status(400).json({ mensaje: 'debe adjuntar un archivo de cv' });
            }

            if (archivo.datos.length > LIMITE_CV_BYTES) {
                return res.status(413).json({ mensaje: 'el archivo supera el tamaño máximo de 5 MB' });
            }

            const extension = path.extname(archivo.nombreOriginal).toLowerCase();
            const mimesPermitidos = TIPOS_CV_PERMITIDOS[extension];
            if (!mimesPermitidos || !mimesPermitidos.includes(archivo.mimeType)) {
                return res.status(415).json({
                    mensaje: 'formato no permitido, solo se aceptan archivos PDF o DOCX'
                });
            }

            const dirBase = process.env.UPLOAD_DIR || 'uploads';
            const carpetaCv = path.resolve(ROOT_BACKEND, dirBase, 'cv');
            await fs.mkdir(carpetaCv, { recursive: true });

            const nombreGuardado = `${crypto.randomUUID()}${extension}`;
            const rutaAbsoluta = path.join(carpetaCv, nombreGuardado);
            const rutaRelativa = path.posix.join(dirBase.replace(/\\/g, '/'), 'cv', nombreGuardado);

            await fs.writeFile(rutaAbsoluta, archivo.datos);

            req.archivoSubido = {
                nombreOriginal: archivo.nombreOriginal,
                rutaRelativa,
                rutaAbsoluta,
                tamano: archivo.datos.length,
                mimeType: archivo.mimeType
            };

            return next();
        } catch (error) {
            return next(error);
        }
    });
};
