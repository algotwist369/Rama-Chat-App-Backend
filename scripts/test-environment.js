#!/usr/bin/env node

/**
 * Test Environment Configuration
 * Run this script to test environment detection and configuration
 */

const envConfig = require('../src/config/environment');

console.log('🧪 Testing Environment Configuration...\n');

// Test environment detection
console.log('🔍 Environment Detection:');
console.log(`  Environment: ${envConfig.env}`);
console.log(`  Is Production: ${envConfig.isProduction}`);
console.log(`  Is Development: ${envConfig.isDevelopment}`);
console.log(`  Is Local: ${envConfig.isLocal}`);

// Test configuration loading
console.log('\n📋 Loaded Configuration:');
const info = envConfig.getEnvironmentInfo();
Object.entries(info).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
});

// Test environment-specific settings
console.log('\n⚙️  Environment-Specific Settings:');
console.log(`  API URL: ${process.env.API_URL}`);
console.log(`  Frontend URL: ${process.env.FRONTEND_URL}`);
console.log(`  Database: ${process.env.MONGO_URI ? 'Configured' : 'Not configured'}`);
console.log(`  JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Not configured'}`);
console.log(`  CORS Origins: ${process.env.CORS_ORIGINS}`);
console.log(`  Socket Origins: ${process.env.SOCKET_CORS_ORIGINS}`);
console.log(`  Use Redis: ${process.env.USE_REDIS}`);
console.log(`  Log Level: ${process.env.LOG_LEVEL}`);

// Test environment file detection
console.log('\n📁 Environment Files:');
const fs = require('fs');
const path = require('path');

const envFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production'
];

envFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);
    console.log(`  ${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

console.log('\n🎯 Environment Summary:');
if (envConfig.isLocal) {
    console.log('  🏠 Running in LOCAL mode - Using local database and relaxed security');
} else if (envConfig.isProduction) {
    console.log('  🚀 Running in PRODUCTION mode - Using cloud database and strict security');
} else {
    console.log('  🔧 Running in DEVELOPMENT mode - Using development settings');
}

console.log('\n✅ Environment test completed!');
