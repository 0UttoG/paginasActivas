import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { pool } from './db.js';
import {errorHandler} from './middlewares/errorHandler.js';

const app = express();
app.use(cors({origin: process.env.FRONTEND_URL || 'http://localhost:5173'}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

//obtener el estado de la conexión a la base de datos
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});


app.get('/health/db', async (req, res) =>{
    try {
        //add to sql, from get to information from the database
        const result = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        );

        res.status(200).json({ status: 'ok', tables: result.rows });
    }
    catch(err) {
        console.error('error al conectarse a supabase', err.message);
        res.status(500).json({ status: 'error', message: 'error al conectarse a supabase' });
    }
}
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
//capturar rutas inexistentes
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Ruta no encontrada'
    })
});
app.use(errorHandler);

export default app;