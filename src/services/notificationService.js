const redis = require('../config/redis');
const User = require('../models/User');

const sendNotification = async (userId, notification) => {
    try {
        await User.findByIdAndUpdate(userId, {
            $push: { notifications: notification }
        });

        const userNotifications = await redis.get(`notifications:${userId}`);
        const notifications = userNotifications ? JSON.parse(userNotifications) : [];
        notifications.push(notification);

        if (notifications.length > 100) {
            notifications.splice(0, notifications.length - 100);
        }

        await redis.setex(`notifications:${userId}`, 24 * 60 * 60, JSON.stringify(notifications));
        return true;
    } catch (error) {
        console.error('Error sending notification:', error);
        return false;
    }
};

const getNotifications = async (userId) => {
    try {
        // First try to get from Redis
        const redisNotifications = await redis.get(`notifications:${userId}`);
        if (redisNotifications) {
            return JSON.parse(redisNotifications);
        }

        // Fallback to MongoDB if Redis is empty
        const user = await User.findById(userId).select('notifications');
        if (user && user.notifications) {
            // Store in Redis for future requests
            await redis.setex(`notifications:${userId}`, 24 * 60 * 60, JSON.stringify(user.notifications));
            return user.notifications;
        }

        return [];
    } catch (error) {
        console.error('Error getting notifications:', error);
        return [];
    }
};

const markNotificationsAsSeen = async (userId) => {
    try {
        // Clear notifications from Redis and MongoDB
        await redis.del(`notifications:${userId}`);
        await User.findByIdAndUpdate(userId, { $set: { notifications: [] } });
        return true;
    } catch (error) {
        console.error('Error marking notifications as seen:', error);
        return false;
    }
};

const clearNotifications = async (userId) => {
    try {
        await redis.del(`notifications:${userId}`);
        await User.findByIdAndUpdate(userId, { $set: { notifications: [] } });
        return true;
    } catch (error) {
        console.error('Error clearing notifications:', error);
        return false;
    }
};

module.exports = { sendNotification, getNotifications, markNotificationsAsSeen, clearNotifications };
