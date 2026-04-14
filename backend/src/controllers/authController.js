const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) return res.status(400).json({ message: 'E-mail já cadastrado' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO users (name, email, password, balance) VALUES ($1, $2, $3, 100.00) RETURNING id, name, email, balance',
            [name, email, hashedPassword]
        );

        const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, token, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Senha incorreta' });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        delete user.password;
        res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};