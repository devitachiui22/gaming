const db = require('../config/db');

exports.getProfile = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, email, balance, coins, level, xp FROM users WHERE id = $1',
            [req.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getWalletHistory = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getRanking = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT name, level, coins FROM users ORDER BY coins DESC LIMIT 10'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};