# Environment Configuration Guide

This guide explains how to configure your RAMA Chat App backend using environment variables. All configuration is now centralized in the `.env` file, making it easy to manage different environments.

## Quick Start

### 1. Create Environment File
```bash
# For development
npm run config:init

# For production
npm run config:init:prod
```

### 2. Validate Configuration
```bash
npm run config:validate
```

### 3. View Current Configuration
```bash
npm run config:show
```

## Environment Variables Reference

### Application Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (development/production) |
| `PORT` | `5000` | Server port |
| `HOST` | `0.0.0.0` | Server host |

### API Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:5000` | Backend API base URL |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |

### Database Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017/rama-chat-app` | MongoDB connection string |
| `MONGO_SERVER_SELECTION_TIMEOUT` | `30000` | MongoDB server selection timeout (ms) |
| `MONGO_SOCKET_TIMEOUT` | `45000` | MongoDB socket timeout (ms) |
| `MONGO_MAX_POOL_SIZE` | `10` | Maximum connection pool size |
| `MONGO_MIN_POOL_SIZE` | `1` | Minimum connection pool size |
| `MONGO_MAX_IDLE_TIME` | `30000` | Maximum idle time (ms) |
| `MONGO_SSL` | `false` | Enable SSL for MongoDB |
| `MONGO_SSL_VALIDATE` | `true` | Validate SSL certificates |

### JWT Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `generated` | JWT signing secret (auto-generated) |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration time |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiration time |

### CORS Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `https://rama.ciphra.in,http://localhost:5173` | Allowed origins (comma-separated) |
| `CORS_CREDENTIALS` | `true` | Allow credentials |
| `CORS_METHODS` | `GET,POST,PUT,PATCH,DELETE,OPTIONS` | Allowed HTTP methods |
| `CORS_HEADERS` | `Content-Type,Authorization` | Allowed headers |

### Socket.io Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SOCKET_CORS_ORIGINS` | `https://rama.ciphra.in,http://localhost:5173` | Socket.io allowed origins |
| `SOCKET_CORS_CREDENTIALS` | `true` | Socket.io allow credentials |
| `SOCKET_TRANSPORTS` | `polling,websocket` | Socket.io transports |
| `SOCKET_PING_TIMEOUT` | `60000` | Socket.io ping timeout (ms) |
| `SOCKET_PING_INTERVAL` | `25000` | Socket.io ping interval (ms) |
| `SOCKET_MAX_HTTP_BUFFER_SIZE` | `1000000` | Max HTTP buffer size |

### File Upload Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `FILE_BASE_URL` | `http://localhost:5000` | Base URL for file access |
| `UPLOAD_PATH` | `/uploads/chat-files` | Upload directory path |
| `MAX_FILE_SIZE` | `10485760` | Maximum file size (bytes) |

### Redis Configuration (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `USE_REDIS` | `false` | Enable Redis for Socket.io |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | `` | Redis password |

## Configuration Management Commands

### Using npm scripts:
```bash
# Initialize environment file
npm run config:init              # Development
npm run config:init:prod         # Production

# Validate configuration
npm run config:validate

# Show current configuration
npm run config:show

# Update specific variable
npm run config:update API_URL https://api.example.com

# Show help
npm run config:help
```

### Using direct commands:
```bash
# Initialize environment file
node scripts/config-manager.js init development
node scripts/config-manager.js init production

# Validate configuration
node scripts/config-manager.js validate

# Show current configuration
node scripts/config-manager.js show

# Update specific variable
node scripts/config-manager.js update API_URL https://api.example.com
node scripts/config-manager.js update JWT_SECRET $(openssl rand -base64 32)

# Show help
node scripts/config-manager.js help
```

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/rama-chat-app
```

### Production
```bash
NODE_ENV=production
PORT=5000
API_URL=https://chat.api.d0s369.co.in
FRONTEND_URL=https://rama.ciphra.in
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/rama-chat-app
JWT_SECRET=your_secure_production_secret
```

### Staging
```bash
NODE_ENV=production
PORT=5000
API_URL=https://staging-api.example.com
FRONTEND_URL=https://staging.example.com
MONGO_URI=mongodb+srv://username:password@staging-cluster.mongodb.net/rama-chat-app-staging
```

## Security Best Practices

### 1. JWT Secret
- Use a strong, random secret
- Generate with: `openssl rand -base64 32`
- Never commit secrets to version control

### 2. Database Security
- Use authentication for production databases
- Enable SSL for cloud databases
- Use connection pooling for better performance

### 3. CORS Configuration
- Only allow necessary origins
- Use HTTPS in production
- Be specific with allowed methods and headers

### 4. File Uploads
- Set appropriate file size limits
- Validate file types
- Use secure file storage

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Failed**
   - Check `MONGO_URI` format
   - Verify database is running
   - Check network connectivity

2. **CORS Errors**
   - Verify `CORS_ORIGINS` includes your frontend URL
   - Check `CORS_CREDENTIALS` setting
   - Ensure frontend URL matches exactly

3. **Socket.io Connection Issues**
   - Check `SOCKET_CORS_ORIGINS`
   - Verify proxy configuration
   - Check transport settings

4. **JWT Errors**
   - Ensure `JWT_SECRET` is set
   - Check token expiration settings
   - Verify secret consistency

### Validation Commands:
```bash
# Check if all required variables are set
npm run config:validate

# View current configuration
npm run config:show

# Test database connection
npm start  # Check console output for connection status
```

## Migration from Hardcoded Values

If you're migrating from hardcoded values:

1. **Create environment file:**
   ```bash
   npm run config:init
   ```

2. **Update your values:**
   ```bash
   npm run config:update API_URL https://your-api.com
   npm run config:update FRONTEND_URL https://your-frontend.com
   ```

3. **Validate configuration:**
   ```bash
   npm run config:validate
   ```

4. **Test the application:**
   ```bash
   npm start
   ```

## Environment File Examples

### Minimal Development Setup
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/rama-chat-app
JWT_SECRET=your_development_secret
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

### Full Production Setup
```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

API_URL=https://chat.api.d0s369.co.in
FRONTEND_URL=https://rama.ciphra.in

MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/rama-chat-app
MONGO_SSL=true
MONGO_SSL_VALIDATE=true

JWT_SECRET=your_very_secure_production_secret_here
JWT_EXPIRES_IN=24h

CORS_ORIGINS=https://rama.ciphra.in
SOCKET_CORS_ORIGINS=https://rama.ciphra.in

FILE_BASE_URL=https://chat.api.d0s369.co.in
MAX_FILE_SIZE=10485760

USE_REDIS=true
REDIS_URL=redis://your-redis-host:6379
```

Now you can manage all your configuration from a single `.env` file! 🎉
