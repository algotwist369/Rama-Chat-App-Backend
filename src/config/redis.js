require('dotenv').config();

// Mock Redis for development - replace with real Redis in production
const redis = {
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
    }
};

module.exports = redis;
