const { createClient } = require('redis');
const envConfig = require('./environment');

let redisClient = null;

const connectRedis = async () => {
    try {
        if (process.env.USE_REDIS === 'true') {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            
            redisClient = createClient({
                url: redisUrl,
                socket: {
                    connectTimeout: 10000,
                    lazyConnect: true
                }
            });

            redisClient.on('error', (err) => {
                console.error('Redis Client Error:', err);
            });

            redisClient.on('connect', () => {
                console.log('🔴 Redis Client Connected');
            });

            redisClient.on('ready', () => {
                console.log('🔴 Redis Client Ready');
            });

            redisClient.on('end', () => {
                console.log('🔴 Redis Client Disconnected');
            });

            await redisClient.connect();
            return redisClient;
        } else {
            console.log('🔵 Redis disabled - using mock Redis');
            return createMockRedis();
        }
    } catch (error) {
        console.error('Redis connection error:', error);
        console.log('🔵 Falling back to mock Redis');
        return createMockRedis();
    }
};

const createMockRedis = () => {
    return {
        setex: (key, ttl, value) => {
            console.log('Redis setex (mock):', key, ttl, value);
            return Promise.resolve('OK');
        },
        get: (key) => {
            console.log('Redis get (mock):', key);
            return Promise.resolve(null);
        },
        del: (...keys) => {
            console.log('Redis del (mock):', keys);
            return Promise.resolve(1);
        },
        keys: (pattern) => {
            console.log('Redis keys (mock):', pattern);
            return Promise.resolve([]);
        },
        disconnect: () => {
            console.log('Mock Redis disconnect');
            return Promise.resolve();
        }
    };
};

const getRedisClient = () => {
    return redisClient;
};

const disconnectRedis = async () => {
    if (redisClient && redisClient.isOpen) {
        await redisClient.disconnect();
        console.log('🔴 Redis Client Disconnected');
    }
};

module.exports = {
    connectRedis,
    getRedisClient,
    disconnectRedis
};
