const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

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
            reconnect: true,
            multipleStatements: true
        };

        try {
            console.log('🚀 Connecting to MariaDB database...');
            this.pool = mysql.createPool(config);
            
            // Test basic connection first
            const connection = await this.pool.getConnection();

            // Check if tables exist, if not create them
            await this.ensureTablesExist(connection);

            // Test connection and get counts
            const [lawsResult] = await connection.execute('SELECT COUNT(*) as count FROM Law');
            const [articlesResult] = await connection.execute('SELECT COUNT(*) as count FROM LawArticle');
            const [captionsResult] = await connection.execute('SELECT COUNT(*) as count FROM LawCaption');
            connection.release();
            
            console.log(`✅ Connected to database successfully`);
            console.log(`📚 Available data:`);
            console.log(`  • ${lawsResult[0].count} laws`);
            console.log(`  • ${articlesResult[0].count} articles`);
            console.log(`  • ${captionsResult[0].count} captions`);
            
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
    }

    async ensureTablesExist(connection) {
        try {
            // Check if Law table exists
            const [tables] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = ? AND table_name = 'Law'
            `, [process.env.DB_DATABASE]);

            if (tables[0].count === 0) {
                console.log('📋 Tables not found, creating database schema...');

                // Read and execute schema file
                const schemaPath = path.join(__dirname, 'schema.sql');
                const schema = await fs.readFile(schemaPath, 'utf8');

                // Split schema into individual statements and execute them
                const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

                for (const statement of statements) {
                    if (statement.trim()) {
                        await connection.execute(statement.trim());
                    }
                }

                console.log('✅ Database schema created successfully');
            } else {
                console.log('✅ Database tables already exist');
            }
        } catch (error) {
            console.error('❌ Error ensuring tables exist:', error.message);
            throw error;
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