import { body, validationResult } from 'express-validator';

//ejecutar validaciones y responder 400 si hay errores
export const runValidateRequest = (validations) => {
    return async (req, res, next) => {
        for (const validation of validations) {
            await validation.run(req);
        }

        const errors = validationResult(req);

        if (errors.isEmpty()) {
            return next();
        }

        return res.status(400).json({
            mensaje: 'datos de entrada inválidos',
            errores: errors.array()
        });
    };
};

//validaciones para registro de usuarios
export const validarRegistro = [
    body('nombres')
        .trim()
        .notEmpty().withMessage('los nombres son obligatorios')
        .isLength({ max: 100 }).withMessage('los nombres no pueden exceder 100 caracteres'),
    body('apellidos')
        .trim()
        .notEmpty().withMessage('los apellidos son obligatorios')
        .isLength({ max: 100 }).withMessage('los apellidos no pueden exceder 100 caracteres'),
    body('correo')
        .trim()
        .notEmpty().withMessage('el correo es obligatorio')
        .isEmail().withMessage('formato de correo inválido')
        .isLength({ max: 150 }).withMessage('el correo no puede exceder 150 caracteres'),
    body('contrasena')
        .isString().withMessage('la contraseña debe ser texto válido')
        .isLength({ min: 8, max: 72 }).withMessage('la contraseña debe tener entre 8 y 72 caracteres'),
    body('telefono')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 20 }).withMessage('el teléfono no puede exceder 20 caracteres'),
    body('rol_id')
        .optional({ values: 'null' })
        .isInt({ min: 1 }).withMessage('el rol_id debe ser un número entero positivo'),
    body('tipo_usuario')
        .optional({ values: 'falsy' })
        .trim()
        .isString().withMessage('el tipo_usuario debe ser texto válido')
];

//validaciones para inicio de sesión
export const validarLogin = [
    body('correo')
        .trim()
        .notEmpty().withMessage('el correo es obligatorio')
        .isEmail().withMessage('formato de correo inválido'),
    body('contrasena')
        .notEmpty().withMessage('la contraseña es obligatoria')
];