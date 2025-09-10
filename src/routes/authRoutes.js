const express = require('express');
const { register, login, loginWithPin, refreshToken, logout, getProfile, createUser, getUsers } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbac');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-pin', loginWithPin);
router.post('/refresh', refreshToken);
router.post('/logout', auth, logout);
router.get('/profile', auth, getProfile);
router.get('/users', auth, requireAdmin, getUsers);
router.post('/create-user', auth, requireAdmin, createUser);

module.exports = router;
