class ApiError extends Error {
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

const errorHandler = (err, req, res, next) => {
    let { statusCode = 500, message } = err;

    // Handle specific database errors
    if (err.code === 'ER_NO_SUCH_TABLE') {
        statusCode = 503;
        message = 'Database table not found - database may not be properly initialized';
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        message = 'Database connection refused';
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        statusCode = 503;
        message = 'Database access denied - check credentials';
    }

    // Log error details for debugging
    if (statusCode >= 500) {
        console.error('❌ Server Error:', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            body: req.body,
            query: req.query,
            params: req.params
        });
    } else {
        console.warn('⚠️  Client Error:', {
            message: err.message,
            url: req.originalUrl,
            method: req.method,
            statusCode
        });
    }

    const errorResponse = {
        error: message,
        status: statusCode,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    ApiError,
    errorHandler,
    asyncHandler
};