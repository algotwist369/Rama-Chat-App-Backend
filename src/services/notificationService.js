const { getRedisClient } = require('../config/redis');
const User = require('../models/User');

const sendNotification = async (userId, notification) => {
    try {
        await User.findByIdAndUpdate(userId, {
            $push: { notifications: notification }
        });

        const redis = getRedisClient();
        const userNotifications = redis ? await redis.get(`notifications:${userId}`) : null;
        const notifications = userNotifications ? JSON.parse(userNotifications) : [];
        notifications.push(notification);

        if (notifications.length > 100) {
            notifications.splice(0, notifications.length - 100);
        }

        if (redis) {
            await redis.setEx(`notifications:${userId}`, 24 * 60 * 60, JSON.stringify(notifications));
        }
        return true;
    } catch (error) {
        console.error('Error sending notification:', error);
        return false;
    }
};

const getNotifications = async (userId) => {
    try {
        // First try to get from Redis
        const redis = getRedisClient();
        const redisNotifications = redis ? await redis.get(`notifications:${userId}`) : null;
        if (redisNotifications) {
            return JSON.parse(redisNotifications);
        }

        // Fallback to MongoDB if Redis is empty
        const user = await User.findById(userId).select('notifications');
        if (user && user.notifications) {
            // Store in Redis for future requests
            const redis = getRedisClient();
            if (redis) {
                await redis.setEx(`notifications:${userId}`, 24 * 60 * 60, JSON.stringify(user.notifications));
            }
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
        const redis = getRedisClient();
        if (redis) {
            await redis.del(`notifications:${userId}`);
        }
        await User.findByIdAndUpdate(userId, { $set: { notifications: [] } });
        return true;
    } catch (error) {
        console.error('Error marking notifications as seen:', error);
        return false;
    }
};

const clearNotifications = async (userId) => {
    try {
        const redis = getRedisClient();
        if (redis) {
            await redis.del(`notifications:${userId}`);
        }
        await User.findByIdAndUpdate(userId, { $set: { notifications: [] } });
        return true;
    } catch (error) {
        console.error('Error clearing notifications:', error);
        return false;
    }
};

module.exports = { sendNotification, getNotifications, markNotificationsAsSeen, clearNotifications };
