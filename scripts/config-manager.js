#!/usr/bin/env node

/**
 * RAMA Chat App - Configuration Manager
 * 
 * This script helps manage environment configurations
 * Usage: node scripts/config-manager.js [command] [options]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ConfigManager {
    constructor() {
        this.configDir = path.join(__dirname, '..');
        this.envFile = path.join(this.configDir, '.env');
        this.exampleFile = path.join(this.configDir, 'env.example');
    }

    // Generate a secure JWT secret
    generateJWTSecret() {
        return crypto.randomBytes(64).toString('base64');
    }

    // Create environment file from template
    createEnvFile(environment = 'development') {
        if (!fs.existsSync(this.exampleFile)) {
            console.error('❌ env.example file not found!');
            return false;
        }

        const template = fs.readFileSync(this.exampleFile, 'utf8');
        let envContent = template;

        // Replace placeholders based on environment
        if (environment === 'production') {
            envContent = envContent
                .replace(/NODE_ENV=development/g, 'NODE_ENV=production')
                .replace(/JWT_SECRET=your_super_secure_jwt_secret_key_here_change_this_in_production/g, `JWT_SECRET=${this.generateJWTSecret()}`)
                .replace(/API_URL=http:\/\/localhost:5000/g, 'API_URL=https://your-domain.com')
                .replace(/FRONTEND_URL=http:\/\/localhost:5173/g, 'FRONTEND_URL=https://your-frontend-domain.com');
        } else {
            envContent = envContent
                .replace(/JWT_SECRET=your_super_secure_jwt_secret_key_here_change_this_in_production/g, `JWT_SECRET=${this.generateJWTSecret()}`);
        }

        fs.writeFileSync(this.envFile, envContent);
        console.log(`✅ Created .env file for ${environment} environment`);
        return true;
    }

    // Validate environment configuration
    validateConfig() {
        if (!fs.existsSync(this.envFile)) {
            console.error('❌ .env file not found!');
            return false;
        }

        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const requiredVars = [
            'NODE_ENV',
            'PORT',
            'MONGO_URI',
            'JWT_SECRET',
            'API_URL',
            'FRONTEND_URL'
        ];

        const missingVars = [];
        requiredVars.forEach(varName => {
            // Check for active (non-commented) variable assignments
            const lines = envContent.split('\n');
            let found = false;
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith(`${varName}=`) && !trimmedLine.startsWith('#')) {
                    const value = trimmedLine.split('=')[1];
                    if (value && !value.includes('your_') && value !== 'your_super_secure_jwt_secret_key_here_change_this_in_production') {
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                missingVars.push(varName);
            }
        });

        if (missingVars.length > 0) {
            console.error('❌ Missing or invalid environment variables:');
            missingVars.forEach(varName => {
                console.error(`   - ${varName}`);
            });
            return false;
        }

        console.log('✅ Environment configuration is valid');
        return true;
    }

    // Show current configuration (without sensitive data)
    showConfig() {
        if (!fs.existsSync(this.envFile)) {
            console.error('❌ .env file not found!');
            return;
        }

        const envContent = fs.readFileSync(this.envFile, 'utf8');
        const lines = envContent.split('\n');
        
        console.log('📋 Current Environment Configuration:');
        console.log('=====================================');
        
        lines.forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                    // Hide sensitive information
                    if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
                        console.log(`${key}=***HIDDEN***`);
                    } else {
                        console.log(`${key}=${value}`);
                    }
                }
            }
        });
    }

    // Update specific environment variable
    updateVar(key, value) {
        if (!fs.existsSync(this.envFile)) {
            console.error('❌ .env file not found!');
            return false;
        }

        let envContent = fs.readFileSync(this.envFile, 'utf8');
        const lines = envContent.split('\n');
        let updated = false;

        const newLines = lines.map(line => {
            if (line.startsWith(`${key}=`)) {
                updated = true;
                return `${key}=${value}`;
            }
            return line;
        });

        if (!updated) {
            newLines.push(`${key}=${value}`);
        }

        fs.writeFileSync(this.envFile, newLines.join('\n'));
        console.log(`✅ Updated ${key}=${value}`);
        return true;
    }

    // Show help
    showHelp() {
        console.log(`
🔧 RAMA Chat App - Configuration Manager

Usage: node scripts/config-manager.js [command] [options]

Commands:
  init [env]     Create .env file from template (env: development|production)
  validate       Validate current environment configuration
  show           Show current configuration (sensitive data hidden)
  update <key> <value>  Update specific environment variable
  help           Show this help message

Examples:
  node scripts/config-manager.js init development
  node scripts/config-manager.js init production
  node scripts/config-manager.js validate
  node scripts/config-manager.js show
  node scripts/config-manager.js update API_URL https://api.example.com
  node scripts/config-manager.js update JWT_SECRET $(openssl rand -base64 32)
        `);
    }
}

// Main execution
const configManager = new ConfigManager();
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
    case 'init':
        const env = arg1 || 'development';
        configManager.createEnvFile(env);
        break;
    
    case 'validate':
        configManager.validateConfig();
        break;
    
    case 'show':
        configManager.showConfig();
        break;
    
    case 'update':
        if (!arg1 || !arg2) {
            console.error('❌ Usage: node scripts/config-manager.js update <key> <value>');
            process.exit(1);
        }
        configManager.updateVar(arg1, arg2);
        break;
    
    case 'help':
    case '--help':
    case '-h':
        configManager.showHelp();
        break;
    
    default:
        console.error('❌ Unknown command. Use "help" to see available commands.');
        configManager.showHelp();
        process.exit(1);
}
