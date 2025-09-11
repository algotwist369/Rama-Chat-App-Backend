const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signAccess } = require('../utils/token');
const { getRedisClient } = require('../config/redis');

const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        if (users.length === 0) {
            return res.status(404).json({ error: 'No users found' });
        }
        const usersWithGroup = await User.find().populate('groupId');
        if (usersWithGroup.length === 0) {
            return res.status(404).json({ error: 'No users found' });
        }
        res.json({ users: usersWithGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const register = async (req, res) => {
    try {
        const { username, email, password, role = 'user' } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            role,
        });

        const token = signAccess(user);

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                groupId: user.groupId,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email }).populate('groupId');
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update online status
        await User.findByIdAndUpdate(user._id, {
            isOnline: true,
            lastSeen: new Date(),
        });

        const token = signAccess(user);

        // Store refresh token in Redis (optional)
        const refreshToken = `refresh_${user._id}_${Date.now()}`;
        const redis = getRedisClient();
        if (redis) {
            await redis.setEx(refreshToken, 7 * 24 * 60 * 60, user._id.toString());
        }

        res.json({
            token,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                groupId: user.groupId,
                isOnline: user.isOnline,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        const redis = getRedisClient();
        const userId = redis ? await redis.get(refreshToken) : null;
        if (!userId) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const newToken = signAccess(user);

        res.json({ token: newToken });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user._id;

        // Update offline status
        await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
        });

        // Remove all refresh tokens for this user (optional cleanup)
        const keys = redis ? await redis.keys(`refresh_${userId}_*`) : [];
        if (keys.length > 0 && redis) {
            await redis.del(...keys);
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('groupId')
            .select('-password');

        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createUser = async (req, res) => {
    try {
        const { username, email, password, pin, role = 'user' } = req.body;

        // Validate role - only allow creating users and managers
        if (!['user', 'manager'].includes(role)) {
            return res.status(400).json({ 
                error: 'Invalid role. Only users and managers can be created by admin.' 
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Hash pin if provided
        let hashedPin = null;
        if (pin) {
            hashedPin = await bcrypt.hash(pin, 12);
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            pin: hashedPin,
            role,
        });

        res.status(201).json({
            message: `${role} created successfully`,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                hasPin: !!user.pin,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const loginWithPin = async (req, res) => {
    try {
        const { email, pin } = req.body;

        // Find user
        const user = await User.findOne({ email }).populate('groupId');
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user has a PIN
        if (!user.pin) {
            return res.status(401).json({ error: 'PIN not set for this user' });
        }

        // Check PIN
        const isPinMatch = await bcrypt.compare(pin, user.pin);
        if (!isPinMatch) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Update online status
        await User.findByIdAndUpdate(user._id, {
            isOnline: true,
            lastSeen: new Date(),
        });

        const token = signAccess(user);

        // Store refresh token in Redis (optional)
        const refreshToken = `refresh_${user._id}_${Date.now()}`;
        const redis = getRedisClient();
        if (redis) {
            await redis.setEx(refreshToken, 7 * 24 * 60 * 60, user._id.toString());
        }

        res.json({
            token,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                groupId: user.groupId,
                isOnline: user.isOnline,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



module.exports = {
    getUsers,
    register,
    login,
    loginWithPin,
    refreshToken,
    logout,
    getProfile,
    createUser,
};
