/**
 * =============================================================================
 * FLUX GAME - USER & PROFILE CONTROLLER
 * Purpose: Manage Profile data, Gamification stats, Ranking and Wallet history.
 * Engineer: Senior Software Architect
 * =============================================================================
 */

const db = require('../config/db');

/**
 * BUSCAR PERFIL DO USUÁRIO
 * Retorna todos os dados necessários para a HomeScreen e ProfileScreen.
 */
exports.getProfile = async (req, res) => {
    try {
        // Buscamos os dados reais do banco (sem mock)
        const result = await db.query(
            `SELECT
                id, name, email, avatar_url,
                balance, coins, level, xp,
                total_wins, total_games,
                created_at
             FROM users
             WHERE id = $1`,
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado.'
            });
        }

        const user = result.rows[0];

        // Cálculo de progresso para a barra de nível (UX da Imagem 3)
        // Lógica: XP atual vs XP necessário para o próximo nível
        const nextLevelXp = Math.pow(user.level, 2) * 100;
        const currentLevelXp = Math.pow(user.level - 1, 2) * 100;
        const progress = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

        res.json({
            success: true,
            data: {
                ...user,
                level_progress: Math.min(Math.max(progress, 0), 100).toFixed(2) // Garante entre 0 e 100
            }
        });

    } catch (err) {
        console.error('[GET PROFILE ERROR]:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar dados do perfil.'
        });
    }
};

/**
 * HISTÓRICO DA CARTEIRA (TRANSAÇÕES)
 * Retorna a lista de movimentações financeiras para a tela de extrato.
 */
exports.getWalletHistory = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                id, amount, type, description, created_at
             FROM transactions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.userId]
        );

        res.json({
            success: true,
            count: result.rows.length,
            transactions: result.rows
        });

    } catch (err) {
        console.error('[WALLET HISTORY ERROR]:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar histórico de transações.'
        });
    }
};

/**
 * RANKING GLOBAL
 * Busca os top 20 usuários com mais moedas para a RankingScreen.
 */
exports.getRanking = async (req, res) => {
    try {
        // Ranking baseado em Coins (Moedas acumuladas)
        const result = await db.query(
            `SELECT
                name, avatar_url, level, coins, total_wins
             FROM users
             WHERE coins > 0
             ORDER BY coins DESC, total_wins DESC
             LIMIT 20`
        );

        res.json({
            success: true,
            ranking: result.rows
        });

    } catch (err) {
        console.error('[GET RANKING ERROR]:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar ranking global.'
        });
    }
};

/**
 * ATUALIZAR AVATAR/NOME (OPCIONAL - PREPARAÇÃO PARA PRODUCTION)
 */
exports.updateProfile = async (req, res) => {
    const { name, avatar_url } = req.body;

    try {
        const result = await db.query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 avatar_url = COALESCE($2, avatar_url),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, name, avatar_url`,
            [name, avatar_url, req.userId]
        );

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso.',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('[UPDATE PROFILE ERROR]:', err);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar perfil.'
        });
    }
};