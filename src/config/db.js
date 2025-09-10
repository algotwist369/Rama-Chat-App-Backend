const mongoose = require('mongoose');
 
require("dotenv").config();

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rama-chat-app';
        await mongoose.connect(mongoUri);
        console.log('MongoDB connected to:', mongoUri);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Don't exit in development, just log the error
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
}

module.exports = connectDB;
