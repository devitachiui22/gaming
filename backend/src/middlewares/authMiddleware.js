/**
 * =============================================================================
 * FLUX GAME - AUTHENTICATION MIDDLEWARE (SECURITY SHIELD)
 * Purpose: JWT Validation, Identity Injection, and Real-time Account Integrity.
 * =============================================================================
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * PROTECT ROUTE MIDDLEWARE
 * Intercepts requests to private endpoints and validates the Bearer Token.
 */
module.exports = async (req, res, next) => {
    // 1. Authorization Header Extraction
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. Valid security token missing from headers.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Cryptographic Verification
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        /**
         * 3. REAL-TIME INTEGRITY CHECK
         * Ensures that the session is still valid within the database state.
         * Critical for blocking banned or deleted users before token expiration.
         */
        const userCheck = await db.query(
            'SELECT id, email, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Session invalid. Player identity no longer exists.'
            });
        }

        const user = userCheck.rows[0];

        // 4. Permission Check
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Access suspended. This account has been flagged for violation.'
            });
        }

        /**
         * 5. IDENTITY INJECTION
         * Contextualizing the request with the current user's identity
         * for downstream controllers (Game/Wallet/User).
         */
        req.userId = user.id;
        req.userEmail = user.email;

        // 6. Authorized - Proceed to logic
        next();

    } catch (err) {
        /**
         * 6. SPECIFIC ERROR HANDLING
         * Differentiates between expired sessions and corrupted tokens to help Flutter UI logic.
         */
        let errorMsg = 'Authentication security failure.';
        let statusCode = 401;

        if (err.name === 'TokenExpiredError') {
            errorMsg = 'Session expired. Please re-authenticate.';
        } else if (err.name === 'JsonWebTokenError') {
            errorMsg = 'Security token corrupted or malformed.';
        }

        console.warn(`[SECURITY_ALERT] Auth failure: ${err.message} at ${req.originalUrl}`);

        return res.status(statusCode).json({
            success: false,
            message: errorMsg
        });
    }
};