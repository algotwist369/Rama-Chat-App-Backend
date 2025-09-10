const jwt = require('jsonwebtoken');
require('dotenv').config();

const signAccess = (user) =>
    jwt.sign(
        { sub: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

const verify = (token) => jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');

module.exports = { signAccess, verify };
