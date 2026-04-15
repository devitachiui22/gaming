/**
 * =============================================================================
 * FLUX GAME - AUTHENTICATION CONTROLLER
 * Purpose: Secure Identity Management & Financial Initialization.
 * =============================================================================
 */

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * REGISTER NEW USER
 * Creates account and grants the initial FluxGame welcome bonus.
 */
exports.register = async (req, res) => {
    const { name, email, password } = req.body;

    // 1. Rigorous Input Validation
    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields (name, email, password) are required.'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Security policy: Password must be at least 6 characters.'
        });
    }

    try {
        // 2. Check for Identity Collision
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This email is already registered in the Flux network.'
            });
        }

        // 3. Cryptographic Password Hashing
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Atomic Transaction: Account Creation + Bonus Injection
        const result = await db.transaction(async (client) => {
            // Insert User with initial stats
            const userInsert = await client.query(
                `INSERT INTO users (name, email, password, balance, coins, level, xp)
                 VALUES ($1, $2, $3, 100.00, 0, 1, 0)
                 RETURNING id, name, email, balance, coins, level, xp, created_at`,
                [name, email.toLowerCase(), hashedPassword]
            );

            const newUser = userInsert.rows[0];

            // Record the welcome bonus transaction for audit trail
            await client.query(
                `INSERT INTO transactions (user_id, amount, type, description)
                 VALUES ($1, $2, $3, $4)`,
                [newUser.id, 100.00, 'bonus', 'FluxGame Welcome Bonus']
            );

            return newUser;
        });

        // 5. JWT Generation (30-day session for mobile UX)
        const token = jwt.sign(
            { id: result.id, email: result.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // 6. Production-Ready Response
        res.status(201).json({
            success: true,
            message: 'Welcome to FluxGame! Account successfully created.',
            token,
            user: result
        });

    } catch (err) {
        console.error('[AUTH_REG_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Internal server failure during registration process.'
        });
    }
};

/**
 * USER LOGIN
 * Validates credentials and generates access token.
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Credentials required.'
        });
    }

    try {
        // 1. User Retrieval
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or user does not exist.'
            });
        }

        const user = result.rows[0];

        // 2. Account Status Check
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account suspended. Contact support for investigation.'
            });
        }

        // 3. Constant-Time Password Comparison
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials.'
            });
        }

        // 4. Update Access Log (Background task)
        db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id])
          .catch(e => console.error('Error logging last access:', e));

        // 5. Session Token issuance
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // 6. Response Construction (Cleaning sensitive fields)
        const userProfile = { ...user };
        delete userProfile.password;

        res.status(200).json({
            success: true,
            message: 'Authenticated successfully.',
            token,
            user: userProfile
        });

    } catch (err) {
        console.error('[AUTH_LOGIN_ERROR]:', err.stack);
        res.status(500).json({
            success: false,
            message: 'Authentication service currently unavailable.'
        });
    }
};