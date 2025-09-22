const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

class Database {
    constructor() {
        this.pool = null;
    }

    async initialize() {
        const config = {
            server: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            }
        };

        try {
            console.log('🚀 Connecting to SQL Server database...');
            this.pool = new sql.ConnectionPool(config);
            await this.pool.connect();
            
            // Check if tables exist, if not create them
            await this.ensureTablesExist();

            // Test connection and get counts
            const lawsResult = await this.pool.request().query('SELECT COUNT(*) as count FROM Law');
            const articlesResult = await this.pool.request().query('SELECT COUNT(*) as count FROM LawArticle');
            const captionsResult = await this.pool.request().query('SELECT COUNT(*) as count FROM LawCaption');

            console.log(`✅ Connected to database successfully`);
            console.log(`📚 Available data:`);
            console.log(`  • ${lawsResult.recordset[0].count} laws`);
            console.log(`  • ${articlesResult.recordset[0].count} articles`);
            console.log(`  • ${captionsResult.recordset[0].count} captions`);
            
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
    }

    async ensureTablesExist() {
        try {
            // Check if Law table exists
            const tablesResult = await this.pool.request().query(`
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_CATALOG = '${process.env.DB_DATABASE}' AND TABLE_NAME = 'Law'
            `);

            if (tablesResult.recordset[0].count === 0) {
                console.log('📋 Tables not found, creating database schema...');

                // Read and execute schema file
                const schemaPath = path.join(__dirname, 'schema.sql');
                const schema = await fs.readFile(schemaPath, 'utf8');

                // Split schema into individual statements and execute them
                const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

                for (const statement of statements) {
                    if (statement.trim()) {
                        await this.pool.request().query(statement.trim());
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

    async query(sqlQuery, params = []) {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        const request = this.pool.request();

        // Add parameters if provided
        if (params.length > 0) {
            params.forEach((param, index) => {
                request.input(`param${index}`, param);
            });
        }

        return await request.query(sqlQuery);
    }

    getRequest() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        return this.pool.request();
    }

    async close() {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }

    isConnected() {
        return this.pool !== null;
    }
}

module.exports = new Database();