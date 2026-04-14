/**
 * =============================================================================
 * FLUX GAME - AUTHENTICATION CONTROLLER
 * Purpose: Secure User Registration, Login and Session Management.
 * Engineer: Senior Software Architect
 * =============================================================================
 */

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * REGISTRO DE USUÁRIO
 * Realiza a criação da conta e inicialização da carteira financeira.
 */
exports.register = async (req, res) => {
    const { name, email, password } = req.body;

    // 1. Validação básica de entrada
    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Todos os campos (nome, e-mail e senha) são obrigatórios.'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'A senha deve ter no mínimo 6 caracteres.'
        });
    }

    try {
        // 2. Verificar se o e-mail já existe (Prevenção de duplicidade)
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Este e-mail já está em uso no FluxGame.'
            });
        }

        // 3. Hashing de Senha (BCrypt com salt de 12 rounds para segurança máxima)
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Execução em TRANSAÇÃO (Garante que o bônus inicial seja registrado com o usuário)
        const result = await db.transaction(async (client) => {
            // Inserir usuário
            const userInsert = await client.query(
                `INSERT INTO users (name, email, password, balance, coins, level, xp)
                 VALUES ($1, $2, $3, 100.00, 0, 1, 0)
                 RETURNING id, name, email, balance, coins, level, xp, created_at`,
                [name, email.toLowerCase(), hashedPassword]
            );

            const newUser = userInsert.rows[0];

            // Registrar transação de bônus de boas-vindas
            await client.query(
                `INSERT INTO transactions (user_id, amount, type, description)
                 VALUES ($1, $2, $3, $4)`,
                [newUser.id, 100.00, 'bonus', 'Bônus de Boas-vindas FluxGame']
            );

            return newUser;
        });

        // 5. Geração do Token JWT
        const token = jwt.sign(
            { id: result.id, email: result.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' } // Sessão longa para UX de App Mobile
        );

        // 6. Resposta de Sucesso
        res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso!',
            token,
            user: result
        });

    } catch (err) {
        console.error('[AUTH REGISTER ERROR]:', err);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao processar o cadastro. Tente novamente mais tarde.'
        });
    }
};

/**
 * LOGIN DE USUÁRIO
 * Validação de credenciais e atualização de rastro de acesso.
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'E-mail e senha são obrigatórios.'
        });
    }

    try {
        // 1. Buscar usuário incluindo a senha para comparação
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado com este e-mail.'
            });
        }

        const user = result.rows[0];

        // 2. Verificar se a conta está ativa
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Esta conta foi desativada. Entre em contato com o suporte.'
            });
        }

        // 3. Comparar Senhas
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Senha incorreta. Tente novamente.'
            });
        }

        // 4. Atualizar último login (Async - não trava a resposta)
        db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id])
            .catch(e => console.error('Erro ao atualizar last_login:', e));

        // 5. Gerar Token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // 6. Limpar dados sensíveis antes de enviar
        const userProfile = { ...user };
        delete userProfile.password;

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            user: userProfile
        });

    } catch (err) {
        console.error('[AUTH LOGIN ERROR]:', err);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao realizar login.'
        });
    }
};