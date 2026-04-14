/**
 * =============================================================================
 * FLUX GAME - BACKEND PRODUCTION SERVER
 * Architecture: Node.js / Express
 * Purpose: Entry point with advanced security, scalability and monitoring.
 * Engineer: Senior Software Architect
 * =============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importação de Rotas
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const gameRoutes = require('./src/routes/gameRoutes');

// Importação da Pool do Banco de Dados para Graceful Shutdown
const { pool } = require('./src/config/db');

const app = express();

/**
 * 1. CONFIGURAÇÕES DE SEGURANÇA (Production Grade)
 */
app.use(helmet({
    crossOriginResourcePolicy: false, // Necessário se for servir imagens estáticas
}));

const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

/**
 * 2. MIDDLEWARES DE PARSING & LOGGING
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/**
 * 3. RATE LIMITING (Prevenção de Abuso)
 * Limita cada IP a 100 requisições por 15 minutos
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Muitas requisições vindas deste IP. Tente novamente em 15 minutos.'
    }
});
app.use('/api/', apiLimiter);

/**
 * 4. DEFINIÇÃO DE ROTAS (Versionamento de API)
 */
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/games`, gameRoutes);

// Servir arquivos estáticos (Avatares, Assets de Jogo se necessário)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/**
 * 5. MONITORAMENTO & HEALTH CHECK
 */
app.get('/health', async (req, res) => {
    try {
        // Verifica conexão com o banco de dados
        await pool.query('SELECT 1');
        res.status(200).json({
            status: 'UP',
            environment: process.env.NODE_ENV,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            db_connection: 'CONNECTED'
        });
    } catch (err) {
        res.status(503).json({
            status: 'DOWN',
            db_connection: 'DISCONNECTED',
            error: err.message
        });
    }
});

/**
 * 6. TRATAMENTO DE ERROS (404 Not Found)
 */
app.use((req, res, next) => {
    const error = new Error(`Caminho não encontrado: ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

/**
 * 7. TRATAMENTO DE ERROS GLOBAL (Global Error Handler)
 */
app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    
    // Log detalhado no servidor
    console.error(`[ERROR] [${new Date().toISOString()}] ${err.stack}`);

    res.status(statusCode).json({
        success: false,
        error: {
            message: err.message || 'Ocorreu um erro interno no servidor',
            code: statusCode,
            path: req.originalUrl,
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * 8. INICIALIZAÇÃO DO SERVIDOR & GRACEFUL SHUTDOWN
 */
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`
    =================================================
    🚀 FLUX GAME SERVER ONLINE
    📡 Porta: ${PORT}
    🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
    🔗 API Prefix: ${API_PREFIX}
    =================================================
    `);
});

// Lógica de fechamento seguro para o Neon PostgreSQL
const gracefulShutdown = () => {
    console.log('Finalizando conexões e encerrando servidor...');
    server.close(async () => {
        console.log('Servidor Express fechado.');
        try {
            await pool.end();
            console.log('Pool de conexões do Banco de Dados encerrado.');
            process.exit(0);
        } catch (err) {
            console.error('Erro ao fechar pool do banco:', err);
            process.exit(1);
        }
    });

    // Se não fechar em 10 segundos, força o encerramento
    setTimeout(() => {
        console.error('Forçando encerramento imediato...');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app; // Para fins de teste
