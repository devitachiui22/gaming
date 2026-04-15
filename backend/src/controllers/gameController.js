/**
 * =============================================================================
 * FLUX GAME - GAME ENGINE & REWARDS CONTROLLER
 * Purpose: Processing match results, XP scaling, and secure QR/Barcode redemptions.
 * =============================================================================
 */

const db = require('../config/db');
const crypto = require('crypto');

/**
 * SUBMIT MATCH RESULT
 * Validates points, calculates rewards (XP/Coins), and updates financial state.
 */
exports.submitMatchResult = async (req, res) => {
    const { game_slug, points, win_amount } = req.body;

    // 1. Technical Validation
    if (!game_slug || points === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Incomplete match telemetry data.'
        });
    }

    try {
        // 2. Verified Game Metadata Retrieval
        const gameRes = await db.query(
            'SELECT * FROM games WHERE slug = $1 AND status = $2',
            [game_slug, 'active']
        );

        if (gameRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Game profile inactive or not found.'
            });
        }
        const game = gameRes.rows[0];

        // 3. Integrity Protection: Cap rewards based on game configuration
        const sanitizedWinAmount = Math.min(parseFloat(win_amount || 0), parseFloat(game.max_reward));

        // 4. Gamification Calculations
        const xpGained = points * 2;
        const coinsGained = Math.floor(points / 5);

        // 5. Atomic State Update
        const rewards = await db.transaction(async (client) => {
            // A. Audit Match Entry
            const matchInsert = await client.query(
                `INSERT INTO matches (user_id, game_id, points, win_amount, xp_gained)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [req.userId, game.id, points, sanitizedWinAmount, xpGained]
            );

            // B. User Evolution & Wallet Update
            // Note: The level-up is handled automatically by the DB Trigger defined in init.sql
            await client.query(
                `UPDATE users
                 SET balance = balance + $1,
                     coins = coins + $2,
                     xp = xp + $3,
                     total_wins = total_wins + (CASE WHEN $1 > 0 THEN 1 ELSE 0 END),
                     total_games = total_games + 1
                 WHERE id = $4`,
                [sanitizedWinAmount, coinsGained, xpGained, req.userId]
            );

            // C. Financial Ledger Logging
            if (sanitizedWinAmount > 0) {
                await client.query(
                    `INSERT INTO transactions (user_id, amount, type, description, reference_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [req.userId, sanitizedWinAmount, 'game_win', `Victory: ${game.title}`, matchInsert.rows[0].id]
                );
            }

            return {
                balance_added: sanitizedWinAmount,
                xp_added: xpGained,
                coins_added: coinsGained
            };
        });

        res.status(200).json({
            success: true,
            message: 'Match synchronized successfully.',
            rewards
        });

    } catch (err) {
        console.error('[GAME_SUBMIT_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Critical error processing game results.'
        });
    }
};

/**
 * PROCESS REWARD SCAN (QR / BARCODE)
 * Uses hashing for unique code identification and anti-replay protection.
 */
exports.processScan = async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Optical data stream empty.'
        });
    }

    // 1. Cryptographic Identifier (Deterministic)
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const FIXED_SCAN_REWARD = 10.00; // Standard reward for authorized scans

    try {
        // 2. Idempotency Check (Anti-Replay)
        const checkScan = await db.query('SELECT id FROM scans WHERE code_hash = $1', [codeHash]);
        if (checkScan.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Security Alert: This code has already been redeemed.'
            });
        }

        // 3. Processing Redemption
        const amountClaimed = await db.transaction(async (client) => {
            // A. Register Scan Event
            const scanEntry = await client.query(
                'INSERT INTO scans (user_id, code_hash, reward_amount) VALUES ($1, $2, $3) RETURNING id',
                [req.userId, codeHash, FIXED_SCAN_REWARD]
            );

            // B. Deposit to User Balance
            await client.query(
                'UPDATE users SET balance = balance + $1 WHERE id = $2',
                [FIXED_SCAN_REWARD, req.userId]
            );

            // C. Ledger Entry
            await client.query(
                `INSERT INTO transactions (user_id, amount, type, description, reference_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.userId, FIXED_SCAN_REWARD, 'scan_reward', 'Physical QR/Barcode Redemption', scanEntry.rows[0].id]
            );

            return FIXED_SCAN_REWARD;
        });

        res.status(200).json({
            success: true,
            message: `Reward confirmed! Kz ${amountClaimed.toFixed(2)} added to your wallet.`,
            amount: amountClaimed
        });

    } catch (err) {
        console.error('[SCAN_PROCESS_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Internal error validating redemption code.'
        });
    }
};