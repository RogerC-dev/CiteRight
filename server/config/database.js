/**
 * Database Configuration - MS SQL Connection
 * Connects to MS SQL Server using mssql package
 */
const sql = require('mssql');

// Connection configuration from environment variables
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false, // Use true for Azure
        trustServerCertificate: true, // For local dev
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Connection pool
let pool = null;
let connected = false;

/**
 * Initialize database connection
 * @returns {Promise<boolean>} True if connected successfully
 */
async function initialize() {
    try {
        console.log(`🔌 Connecting to MS SQL Server at ${config.server}:${config.port}...`);
        pool = await sql.connect(config);
        connected = true;
        console.log(`✅ Connected to database: ${config.database}`);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        connected = false;
        return false;
    }
}

/**
 * Check if database is connected
 * @returns {boolean}
 */
function isConnected() {
    return connected && pool && pool.connected;
}

/**
 * Execute a SQL query with parameters
 * @param {string} queryString - SQL query string with @param0, @param1, etc.
 * @param {Array} params - Array of parameter values
 * @returns {Promise<{recordset: Array}>}
 */
async function query(queryString, params = []) {
    if (!isConnected()) {
        throw new Error('Database not connected');
    }

    try {
        const request = pool.request();

        // Add parameters
        params.forEach((value, index) => {
            request.input(`param${index}`, value);
        });

        const result = await request.query(queryString);
        return result;
    } catch (error) {
        console.error('❌ Query error:', error.message);
        throw error;
    }
}

/**
 * Get a raw request object for stored procedure calls
 * @returns {sql.Request|null}
 */
function getRequest() {
    if (!isConnected()) {
        return null;
    }
    return pool.request();
}

/**
 * Close database connection
 */
async function close() {
    if (pool) {
        try {
            await pool.close();
            connected = false;
            console.log('🔌 Database connection closed');
        } catch (error) {
            console.error('Error closing database:', error.message);
        }
    }
}

module.exports = {
    initialize,
    isConnected,
    query,
    getRequest,
    close
};
