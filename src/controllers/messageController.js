const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
const extractTags = require('../utils/parser');
const mongoose = require('mongoose');

// Memory-optimized message cleanup with chunking
const cleanupDeletedMessages = async () => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // Process in chunks to avoid memory issues
        let totalDeleted = 0;
        let hasMore = true;
        const chunkSize = 1000;
        
        while (hasMore) {
        const result = await Message.deleteMany({
            'deleted.isDeleted': true,
            'deleted.deletedAt': { $lt: twentyFourHoursAgo }
            }).limit(chunkSize);
            
            totalDeleted += result.deletedCount;
            hasMore = result.deletedCount === chunkSize;
            
            // Small delay to prevent overwhelming the database
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        if (totalDeleted > 0) {
            console.log(`Cleaned up ${totalDeleted} permanently deleted messages`);
        }
    } catch (error) {
        console.error('Error cleaning up deleted messages:', error);
    }
};

// Optimized cleanup for old messages (older than 90 days)
const cleanupOldMessages = async () => {
    try {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        
        // Only clean up messages from inactive groups or very old messages
        const result = await Message.deleteMany({
            createdAt: { $lt: ninetyDaysAgo },
            'deleted.isDeleted': true
        }).limit(5000); // Limit to prevent long-running operations
        
        if (result.deletedCount > 0) {
            console.log(`Cleaned up ${result.deletedCount} old deleted messages`);
        }
    } catch (error) {
        console.error('Error cleaning up old messages:', error);
    }
};

// Run cleanup every hour for deleted messages, every 6 hours for old messages
setInterval(cleanupDeletedMessages, 60 * 60 * 1000);
setInterval(cleanupOldMessages, 6 * 60 * 60 * 1000);

/**
 * Send a new message
 */
