const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Import configuration and utilities
const { validateEnvironment, config } = require('./config/env');
const database = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const ProcessManager = require('./utils/processManager');

// Import routes
const healthRoutes = require('./routes/health');
const caseRoutes = require('./routes/cases');
const lawRoutes = require('./routes/laws');
const debugRoutes = require('./routes/debug');
const pdfRoutes = require('./routes/pdf');

// Validate environment variables before starting
validateEnvironment();

const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CiteRight Taiwan Legal API',
      version: '1.0.0',
      description: 'Professional Taiwan Legal Case Citation Explorer using Official Judicial Yuan API',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
  },
  apis: [
    './server/routes/*.js'  // Updated to scan route files
  ],
};

const specs = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from extension directory
app.use('/extension', express.static(path.join(__dirname, '../extension')));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/health', healthRoutes);
app.use('/api/case', caseRoutes);
app.use('/api/laws', lawRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/pdf', pdfRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /api/case?caseType=釋字&number=712',
            'GET /api/laws/search?q=民法',
            'GET /api/laws/{lawLevel}/{lawName}',
            'GET /api/debug',
            'POST /api/pdf/process',
            'POST /api/pdf/process-url',
            'GET /api/pdf/health',
            'GET /api-docs'
        ]
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

async function startServer() {
    try {
        console.log('🚀 Starting CiteRight Taiwan Legal API Server...');
        
        // Kill any existing processes on the port
        await ProcessManager.killProcessOnPort(config.port);
        
        // Initialize database
        const dbConnected = await database.initialize();
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Server will not start.');
            process.exit(1);
        }
        
        // Start server
        const server = app.listen(config.port, () => {
            console.log(`✅ Server running on http://localhost:${config.port}`);
            console.log('🔗 Available endpoints:');
            console.log(`  📖 API Documentation: http://localhost:${config.port}/api-docs`);
            console.log(`  🤖 AI Legal Interface: http://localhost:${config.port}/extension/pages/ai-legal-interface.html`);
            console.log(`  📊 Health: http://localhost:${config.port}/health`);
            console.log(`  🔍 Debug: http://localhost:${config.port}/api/debug`);
            console.log(`  ⚖️ Constitutional interpretation: http://localhost:${config.port}/api/case?caseType=釋字&number=712`);
            console.log(`  📖 Search laws: http://localhost:${config.port}/api/laws/search?q=民法`);
            console.log(`  📑 Law details: http://localhost:${config.port}/api/laws/法律/民法`);
            console.log(`  📄 PDF processing: http://localhost:${config.port}/api/pdf/health`);
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${config.port} is still in use after cleanup attempt`);
                console.error('Please manually kill the process or restart your system');
            } else {
                console.error('❌ Server error:', err.message);
            }
            process.exit(1);
        });
        
        // Setup graceful shutdown
        ProcessManager.setupGracefulShutdown(server, database);
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();