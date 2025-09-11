# Automatic Environment Detection Guide

## 🎯 Overview

Your RAMA Chat App now automatically detects the environment and loads the appropriate configuration without any manual setup! The system intelligently switches between development and production settings based on where and how you run the application.

## 🚀 How It Works

### Automatic Environment Detection

The system automatically detects your environment using these indicators:

#### 🏠 **Local Development Mode**
- Running from your Desktop/Documents folder
- Username is 'ankit'
- Default port (5000) and localhost
- `NODE_ENV=development` or not set

#### 🚀 **Production Mode**
- `NODE_ENV=production` is explicitly set
- Running on a server (not local machine)
- Production URLs configured

#### 🔧 **Development Mode**
- `NODE_ENV=development` is set
- Running in a development environment

## 📁 Environment Files

The system loads configuration in this priority order:

1. **`.env`** - Base configuration (always loaded)
2. **`.env.local`** - Local machine overrides (highest priority for local)
3. **`.env.development`** - Development environment settings
4. **`.env.production`** - Production environment settings

## 🎮 Usage Examples

### Local Development (Automatic)
```bash
# Just run normally - automatically detects local environment
npm start
# or
npm run dev
```

### Force Development Mode
```bash
npm run start:local
# or
NODE_ENV=development npm start
```

### Force Production Mode
```bash
npm run start:prod
# or
NODE_ENV=production npm start
```

### Test Environment Detection
```bash
# Test current environment
npm run env:test

# Test specific environments
npm run env:local
npm run env:prod
```

## ⚙️ Environment-Specific Configurations

### 🏠 Local Development (Automatic)
```javascript
// Automatically configured when running locally
{
  NODE_ENV: 'development',
  PORT: 5000,
  HOST: 'localhost',
  API_URL: 'http://localhost:5000',
  FRONTEND_URL: 'http://localhost:5173',
  MONGO_URI: 'mongodb://localhost:27017/rama-chat-app-dev',
  JWT_SECRET: 'local-development-secret',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:3000',
  LOG_LEVEL: 'debug',
  BCRYPT_ROUNDS: 8,
  USE_REDIS: false
}
```

### 🚀 Production (Automatic)
```javascript
// Automatically configured when NODE_ENV=production
{
  NODE_ENV: 'production',
  PORT: 5000,
  HOST: '0.0.0.0',
  API_URL: 'https://chat.api.d0s369.co.in',
  FRONTEND_URL: 'https://rama.ciphra.in',
  MONGO_URI: 'mongodb+srv://username:password@cluster.mongodb.net/rama-chat-app',
  JWT_SECRET: 'CHANGE-THIS-TO-A-SECURE-SECRET-IN-PRODUCTION',
  CORS_ORIGINS: 'https://rama.ciphra.in',
  LOG_LEVEL: 'warn',
  BCRYPT_ROUNDS: 12,
  USE_REDIS: true
}
```

## 🔧 Configuration Files

### Create Environment-Specific Files (Optional)

If you want to customize specific environments, create these files:

#### `.env.local` (Local Machine Overrides)
```env
# Override any setting for your local machine
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/rama-chat-app-local
JWT_SECRET=my-local-secret
LOG_LEVEL=debug
```

#### `.env.development` (Development Team)
```env
# Settings for development environment
API_URL=http://dev-api.example.com
FRONTEND_URL=http://dev.example.com
MONGO_URI=mongodb://dev-db:27017/rama-chat-app-dev
```

#### `.env.production` (Production Server)
```env
# Production settings
API_URL=https://chat.api.d0s369.co.in
FRONTEND_URL=https://rama.ciphra.in
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/rama-chat-app
JWT_SECRET=your-super-secure-production-secret
USE_REDIS=true
```

## 🎯 Smart Defaults

The system provides intelligent defaults based on environment:

### Security Settings
- **Local**: Relaxed security (faster development)
- **Production**: Strict security (secure by default)

### Database Settings
- **Local**: Local MongoDB with relaxed timeouts
- **Production**: Cloud MongoDB with optimized connection pooling

### CORS Settings
- **Local**: Permissive CORS (allows localhost)
- **Production**: Strict CORS (only production domains)

### Logging
- **Local**: Verbose logging (debug level)
- **Production**: Minimal logging (warn level)

## 🚀 Deployment Scenarios

### Local Development
```bash
# Just run - automatically detects local environment
npm start
# Output: 🏠 Running in LOCAL development mode
```

### AWS EC2 Deployment
```bash
# Set production environment
export NODE_ENV=production
npm start
# Output: 🚀 Running in PRODUCTION mode
```

### Docker Deployment
```dockerfile
# Dockerfile
ENV NODE_ENV=production
CMD ["npm", "start"]
```

### PM2 Deployment
```bash
# PM2 ecosystem file
{
  "apps": [{
    "name": "rama-chat-backend",
    "script": "src/server.js",
    "env": {
      "NODE_ENV": "production"
    }
  }]
}
```

## 🔍 Environment Detection Logic

```javascript
// The system detects environment using:
const isLocal = [
  process.env.NODE_ENV === 'development',
  process.env.USER === 'ankit',
  process.cwd().includes('Desktop'),
  process.env.PORT === '5000'
].some(condition => condition);

const isProduction = process.env.NODE_ENV === 'production';
```

## 🛠️ Customization

### Override Environment Detection
```bash
# Force local mode even on server
LOCAL_DEVELOPMENT=true npm start

# Force production mode even locally
NODE_ENV=production npm start
```

### Custom Environment Files
```bash
# Create custom environment file
cp env.development .env.staging

# Load custom environment
NODE_ENV=staging npm start
```

## 📊 Environment Information

The system provides detailed environment information:

```bash
npm run env:test
```

Output:
```
🌍 Environment Information:
============================
Environment: development
Mode: 🏠 Development
Local: ✅ Yes
Port: 5000
Host: localhost
API URL: http://localhost:5000
Frontend URL: http://localhost:5173
Database: configured
JWT Secret: configured
============================
```

## 🎉 Benefits

1. **🔄 Zero Configuration**: Works out of the box
2. **🎯 Smart Detection**: Automatically detects environment
3. **🔒 Secure Defaults**: Production-ready security
4. **🏠 Developer Friendly**: Optimized for local development
5. **📁 Flexible**: Easy to override with custom files
6. **🚀 Production Ready**: Optimized for deployment

## 🚨 Important Notes

### Security
- **Local**: Uses less secure defaults for faster development
- **Production**: Uses secure defaults - always change JWT_SECRET!

### Database
- **Local**: Connects to local MongoDB
- **Production**: Expects cloud MongoDB (MongoDB Atlas)

### URLs
- **Local**: Uses localhost URLs
- **Production**: Uses your production domains

## 🎯 Quick Start

1. **Local Development**: Just run `npm start` - everything is automatic!
2. **Production**: Set `NODE_ENV=production` and run `npm start`
3. **Custom**: Create `.env.local` or `.env.production` files to override

**That's it! Your app automatically adapts to any environment! 🎉**
