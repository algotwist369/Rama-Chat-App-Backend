const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
const { extractTags } = require('../utils/parser');

// Auto-delete permanently deleted messages after 24 hours
const cleanupDeletedMessages = async () => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const result = await Message.deleteMany({
            'deleted.isDeleted': true,
            'deleted.deletedAt': { $lt: twentyFourHoursAgo }
        });
        
        if (result.deletedCount > 0) {
            console.log(`Cleaned up ${result.deletedCount} permanently deleted messages`);
        }
    } catch (error) {
        console.error('Error cleaning up deleted messages:', error);
    }
};

// Run cleanup every hour
setInterval(cleanupDeletedMessages, 60 * 60 * 1000);

/**
 * Get messages from a group with pagination
 */
const getMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        // Get user's join date for this group
        const user = await User.findById(req.user._id);
        const userJoinedAt = user.groupJoinedAt;

        // Build query - only show messages after user joined the group
        const query = { groupId };
        if (userJoinedAt) {
            query.createdAt = { $gte: userJoinedAt };
        }

        const messages = await Message.find(query)
            .populate('senderId', 'username email role')
            .populate('deleted.deletedBy', 'username')
            .sort({ createdAt: 1 }) // Sort oldest first (chronological order)
            .skip(skip)
            .limit(parseInt(limit));

        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Edit a message (only by sender within 15 minutes)
 */
const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (!message.senderId.equals(userId)) {
            return res.status(403).json({ error: 'Not authorized to edit this message' });
        }

        const editTimeLimit = 15 * 60 * 1000;
        if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
            return res.status(400).json({ error: 'Message too old to edit' });
        }

        message.text = text;
        message.tags = extractTags(text);
        message.edited = { isEdited: true, editedAt: new Date() };

        await message.save();

        // If this is an original message, also update all forwarded copies
        if (!message.forwardedFrom) {
            await Message.updateMany(
                { forwardedFrom: messageId },
                { 
                    text: text,
                    tags: extractTags(text),
                    edited: { isEdited: true, editedAt: new Date() }
                }
            );
        }

        req.app.get('io')?.to(`group:${message.groupId}`).emit('message:edited', message);

        res.json({ message: 'Message updated successfully', message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Soft delete a message (owner, manager, or admin)
 */
const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        const canDelete =
            message.senderId.equals(userId) ||
            req.user.role === 'admin' ||
            req.user.role === 'manager';

        if (!canDelete) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        message.deleted = {
            isDeleted: true,
            deletedBy: userId,
            deletedAt: new Date()
        };

        await message.save();

        // If this is an original message, also delete all forwarded copies
        if (!message.forwardedFrom) {
            await Message.updateMany(
                { forwardedFrom: messageId },
                { 
                    deleted: {
                        isDeleted: true,
                        deletedBy: userId,
                        deletedAt: new Date()
                    }
                }
            );
        }

        // Populate the deletedBy field with user information for the socket event
        const populatedMessage = await Message.findById(messageId)
            .populate('deleted.deletedBy', 'username')
            .populate('senderId', 'username')
            .lean();

        console.log('Emitting message:deleted event to group:', message.groupId, {
            messageId,
            deletedBy: populatedMessage.deleted.deletedBy
        });
        
        req.app.get('io')?.to(`group:${message.groupId}`).emit('message:deleted', {
            messageId,
            deletedBy: populatedMessage.deleted.deletedBy
        });

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Search messages (text, group, date range)
 */
const searchMessages = async (req, res) => {
    try {
        const { q, groupId, startDate, endDate, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let searchQuery = { 'deleted.isDeleted': { $ne: true } };
        if (groupId) searchQuery.groupId = groupId;
        if (q) searchQuery.text = { $regex: q, $options: 'i' };
        if (startDate || endDate) {
            searchQuery.createdAt = {};
            if (startDate) searchQuery.createdAt.$gte = new Date(startDate);
            if (endDate) searchQuery.createdAt.$lte = new Date(endDate);
        }

        const messages = await Message.find(searchQuery)
            .populate('senderId', 'username email')
            .populate('groupId', 'name region')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Message.countDocuments(searchQuery);

        res.json({
            messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Forward message to other groups
 */
const forwardMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { groupIds } = req.body;

        const originalMessage = await Message.findById(messageId);
        if (!originalMessage) return res.status(404).json({ error: 'Message not found' });

        const targetGroups = await Group.find({ _id: { $in: groupIds } });

        const forwardedMessages = await Promise.all(
            targetGroups.map(group =>
                Message.create({
                    senderId: req.user._id,
                    groupId: group._id,
                    text: `[Forwarded] ${originalMessage.text}`,
                    file: originalMessage.file,
                    tags: originalMessage.tags,
                    forwardedFrom: originalMessage._id
                })
            )
        );

        const io = req.app.get('io');
        if (io) {
            forwardedMessages.forEach(msg => {
                io.to(`group:${msg.groupId}`).emit('message:new', msg);
            });
        }

        res.json({
            message: 'Message forwarded successfully',
            forwardedTo: targetGroups.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Mark messages as delivered for a user
 */
const markAsDelivered = async (req, res) => {
    try {
        const { messageIds } = req.body;
        const userId = req.user._id;

        await Message.updateMany(
            { _id: { $in: messageIds }, deliveredTo: { $ne: userId } },
            { $push: { deliveredTo: userId }, $set: { status: 'delivered' } }
        );

        res.json({ message: 'Messages marked as delivered' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Mark messages as seen for a user
 */
const markAsSeen = async (req, res) => {
    try {
        const { messageIds } = req.body;
        const userId = req.user._id;

        await Message.updateMany(
            { _id: { $in: messageIds }, seenBy: { $ne: userId } },
            { $push: { seenBy: userId }, $set: { status: 'seen' } }
        );

        res.json({ message: 'Messages marked as seen' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getMessages,
    editMessage,
    deleteMessage,
    searchMessages,
    forwardMessage,
    markAsDelivered,
    markAsSeen
};