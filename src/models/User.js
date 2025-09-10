const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String, // hashed
    pin: String, // hashed pin for quick access
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    groupJoinedAt: Date, // Track when user joined their current group
    isOnline: { type: Boolean, default: false },
    lastSeen: Date,
    notifications: [{ type: Object }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
