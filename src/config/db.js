const mongoose = require('mongoose');
const envConfig = require('./environment');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        
        const connectionOptions = {
            serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT) || 30000,
            socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT) || 45000,
            maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
            minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 1,
            maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME) || 30000,
            serverApi: { version: '1' }
        };

        // Add authentication if provided
        if (process.env.MONGO_USERNAME && process.env.MONGO_PASSWORD) {
            connectionOptions.auth = {
                username: process.env.MONGO_USERNAME,
                password: process.env.MONGO_PASSWORD
            };
        }

        // Add SSL options if provided
        if (process.env.MONGO_SSL === 'true') {
            connectionOptions.ssl = true;
            if (process.env.MONGO_SSL_VALIDATE === 'false') {
                connectionOptions.sslValidate = false;
            }
        }

        await mongoose.connect(mongoUri, connectionOptions);
        console.log('✅ MongoDB connected successfully');
        console.log(`🗄️  Database: ${mongoUri.includes('localhost') ? 'Local MongoDB' : 'Cloud MongoDB'}`);
        console.log(`🌍 Environment: ${envConfig.env} (${envConfig.isLocal ? 'Local' : envConfig.isProduction ? 'Production' : 'Development'})`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Don't exit in development, just log the error
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
}

module.exports = connectDB;
