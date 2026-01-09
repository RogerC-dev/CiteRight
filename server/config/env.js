const path = require('path');

// Load .env from server directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT', 
    'DB_USER',
    'DB_PASSWORD',
    'DB_DATABASE'
];

function validateEnvironment() {
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(varName => {
            console.error(`  • ${varName}`);
        });
        console.error('\nPlease create a .env file with these variables or set them in your environment.');
        process.exit(1);
    }
    
    console.log('✅ Environment configuration validated');
}

const config = {
    port: process.env.PORT || 3000,
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    }
};

module.exports = {
    validateEnvironment,
    config
};