/**
 * =============================================================================
 * FLUX GAME - DATABASE CONFIGURATION (POSTGRESQL / NEON)
 * Purpose: High-performance connection pooling and query management.
 * Engineer: Senior Software Architect
 * =============================================================================
 */

const { Pool } = require('pg');

// Validação rigorosa da variável de ambiente
if (!process.env.DATABASE_URL) {
    console.error('❌ ERRO FATAL: A variável DATABASE_URL não foi definida no arquivo .env');
    process.exit(1);
}

/**
 * Configuração do Pool de Conexões
 * Ajustado para os limites do plano gratuito/pro do Neon
 */
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // SSL é obrigatório para o Neon
    ssl: {
        rejectUnauthorized: false,
    },
    max: 20,              // Máximo de conexões simultâneas no pool
    idleTimeoutMillis: 30000, // Tempo para fechar conexões ociosas
    connectionTimeoutMillis: 2000, // Tempo limite para conseguir uma conexão
};

const pool = new Pool(poolConfig);

/**
 * Event Listeners para Monitoramento do Banco de Dados
 */
pool.on('connect', (client) => {
    // Em desenvolvimento, opcionalmente logar novas conexões
    if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Nova conexão estabelecida com o PostgreSQL');
    }
});

pool.on('error', (err, client) => {
    console.error('❌ ERRO INESPERADO no Pool do PostgreSQL:', err.message);
    // Não encerramos o processo aqui para permitir que o pool tente se recuperar
});

pool.on('acquire', (client) => {
    // Log para depuração de vazamento de conexão (connection leaks)
    // console.log('Conexão adquirida do pool');
});

/**
 * Objeto de Serviço de Banco de Dados
 * Encapsula a lógica de query para facilitar o uso nos controllers
 */
const db = {
    /**
     * Executa uma query simples
     * @param {string} text - SQL Query
     * @param {Array} params - Parâmetros da query
     */
    query: async (text, params) => {
        const start = Date.now();
        try {
            const res = await pool.query(text, params);
            const duration = Date.now() - start;

            // Log de performance para queries lentas (acima de 500ms)
            if (duration > 500) {
                console.warn(`⚠️ Query Lenta (${duration}ms): ${text.substring(0, 100)}...`);
            }

            return res;
        } catch (error) {
            console.error('❌ Erro na execução da Query:', {
                text: text.substring(0, 150),
                message: error.message,
                params
            });
            throw error;
        }
    },

    /**
     * Retorna um cliente do pool para transações manuais (BEGIN/COMMIT/ROLLBACK)
     * Essencial para operações financeiras no FluxGame
     */
    getClient: async () => {
        const client = await pool.connect();
        const query = client.query;
        const release = client.release;

        // Adicionamos um timeout de segurança para liberação do cliente
        const timeout = setTimeout(() => {
            console.error('⚠️ ALERTA: Um cliente de transação está retido há mais de 10 segundos!');
            console.error('Verifique se você esqueceu de chamar client.release()');
        }, 10000);

        client.release = () => {
            clearTimeout(timeout);
            client.query = query;
            client.release = release;
            return release.apply(client);
        };

        return client;
    },

    /**
     * Método auxiliar para transações (facilita o uso de rollback automático)
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
            throw error;
        } finally {
            client.release();
        }
    },

    pool // Exporta o pool para o Graceful Shutdown no index.js
};

module.exports = db;