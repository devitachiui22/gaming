/**
 * =============================================================================
 * FLUX GAME - MAIN PRODUCTION SERVER
 * Architecture: Node.js / Express / PostgreSQL
 * Purpose: Secure, scalable, and high-performance API entry point.
 * =============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Route Imports
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const gameRoutes = require('./src/routes/gameRoutes');

// DB Pool for Graceful Shutdown
const { pool } = require('./src/config/db');

const app = express();
const API_PREFIX = '/api/v1';

/**
 * 1. SECURITY LAYERS
 */
app.use(helmet({
    crossOriginResourcePolicy: false,
}));

const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

/**
 * 2. REQUEST PARSING & LOGGING
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/**
 * 3. TRAFFIC CONTROL (Anti-Abuse)
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP
    message: { success: false, message: 'Too many requests. Please cool down.' }
});
app.use('/api/', apiLimiter);

/**
 * 4. ROUTE MOUNTING
 */
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/games`, gameRoutes);

// Static assets (for future uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/**
 * 5. HEALTH MONITORING
 */
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'UP', db: 'CONNECTED', uptime: process.uptime() });
    } catch (err) {
        res.status(503).json({ status: 'DOWN', db: 'DISCONNECTED', error: err.message });
    }
});

/**
 * 6. GLOBAL ERROR HANDLER
 */
app.use((req, res, next) => {
    const error = new Error(`Resource not found: ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    console.error(`[SERVER_ERROR] ${err.stack}`);

    res.status(statusCode).json({
        success: false,
        error: {
            message: err.message || 'Internal Server Error',
            path: req.originalUrl,
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * 7. SERVER INITIALIZATION & GRACEFUL SHUTDOWN
 */
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`
    =================================================
    🚀 FLUX GAME PRODUCTION SERVER ONLINE
    📡 Port: ${PORT}
    🌍 Environment: ${process.env.NODE_ENV || 'development'}
    =================================================
    `);
});

// Neon PostgreSQL Safe Exit
const gracefulExit = () => {
    server.close(async () => {
        console.log('HTTP Server closed.');
        await pool.end();
        console.log('DB Pool disconnected. Process terminated.');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulExit);
process.on('SIGINT', gracefulExit);

module.exports = app;