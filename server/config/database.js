const mysql = require('mysql2/promise');

class Database {
    constructor() {
        this.pool = null;
    }

    async initialize() {
        const config = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            charset: 'utf8mb4',
            connectionLimit: 10,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true
        };

        try {
            console.log('🚀 Connecting to MariaDB database...');
            this.pool = mysql.createPool(config);
            
            // Test connection and get counts
            const connection = await this.pool.getConnection();
            const [lawsResult] = await connection.execute('SELECT COUNT(*) as count FROM laws');
            const [articlesResult] = await connection.execute('SELECT COUNT(*) as count FROM articles');
            const [interpretationsResult] = await connection.execute('SELECT COUNT(*) as count FROM interpretations');
            connection.release();
            
            console.log(`✅ Connected to database successfully`);
            console.log(`📚 Available data:`);
            console.log(`  • ${lawsResult[0].count} laws`);
            console.log(`  • ${articlesResult[0].count} articles`);
            console.log(`  • ${interpretationsResult[0].count} constitutional interpretations`);
            
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
    }

    async query(sql, params = []) {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        return await this.pool.execute(sql, params);
    }

    async getConnection() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        return await this.pool.getConnection();
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }

    isConnected() {
        return this.pool !== null;
    }
}

module.exports = new Database();