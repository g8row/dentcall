/**
 * Simple logging utility with environment-aware log levels.
 * 
 * In production, only warnings and errors are logged.
 * In development, all log levels are enabled.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// In production, default to 'warn' level (only warn and error)
// In development, default to 'debug' (all logs)
const currentLevel = process.env.LOG_LEVEL as LogLevel ||
    (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(prefix: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${prefix}] ${message}`;
}

export const logger = {
    /**
     * Debug logs - development only, stripped in production
     */
    debug(prefix: string, message: string, ...args: unknown[]): void {
        if (shouldLog('debug')) {
            console.log(formatMessage(prefix, message), ...args);
        }
    },

    /**
     * Info logs - general information, shown in development
     */
    info(prefix: string, message: string, ...args: unknown[]): void {
        if (shouldLog('info')) {
            console.log(formatMessage(prefix, message), ...args);
        }
    },

    /**
     * Warning logs - always shown
     */
    warn(prefix: string, message: string, ...args: unknown[]): void {
        if (shouldLog('warn')) {
            console.warn(formatMessage(prefix, message), ...args);
        }
    },

    /**
     * Error logs - always shown
     */
    error(prefix: string, message: string, error?: unknown): void {
        if (shouldLog('error')) {
            console.error(formatMessage(prefix, message), error || '');
        }
    },

    /**
     * Migration logs - only on first run, use info level
     */
    migration(message: string): void {
        if (shouldLog('info')) {
            console.log(`[Migration] ${message}`);
        }
    },

    /**
     * Scheduler logs - background tasks
     */
    scheduler(message: string, ...args: unknown[]): void {
        if (shouldLog('info')) {
            console.log(`[Scheduler] ${message}`, ...args);
        }
    },
};

export default logger;
