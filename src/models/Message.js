const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    text: { type: String, maxlength: 1000 },
    file: { 
        url: String, 
        key: String,
        size: Number,
        mimetype: String,
        originalname: String
    },
    tags: [String],
    forwardedToGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    edited: { isEdited: Boolean, editedAt: Date },
    deleted: {
        isDeleted: Boolean,
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: Date
    }
}, { timestamps: true });

messageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
