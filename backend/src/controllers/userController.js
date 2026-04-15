/**
 * =============================================================================
 * FLUX GAME - USER & ECOSYSTEM CONTROLLER
 * Purpose: Handling User Profiles, Ranking Engine, and Financial History.
 * =============================================================================
 */

const db = require('../config/db');

/**
 * GET USER PROFILE
 * Returns full telemetry, balance, and gamification progress.
 */
exports.getProfile = async (req, res) => {
    try {
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
                message: 'Player identity not found.'
            });
        }

        const user = result.rows[0];

        /**
         * LEVEL PROGRESS CALCULATION (UI IMAGE 3)
         * Formula synchronized with DB Trigger: Level = floor(sqrt(xp / 100)) + 1
         * We calculate the % to the next level for the Flutter Progress Bar.
         */
        const currentLevel = user.level;
        const nextLevel = currentLevel + 1;

        const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
        const xpForNextLevel = Math.pow(currentLevel, 2) * 100;

        const progress = ((user.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;

        res.status(200).json({
            success: true,
            data: {
                ...user,
                level_progress: Math.min(Math.max(progress, 0), 100).toFixed(2)
            }
        });

    } catch (err) {
        console.error('[GET_PROFILE_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile data.'
        });
    }
};

/**
 * GET WALLET HISTORY
 * Retrieves latest financial movements for audit.
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

        res.status(200).json({
            success: true,
            count: result.rows.length,
            transactions: result.rows
        });

    } catch (err) {
        console.error('[WALLET_HISTORY_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Database error fetching transaction logs.'
        });
    }
};

/**
 * GET GLOBAL RANKING
 * Optimized query for Top 20 players based on FluxCoins.
 */
exports.getRanking = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                name, avatar_url, level, coins, total_wins
             FROM users
             WHERE is_active = true
             ORDER BY coins DESC, xp DESC
             LIMIT 20`
        );

        res.status(200).json({
            success: true,
            ranking: result.rows
        });

    } catch (err) {
        console.error('[GET_RANKING_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Ranking service temporarily unavailable.'
        });
    }
};

/**
 * UPDATE PROFILE DATA
 * Permite alteração de nome e URL do avatar.
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
             RETURNING id, name, avatar_url, updated_at`,
            [name, avatar_url, req.userId]
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('[UPDATE_PROFILE_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Error synchronizing profile updates.'
        });
    }
};