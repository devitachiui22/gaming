/**
 * =============================================================================
 * FLUX GAME - DATABASE ENGINE (POSTGRESQL / NEON)
 * Purpose: High-availability connection pooling and atomic transactions.
 * =============================================================================
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configuração de ambiente crítica
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('CRITICAL: DATABASE_URL is not defined in environment variables.');
    process.exit(1);
}

/**
 * Pool Configuration
 * Optimized for Neon serverless architecture
 */
const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false, // Required for Neon SSL connection
    },
    max: 20, // Peak concurrent connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Database Event Monitoring
pool.on('connect', () => {
    if (!isProduction) console.log('📡 Database: New client connected to pool');
});

pool.on('error', (err) => {
    console.error('❌ Database: Unexpected error on idle client', err.message);
});

module.exports = {
    /**
     * Standard Query Runner
     * @param {string} text SQL Query
     * @param {Array} params Query Parameters
     */
    query: (text, params) => pool.query(text, params),

    /**
     * Atomic Transaction Wrapper
     * Ensures financial data integrity (BEGIN/COMMIT/ROLLBACK)
     * @param {Function} callback Async operations to be executed within transaction
     */
    transaction: async (callback) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Transaction Rollback:', error.message);
            throw error;
        } finally {
            client.release();
        }
    },

    pool: pool // Export pool instance for graceful shutdown
};