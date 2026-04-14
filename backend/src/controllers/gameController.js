/**
 * =============================================================================
 * FLUX GAME - GAME & REWARDS CONTROLLER
 * Purpose: Handle Game sessions, Score submission, and QR/Barcode rewards.
 * Engineer: Senior Software Architect
 * =============================================================================
 */

const db = require('../config/db');
const crypto = require('crypto');

/**
 * SUBMETER RESULTADO DE PARTIDA
 * Processa a vitória, calcula XP/Coins e atualiza o saldo financeiro.
 */
exports.submitMatchResult = async (req, res) => {
    const { game_slug, points, win_amount } = req.body;

    if (!game_slug || points === undefined) {
        return res.status(400).json({ success: false, message: 'Dados da partida incompletos.' });
    }

    try {
        // 1. Buscar configurações reais do jogo
        const gameRes = await db.query('SELECT * FROM games WHERE slug = $1 AND status = $2', [game_slug, 'active']);
        if (gameRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Jogo não encontrado ou inativo.' });
        }
        const game = gameRes.rows[0];

        // 2. Proteção de integridade: Validar se o win_amount enviado não excede o máximo permitido do jogo
        const finalWinAmount = Math.min(parseFloat(win_amount || 0), parseFloat(game.max_reward));

        // 3. Cálculo de recompensas secundárias
        const xpGained = points * 2; // Ex: 100 pontos = 200 XP
        const coinsGained = Math.floor(points / 5); // Recompensa em moedas do ranking

        // 4. Execução da transação atômica (Tudo ou Nada)
        await db.transaction(async (client) => {
            // A. Registrar a partida (Match)
            const matchInsert = await client.query(
                `INSERT INTO matches (user_id, game_id, points, win_amount, xp_gained)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [req.userId, game.id, points, finalWinAmount, xpGained]
            );

            // B. Atualizar o Usuário (Saldo, XP, Moedas e Estatísticas)
            await client.query(
                `UPDATE users
                 SET balance = balance + $1,
                     coins = coins + $2,
                     xp = xp + $3,
                     total_wins = total_wins + (CASE WHEN $1 > 0 THEN 1 ELSE 0 END),
                     total_games = total_games + 1
                 WHERE id = $4`,
                [finalWinAmount, coinsGained, xpGained, req.userId]
            );

            // C. Registrar transação financeira se houver ganho
            if (finalWinAmount > 0) {
                await client.query(
                    `INSERT INTO transactions (user_id, amount, type, description, reference_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [req.userId, finalWinAmount, 'game_win', `Vitória no jogo: ${game.title}`, matchInsert.rows[0].id]
                );
            }
        });

        res.json({
            success: true,
            message: 'Resultado processado com sucesso!',
            rewards: {
                balance_added: finalWinAmount,
                xp_added: xpGained,
                coins_added: coinsGained
            }
        });

    } catch (err) {
        console.error('[SUBMIT SCORE ERROR]:', err);
        res.status(500).json({ success: false, message: 'Erro ao salvar resultado da partida.' });
    }
};

/**
 * PROCESSAR SCAN DE RECOMPENSA (QR / BARCODE)
 * Valida o código e credita o valor na conta do usuário.
 */
exports.processScan = async (req, res) => {
    const { code } = req.body; // O texto bruto lido pelo scanner

    if (!code) {
        return res.status(400).json({ success: false, message: 'Código não identificado.' });
    }

    // Criar um hash do código para evitar salvar dados sensíveis em texto claro e facilitar a busca
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const REWARD_VALUE = 10.00; // Valor fixo por scan (Poderia vir de uma tabela de promoções)

    try {
        // 1. Verificar se este código específico já foi usado (Unicidade via DB Constraint)
        const checkScan = await db.query('SELECT id FROM scans WHERE code_hash = $1', [codeHash]);
        if (checkScan.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Este QR Code já foi resgatado anteriormente.'
            });
        }

        // 2. Processar resgate em transação
        const result = await db.transaction(async (client) => {
            // A. Registrar o Scan
            const scanEntry = await client.query(
                'INSERT INTO scans (user_id, code_hash, reward_amount) VALUES ($1, $2, $3) RETURNING id',
                [req.userId, codeHash, REWARD_VALUE]
            );

            // B. Atualizar saldo do usuário
            await client.query(
                'UPDATE users SET balance = balance + $1 WHERE id = $2',
                [REWARD_VALUE, req.userId]
            );

            // C. Gerar Log Financeiro
            await client.query(
                `INSERT INTO transactions (user_id, amount, type, description, reference_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.userId, REWARD_VALUE, 'scan_reward', 'Recompensa de Scan QR/Barcode', scanEntry.rows[0].id]
            );

            return REWARD_VALUE;
        });

        res.json({
            success: true,
            message: `Parabéns! Kz ${result.toFixed(2)} foram adicionados à sua carteira.`,
            amount: result
        });

    } catch (err) {
        console.error('[SCAN PROCESS ERROR]:', err);
        res.status(500).json({ success: false, message: 'Erro ao processar o resgate do código.' });
    }
};