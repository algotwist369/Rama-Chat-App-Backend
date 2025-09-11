const mongoose = require('mongoose');

/**
 * Create database indexes for optimal performance with large datasets
 */
const createIndexes = async () => {
    try {
        console.log('🔍 Creating database indexes for optimal performance...');

        // Message indexes - optimized for chunking and memory efficiency
        await mongoose.connection.db.collection('messages').createIndexes([
            // Primary index for chunking queries
            { key: { groupId: 1, 'deleted.isDeleted': 1, createdAt: -1 }, name: 'groupId_deleted_createdAt_idx' },
            // Sparse index for non-deleted messages only
            { key: { groupId: 1, createdAt: -1 }, name: 'groupId_createdAt_active_idx', partialFilterExpression: { 'deleted.isDeleted': { $ne: true } } },
            // Sender-based queries
            { key: { senderId: 1, createdAt: -1 }, name: 'senderId_createdAt_idx' },
            // Cleanup operations
            { key: { 'deleted.isDeleted': 1, 'deleted.deletedAt': 1 }, name: 'deleted_cleanup_idx' },
            { key: { createdAt: 1 }, name: 'createdAt_cleanup_idx' },
            // File and media queries
            { key: { file: 1, createdAt: -1 }, name: 'file_createdAt_idx' },
            // Forwarding and tags
            { key: { forwardedFrom: 1 }, name: 'forwardedFrom_idx' },
            { key: { tags: 1 }, name: 'tags_idx' },
            // Compound index for user join date filtering
            { key: { groupId: 1, createdAt: 1 }, name: 'groupId_createdAt_asc_idx' }
        ]);

        // Group indexes
        await mongoose.connection.db.collection('groups').createIndexes([
            { key: { users: 1, createdAt: -1 }, name: 'users_createdAt_idx' },
            { key: { managers: 1, createdAt: -1 }, name: 'managers_createdAt_idx' },
            { key: { region: 1 }, name: 'region_idx' },
            { key: { name: 'text' }, name: 'name_text_idx' },
            { key: { createdBy: 1 }, name: 'createdBy_idx' }
        ]);

        // User indexes
        await mongoose.connection.db.collection('users').createIndexes([
            { key: { email: 1 }, name: 'email_idx', unique: true },
            { key: { username: 1 }, name: 'username_idx' },
            { key: { groupId: 1 }, name: 'groupId_idx' },
            { key: { isOnline: 1, lastSeen: -1 }, name: 'isOnline_lastSeen_idx' },
            { key: { role: 1 }, name: 'role_idx' }
        ]);

        // Notification indexes
        await mongoose.connection.db.collection('notifications').createIndexes([
            { key: { userId: 1, createdAt: -1 }, name: 'userId_createdAt_idx' },
            { key: { userId: 1, isRead: 1, createdAt: -1 }, name: 'userId_isRead_createdAt_idx' },
            { key: { groupId: 1, createdAt: -1 }, name: 'groupId_createdAt_idx' },
            { key: { type: 1, createdAt: -1 }, name: 'type_createdAt_idx' }
        ]);

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.error('❌ Error creating database indexes:', error);
    }
};

/**
 * Drop all indexes (use with caution)
 */
const dropIndexes = async () => {
    try {
        console.log('🗑️ Dropping all database indexes...');
        
        await mongoose.connection.db.collection('messages').dropIndexes();
        await mongoose.connection.db.collection('groups').dropIndexes();
        await mongoose.connection.db.collection('users').dropIndexes();
        await mongoose.connection.db.collection('notifications').dropIndexes();
        
        console.log('✅ All indexes dropped successfully');
    } catch (error) {
        console.error('❌ Error dropping indexes:', error);
    }
};

module.exports = {
    createIndexes,
    dropIndexes
};
