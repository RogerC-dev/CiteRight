const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ProcessManager {
    static async killProcessOnPort(port) {
        try {
            console.log(`🔍 Checking for existing processes on port ${port}...`);
            
            if (process.platform === 'win32') {
                await this._killProcessOnPortWindows(port);
            } else {
                await this._killProcessOnPortUnix(port);
            }
            
            // Wait a moment for processes to fully terminate
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`🔍 No existing processes found on port ${port} or error checking`);
        }
    }

    static async _killProcessOnPortWindows(port) {
        const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
        if (stdout.trim()) {
            const lines = stdout.trim().split('\n');
            const pids = new Set();
            
            for (const line of lines) {
                if (line.includes('LISTENING')) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && pid !== '0') {
                        pids.add(pid);
                    }
                }
            }
            
            // Kill all processes using the port
            for (const pid of pids) {
                try {
                    await execPromise(`taskkill /PID ${pid} /F`);
                    console.log(`🔪 Killed process ${pid} using port ${port}`);
                } catch (e) {
                    // Process might already be dead, ignore
                }
            }
        }
    }

    static async _killProcessOnPortUnix(port) {
        try {
            // Find process using the port
            const { stdout } = await execPromise(`lsof -ti:${port}`);
            if (stdout.trim()) {
                const pids = stdout.trim().split('\n');
                
                for (const pid of pids) {
                    if (pid) {
                        try {
                            await execPromise(`kill -9 ${pid}`);
                            console.log(`🔪 Killed process ${pid} using port ${port}`);
                        } catch (e) {
                            // Process might already be dead, ignore
                        }
                    }
                }
            }
        } catch (error) {
            // Try alternative method with netstat
            try {
                const { stdout } = await execPromise(`netstat -tlnp | grep :${port}`);
                if (stdout.trim()) {
                    const lines = stdout.trim().split('\n');
                    for (const line of lines) {
                        const pidMatch = line.match(/(\d+)\//);
                        if (pidMatch) {
                            const pid = pidMatch[1];
                            try {
                                await execPromise(`kill -9 ${pid}`);
                                console.log(`🔪 Killed process ${pid} using port ${port}`);
                            } catch (e) {
                                // Process might already be dead, ignore
                            }
                        }
                    }
                }
            } catch (e) {
                // No processes found
            }
        }
    }

    static setupGracefulShutdown(server, database) {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
            
            try {
                // Close server
                if (server) {
                    await new Promise((resolve) => {
                        server.close(() => {
                            console.log('✅ HTTP server closed');
                            resolve();
                        });
                    });
                }
                
                // Close database connections
                if (database) {
                    await database.close();
                    console.log('✅ Database connections closed');
                }
                
                console.log('✅ Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        // Handle various shutdown signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        // Handle Windows specific signals
        if (process.platform === 'win32') {
            process.on('SIGBREAK', () => shutdown('SIGBREAK'));
        }
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }
}

module.exports = ProcessManager;