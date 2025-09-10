const express = require('express');
const router = express.Router();
const { getNotifications, clearNotifications, markNotificationsAsSeen } = require('../services/notificationService');
const authenticateToken = require('../middleware/authMiddleware');

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const notifications = await getNotifications(req.user.id);
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notifications as seen
router.patch('/seen', authenticateToken, async (req, res) => {
    try {
        console.log('PATCH /seen route hit for user:', req.user.id);
        await markNotificationsAsSeen(req.user.id);
        console.log('Notifications marked as seen successfully for user:', req.user.id);
        res.json({ message: 'Notifications marked as seen successfully' });
    } catch (error) {
        console.error('Error marking notifications as seen:', error);
        res.status(500).json({ error: 'Failed to mark notifications as seen' });
    }
});

// Clear all notifications
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await clearNotifications(req.user.id);
        res.json({ message: 'Notifications cleared successfully' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
});

// Test endpoint to create sample notifications
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const { sendNotification } = require('../services/notificationService');
        
        const testNotifications = [
            {
                type: 'message',
                title: 'New message from John Doe',
                message: 'Hey, how are you doing?',
                groupId: '507f1f77bcf86cd799439011',
                groupName: 'General Chat',
                senderId: '507f1f77bcf86cd799439012',
                senderUsername: 'John Doe',
                createdAt: new Date()
            },
            {
                type: 'user_joined',
                title: 'Alice joined the group',
                message: 'Alice has joined General Chat',
                groupId: '507f1f77bcf86cd799439011',
                groupName: 'General Chat',
                createdAt: new Date()
            },
            {
                type: 'user_left',
                title: 'Bob left the group',
                message: 'Bob has left General Chat',
                groupId: '507f1f77bcf86cd799439011',
                groupName: 'General Chat',
                createdAt: new Date()
            }
        ];

        for (const notification of testNotifications) {
            await sendNotification(req.user.id, notification);
        }

        res.json({ message: 'Test notifications created successfully' });
    } catch (error) {
        console.error('Error creating test notifications:', error);
        res.status(500).json({ error: 'Failed to create test notifications' });
    }
});

module.exports = router;
