const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const messageRoutes = require('./routes/messageRoutes');
const fileRoutes = require('./routes/fileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling
app.use((error, req, res, next) => {
    console.error(error.stack);
    res.status(500).json({
        error: process.env.NODE_ENV === 'development'
            ? 'Internal server error'
            : error.message
    });
});

// 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