const sendMessage = async (req, res) => {
    try {
        const { text, groupId, file } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!text && !file) {
            return res.status(400).json({ error: 'Message text or file is required' });
        }

        if (!groupId) {
            return res.status(400).json({ error: 'Group ID is required' });
        }

        // Verify user is member of the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const isMember = group.users.some(user => user.toString() === userId.toString()) ||
                        group.managers.some(manager => manager.toString() === userId.toString());

        if (!isMember) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Create the message
        const message = await Message.create({
            senderId: userId,
            groupId: groupId,
            text: text || '',
            file: file || null,
            tags: extractTags(text || '')
        });

        // Populate the message with sender and group information
        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'username email')
            .populate('groupId', 'name region')
            .lean();

        // Emit to the group via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`group:${groupId}`).emit('message:new', populatedMessage);
        }

        res.status(201).json({
            message: 'Message sent successfully',
            data: populatedMessage
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get messages from a group with optimized chunking and memory management
 */
const getMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { 
            chunkSize = 50,           // Smaller chunks for better memory management
            before,                   // Cursor-based pagination
            after,                    // For loading newer messages
            includeMetadata = false   // Only include essential data by default
        } = req.query;
        
        const userId = req.user._id;
        const chunkLimit = Math.min(parseInt(chunkSize), 100); // Cap at 100 for performance

        // Fast group membership check with projection
        const group = await Group.findById(groupId, { 
            users: 1, 
            managers: 1, 
            _id: 1 
        }).lean();
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const isMember = group.users.some(user => user.toString() === userId.toString()) ||
                        group.managers.some(manager => manager.toString() === userId.toString());
        
        if (!isMember) {
            return res.status(403).json({ error: 'Not authorized to view messages' });
        }

        // Get user's join date with minimal projection
        const user = await User.findById(userId, { groupJoinedAt: 1 }).lean();
        const userJoinedAt = user?.groupJoinedAt;

        // Build optimized query with proper indexing
        const baseQuery = { 
            groupId: groupId, // Mongoose will automatically cast string to ObjectId
            'deleted.isDeleted': { $ne: true }
        };
        
        // Time-based filtering for performance - only apply if user has a specific join date
        // For existing group members, show all messages unless they have a specific join date
        if (userJoinedAt) {
            baseQuery.createdAt = { $gte: userJoinedAt };
        }
        // Remove the 30-day restriction for existing members - they should see all group messages
        
        // Cursor-based pagination
        if (before) {
            baseQuery.createdAt = { ...baseQuery.createdAt, $lt: new Date(before) };
        }
        
        if (after) {
            baseQuery.createdAt = { ...baseQuery.createdAt, $gt: new Date(after) };
        }

        // Debug logging to help troubleshoot
        console.log('🔍 Message Query Debug:', {
            groupId,
            userId,
            userJoinedAt,
            baseQuery,
            chunkLimit
        });

        // Test query to see if any messages exist for this group
        const testQuery = { groupId: groupId };
        const testCount = await Message.countDocuments(testQuery);
        console.log('🧪 Test Query Results:', {
            testQuery,
            testCount,
            groupIdType: typeof groupId,
            groupId
        });

        // Optimized aggregation pipeline with memory-efficient operations
        const pipeline = [
            { $match: baseQuery },
            { $sort: { createdAt: -1 } },
            { $limit: chunkLimit },
            
            // Optimized lookup with minimal data projection
            {
                $lookup: {
                    from: 'users',
                    localField: 'senderId',
                    foreignField: '_id',
                    as: 'sender',
                    pipeline: [
                        { 
                            $project: { 
                                username: 1, 
                                _id: 1,
                                // Only include role if metadata is requested
                                ...(includeMetadata === 'true' && { role: 1, email: 1 })
                            } 
                        }
                    ]
                }
            },
            
            // Only lookup deletedBy if there are deleted messages
            {
                $lookup: {
                    from: 'users',
                    localField: 'deleted.deletedBy',
                    foreignField: '_id',
                    as: 'deletedByUser',
                    pipeline: [{ $project: { username: 1, _id: 1 } }]
                }
            },
            
            // Optimized field projection
            {
                $addFields: {
                    senderId: { $arrayElemAt: ['$sender', 0] },
                    'deleted.deletedBy': { 
                        $cond: {
                            if: { $gt: [{ $size: '$deletedByUser' }, 0] },
                            then: { $arrayElemAt: ['$deletedByUser', 0] },
                            else: null
                        }
                    }
                }
            },
            
            // Remove unnecessary fields to reduce memory usage
            {
                $project: {
                    _id: 1,
                    text: 1,
                    file: 1,
                    senderId: 1,
                    groupId: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    deleted: 1,
                    // Only include these fields if metadata is requested
                    ...(includeMetadata === 'true' && {
                        seenBy: 1,
                        deliveredTo: 1,
                        status: 1
                    })
                }
            },
            
            // Final sort for chronological order
            { $sort: { createdAt: 1 } }
        ];

        // Execute aggregation with memory optimization
        let messages = await Message.aggregate(pipeline).allowDiskUse(false);

        // Debug logging for aggregation results
        console.log('📊 Aggregation Results:', {
            messagesFound: messages.length,
            firstMessage: messages[0] ? {
                _id: messages[0]._id,
                text: messages[0].text,
                createdAt: messages[0].createdAt
            } : null
        });

        // Fallback: If aggregation returns no results but test query found messages, try simple query
        if (messages.length === 0 && testCount > 0) {
            console.log('🔄 Using fallback query - aggregation returned no results');
            const fallbackQuery = { 
                groupId: groupId,
                'deleted.isDeleted': { $ne: true }
            };
            
            messages = await Message.find(fallbackQuery)
                .populate('senderId', 'username _id')
                .sort({ createdAt: -1 })
                .limit(chunkLimit)
                .lean();
                
            // Sort messages chronologically for consistency
            messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
            console.log('🔄 Fallback Results:', {
                messagesFound: messages.length,
                firstMessage: messages[0] ? {
                    _id: messages[0]._id,
                    text: messages[0].text,
                    createdAt: messages[0].createdAt
                } : null
            });
        }

        // Get approximate count using estimatedDocumentCount for better performance
        const estimatedCount = await Message.estimatedDocumentCount({ groupId: groupId });
        
        // Only get exact count if it's small (less than 10k messages)
        let totalCount = estimatedCount;
        if (estimatedCount < 10000) {
            totalCount = await Message.countDocuments(baseQuery);
        }

        console.log('📈 Count Results:', {
            estimatedCount,
            totalCount,
            baseQuery
        });

        // Calculate next cursor efficiently
        const nextCursor = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
        const prevCursor = messages.length > 0 ? messages[0].createdAt : null;

        // Response with optimized structure
        const response = {
            messages,
            chunk: {
                size: chunkLimit,
                hasMore: messages.length === chunkLimit,
                nextCursor,
                prevCursor,
                total: totalCount,
                isEstimated: totalCount === estimatedCount && estimatedCount >= 10000
            }
        };

        // Add metadata only if requested
        if (includeMetadata === 'true') {
            response.metadata = {
                chunkSize: chunkLimit,
                loadTime: Date.now(),
                memoryOptimized: true
            };
        }

        res.json(response);
        
    } catch (error) {
        console.error('Error fetching messages:', error);
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

        // Populate the message with sender and group information before emitting
        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'username email')
            .populate('groupId', 'name region')
            .lean();

        req.app.get('io')?.to(`group:${message.groupId}`).emit('message:edited', populatedMessage);

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

/**
 * Test endpoint to debug message retrieval
 */
const testGetMessages = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        console.log('🧪 Test endpoint called:', { groupId, userId });

        // Simple query to get all messages for the group
        const messages = await Message.find({ 
            groupId: groupId 
        })
        .populate('senderId', 'username _id')
        .sort({ createdAt: 1 })
        .lean();

        console.log('🧪 Test results:', {
            groupId,
            messagesFound: messages.length,
            messages: messages.map(m => ({
                _id: m._id,
                text: m.text,
                senderId: m.senderId,
                createdAt: m.createdAt
            }))
        });

        res.json({
            success: true,
            groupId,
            messagesFound: messages.length,
            messages: messages
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    sendMessage,
    getMessages,
    testGetMessages,
    editMessage,
    deleteMessage,
    searchMessages,
    forwardMessage,
    markAsDelivered,
    markAsSeen
};