const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: String,
    region: { type: String, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
