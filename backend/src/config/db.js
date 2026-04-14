const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('✅ Banco de Dados Conectado'));
pool.on('error', (err) => console.error('❌ Erro no Pool do PG', err));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};