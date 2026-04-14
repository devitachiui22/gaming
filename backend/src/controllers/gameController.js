const db = require('../config/db');

exports.submitScore = async (req, res) => {
    const { game_id, points, win_amount } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Registrar o score
        await client.query(
            'INSERT INTO scores (user_id, game_id, points, win_amount) VALUES ($1, $2, $3, $4)',
            [req.userId, game_id, points, win_amount]
        );

        // Atualizar saldo do usuário
        await client.query(
            'UPDATE users SET balance = balance + $1, coins = coins + $2 WHERE id = $3',
            [win_amount, Math.floor(points / 10), req.userId]
        );

        // Registrar transação
        await client.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [req.userId, win_amount, 'game_win', 'Vitória em jogo']
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Pontuação salva e saldo atualizado' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
};

exports.processScan = async (req, res) => {
    const { code } = req.body;
    const reward = 10.00; // Valor fixo de recompensa por scan

    try {
        const scanExists = await db.query('SELECT id FROM scans WHERE code_hash = $1', [code]);
        if (scanExists.rows.length > 0) return res.status(400).json({ message: 'Este código já foi resgatado!' });

        await db.query('BEGIN');
        await db.query('INSERT INTO scans (user_id, code_hash, reward) VALUES ($1, $2, $3)', [req.userId, code, reward]);
        await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [reward, req.userId]);
        await db.query('INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [req.userId, reward, 'scan_reward', 'Recompensa de Scanner']);
        await db.query('COMMIT');

        res.json({ success: true, message: `Parabéns! Você ganhou Kz ${reward}` });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    }
};