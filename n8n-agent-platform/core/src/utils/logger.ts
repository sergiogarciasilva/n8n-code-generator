import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || 'logs';

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'n8n-agent-platform' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: fileFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        // File transport for errors
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ],
    
    // Handle exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log'),
            format: fileFormat
        })
    ],
    
    // Handle rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log'),
            format: fileFormat
        })
    ]
});

// Add custom log levels if needed
winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
});

// Export additional logging utilities
export const logPerformance = (operation: string, startTime: number, metadata?: any) => {
    const duration = Date.now() - startTime;
    logger.info(`Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...metadata
    });
};

export const logAgentActivity = (agentId: string, activity: string, metadata?: any) => {
    logger.info(`Agent Activity: ${activity}`, {
        agentId,
        ...metadata
    });
};

export const logWorkflowChange = (workflowId: string, change: string, metadata?: any) => {
    logger.info(`Workflow Change: ${change}`, {
        workflowId,
        ...metadata
    });
};

export const logAPICall = (endpoint: string, method: string, statusCode: number, duration: number) => {
    logger.info('API Call', {
        endpoint,
        method,
        statusCode,
        duration: `${duration}ms`
    });
};

export const logError = (error: Error, context?: string, metadata?: any) => {
    logger.error(`Error${context ? ` in ${context}` : ''}`, {
        message: error.message,
        stack: error.stack,
        ...metadata
    });
};

// Create a child logger for specific modules
export const createModuleLogger = (moduleName: string) => {
    return logger.child({ module: moduleName });
};