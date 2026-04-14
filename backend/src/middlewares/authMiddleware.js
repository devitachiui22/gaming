/**
 * =============================================================================
 * FLUX GAME - AUTHENTICATION MIDDLEWARE (SECURITY GUARD)
 * Purpose: Token validation, Session integrity and Route protection.
 * Engineer: Senior Software Architect
 * =============================================================================
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware para proteger rotas privadas.
 * Extrai, valida o JWT e verifica a integridade do usuário no Banco de Dados.
 */
module.exports = async (req, res, next) => {
    // 1. Obter o header de autorização
    const authHeader = req.headers.authorization;

    // 2. Verificar se o header existe e segue o padrão 'Bearer <TOKEN>'
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Acesso negado. Token de autenticação não fornecido ou inválido.'
        });
    }

    // 3. Extrair o token puro
    const token = authHeader.split(' ')[1];

    try {
        // 4. Verificar assinatura do Token com o Segredo do Servidor
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        /**
         * 5. VERIFICAÇÃO DE INTEGRIDADE REAL-TIME (Crucial para produção)
         * Mesmo com token válido, verificamos se o usuário ainda existe no DB
         * e se a conta está ativa. Isso evita que usuários excluídos ou banidos
         * continuem usando o app até o token expirar (daqui a 30 dias).
         */
        const userCheck = await db.query(
            'SELECT id, email, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Sessão inválida. O usuário não existe mais.'
            });
        }

        const user = userCheck.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Sessão encerrada. Esta conta foi desativada por violação de termos.'
            });
        }

        /**
         * 6. INJEÇÃO DE CONTEXTO
         * Adicionamos os dados do usuário ao objeto 'req' para que os próximos
         * controllers (UserController, GameController) saibam QUEM está chamando.
         */
        req.userId = user.id;
        req.userEmail = user.email;

        // 7. Autorizado! Segue para a próxima função da rota.
        next();

    } catch (err) {
        /**
         * 8. TRATAMENTO DE ERROS DE JWT ESPECÍFICOS
         * Diferenciamos tokens expirados de tokens malformados para ajudar no debug do Flutter.
         */
        let errorMsg = 'Falha na autenticação do token.';

        if (err.name === 'TokenExpiredError') {
            errorMsg = 'Sessão expirada. Por favor, faça login novamente.';
        } else if (err.name === 'JsonWebTokenError') {
            errorMsg = 'Token de segurança inválido ou corrompido.';
        }

        console.warn(`[AUTH MIDDLEWARE WARNING]: ${err.message} em ${req.originalUrl}`);

        return res.status(401).json({
            success: false,
            message: errorMsg
        });
    }
};